import { useState } from 'react'
import * as Haptics from 'expo-haptics'
import { updateWorkshop, type WorkshopInfo } from '@hellokido/core/api'
import { useCatalog, useRefresh } from '../../data/queries'
import { useI18n } from '../../providers/I18n'
import { EmptyState, ListSkeleton } from '../../ui/Bits'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Fields'
import { FormGroup } from '../../ui/Screen'
import { SheetActions, SheetScreen, useSheet } from '../../ui/Sheet'
import { useToast } from '../../ui/Toast'

/** The workshop's place, map link and lesson length, which every message may use. */
export function WorkshopSheet() {
  const { t } = useI18n()
  const catalog = useCatalog()
  const info = catalog.data?.settings.workshop

  if (info) return <WorkshopForm info={info} />
  return (
    <SheetScreen title={t.messages.workshop.title}>
      {catalog.isError ? (
        <EmptyState
          icon="info"
          title={t.common.loadFailed}
          action={
            <Button size="sm" icon="refresh" busy={catalog.isFetching} onPress={() => void catalog.refetch()}>
              {t.common.retry}
            </Button>
          }
        />
      ) : (
        <ListSkeleton rows={3} />
      )}
    </SheetScreen>
  )
}

function WorkshopForm({ info }: { info: WorkshopInfo }) {
  const { t } = useI18n()
  const toast = useToast()
  const refresh = useRefresh()
  // This form draws its own SheetScreen, so the bar's action closes the sheet it is in through this
  const sheet = useSheet()
  const copy = t.messages.workshop
  const [value, setValue] = useState<WorkshopInfo>(info)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = value.place !== info.place || value.map !== info.map || value.duration !== info.duration

  const save = async () => {
    if (busy || !dirty) return
    setBusy(true)
    setError(null)
    try {
      await updateWorkshop(value)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast({ title: copy.saved })
      void refresh.catalog()
      sheet.finish()
    } catch {
      setError(copy.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SheetScreen title={copy.title} dirty={dirty} busy={busy} action={{ label: t.common.save, disabled: !dirty, onPress: () => void save() }}>
      <FormGroup footer={copy.body}>
        <TextField label={copy.place} value={value.place} onChangeText={(place) => setValue({ ...value, place })} autoCapitalize="sentences" returnKeyType="done" />
        <TextField label={copy.duration} value={value.duration} onChangeText={(duration) => setValue({ ...value, duration })} returnKeyType="done" />
      </FormGroup>
      <FormGroup footer={copy.mapHint}>
        <TextField
          label={copy.map}
          value={value.map}
          onChangeText={(map) => setValue({ ...value, map: map.trim() })}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="done"
        />
      </FormGroup>
      <SheetActions error={error} />
    </SheetScreen>
  )
}
