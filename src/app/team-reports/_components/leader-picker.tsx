"use client"

import { useMemo, useState } from "react"
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react"
import { ParticipantAvatar } from "@/components/participant-avatar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MemberRef, ProcedureOption } from "@/lib/types"
import { cn } from "@/lib/utils"

const LIMIT = 100

/** Выбор руководителя: сначала процедура, затем участник из неё (с поиском). */
export function LeaderPicker({
  id,
  procedures,
  value,
  onChange,
  invalid,
}: {
  id?: string
  procedures: ProcedureOption[]
  value: MemberRef | null
  onChange: (ref: MemberRef) => void
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [procedureId, setProcedureId] = useState<string | null>(
    value?.procedureId ?? (procedures.length === 1 ? procedures[0].id : null),
  )

  const leaderProcedure = procedures.find((p) => p.id === value?.procedureId)
  const leader = leaderProcedure?.participants.find((p) => p.id === value?.participantId)
  const procedure = procedures.find((p) => p.id === procedureId)
  const procedureItems = procedures.map((p) => ({ value: p.id, label: p.name }))

  const found = useMemo(() => {
    const list = procedure?.participants ?? []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((p) =>
      [p.fullName, p.position, p.externalLogin].some((v) => v.toLowerCase().includes(q)),
    )
  }, [procedure, query])

  return (
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
            data-invalid={invalid || undefined}
            className={cn(
              "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20",
              !leader && "text-muted-foreground",
            )}
          />
        }
      >
        <span className="truncate">
          {leader ? (
            <>
              {leader.fullName}
              <span className="text-muted-foreground"> · {leaderProcedure?.name}</span>
            </>
          ) : (
            "Выберите руководителя"
          )}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-80 gap-2 p-2" align="start">
        <div className="grid gap-1">
          <span className="px-0.5 text-[11px] font-medium text-muted-foreground">1. Процедура</span>
          <Select
            items={procedureItems}
            value={procedureId}
            onValueChange={(v) => {
              setProcedureId(v)
              setQuery("")
            }}
          >
            <SelectTrigger className="w-full" aria-label="Процедура руководителя">
              <SelectValue placeholder="Выберите процедуру" />
            </SelectTrigger>
            <SelectContent>
              {procedureItems.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <span className="px-0.5 text-[11px] font-medium text-muted-foreground">2. Сотрудник</span>
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              disabled={!procedure}
              placeholder={procedure ? "ФИО, должность или логин" : "Сначала выберите процедуру"}
              className="pl-8"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {procedure && (
          <div role="listbox" aria-label="Участники процедуры" className="max-h-64 overflow-y-auto">
            {found.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">Никого не найдено</p>
            )}
            {found.slice(0, LIMIT).map((p) => {
              const selected = value?.procedureId === procedure.id && value.participantId === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                  onClick={() => {
                    onChange({ procedureId: procedure.id, participantId: p.id })
                    setOpen(false)
                    setQuery("")
                  }}
                >
                  <ParticipantAvatar fullName={p.fullName} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.fullName}</span>
                    <span className="block truncate text-muted-foreground">{p.position || "—"}</span>
                  </span>
                  {selected && <CheckIcon className="size-4 text-primary" />}
                </button>
              )
            })}
            {found.length > LIMIT && (
              <p className="px-2 py-2 text-center text-xs text-muted-foreground">
                Показаны первые {LIMIT} из {found.length}. Уточните поиск.
              </p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
