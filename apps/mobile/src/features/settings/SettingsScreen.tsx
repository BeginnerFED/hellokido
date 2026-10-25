import { useCallback, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import Constants from 'expo-constants'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listAdmins, listRecurring, revokeAdmin, type Admin, type PackageType } from '@hellokido/core/api'
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
import { Text } from '../../ui/Text'
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

/** A value at the end of a row, in the quieter ink the phone's own settings use. */
function Value({ children, strong, quiet }: { children: string; strong?: boolean; quiet?: boolean }) {
  return (
    <Text variant="sub" weight={strong ? '600' : '400'} tone={quiet ? 'ink3' : strong ? 'ink' : 'ink2'} tabular numberOfLines={1}>
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

function CardMoney() {
  const { t, fmt, locale } = useI18n()
  const catalog = useCatalog()
  const saved = catalog.data?.settings

  if (catalog.isError) return <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void catalog.refetch()} />
  if (!saved) return <ListSkeleton rows={2} />

  return (
    <Card>
      <Row title={t.settings.card.days} trailing={<Value>{`${saved.cardSettlementDays} ${t.settings.card.daysUnit}`}</Value>} chevron onPress={tasks.cardSettings} />
      <Row
        title={t.settings.card.commission}
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
            const meta = [labels.expenseCategory(row.expense_type), methodName(t, labels, row.payment_method)].filter(Boolean).join(' · ')
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
  const copy = t.settings.access

  const revoke = (admin: Admin) =>
    Alert.alert(copy.removeTitle, fmt(copy.removeBody, { email: admin.email }), [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: copy.remove,
        style: 'destructive',
        onPress: async () => {
          try {
            await revokeAdmin(admin.user_id)
            toast({ title: copy.removed })
          } catch (failure) {
            toast({ tone: 'error', title: failedWith(failure, 'cannot_revoke_self') ? copy.cannotRemoveSelf : copy.removeFailed })
          } finally {
            void refresh.admins()
          }
        }
      }
    ])

  if (admins.isError) return <LoadError message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => void admins.refetch()} />
  if (!admins.data) return <ListSkeleton rows={2} />

  return (
    <View>
      <Card inset={60}>
        {admins.data.map((admin) => (
          <Row
            key={admin.user_id}
            leading={
              <View style={[styles.avatar, { backgroundColor: c.accentWash2 }]}>
                <Text variant="caption" weight="600" tone="accentInk">
                  {initialsOfEmail(admin.email)}
                </Text>
              </View>
            }
            title={admin.email}
            trailing={
              admin.is_self ? (
                <Mark tone="neutral">{copy.you}</Mark>
              ) : (
                <Button variant="plain" size="sm" accessibilityLabel={fmt(copy.removeLabel, { email: admin.email })} onPress={() => revoke(admin)}>
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
        title={email}
      />
      <Row
        leading={
          <View style={styles.avatar}>
            <Icon name="logout" size={18} color={busy ? c.ink3 : c.accentInk} />
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
  const { t } = useI18n()
  return (
    <Card>
      <Row title={t.mobile.version} trailing={<Value>{Constants.expoConfig?.version ?? ''}</Value>} />
    </Card>
  )
}

const styles = StyleSheet.create({
  appearance: { gap: 16 },
  add: { alignSelf: 'flex-start', marginTop: 6, marginLeft: 4 },
  dayTablet: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }
})
