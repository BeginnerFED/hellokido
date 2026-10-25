import type { ReactNode } from 'react'
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { useI18n } from '../providers/I18n'
import { Button } from './Button'

type ConfirmDialogProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  body?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  isPending?: boolean
  /** The confirm button waits (e.g. for something the body still reads). */
  isConfirmDisabled?: boolean
  onConfirm: () => void
}

/** Asks before something that cannot be undone. The safe choice is focused first. */
export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  isPending,
  isConfirmDisabled,
  onConfirm
}: ConfirmDialogProps) {
  const { t } = useI18n()
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => !isPending && onOpenChange(open)}
      isDismissable={!isPending}
      className="fixed inset-0 z-[60] grid items-end bg-scrim p-3 data-entering:animate-fade-in data-exiting:animate-fade-out sm:place-items-center sm:p-6"
    >
      <Modal className="w-full rounded-sheet bg-sheet p-5 text-ink shadow-float outline-none data-entering:animate-pop-in data-exiting:animate-pop-out sm:max-w-[26rem] sm:p-6">
        <Dialog role="alertdialog" className="outline-none">
          <Heading slot="title" className="text-[1.1875rem] leading-[1.5625rem] font-semibold tracking-[-0.015em] text-balance">
            {title}
          </Heading>
          {body && <div className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">{body}</div>}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="quiet" autoFocus onPress={() => onOpenChange(false)} isDisabled={isPending}>
              {cancelLabel ?? t.common.cancel}
            </Button>
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} onPress={onConfirm} isPending={isPending} isDisabled={isConfirmDisabled}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
