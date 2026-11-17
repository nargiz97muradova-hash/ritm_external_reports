"use client"

import { useMemo, useState } from "react"
import { SearchIcon } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { memberKey, type MemberRef, type ProcedureOption } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ChipsField } from "./chips-field"

const LIMIT = 150

/**
 * Множественный выбор руководителей — получателей отчёта:
 * сначала процедура, затем сотрудники флажками.
 */
export function LeadersPicker({
  id,
  procedures,
  value,
  onChange,
  memberLogins,
  invalid,
}: {
  id?: string
  procedures: ProcedureOption[]
  value: MemberRef[]
  onChange: (refs: MemberRef[]) => void
  /** Логины участников команды — их нельзя выбрать руководителями */
  memberLogins: Set<string>
  invalid?: boolean
}) {
  const [query, setQuery] = useState("")
  const [procedureId, setProcedureId] = useState<string | null>(
    value[0]?.procedureId ?? (procedures.length === 1 ? procedures[0].id : null),
  )

  const lookup = useMemo(() => {
    const map = new Map<string, { name: string; login: string; procedure: string }>()
    for (const p of procedures)
      for (const x of p.participants)
        map.set(memberKey({ procedureId: p.id, participantId: x.id }), {
          name: x.fullName,
          login: x.externalLogin.toLowerCase(),
          procedure: p.name,
        })
    return map
  }, [procedures])

  const selectedKeys = new Set(value.map(memberKey))
  const selectedLogins = new Set(value.flatMap((r) => lookup.get(memberKey(r))?.login ?? []))
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

  function toggle(ref: MemberRef, checked: boolean) {
    if (checked) onChange([...value, ref])
    else onChange(value.filter((r) => memberKey(r) !== memberKey(ref)))
  }

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <ChipsField
        id={id}
        invalid={invalid}
        placeholder="Не выбраны"
        addLabel="Выбрать"
        items={value.map((ref) => {
          const info = lookup.get(memberKey(ref))
          return { key: memberKey(ref), label: info?.name ?? "—", hint: info?.procedure }
        })}
        onRemove={(key) => onChange(value.filter((r) => memberKey(r) !== key))}
      />
      <PopoverContent className="w-96 max-w-[calc(100vw-2rem)] gap-2 p-2" align="end">
        <div className="grid gap-1">
          <span className="px-0.5 text-[11px] font-medium text-muted-foreground">Процедура</span>
          <Select
            items={procedureItems}
            value={procedureId}
            onValueChange={(v) => {
              setProcedureId(v)
              setQuery("")
            }}
          >
            <SelectTrigger className="w-full" aria-label="Процедура">
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
        {procedure && (
          <div className="max-h-72 overflow-y-auto">
            {found.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">Никого не найдено</p>
            )}
            {found.slice(0, LIMIT).map((p) => {
              const ref = { procedureId: procedure.id, participantId: p.id }
              const login = p.externalLogin.toLowerCase()
              const checked = selectedKeys.has(memberKey(ref))
              const inTeam = memberLogins.has(login)
              const elsewhere = !checked && selectedLogins.has(login)
              const disabled = inTeam || elsewhere
              return (
                <label
                  key={p.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(c) => toggle(ref, c)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.fullName}</span>
                    <span className="block truncate text-muted-foreground">
                      {inTeam
                        ? "уже участник команды"
                        : elsewhere
                          ? "уже выбран из другой процедуры"
                          : p.position || "—"}
                    </span>
                  </span>
                </label>
              )
            })}
            {found.length > LIMIT && (
              <p className="px-2 py-2 text-center text-xs text-muted-foreground">
                Показаны первые {LIMIT} из {found.length}. Уточните поиск.
              </p>
            )}
          </div>
        )}
        <p className="px-1 text-[11px] text-muted-foreground">
          Выбрано: {value.length}. Руководители увидят отчёт на главной странице сервиса «Оценка» в
          разделе «Внешняя оценка».
        </p>
      </PopoverContent>
    </Popover>
  )
}
