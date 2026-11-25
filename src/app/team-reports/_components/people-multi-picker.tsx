"use client"

import { useMemo, useState } from "react"
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Participant } from "@/lib/types"
import { cn } from "@/lib/utils"

const LIMIT = 100

/** Мультивыбор сотрудников с поиском (без аватарок в списке). */
export function PeopleMultiPicker({
  id,
  participants,
  value,
  onChange,
  disabled,
  invalid,
  placeholder,
  listLabel,
  removeRoleLabel,
}: {
  id?: string
  participants: Participant[]
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  invalid?: boolean
  placeholder: string
  listLabel: string
  /** Роль в тексте подтверждения удаления, например «руководителя» или «сотрудника ДРП» */
  removeRoleLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [pendingRemove, setPendingRemove] = useState<Participant | null>(null)
  const byId = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants])
  const selected = useMemo(
    () => value.map((vid) => byId.get(vid)).filter((p) => p !== undefined),
    [byId, value],
  )
  const selectedSet = useMemo(() => new Set(value), [value])

  const found = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return participants
    return participants.filter((p) =>
      [p.fullName, p.position, p.sspUnit, p.externalLogin].some((v) =>
        v.toLowerCase().includes(q),
      ),
    )
  }, [participants, query])

  function requestRemove(person: Participant) {
    setOpen(false)
    setQuery("")
    setPendingRemove(person)
  }

  function toggle(pid: string) {
    if (selectedSet.has(pid)) {
      const person = byId.get(pid)
      if (person) requestRemove(person)
      return
    }
    onChange([...value, pid])
  }

  function confirmRemove() {
    if (!pendingRemove) return
    onChange(value.filter((id) => id !== pendingRemove.id))
    setPendingRemove(null)
  }

  return (
    <div className="grid gap-1.5">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery("")
        }}
      >
        <PopoverTrigger
          render={
            <button
              id={id}
              type="button"
              disabled={disabled}
              data-invalid={invalid || undefined}
              className={cn(
                "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20",
                selected.length === 0 && "text-muted-foreground",
              )}
            />
          }
        >
          <span className="truncate">
            {selected.length === 0
              ? placeholder
              : selected.length === 1
                ? selected[0].fullName
                : `Выбрано: ${selected.length}`}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent className="w-(--anchor-width) min-w-72 gap-2 p-2" align="start">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              placeholder="ФИО, должность, подразделение или логин"
              className="pl-8"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div role="listbox" aria-multiselectable aria-label={listLabel} className="max-h-72 overflow-y-auto">
            {found.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">Никого не найдено</p>
            )}
            {found.slice(0, LIMIT).map((p) => {
              const checked = selectedSet.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                  onClick={() => toggle(p.id)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.fullName}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="secondary" className="max-w-full truncate font-normal">
                        {p.position || "—"}
                      </Badge>
                      <Badge variant="secondary" className="max-w-full truncate font-normal">
                        {p.sspUnit || "—"}
                      </Badge>
                    </span>
                  </span>
                  {checked && <CheckIcon className="size-4 shrink-0 text-primary" />}
                </button>
              )
            })}
            {found.length > LIMIT && (
              <p className="px-2 py-2 text-center text-xs text-muted-foreground">
                Показаны первые {LIMIT} из {found.length}. Уточните поиск.
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((p) => (
            <span
              key={p.id}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px]"
            >
              <span className="truncate">{p.fullName}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Убрать ${p.fullName}`}
                className="rounded-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                onClick={() => requestRemove(p)}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <AlertDialog open={pendingRemove !== null} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Убрать {removeRoleLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove
                ? `«${pendingRemove.fullName}» будет удалён из выбранных. Нажмите «Сохранить», чтобы применить изменения.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmRemove}>
              Убрать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
