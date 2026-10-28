import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Autocomplete,
  Collection,
  Dialog,
  Header,
  Input,
  Menu,
  MenuItem,
  MenuSection,
  Modal,
  ModalOverlay,
  SearchField
} from 'react-aria-components'
import { useNavigate } from 'react-router'
import {
  ArrowRightIcon,
  CalendarPlusIcon,
  CoinsIcon,
  HandCoinsIcon,
  HourglassIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  ReceiptIcon,
  UserPlusIcon,
  type Icon
} from '@phosphor-icons/react'
import type { Messages } from '@hellokido/core/i18n'
import { matchesSearch } from '@hellokido/core/rules/text.js'
import { useI18n } from '../providers/I18n'
import { Sheet } from '../ui/Sheet'
import { cx } from '../ui/cx'
import { ActionsContext, type TaskKind, type TaskRequest } from './Actions'
import { NAV, SETTINGS_NAV } from './nav'
import { TaskHost, usePaletteChildren } from './tasks'

export const TASKS: { kind: TaskKind; icon: Icon; label: (t: Messages) => string }[] = [
  { kind: 'payment', icon: HandCoinsIcon, label: (t) => t.shell.quickAdd.payment },
  { kind: 'expense', icon: ReceiptIcon, label: (t) => t.shell.quickAdd.expense },
  { kind: 'income', icon: CoinsIcon, label: (t) => t.shell.quickAdd.income },
  { kind: 'registration', icon: UserPlusIcon, label: (t) => t.shell.quickAdd.registration },
  { kind: 'lesson', icon: CalendarPlusIcon, label: (t) => t.shell.quickAdd.lesson },
  { kind: 'note', icon: NotePencilIcon, label: (t) => t.shell.quickAdd.note },
  { kind: 'waitlist', icon: HourglassIcon, label: (t) => t.shell.quickAdd.waitlist }
]

export function ActionsProvider({ children }: { children: ReactNode }) {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [task, setTask] = useState<TaskRequest | null>(null)
  const taskCount = useRef(0)

  const startTask = useCallback((kind: TaskKind, params?: Record<string, unknown>) => {
    setQuickAddOpen(false)
    setPaletteOpen(false)
    taskCount.current += 1
    setTask({ kind, params, id: taskCount.current })
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo(
    () => ({ openQuickAdd: () => setQuickAddOpen(true), openPalette: () => setPaletteOpen(true), startTask }),
    [startTask]
  )

  return (
    <ActionsContext.Provider value={value}>
      {children}
      <QuickAddSheet isOpen={quickAddOpen} onOpenChange={setQuickAddOpen} onPick={startTask} />
      <CommandPalette isOpen={paletteOpen} onOpenChange={setPaletteOpen} onTask={startTask} />
      <TaskHost task={task} onDone={() => setTask(null)} />
    </ActionsContext.Provider>
  )
}

function QuickAddSheet({ isOpen, onOpenChange, onPick }: { isOpen: boolean; onOpenChange: (open: boolean) => void; onPick: (kind: TaskKind) => void }) {
  const { t } = useI18n()
  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title={t.shell.quickAdd.title}>
      <ul className="-mx-2 grid gap-0.5">
        {TASKS.map(({ kind, icon: TaskIcon, label }) => (
          <li key={kind}>
            <button
              type="button"
              onClick={() => onPick(kind)}
              className="flex h-13 w-full items-center gap-3.5 rounded-control px-2 text-left text-[0.9375rem] font-medium text-ink outline-none hover:bg-well focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span className="grid size-9 place-items-center rounded-tablet bg-accent-wash text-accent-ink">
                <TaskIcon aria-hidden className="size-5" />
              </span>
              {label(t)}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

type PaletteItem = { id: string; label: string; detail?: string; section: 'people' | 'actions' | 'pages'; run: () => void; icon?: Icon }

function CommandPalette({ isOpen, onOpenChange, onTask }: { isOpen: boolean; onOpenChange: (open: boolean) => void; onTask: (kind: TaskKind) => void }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const people = usePaletteChildren(isOpen)

  useEffect(() => {
    if (!isOpen) setQuery('')
  }, [isOpen])

  const close = () => onOpenChange(false)
  const sections = useMemo(() => {
    const pages: PaletteItem[] = [...NAV, SETTINGS_NAV].map((item) => ({
      id: `page:${item.to}`,
      label: item.label(t),
      section: 'pages',
      icon: item.icon,
      run: () => navigate(item.to)
    }))
    const tasks: PaletteItem[] = TASKS.map((task) => ({
      id: `task:${task.kind}`,
      label: task.label(t),
      section: 'actions',
      icon: task.icon,
      run: () => onTask(task.kind)
    }))
    const children: PaletteItem[] = people.map((person) => ({
      id: `child:${person.id}`,
      label: person.name,
      detail: person.detail,
      section: 'people',
      run: () => navigate(`/children/${person.id}`)
    }))
    return [
      { id: 'people', title: t.shell.palette.people, items: query.trim() ? children : children.slice(0, 0) },
      { id: 'actions', title: t.shell.palette.actions, items: tasks },
      { id: 'pages', title: t.shell.palette.pages, items: pages }
    ].filter((section) => section.items.length > 0)
  }, [t, people, query, navigate, onTask])

  const byId = useMemo(() => new Map(sections.flatMap((s) => s.items).map((item) => [item.id, item])), [sections])

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-[55] bg-scrim px-3 pt-[max(0.75rem,env(safe-area-inset-top))] data-entering:animate-fade-in data-exiting:animate-fade-out sm:px-6 sm:pt-[12vh]"
    >
      <Modal className="mx-auto w-full max-w-xl overflow-hidden rounded-sheet bg-sheet text-ink shadow-float outline-none data-entering:animate-pop-in data-exiting:animate-pop-out">
        <Dialog aria-label={t.shell.palette.open} className="outline-none">
          <Autocomplete filter={(text, input) => matchesSearch(text, input)} inputValue={query} onInputChange={setQuery}>
            <SearchField aria-label={t.shell.palette.open} autoFocus className="flex items-center gap-2 border-b border-line px-4">
              <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-ink-3" />
              <Input
                placeholder={t.shell.palette.placeholder}
                className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
              />
            </SearchField>
            <Menu
              aria-label={t.shell.palette.open}
              items={sections}
              onAction={(key) => {
                const item = byId.get(String(key))
                if (!item) return
                close()
                item.run()
              }}
              renderEmptyState={() => <p className="px-4 py-8 text-center text-sm text-ink-2">{t.common.noResults}</p>}
              className="relative max-h-[min(26rem,60dvh)] overflow-y-auto p-2 outline-none"
            >
              {(section) => (
                <MenuSection id={section.id} className="pb-1">
                  <Header className="px-2.5 pt-2 pb-1 text-[0.75rem] font-medium text-ink-3">{section.title}</Header>
                  <Collection items={section.items}>
                  {(item: PaletteItem) => {
                    const ItemIcon = item.icon
                    return (
                      <MenuItem
                        id={item.id}
                        textValue={`${item.label} ${item.detail ?? ''}`}
                        className={cx(
                          'group flex items-center gap-3 rounded-[0.5rem] px-2.5 py-2 text-sm outline-none select-none',
                          'data-focused:bg-accent-wash data-focused:text-accent-ink'
                        )}
                      >
                        {ItemIcon ? (
                          <ItemIcon aria-hidden className="size-[1.125rem] shrink-0 text-ink-2 group-data-focused:text-accent-ink" />
                        ) : (
                          <span aria-hidden className="grid size-[1.125rem] shrink-0 place-items-center">
                            <span className="size-2 rounded-full bg-accent" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                          {item.detail && <span className="ml-2 text-ink-3 group-data-focused:text-accent-ink/80">{item.detail}</span>}
                        </span>
                        <ArrowRightIcon aria-hidden className="size-4 opacity-0 group-data-focused:opacity-100" />
                      </MenuItem>
                    )
                  }}
                  </Collection>
                </MenuSection>
              )}
            </Menu>
          </Autocomplete>
          <p className="hidden border-t border-line px-4 py-2 text-[0.75rem] text-ink-3 sm:block">{t.shell.palette.hint}</p>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
