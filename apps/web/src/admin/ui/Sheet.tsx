import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { XIcon } from '@phosphor-icons/react'
import { useI18n } from '../providers/I18n'
import { IconButton } from './Button'
import { ConfirmDialog } from './ConfirmDialog'
import { cx } from './cx'

const FooterSlot = createContext<HTMLElement | null>(null)

/**
 * Puts its children in the footer of the sheet it is rendered in. Lets a form that lives inside the
 * sheet's body own its save button, so one sheet can switch between forms without closing.
 */
export function SheetFooter({ children }: { children: ReactNode }) {
  const slot = useContext(FooterSlot)
  return slot ? createPortal(children, slot) : null
}

let openSheets = 0

/** Marks the page while a sheet is open, so toasts can move off its save button. */
function useOpenMark(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return
    openSheets += 1
    document.documentElement.dataset.sheet = 'open'
    return () => {
      openSheets -= 1
      if (openSheets === 0) delete document.documentElement.dataset.sheet
    }
  }, [isOpen])
}

type SheetProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg'
  /** When true, closing asks first so typed values are not lost by a stray tap. */
  isDirty?: boolean
  /** While saving the sheet cannot be dismissed. */
  isBusy?: boolean
  bodyClassName?: string
}

/**
 * Work happens in sheets, not modals: a panel from the right on wide screens and a sheet from
 * the bottom on phones. The page behind stays in place, so the person keeps their context.
 */
export function Sheet({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  isDirty,
  isBusy,
  bodyClassName
}: SheetProps) {
  const { t } = useI18n()
  const [askDiscard, setAskDiscard] = useState(false)
  const [footerSlot, setFooterSlot] = useState<HTMLElement | null>(null)
  useOpenMark(isOpen)

  const requestClose = () => {
    if (isBusy) return
    if (isDirty) setAskDiscard(true)
    else onOpenChange(false)
  }

  return (
    <>
      <ModalOverlay
        isOpen={isOpen}
        onOpenChange={(open) => (open ? onOpenChange(true) : requestClose())}
        isDismissable={!isBusy}
        isKeyboardDismissDisabled={isBusy}
        className="fixed inset-0 z-50 bg-scrim data-entering:animate-fade-in data-exiting:animate-fade-out"
      >
        <Modal
          className={cx(
            'fixed flex flex-col bg-surface text-ink shadow-lift outline-none',
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-sheet data-entering:animate-sheet-in-up data-exiting:animate-sheet-out-down',
            'md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:rounded-none md:border-l md:border-line',
            'md:data-entering:animate-sheet-in-right md:data-exiting:animate-sheet-out-right',
            size === 'md' ? 'md:w-[min(30rem,100vw)]' : 'md:w-[min(42rem,100vw)]'
          )}
        >
          <Dialog className="flex min-h-0 flex-1 flex-col outline-none">
            <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong md:hidden" />
            <header className="flex shrink-0 items-start gap-3 px-5 pt-3 pb-3 md:mb-5 md:border-b md:border-line md:px-6 md:pt-5 md:pb-4">
              <div className="min-w-0 flex-1 pt-1">
                <Heading slot="title" className="text-[1.0625rem] leading-tight font-semibold tracking-[-0.01em] text-balance">
                  {title}
                </Heading>
                {description && <div className="mt-1 text-[0.84375rem] text-ink-3">{description}</div>}
              </div>
              <IconButton label={t.common.close} onPress={requestClose} isDisabled={isBusy} className="-mr-2">
                <XIcon aria-hidden className="size-5" />
              </IconButton>
            </header>
            <div className={cx('min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 md:px-6', bodyClassName)}>
              <FooterSlot.Provider value={footerSlot}>{children}</FooterSlot.Provider>
            </div>
            <footer
              ref={setFooterSlot}
              className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] empty:hidden md:px-6 md:pb-4"
            >
              {footer}
            </footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
      <ConfirmDialog
        isOpen={askDiscard}
        onOpenChange={setAskDiscard}
        title={t.common.unsavedChanges}
        confirmLabel={t.common.discard}
        cancelLabel={t.common.keepEditing}
        tone="danger"
        onConfirm={() => {
          setAskDiscard(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}

/** The usual footer: secondary actions on the left, the main action on the right. */
export function SheetActions({ children, start }: { children: ReactNode; start?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">{start}</div>
      {children}
    </div>
  )
}
