"use client"

import { useMemo, useState } from "react"
import { ArrowLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDate, pluralRu } from "@/lib/format"
import { memberKey, type MemberRef, type ProcedureOption } from "@/lib/types"
import { cn } from "@/lib/utils"

const ALL = "__all__"

/** Добавление участников: сначала процедура, затем сотрудники из неё. */
export function AddMembersDialog({
  open,
  onOpenChange,
  procedures,
  takenKeys,
  takenLogins,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  procedures: ProcedureOption[]
  /** Ключи участников, уже включённых в отчёт (вместе с руководителем) */
  takenKeys: Set<string>
  /** Логины уже включённых — один человек может быть в нескольких процедурах */
  takenLogins: Set<string>
  onAdd: (refs: MemberRef[]) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && (
          <Wizard
            procedures={procedures}
            takenKeys={takenKeys}
            takenLogins={takenLogins}
            onAdd={onAdd}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Wizard({
  procedures,
  takenKeys,
  takenLogins,
  onAdd,
}: {
  procedures: ProcedureOption[]
  takenKeys: Set<string>
  takenLogins: Set<string>
  onAdd: (refs: MemberRef[]) => void
}) {
  const [procedureId, setProcedureId] = useState<string | null>(
    procedures.length === 1 ? procedures[0].id : null,
  )
  /** Выбранные участники по всем процедурам: key → { ref, login } */
  const [selected, setSelected] = useState<Map<string, { ref: MemberRef; login: string }>>(new Map())

  const procedure = procedures.find((p) => p.id === procedureId) ?? null
  const selectedLogins = useMemo(
    () => new Set([...selected.values()].map((s) => s.login)),
    [selected],
  )

  function toggle(ref: MemberRef, login: string, checked: boolean) {
    const next = new Map(selected)
    if (checked) next.set(memberKey(ref), { ref, login })
    else next.delete(memberKey(ref))
    setSelected(next)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Добавить участников в команду</DialogTitle>
        <DialogDescription>
          {procedure
            ? "Шаг 2 из 2. Отметьте сотрудников. Можно вернуться и добавить людей из другой процедуры — выбор сохранится."
            : "Шаг 1 из 2. Выберите процедуру, из участников которой нужно набрать команду."}
        </DialogDescription>
      </DialogHeader>

      {procedure ? (
        <ParticipantStep
          procedure={procedure}
          canGoBack={procedures.length > 1}
          onBack={() => setProcedureId(null)}
          takenKeys={takenKeys}
          takenLogins={takenLogins}
          selected={selected}
          selectedLogins={selectedLogins}
          onToggle={toggle}
          onToggleMany={(items, checked) => {
            const next = new Map(selected)
            for (const { ref, login } of items) {
              if (checked) next.set(memberKey(ref), { ref, login })
              else next.delete(memberKey(ref))
            }
            setSelected(next)
          }}
        />
      ) : (
        <ProcedureStep
          procedures={procedures}
          takenKeys={takenKeys}
          selected={selected}
          onPick={setProcedureId}
        />
      )}

      <DialogFooter className="items-center">
        <span className="mr-auto text-xs text-muted-foreground">
          {selected.size > 0
            ? `Выбрано: ${selected.size}`
            : procedure
              ? "Никто не выбран"
              : null}
        </span>
        <Button disabled={selected.size === 0} onClick={() => onAdd([...selected.values()].map((s) => s.ref))}>
          Добавить
          {selected.size > 0 &&
            ` ${selected.size} ${pluralRu(selected.size, "участника", "участников", "участников")}`}
        </Button>
      </DialogFooter>
    </>
  )
}

function ProcedureStep({
  procedures,
  takenKeys,
  selected,
  onPick,
}: {
  procedures: ProcedureOption[]
  takenKeys: Set<string>
  selected: Map<string, unknown>
  onPick: (id: string) => void
}) {
  const [query, setQuery] = useState("")
  const found = procedures.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))

  if (procedures.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Нет запущенных процедур. Командный отчёт собирается из участников запущенных процедур.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {procedures.length > 5 && (
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            placeholder="Название процедуры"
            className="pl-8"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      <ul className="max-h-96 overflow-y-auto rounded-lg border">
        {found.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">Ничего не найдено</li>
        )}
        {found.map((p) => {
          const inTeam = p.participants.filter((x) => takenKeys.has(memberKey({ procedureId: p.id, participantId: x.id }))).length
          const picked = [...selected.keys()].filter((k) => k.startsWith(`${p.id}:`)).length
          return (
            <li key={p.id} className="border-b last:border-b-0">
              <button
                type="button"
                onClick={() => onPick(p.id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{p.name}</span>
                    <StatusBadge status={p.status} />
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {formatDate(p.startDate)} — {formatDate(p.endDate)} · {p.participants.length}{" "}
                    {pluralRu(p.participants.length, "участник", "участника", "участников")}
                    {inTeam > 0 && ` · в команде: ${inTeam}`}
                  </span>
                </span>
                {picked > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                    выбрано {picked}
                  </span>
                )}
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ParticipantStep({
  procedure,
  canGoBack,
  onBack,
  takenKeys,
  takenLogins,
  selected,
  selectedLogins,
  onToggle,
  onToggleMany,
}: {
  procedure: ProcedureOption
  canGoBack: boolean
  onBack: () => void
  takenKeys: Set<string>
  takenLogins: Set<string>
  selected: Map<string, { ref: MemberRef; login: string }>
  selectedLogins: Set<string>
  onToggle: (ref: MemberRef, login: string, checked: boolean) => void
  onToggleMany: (items: { ref: MemberRef; login: string }[], checked: boolean) => void
}) {
  const [query, setQuery] = useState("")
  const [unit, setUnit] = useState<string>(ALL)

  // Кто уже в команде (или руководитель) — не показываем.
  const candidates = useMemo(
    () =>
      procedure.participants.filter(
        (p) =>
          !takenKeys.has(memberKey({ procedureId: procedure.id, participantId: p.id })) &&
          !takenLogins.has(p.externalLogin.toLowerCase()),
      ),
    [procedure, takenKeys, takenLogins],
  )

  const units = useMemo(
    () =>
      [...new Set(candidates.map((p) => p.sspUnit).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "ru"),
      ),
    [candidates],
  )
  const unitItems = [{ value: ALL, label: "Все подразделения ССП" }, ...units.map((u) => ({ value: u, label: u }))]

  const found = useMemo(() => {
    const q = query.trim().toLowerCase()
    return candidates.filter((p) => {
      if (unit !== ALL && p.sspUnit !== unit) return false
      if (!q) return true
      return [p.fullName, p.position, p.vspUnit, p.externalLogin].some((v) => v.toLowerCase().includes(q))
    })
  }, [candidates, query, unit])

  const item = (p: (typeof found)[number]) => ({
    ref: { procedureId: procedure.id, participantId: p.id },
    login: p.externalLogin.toLowerCase(),
  })
  const isSelected = (p: (typeof found)[number]) => selected.has(memberKey(item(p).ref))
  /** Тот же человек уже выбран из другой процедуры */
  const pickedElsewhere = (p: (typeof found)[number]) =>
    !isSelected(p) && selectedLogins.has(p.externalLogin.toLowerCase())

  const selectable = found.filter((p) => !pickedElsewhere(p))
  const allFound = selectable.length > 0 && selectable.every(isSelected)
  const someFound = selectable.some(isSelected)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-lg bg-muted px-2 py-1.5">
        {canGoBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeftIcon /> Все процедуры
          </Button>
        )}
        <span className="min-w-0 truncate text-sm font-medium">{procedure.name}</span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {formatDate(procedure.startDate)} — {formatDate(procedure.endDate)}
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            placeholder="ФИО, должность, ВСП или логин"
            className="pl-8"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select items={unitItems} value={unit} onValueChange={(v) => setUnit(v ?? ALL)}>
          <SelectTrigger className="w-full sm:w-64" aria-label="Подразделение ССП">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {unitItems.map((u) => (
              <SelectItem key={u.value} value={u.value}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <label className="flex items-center gap-2 border-b bg-table-head px-3 py-2 text-xs font-semibold">
          <Checkbox
            disabled={selectable.length === 0}
            checked={allFound}
            indeterminate={!allFound && someFound}
            onCheckedChange={(checked) => onToggleMany(selectable.map(item), checked)}
          />
          Выбрать всех найденных ({selectable.length})
        </label>
        <div className="max-h-72 overflow-y-auto">
          {found.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {candidates.length === 0
                ? "Все участники этой процедуры уже в команде"
                : "Никого не найдено"}
            </p>
          )}
          {found.map((p) => {
            const elsewhere = pickedElsewhere(p)
            return (
              <label
                key={p.id}
                className={cn(
                  "flex cursor-pointer items-start gap-2 border-b px-3 py-2 text-xs last:border-b-0 hover:bg-muted/50",
                  elsewhere && "cursor-not-allowed opacity-60",
                )}
              >
                <Checkbox
                  className="mt-0.5"
                  disabled={elsewhere}
                  checked={isSelected(p)}
                  onCheckedChange={(checked) => {
                    const { ref, login } = item(p)
                    onToggle(ref, login, checked)
                  }}
                />
                <span className="grid flex-1 gap-0.5 sm:grid-cols-[1.2fr_1fr_1.4fr] sm:gap-3">
                  <span className="font-medium">
                    {p.fullName}
                    {elsewhere && (
                      <span className="block font-normal text-muted-foreground">
                        уже выбран из другой процедуры
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">{p.position || "—"}</span>
                  <span className="text-muted-foreground">{p.sspUnit || "—"}</span>
                </span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
