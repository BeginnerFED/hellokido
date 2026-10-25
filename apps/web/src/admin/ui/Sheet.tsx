import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { XIcon } from '@phosphor-icons/react'
import { useI18n } from '../providers/I18n'
import { IconButton } from './Button'
import { ConfirmDialog } from './ConfirmDialog'
import { cx } from './cx'

const FooterSlot = createContext<HTMLElement | null>(null)
const CloseRequest = createContext<(() => void) | null>(null)

/**
 * Closes the sheet this is rendered in the way its X does: a dirty form asks first and a busy one
 * stays open. For a "Vazgeç" button that lives in a form inside the sheet. Null outside a sheet.
 */
export function useCloseSheet() {
  return useContext(CloseRequest)
}

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
 * Work happens in sheets, not modals: a floating panel at the right on wide screens (inset 12,
 * radius 28, over the scrim) and a sheet from the bottom on phones. The page behind stays in place,
 * so the person keeps their context. Esc, the X and a tap on the scrim close it; a dirty form asks first.
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
            'fixed flex flex-col bg-sheet text-ink shadow-float outline-none',
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-sheet data-entering:animate-sheet-in-up data-exiting:animate-sheet-out-down',
            'md:top-3 md:right-3 md:bottom-3 md:left-auto md:max-h-none md:rounded-sheet',
            'md:data-entering:animate-sheet-in-right md:data-exiting:animate-sheet-out-right',
            size === 'md' ? 'md:w-[min(31.25rem,calc(100vw-1.5rem))]' : 'md:w-[min(42rem,calc(100vw-1.5rem))]'
          )}
        >
          {/* Passes the panel's rounding down, so the footer's own fill keeps the bottom corners round */}
          <Dialog className="flex min-h-0 flex-1 flex-col rounded-[inherit] outline-none">
            <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong md:hidden" />
            <header className="flex shrink-0 items-start gap-3 px-5 pt-3 pb-3.5 md:px-6 md:pt-6">
              <div className="min-w-0 flex-1 pt-0.5">
                <Heading slot="title" className="text-[1.25rem] leading-7 font-semibold tracking-[-0.02em] text-balance md:text-2xl md:leading-[1.875rem]">
                  {title}
                </Heading>
                {description && <div className="mt-[3px] text-[0.90625rem] text-ink-2">{description}</div>}
              </div>
              <IconButton label={t.common.close} variant="quiet" onPress={requestClose} isDisabled={isBusy} className="size-10! max-md:-mr-1">
                <XIcon aria-hidden className="size-[1.125rem]" />
              </IconButton>
            </header>
            <div className={cx('min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 md:px-6', bodyClassName)}>
              <CloseRequest.Provider value={requestClose}>
                <FooterSlot.Provider value={footerSlot}>{children}</FooterSlot.Provider>
              </CloseRequest.Provider>
            </div>
            <footer
              ref={setFooterSlot}
              className="shrink-0 rounded-b-[inherit] border-t border-line bg-sheet px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] empty:hidden md:px-6 md:pb-5"
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
