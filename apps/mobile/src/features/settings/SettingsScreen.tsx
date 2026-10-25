import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Platform, StyleSheet, Switch, View } from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import Constants from 'expo-constants'
import * as Haptics from 'expo-haptics'
import * as Updates from 'expo-updates'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listAdmins, listRecurring, revokeAdmin, updateEveningReminder, type Admin, type EveningReminder, type PackageType } from '@hellokido/core/api'
import { LANGUAGE_NAMES, LOCALES, type Locale } from '@hellokido/core/i18n'
import { rateText } from '@hellokido/core/view'
import { keys, useCatalog, useLabels, useRefresh } from '../../data/queries'
import { tasks } from '../../lib/navigation'
import { useAuth } from '../../providers/Auth'
import { useI18n } from '../../providers/I18n'
import { useTheme, type ThemeChoice } from '../../providers/Theme'
import { useColors } from '../../theme/colors'
import { initialsOf, ListSkeleton, LoadError, Mark } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Segmented } from '../../ui/Fields'
import { Icon, type IconName } from '../../ui/Icon'
import { Card, Row, Screen, Section } from '../../ui/Screen'
import { DOT, Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { CategoryTablet, IncomeTablet, methodName } from '../finance/bits'
import { SettingTitle } from './bits'

const isFree = (row: PackageType) => row.family === 'free'

// "ayse.yilmaz@…" gives "AY", the way the web panel's account button shows it
const initialsOfEmail = (email: string) => initialsOf((email.split('@')[0] ?? '').replace(/[._-]+/g, ' '))

/**
 * The few things set once and changed rarely, on one page: how the app looks on this phone, the
 * prices and names the forms use, card money, monthly expenses, categories, and who may sign in.
 */
export function SettingsScreen() {
  const { t } = useI18n()
  const client = useQueryClient()
  const refresh = useCallback(
    () =>
      Promise.all([
        client.invalidateQueries({ queryKey: keys.catalog }),
        client.invalidateQueries({ queryKey: keys.finance('recurring') }),
        client.invalidateQueries({ queryKey: keys.admins })
      ]),
    [client]
  )
  const copy = t.settings

  return (
    <Screen onRefresh={refresh}>
      <Section title={copy.appearance.title} description={copy.appearance.body}>
        <Appearance />
      </Section>
      <Section title={copy.packages.title} description={copy.packages.body}>
        <Packages />
      </Section>
      <Section title={copy.period.title} description={copy.period.body}>
        <MoneyPeriod />
      </Section>
      <Section title={copy.card.title} description={copy.card.body}>
        <CardMoney />
      </Section>
      <Section title={copy.monthly.title} description={copy.monthly.body}>
        <Monthly />
      </Section>
      <Section title={copy.categories.expenseTitle} description={copy.categories.expenseBody}>
        <Categories kind="expense" />
      </Section>
      <Section title={copy.categories.incomeTitle} description={copy.categories.incomeBody}>
        <Categories kind="income" />
      </Section>
      <Section title={t.messages.evening.setting.title} description={t.messages.evening.setting.body}>
        <EveningReminderSetting />
      </Section>
      <Section title={copy.access.title} description={copy.access.body}>
        <Access />
      </Section>
      <Section title={t.mobile.account}>
        <Account />
      </Section>
      <Section title={copy.about.title}>
        <About />
      </Section>
    </Screen>
  )
}

function AddButton({ label, icon = 'add', onPress }: { label: string; icon?: IconName; onPress: () => void }) {
  return (
    <Button variant="plain" size="sm" icon={icon} onPress={onPress} style={styles.add}>
      {label}
    </Button>
  )
}

/**
 * A value at the end of a row, in the quieter ink the phone's own settings use. It never takes more
 * than half the row, so the name beside it is not cut to a few letters.
 */
function Value({ children, strong, quiet }: { children: string; strong?: boolean; quiet?: boolean }) {
  return (
    <Text variant="sub" weight={strong ? '600' : '400'} tone={quiet ? 'ink3' : strong ? 'ink' : 'ink2'} tabular numberOfLines={1} style={styles.value}>
      {children}
    </Text>
  )
}

/** The name of a row that has a value at its end: a long one (English, Ukrainian) wraps instead of being cut. */
function Label({ children }: { children: string }) {
  return (
    <Text variant="body" numberOfLines={2}>
      {children}
    </Text>
  )
}

/** An email cut in the middle, so both the name and the domain stay readable. */
function Email({ children }: { children: string }) {
  return (
    <Text variant="body" numberOfLines={1} ellipsizeMode="middle">
      {children}
    </Text>
  )
}

function Appearance() {
  const { t, locale, setLocale } = useI18n()
  const { choice, setChoice } = useTheme()
  return (
    <View style={styles.appearance}>
      <Segmented<ThemeChoice>
        label={t.settings.appearance.theme}
        value={choice}
        onChange={setChoice}
        options={[
          { id: 'light', label: t.shell.account.themeLight },
          { id: 'dark', label: t.shell.account.themeDark },
          { id: 'system', label: t.shell.account.themeSystem }
        ]}
      />
      <Segmented<Locale> label={t.shell.account.language} value={locale} onChange={setLocale} options={LOCALES.map((id) => ({ id, label: LANGUAGE_NAMES[id] }))} />
    </View>
  )
}

function Packages() {
  const { t, plural, money } = useI18n()
  const labels = useLabels()
  const catalog = useCatalog()

  if (catalog.isError) return <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void catalog.refetch()} />
  if (!catalog.data) return <ListSkeleton rows={4} />

  const lessonsOf = (row: PackageType, name: string) => {
    if (isFree(row)) return t.children.form.noQuota
    // "3 aylık - 12 atölye" already says how many lessons it has
    if (!row.lessons || new RegExp(`(^|\\D)${row.lessons}(\\D|$)`).test(name)) return undefined
    return plural(t.children.form.lessons, row.lessons)
  }

  return (
    <Card>
      {catalog.data.packages.map((row) => {
        const name = labels.packageName(row.code)
        return (
          <Row
            key={row.code}
            title={<SettingTitle mark={!row.is_active && t.settings.hidden}>{name}</SettingTitle>}
            subtitle={lessonsOf(row, name)}
            trailing={
              isFree(row) ? undefined : row.default_price != null ? (
                <Value strong>{money(row.default_price)}</Value>
              ) : (
                <Value quiet>{t.settings.packages.noPrice}</Value>
              )
            }
            chevron
            onPress={() => tasks.packageType(row.code)}
          />
        )
      })}
    </Card>
  )
}

function MoneyPeriod() {
  const { t, fmt } = useI18n()
  const catalog = useCatalog()
  const day = catalog.data?.settings.moneyPeriodStartDay

  if (catalog.isError) return <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void catalog.refetch()} />
  if (day === undefined) return <ListSkeleton rows={1} />

  return (
    <Card>
      <Row
        title={<Label>{t.settings.period.start}</Label>}
        trailing={<Value>{day === 1 ? t.settings.period.calendar : fmt(t.settings.period.value, { day })}</Value>}
        chevron
        onPress={tasks.moneyPeriod}
      />
    </Card>
  )
}

const timeOfDay = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  const day = new Date()
  day.setHours(hours, minutes, 0, 0)
  return day
}

const timeText = (day: Date) => `${String(day.getHours()).padStart(2, '0')}:${String(day.getMinutes()).padStart(2, '0')}`

/**
 * The note every admin phone gets from the server about tomorrow's families still waiting. Shared by
 * all admins and the web; each change is saved at once, as the phone's own settings are.
 */
function EveningReminderSetting() {
  const c = useColors()
  const { t, tag } = useI18n()
  const catalog = useCatalog()
  const refresh = useRefresh()
  const toast = useToast()
  const copy = t.messages.evening.setting
  // What was just chosen shows at once; the saved setting takes over once it is read back
  const [draft, setDraft] = useState<EveningReminder | null>(null)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saved = catalog.data?.settings.eveningReminder

  if (catalog.isError) return <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void catalog.refetch()} />
  if (!saved) return <ListSkeleton rows={2} />
  const shown = draft ?? saved

  const save = async (next: EveningReminder) => {
    try {
      await updateEveningReminder(next)
      await refresh.catalog()
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      toast({ tone: 'error', title: copy.failed })
    } finally {
      setDraft(null)
    }
  }

  // The iPhone's time wheel reports every turn; only where it stops is saved
  const choose = (next: EveningReminder, wait = 0) => {
    setDraft(next)
    if (pending.current) clearTimeout(pending.current)
    pending.current = setTimeout(() => void save(next), wait)
  }

  const pickTime = (picked: Date) => {
    const time = timeText(picked)
    if (time !== shown.time) choose({ ...shown, time }, Platform.OS === 'ios' ? 900 : 0)
  }

  return (
    <Card>
      <Row
        title={<Label>{copy.enabled}</Label>}
        trailing={
          <Switch
            value={shown.enabled}
            onValueChange={(enabled) => choose({ ...shown, enabled })}
            accessibilityLabel={copy.enabled}
            trackColor={{ false: c.lineStrong, true: c.accentSolid }}
            // The phone's own switches keep a white knob in both themes
            thumbColor="#ffffff"
            ios_backgroundColor={c.lineStrong}
          />
        }
      />
      {shown.enabled && (
        <Row
          title={<Label>{copy.time}</Label>}
          subtitle={copy.timeHint}
          trailing={
            Platform.OS === 'ios' ? (
              <DateTimePicker
                value={timeOfDay(shown.time)}
                mode="time"
                display="compact"
                // tr-TR, en-GB and uk-UA all read the day in 24 hours
                locale={tag}
                minuteInterval={5}
                accentColor={c.accentSolid}
                onChange={(event, picked) => {
                  if (event.type === 'set' && picked) pickTime(picked)
                }}
              />
            ) : (
              <Value strong>{shown.time}</Value>
            )
          }
          chevron={Platform.OS === 'android'}
          onPress={
            Platform.OS === 'android'
              ? () =>
                  DateTimePickerAndroid.open({
                    value: timeOfDay(shown.time),
                    mode: 'time',
                    is24Hour: true,
                    onChange: (event, picked) => {
                      if (event.type === 'set' && picked) pickTime(picked)
                    }
                  })
              : undefined
          }
        />
      )}
    </Card>
  )
}

function CardMoney() {
  const { t, fmt, locale } = useI18n()
  const catalog = useCatalog()
  const saved = catalog.data?.settings

  if (catalog.isError) return <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void catalog.refetch()} />
  if (!saved) return <ListSkeleton rows={2} />

  return (
    <Card>
      <Row
        title={<Label>{t.settings.card.days}</Label>}
        trailing={<Value>{`${saved.cardSettlementDays} ${t.settings.card.daysUnit}`}</Value>}
        chevron
        onPress={tasks.cardSettings}
      />
      <Row
        title={<Label>{t.settings.card.commission}</Label>}
        trailing={<Value>{fmt(t.mobile.percent, { rate: rateText(saved.cardCommissionRate, locale) })}</Value>}
        chevron
        onPress={tasks.cardSettings}
      />
    </Card>
  )
}

/** Every monthly expense, paused ones too: Finance only lists the running ones. */
function Monthly() {
  const c = useColors()
  const { t, fmt, money } = useI18n()
  const labels = useLabels()
  const templates = useQuery({ queryKey: keys.finance('recurring'), queryFn: listRecurring })

  if (templates.isError) return <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void templates.refetch()} />
  if (!templates.data) return <ListSkeleton rows={2} />

  return (
    <View>
      {templates.data.length > 0 && (
        <Card inset={60}>
          {templates.data.map((row) => {
            const meta = [labels.expenseCategory(row.expense_type), methodName(t, labels, row.payment_method)].filter(Boolean).join(DOT)
            const amount = row.amount != null ? money(row.amount) : t.finance.monthly.varies
            return (
              <Row
                key={row.id}
                leading={
                  <View style={[styles.dayTablet, { backgroundColor: c.well }]}>
                    <Text variant="foot" weight="700" tabular tone={row.is_active ? 'ink2' : 'ink3'}>
                      {row.day_of_month}
                    </Text>
                  </View>
                }
                title={<SettingTitle mark={!row.is_active && t.finance.monthly.paused}>{row.title}</SettingTitle>}
                subtitle={meta}
                trailing={
                  row.amount != null ? (
                    <Value strong={row.is_active === true}>{amount}</Value>
                  ) : (
                    <Value quiet>{amount}</Value>
                  )
                }
                // The tablet shows the day; it is read out with the rest
                accessibilityLabel={[fmt(t.finance.monthly.day, { day: row.day_of_month }), row.title, !row.is_active && t.finance.monthly.paused, meta, amount]
                  .filter(Boolean)
                  .join(', ')}
                chevron
                onPress={() => tasks.recurring(row.id)}
              />
            )
          })}
        </Card>
      )}
      <AddButton label={t.finance.monthly.add} onPress={() => tasks.recurring()} />
    </View>
  )
}

function Categories({ kind }: { kind: 'expense' | 'income' }) {
  const { t } = useI18n()
  const labels = useLabels()
  const catalog = useCatalog()

  if (catalog.isError) return <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void catalog.refetch()} />
  if (!catalog.data) return <ListSkeleton rows={4} />

  const rows = kind === 'expense' ? catalog.data.expenseCategories : catalog.data.incomeCategories
  const name = (code: string) => (kind === 'expense' ? labels.expenseCategory(code) : labels.incomeCategory(code))

  return (
    <View>
      <Card inset={60}>
        {rows.map((row) => (
          <Row
            key={row.code}
            leading={kind === 'expense' ? <CategoryTablet code={row.code} /> : <IncomeTablet code={row.code} />}
            title={<SettingTitle mark={!row.is_active && t.settings.hidden}>{name(row.code)}</SettingTitle>}
            chevron
            onPress={() => tasks.category(kind, row.code)}
          />
        ))}
      </Card>
      <AddButton label={t.settings.categories.add} onPress={() => tasks.category(kind)} />
    </View>
  )
}

const failedWith = (error: unknown, code: string) => String((error as Error)?.message).includes(code)

/**
 * Who may enter the panel. Accounts themselves are made in the Supabase dashboard; here an
 * existing account gets access or loses it.
 */
function Access() {
  const c = useColors()
  const { t, fmt } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  const admins = useQuery({ queryKey: keys.admins, queryFn: listAdmins })
  // The account being taken off: its button spins and the others wait, so nothing is sent twice
  const [removing, setRemoving] = useState<string | null>(null)
  const copy = t.settings.access

  const revoke = (admin: Admin) => {
    if (removing) return
    Alert.alert(copy.removeTitle, fmt(copy.removeBody, { email: admin.email }), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: copy.remove,
        style: 'destructive',
        onPress: async () => {
          setRemoving(admin.user_id)
          try {
            await revokeAdmin(admin.user_id)
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            toast({ title: copy.removed })
          } catch (failure) {
            toast({ tone: 'error', title: failedWith(failure, 'cannot_revoke_self') ? copy.cannotRemoveSelf : copy.removeFailed })
          } finally {
            await refresh.admins()
            setRemoving(null)
          }
        }
      }
    ])
  }

  if (admins.isError) return <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void admins.refetch()} />
  if (!admins.data) return <ListSkeleton rows={2} />

  return (
    <View>
      <Card inset={60}>
        {admins.data.map((admin) => (
          <Row
            key={admin.user_id}
            leading={
              // People are square tiles; the one round avatar is the signed-in account below
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.tile, { backgroundColor: c.surface2, borderColor: c.line }]}>
                <Text variant="caption" weight="600" tone="ink2">
                  {initialsOfEmail(admin.email)}
                </Text>
              </View>
            }
            title={<Email>{admin.email}</Email>}
            trailing={
              admin.is_self ? (
                <Mark tone="neutral">{copy.you}</Mark>
              ) : (
                <Button
                  variant="plain"
                  size="sm"
                  accessibilityLabel={fmt(copy.removeLabel, { email: admin.email })}
                  busy={removing === admin.user_id}
                  disabled={removing !== null && removing !== admin.user_id}
                  onPress={() => revoke(admin)}
                >
                  {copy.remove}
                </Button>
              )
            }
          />
        ))}
      </Card>
      <AddButton label={copy.grant} icon="personAdd" onPress={tasks.grantAccess} />
    </View>
  )
}

function Account() {
  const c = useColors()
  const { t } = useI18n()
  const { session, signOut } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const email = session?.user.email ?? ''

  const confirm = () =>
    Alert.alert(t.mobile.signOutTitle, t.mobile.signOutBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.shell.account.signOut,
        style: 'destructive',
        onPress: async () => {
          setBusy(true)
          // On success the sign-in screen takes over; this page goes with it
          if (!(await signOut())) {
            setBusy(false)
            toast({ tone: 'error', title: t.shell.signOutFailed })
          }
        }
      }
    ])

  return (
    <Card inset={60}>
      <Row
        leading={
          <View style={[styles.avatar, { backgroundColor: c.accentWash2 }]}>
            <Text variant="caption" weight="600" tone="accentInk">
              {initialsOfEmail(email)}
            </Text>
          </View>
        }
        title={<Email>{email}</Email>}
      />
      <Row
        leading={
          <View style={styles.avatar}>
            {busy ? <ActivityIndicator size="small" color={c.ink3} /> : <Icon name="logout" size={18} color={c.accentInk} />}
          </View>
        }
        title={
          <Text variant="body" tone={busy ? 'ink3' : 'accentInk'}>
            {t.shell.account.signOut}
          </Text>
        }
        onPress={busy ? undefined : confirm}
      />
    </Card>
  )
}

function About() {
  const { t, date } = useI18n()
  // An update sent over the air keeps the store version, so its day tells which one is running
  const updated = !Updates.isEmbeddedLaunch ? Updates.createdAt : null
  return (
    <Card>
      <Row title={t.mobile.version} trailing={<Value>{Constants.expoConfig?.version ?? ''}</Value>} />
      {updated && (
        <Row
          title={<Label>{t.settings.about.updated}</Label>}
          trailing={<Value>{date(updated, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Value>}
        />
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  appearance: { gap: 16 },
  add: { alignSelf: 'flex-start', marginTop: 6, marginLeft: 4 },
  value: { flexShrink: 1, maxWidth: '50%' },
  dayTablet: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tile: { width: 32, height: 32, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }
})
