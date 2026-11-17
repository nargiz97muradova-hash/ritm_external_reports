"use client"

import { useMemo, useState } from "react"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"
import { AccessStatus } from "@/app/procedures/_components/access-status"
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
import { memberKey, type MemberRef, type Participant, type ProcedureOption } from "@/lib/types"
import { cn } from "@/lib/utils"

const ALL = "__all__"

interface Picked {
  ref: MemberRef
  person: Participant
  procedureName: string
}

/** Добавление участников: шаг 1 — процедура и сотрудники, шаг 2 — проверка. */
export function AddMembersDialog({
  open,
  onOpenChange,
  procedures,
  memberKeys,
  memberLogins,
  leaderLogins,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  procedures: ProcedureOption[]
  /** Уже в команде: ключи и логины (один человек может быть в нескольких процедурах) */
  memberKeys: Set<string>
  memberLogins: Set<string>
  /** Логины руководителей — их нельзя добавить участниками */
  leaderLogins: Set<string>
  onAdd: (refs: MemberRef[]) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(88vh,820px)] flex-col gap-4 sm:max-w-5xl">
        {open && (
          <Wizard
            procedures={procedures}
            memberKeys={memberKeys}
            memberLogins={memberLogins}
            leaderLogins={leaderLogins}
            onAdd={onAdd}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Wizard({
  procedures,
  memberKeys,
  memberLogins,
  leaderLogins,
  onAdd,
}: {
  procedures: ProcedureOption[]
  memberKeys: Set<string>
  memberLogins: Set<string>
  leaderLogins: Set<string>
  onAdd: (refs: MemberRef[]) => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [procedureId, setProcedureId] = useState<string | null>(procedures[0]?.id ?? null)
  const [selected, setSelected] = useState<Map<string, Picked>>(new Map())

  const procedure = procedures.find((p) => p.id === procedureId) ?? null
  const selectedLogins = useMemo(
    () => new Set([...selected.values()].map((s) => s.person.externalLogin.toLowerCase())),
    [selected],
  )

  function setMany(items: Picked[], checked: boolean) {
    const next = new Map(selected)
    for (const item of items) {
      if (checked) next.set(memberKey(item.ref), item)
      else next.delete(memberKey(item.ref))
    }
    setSelected(next)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Добавить участников в команду</DialogTitle>
        <DialogDescription>
          <span className={cn(step === 1 && "font-medium text-foreground")}>1. Выбор сотрудников</span>
          <span className="mx-2">→</span>
          <span className={cn(step === 2 && "font-medium text-foreground")}>2. Проверка</span>
        </DialogDescription>
      </DialogHeader>

      {step === 1 ? (
        <SelectStep
          procedures={procedures}
          procedure={procedure}
          onProcedureChange={setProcedureId}
          memberKeys={memberKeys}
          memberLogins={memberLogins}
          leaderLogins={leaderLogins}
          selected={selected}
          selectedLogins={selectedLogins}
          onSetMany={setMany}
        />
      ) : (
        <ReviewStep
          selected={[...selected.values()]}
          onRemove={(key) => {
            const next = new Map(selected)
            next.delete(key)
            setSelected(next)
          }}
        />
      )}

      <DialogFooter className="mt-auto items-center">
        <span className="mr-auto text-xs text-muted-foreground">
          {selected.size > 0
            ? `Выбрано: ${selected.size} ${pluralRu(selected.size, "сотрудник", "сотрудника", "сотрудников")}`
            : "Никто не выбран"}
        </span>
        {step === 1 ? (
          <Button disabled={selected.size === 0} onClick={() => setStep(2)}>
            Далее: проверка <ArrowRightIcon />
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeftIcon /> Назад
            </Button>
            <Button
              disabled={selected.size === 0}
              onClick={() => onAdd([...selected.values()].map((s) => s.ref))}
            >
              Добавить {selected.size}{" "}
              {pluralRu(selected.size, "участника", "участников", "участников")}
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  )
}

function SelectStep({
  procedures,
  procedure,
  onProcedureChange,
  memberKeys,
  memberLogins,
  leaderLogins,
  selected,
  selectedLogins,
  onSetMany,
}: {
  procedures: ProcedureOption[]
  procedure: ProcedureOption | null
  onProcedureChange: (id: string) => void
  memberKeys: Set<string>
  memberLogins: Set<string>
  leaderLogins: Set<string>
  selected: Map<string, Picked>
  selectedLogins: Set<string>
  onSetMany: (items: Picked[], checked: boolean) => void
}) {
  const [query, setQuery] = useState("")
  const [unit, setUnit] = useState<string>(ALL)

  const procedureItems = procedures.map((p) => {
    const picked = [...selected.keys()].filter((k) => k.startsWith(`${p.id}:`)).length
    return { value: p.id, label: picked ? `${p.name} — выбрано ${picked}` : p.name }
  })

  const participants = useMemo(() => procedure?.participants ?? [], [procedure])
  const units = useMemo(
    () =>
      [...new Set(participants.map((p) => p.sspUnit).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "ru"),
      ),
    [participants],
  )
  const unitItems = [{ value: ALL, label: "Все подразделения ССП" }, ...units.map((u) => ({ value: u, label: u }))]

  const found = useMemo(() => {
    const q = query.trim().toLowerCase()
    return participants.filter((p) => {
      if (unit !== ALL && p.sspUnit !== unit) return false
      if (!q) return true
      return [p.fullName, p.position, p.vspUnit, p.externalLogin].some((v) => v.toLowerCase().includes(q))
    })
  }, [participants, query, unit])

  if (!procedure) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Нет запущенных процедур. Командный отчёт собирается из участников запущенных процедур.
      </p>
    )
  }

  const picked = (p: Participant): Picked => ({
    ref: { procedureId: procedure.id, participantId: p.id },
    person: p,
    procedureName: procedure.name,
  })
  /** Почему сотрудника нельзя выбрать (или null, если можно). */
  const blocked = (p: Participant): string | null => {
    const key = memberKey({ procedureId: procedure.id, participantId: p.id })
    const login = p.externalLogin.toLowerCase()
    if (memberKeys.has(key) || memberLogins.has(login)) return "уже в команде"
    if (leaderLogins.has(login)) return "выбран руководителем"
    if (!selected.has(key) && selectedLogins.has(login)) return "уже выбран из другой процедуры"
    return null
  }
  const selectable = found.filter((p) => !blocked(p))
  const isChecked = (p: Participant) =>
    selected.has(memberKey({ procedureId: procedure.id, participantId: p.id }))
  const allChecked = selectable.length > 0 && selectable.every(isChecked)
  const someChecked = selectable.some(isChecked)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid gap-2 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid gap-1">
          <span className="text-xs font-semibold">Процедура</span>
          <Select
            items={procedureItems}
            value={procedure.id}
            onValueChange={(v) => {
              if (!v) return
              onProcedureChange(v)
              setQuery("")
              setUnit(ALL)
            }}
          >
            <SelectTrigger className="w-full" aria-label="Процедура">
              <SelectValue />
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
          <span className="text-xs font-semibold">Поиск</span>
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              placeholder="ФИО, должность, ВСП или логин"
              className="pl-8"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-1">
          <span className="text-xs font-semibold">Подразделение ССП</span>
          <Select items={unitItems} value={unit} onValueChange={(v) => setUnit(v ?? ALL)}>
            <SelectTrigger className="w-full" aria-label="Подразделение ССП">
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
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        {formatDate(procedure.startDate)} — {formatDate(procedure.endDate)} ·{" "}
        {procedure.participants.length}{" "}
        {pluralRu(procedure.participants.length, "участник", "участника", "участников")}. Выбор
        сохраняется при переключении процедуры.
      </p>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[2rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.1fr)] items-center gap-3 border-b bg-table-head px-3 py-2 text-xs font-semibold">
          <Checkbox
            aria-label="Выбрать всех найденных"
            disabled={selectable.length === 0}
            checked={allChecked}
            indeterminate={!allChecked && someChecked}
            onCheckedChange={(checked) => onSetMany(selectable.map(picked), checked)}
          />
          <span>ФИО ({found.length})</span>
          <span>Должность</span>
          <span>Подразделение ССП</span>
          <span>Внешний логин</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {found.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">Никого не найдено</p>
          )}
          {found.map((p) => {
            const reason = blocked(p)
            return (
              <label
                key={p.id}
                className={cn(
                  "grid cursor-pointer grid-cols-[2rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.1fr)] items-start gap-3 border-b px-3 py-2 text-xs last:border-b-0 hover:bg-muted/50",
                  reason && "cursor-not-allowed bg-muted/30 text-muted-foreground",
                )}
              >
                <Checkbox
                  className="mt-0.5"
                  aria-label={`Выбрать ${p.fullName}`}
                  disabled={!!reason}
                  checked={isChecked(p)}
                  onCheckedChange={(checked) => onSetMany([picked(p)], checked)}
                />
                <span>
                  <span className={cn("font-medium", !reason && "text-foreground")}>{p.fullName}</span>
                  {reason && <span className="block">{reason}</span>}
                </span>
                <span className="text-muted-foreground">{p.position || "—"}</span>
                <span className="text-muted-foreground">{p.sspUnit || "—"}</span>
                <span className="truncate text-muted-foreground">{p.externalLogin}</span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ReviewStep({
  selected,
  onRemove,
}: {
  selected: Picked[]
  onRemove: (key: string) => void
}) {
  const byProcedure = new Map<string, Picked[]>()
  for (const item of selected) {
    byProcedure.set(item.procedureName, [...(byProcedure.get(item.procedureName) ?? []), item])
  }
  const noLink = selected.filter((s) => !s.person.externalLink).length
  const noUnit = selected.filter((s) => !s.person.sspUnit).length

  const checks: { ok: boolean; text: string }[] = [
    { ok: selected.length > 0, text: selected.length > 0 ? `Выбрано сотрудников: ${selected.length}` : "Никто не выбран — вернитесь к выбору" },
    { ok: true, text: "Повторов нет: каждый сотрудник выбран один раз, даже если он участвует в нескольких процедурах" },
    { ok: true, text: "Руководители отчёта и текущие участники команды исключены" },
    {
      ok: noLink === 0,
      text:
        noLink === 0
          ? "У всех выбранных есть внешняя ссылка на опросник"
          : `У ${noLink} ${pluralRu(noLink, "сотрудника", "сотрудников", "сотрудников")} нет внешней ссылки — их результаты могут не попасть в отчёт`,
    },
    {
      ok: noUnit === 0,
      text:
        noUnit === 0
          ? "У всех указано подразделение ССП"
          : `У ${noUnit} ${pluralRu(noUnit, "сотрудника", "сотрудников", "сотрудников")} не указано подразделение ССП`,
    },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <ul className="grid gap-1.5 rounded-lg bg-muted/60 p-3 text-xs">
        {checks.map((c) => (
          <li key={c.text} className="flex items-start gap-2">
            {c.ok ? (
              <CircleCheckIcon className="mt-px size-4 shrink-0 text-success" />
            ) : (
              <CircleAlertIcon className="mt-px size-4 shrink-0 text-amber-600" />
            )}
            {c.text}
          </li>
        ))}
      </ul>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
        {[...byProcedure.entries()].map(([procedureName, items]) => (
          <div key={procedureName}>
            <div className="sticky top-0 z-10 border-b bg-table-head px-3 py-2 text-xs font-semibold">
              {procedureName} · {items.length}
            </div>
            {items.map((item) => (
              <div
                key={memberKey(item.ref)}
                className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-2 text-xs last:border-b-0"
              >
                <span className="font-medium">{item.person.fullName}</span>
                <span className="text-muted-foreground">{item.person.position || "—"}</span>
                <span className="text-muted-foreground">{item.person.sspUnit || "—"}</span>
                <span>
                  <AccessStatus access={item.person.reportAccess} />
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Убрать ${item.person.fullName}`}
                  onClick={() => onRemove(memberKey(item.ref))}
                >
                  <XIcon />
                </Button>
              </div>
            ))}
          </div>
        ))}
        {selected.length === 0 && (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">Список пуст</p>
        )}
      </div>
    </div>
  )
}
