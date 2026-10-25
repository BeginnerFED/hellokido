import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Alert, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
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
import { Avatar, ListSkeleton, LoadError } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { Segmented, SwitchField, TimeField } from '../../ui/Fields'
import { ActionRow, Card, CardButton, GroupFooter, Row, Screen, Section } from '../../ui/Screen'
import { dots, Text } from '../../ui/Text'
import { useToast } from '../../ui/Toast'
import { CategoryTablet, IncomeTablet, methodName } from '../finance/bits'
import { SettingTitle } from './bits'

const isFree = (row: PackageType) => row.family === 'free'

/** The tile before a row (a category, a person, a day), the same size in every list on the page. */
const TILE = 32

/** The room over the first part of the page, under the bar. */
const FIRST_GROUP = { marginTop: 6 }

// "ayse.yilmaz@…" gives "AY", the way the web panel's account button shows it
/** "ayse.yilmaz@…" → "ayse yilmaz", so an account's tile shows the initials of the name before the @. */
const nameOfEmail = (email: string) => (email.split('@')[0] ?? '').replace(/[._-]+/g, ' ')

/**
 * The few things set once and changed rarely, on one page laid out as the phone's Settings: how the
 * app looks on this phone, the prices and names the forms use, card money, monthly expenses,
 * categories, the evening reminder and who may sign in.
 */
export function SettingsScreen() {
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

  return (
    <Screen onRefresh={refresh}>
      <Appearance />
      <Packages />
      <CardMoney />
      <Monthly />
      <Categories kind="expense" />
      <Categories kind="income" />
      <EveningReminderSetting />
      <Access />
      <Account />
      <About />
    </Screen>
  )
}

type GroupProps = {
  title: string
  /** A count or the setting's state at the right of the head ("12", "Her gün 16:00"). */
  aside?: ReactNode
  /** What the rows mean, under the card. */
  footer?: ReactNode
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

/** One part of the page as on the felt board: its head (20pt) with a muted note at the right, the rows on one felt card, a note under it. */
function Group({ title, aside, footer, children, style }: GroupProps) {
  return (
    <Section title={title} aside={aside} style={style}>
      <Card>{children}</Card>
      {footer !== undefined && <GroupFooter>{footer}</GroupFooter>}
    </Section>
  )
}

/** A group still loading or that failed: its heading stays in place, so the page does not jump. */
function Waiting({ title, failed, onRetry, rows = 2 }: { title: string; failed: boolean; onRetry: () => void; rows?: number }) {
  const { t } = useI18n()
  return (
    <Section title={title}>
      {failed ? <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={onRetry} /> : <ListSkeleton rows={rows} />}
    </Section>
  )
}

/** A value the row does not have yet ("No price"), quieter than a real one. */
function Missing({ children }: { children: string }) {
  return (
    <Text variant="body" tone="ink3" numberOfLines={1} style={styles.value}>
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
    <Group title={t.settings.appearance.title} footer={t.settings.appearance.body} style={FIRST_GROUP}>
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
    </Group>
  )
}

function Packages() {
  const { t, plural, money } = useI18n()
  const labels = useLabels()
  const catalog = useCatalog()
  const copy = t.settings.packages

  if (!catalog.data) return <Waiting title={copy.title} failed={catalog.isError} onRetry={() => void catalog.refetch()} rows={4} />

  const lessonsOf = (row: PackageType, name: string) => {
    if (isFree(row)) return t.children.form.noQuota
    // "3 aylık - 12 atölye" already says how many lessons it has
    if (!row.lessons || new RegExp(`(^|\\D)${row.lessons}(\\D|$)`).test(name)) return undefined
    return plural(t.children.form.lessons, row.lessons)
  }

  return (
    <Group title={copy.title} aside={catalog.data.packages.length} footer={copy.body}>
      {catalog.data.packages.map((row) => {
        const name = labels.packageName(row.code)
        const subtitle = dots(lessonsOf(row, name), !row.is_active && t.settings.hidden)
        return (
          <Row
            key={row.code}
            title={<SettingTitle dimmed={!row.is_active}>{name}</SettingTitle>}
            subtitle={subtitle || undefined}
            value={isFree(row) ? undefined : row.default_price != null ? money(row.default_price) : <Missing>{copy.noPrice}</Missing>}
            chevron
            onPress={() => tasks.packageType(row.code)}
          />
        )
      })}
    </Group>
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
  const { t, fmt } = useI18n()
  const catalog = useCatalog()
  const refresh = useRefresh()
  const toast = useToast()
  const copy = t.messages.evening.setting
  // What was just chosen shows at once; the saved setting takes over once it is read back
  const [draft, setDraft] = useState<EveningReminder | null>(null)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saved = catalog.data?.settings.eveningReminder

  if (!saved) return <Waiting title={copy.title} failed={catalog.isError} onRetry={() => void catalog.refetch()} />
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
    <Group title={copy.title} aside={shown.enabled ? fmt(copy.on, { time: shown.time }) : copy.off} footer={copy.body}>
      <SwitchField label={copy.enabled} value={shown.enabled} onChange={(enabled) => choose({ ...shown, enabled })} />
      {shown.enabled && <TimeField label={copy.time} hint={copy.timeHint} value={timeOfDay(shown.time)} onChange={pickTime} minuteInterval={5} />}
    </Group>
  )
}

function CardMoney() {
  const { t, fmt, locale } = useI18n()
  const catalog = useCatalog()
  const saved = catalog.data?.settings
  const copy = t.settings.card

  if (!saved) return <Waiting title={copy.title} failed={catalog.isError} onRetry={() => void catalog.refetch()} />

  return (
    <Group title={copy.title} footer={copy.body}>
      <Row title={<SettingTitle>{copy.days}</SettingTitle>} value={`${saved.cardSettlementDays} ${copy.daysUnit}`} chevron onPress={tasks.cardSettings} />
      <Row
        title={<SettingTitle>{copy.commission}</SettingTitle>}
        value={fmt(t.mobile.percent, { rate: rateText(saved.cardCommissionRate, locale) })}
        chevron
        onPress={tasks.cardSettings}
      />
    </Group>
  )
}

/** Every monthly expense, paused ones too: Finance only lists the running ones. */
function Monthly() {
  const c = useColors()
  const { t, fmt, money } = useI18n()
  const labels = useLabels()
  const templates = useQuery({ queryKey: keys.finance('recurring'), queryFn: listRecurring })
  const copy = t.settings.monthly

  if (!templates.data) return <Waiting title={copy.title} failed={templates.isError} onRetry={() => void templates.refetch()} />

  return (
    <Group title={copy.title} aside={templates.data.length > 0 ? templates.data.length : undefined} footer={copy.body}>
      {templates.data.map((row) => {
        const meta = dots(labels.expenseCategory(row.expense_type), methodName(t, labels, row.payment_method), !row.is_active && t.finance.monthly.paused)
        const amount = row.amount != null ? money(row.amount) : t.finance.monthly.varies
        return (
          <Row
            key={row.id}
            leading={
              // The day of the month it is due, in a circle on the felt like the other rows' tiles
              <View style={[styles.day, { backgroundColor: c.onFelt }]}>
                <Text weight="600" tabular tone={row.is_active ? 'ink' : 'ink3'} maxFontSizeMultiplier={1.15} style={styles.dayText}>
                  {row.day_of_month}
                </Text>
              </View>
            }
            title={<SettingTitle dimmed={!row.is_active}>{row.title}</SettingTitle>}
            subtitle={meta || undefined}
            value={row.amount != null ? amount : <Missing>{amount}</Missing>}
            // The leaf shows the day; it is read out with the rest
            accessibilityLabel={[fmt(t.finance.monthly.day, { day: row.day_of_month }), row.title, meta, amount].filter(Boolean).join(', ')}
            chevron
            onPress={() => tasks.recurring(row.id)}
          />
        )
      })}
      <ActionRow icon="add" lead={TILE} label={t.finance.monthly.add} onPress={() => tasks.recurring()} />
    </Group>
  )
}

function Categories({ kind }: { kind: 'expense' | 'income' }) {
  const { t } = useI18n()
  const labels = useLabels()
  const catalog = useCatalog()
  const copy = t.settings.categories
  const title = kind === 'expense' ? copy.expenseTitle : copy.incomeTitle

  if (!catalog.data) return <Waiting title={title} failed={catalog.isError} onRetry={() => void catalog.refetch()} rows={4} />

  const rows = kind === 'expense' ? catalog.data.expenseCategories : catalog.data.incomeCategories
  const name = (code: string) => (kind === 'expense' ? labels.expenseCategory(code) : labels.incomeCategory(code))

  return (
    <Group title={title} aside={rows.length} footer={kind === 'expense' ? copy.expenseBody : copy.incomeBody}>
      {rows.map((row) => (
        <Row
          key={row.code}
          leading={kind === 'expense' ? <CategoryTablet code={row.code} size={TILE} /> : <IncomeTablet code={row.code} size={TILE} />}
          title={<SettingTitle dimmed={!row.is_active}>{name(row.code)}</SettingTitle>}
          subtitle={row.is_active ? undefined : t.settings.hidden}
          chevron
          onPress={() => tasks.category(kind, row.code)}
        />
      ))}
      <ActionRow icon="add" lead={TILE} label={copy.add} onPress={() => tasks.category(kind)} />
    </Group>
  )
}

const failedWith = (error: unknown, code: string) => String((error as Error)?.message).includes(code)

/**
 * Who may enter the panel. Accounts themselves are made in the Supabase dashboard; here an
 * existing account gets access or loses it.
 */
function Access() {
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

  if (!admins.data) return <Waiting title={copy.title} failed={admins.isError} onRetry={() => void admins.refetch()} />

  return (
    <Group title={copy.title} aside={admins.data.length} footer={copy.body}>
      {admins.data.map((admin) => (
        <Row
          key={admin.user_id}
          leading={<Avatar name={nameOfEmail(admin.email)} size={TILE} />}
          title={<Email>{admin.email}</Email>}
          value={admin.is_self ? copy.you : undefined}
          trailing={
            admin.is_self ? undefined : (
              // A small raised button with red words: it takes something away
              <Button
                variant="danger"
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
      <ActionRow icon="personAdd" lead={TILE} label={copy.grant} onPress={tasks.grantAccess} />
    </Group>
  )
}

function Account() {
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

  // The account, then signing out on its own in red, as the phone's own account page ends
  return (
    <View style={styles.account}>
      <Group title={t.mobile.account}>
        <Row leading={<Avatar name={nameOfEmail(email)} size={TILE} />} title={<Email>{email}</Email>} />
      </Group>
      <CardButton label={t.shell.account.signOut} destructive busy={busy} onPress={confirm} />
    </View>
  )
}

function About() {
  const { t, date } = useI18n()
  // An update sent over the air keeps the store version, so its day tells which one is running
  const updated = !Updates.isEmbeddedLaunch ? Updates.createdAt : null
  return (
    <Group title={t.settings.about.title}>
      <Row title={t.mobile.version} value={Constants.expoConfig?.version ?? ''} />
      {updated && <Row title={<SettingTitle>{t.settings.about.updated}</SettingTitle>} value={date(updated, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} />}
    </Group>
  )
}

const styles = StyleSheet.create({
  value: { flexShrink: 1, maxWidth: '55%' },
  // As large as the other rows' tiles, so every list on the page lines up
  day: { width: TILE, height: TILE, borderRadius: TILE / 2, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, lineHeight: 18 },
  account: { gap: 12 }
})
