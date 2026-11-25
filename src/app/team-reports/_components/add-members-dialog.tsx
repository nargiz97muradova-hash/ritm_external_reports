"use client"

import { useMemo, useState } from "react"
import { PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"
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
import { formatDate, pluralRu } from "@/lib/format"
import {
  GROUP_COLOR_OPTIONS,
  groupColorHex,
  groupDotStyle,
  groupSwatchClass,
  isGroupColor,
  isHexColor,
  nextGroupColorId,
} from "@/lib/report/group-colors"
import type { Participant, TeamComparisonGroup } from "@/lib/types"
import { cn } from "@/lib/utils"

type DraftGroup = { id: string; name: string; color: string }

export type MemberProcedurePool = {
  id: string
  name: string
  participants: Participant[]
}

type Row = Participant & { procedureId: string; procedureName: string }

function matchesQuery(p: Participant, q: string) {
  if (!q) return true
  return [p.personnelId, p.fullName, p.position, p.vspUnit, p.sspUnit, p.externalLogin].some((v) =>
    v.toLowerCase().includes(q),
  )
}

function newGroupId() {
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function toDraftGroups(groups: TeamComparisonGroup[]): DraftGroup[] {
  const drafts: DraftGroup[] = []
  for (const g of groups) {
    const name = g.name.trim()
    if (!name) continue
    drafts.push({
      id: g.id,
      name,
      color: isGroupColor(g.color) ? g.color! : nextGroupColorId(drafts.map((d) => d.color)),
    })
  }
  return drafts
}

/** Два шага: выбор сотрудников → опциональная группировка для сравнения в отчёте. */
export function AddMembersDialog({
  open,
  onOpenChange,
  procedures,
  initialProcedureId,
  existingGroups = [],
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  procedures: MemberProcedurePool[]
  initialProcedureId?: string
  /** Уже созданные группы отчёта — предлагаются на шаге группировки. */
  existingGroups?: TeamComparisonGroup[]
  onAdd: (payload: {
    memberIds: string[]
    groups: TeamComparisonGroup[]
    highlightedIds: string[]
  }) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl">
        {open && (
          <Wizard
            procedures={procedures}
            initialProcedureId={initialProcedureId}
            existingGroups={existingGroups}
            onAdd={onAdd}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Wizard({
  procedures,
  initialProcedureId,
  existingGroups,
  onAdd,
  onClose,
}: {
  procedures: MemberProcedurePool[]
  initialProcedureId?: string
  existingGroups: TeamComparisonGroup[]
  onAdd: (payload: {
    memberIds: string[]
    groups: TeamComparisonGroup[]
    highlightedIds: string[]
  }) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  /** Выбор хранится здесь — не сбрасывается при смене процедуры и при возврате с шага 2. */
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [picked, setPicked] = useState<Row[]>([])
  const [draftGroups, setDraftGroups] = useState<DraftGroup[]>([])
  const [assignment, setAssignment] = useState<Record<string, string>>({})
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set())
  const presetGroups = useMemo(() => toDraftGroups(existingGroups), [existingGroups])

  function goToGrouping(rows: Row[]) {
    setSelectedIds(rows.map((r) => r.id))
    setPicked(rows)
    setDraftGroups(presetGroups)
    setAssignment({})
    setHighlighted(new Set())
    setStep(2)
  }

  function finish(withGroups: boolean) {
    if (picked.length === 0) return
    const memberIds = picked.map((p) => p.id)
    const knownIds = new Set(existingGroups.map((g) => g.id))
    const groups: TeamComparisonGroup[] = withGroups
      ? draftGroups
          .map((g) => ({
            id: g.id,
            name: g.name.trim(),
            color: g.color,
            memberIds: memberIds.filter((id) => assignment[id] === g.id),
          }))
          .filter((g) => g.name && (g.memberIds.length > 0 || knownIds.has(g.id)))
      : []
    onAdd({
      memberIds,
      groups,
      highlightedIds: memberIds.filter((id) => highlighted.has(id)),
    })
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Добавить участников в команду</DialogTitle>
        <DialogDescription>
          {step === 1
            ? "Шаг 1 из 2 — выберите сотрудников из одной или нескольких процедур. Выбор сохраняется при переключении процедур."
            : presetGroups.length > 0
              ? "Шаг 2 из 2 — распределите новых участников по уже созданным группам или добавьте новые. Группировку можно пропустить."
              : "Шаг 2 из 2 — при желании разбейте участников на группы для сравнения в отчёте (тепловые карты, раздел «Группы участников»). Группировку можно пропустить."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center justify-center gap-3 text-sm">
        <StepBadge n={1} active={step === 1} done={step === 2} label="Сотрудники" />
        <span className="text-base text-muted-foreground">→</span>
        <StepBadge n={2} active={step === 2} label="Группировка" />
      </div>

      {step === 1 ? (
        <SelectStep
          procedures={procedures}
          initialProcedureId={initialProcedureId}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          onNext={goToGrouping}
          onCancel={onClose}
        />
      ) : (
        <GroupingStep
          people={picked}
          draftGroups={draftGroups}
          assignment={assignment}
          highlighted={highlighted}
          onDraftGroupsChange={setDraftGroups}
          onAssignmentChange={setAssignment}
          onHighlightedChange={setHighlighted}
          onBack={() => setStep(1)}
          onSkip={() => finish(false)}
          onConfirm={() => finish(true)}
        />
      )}
    </>
  )
}

function StepBadge({
  n,
  active,
  done,
  label,
}: {
  n: number
  active?: boolean
  done?: boolean
  label: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold",
        active && "bg-primary text-primary-foreground",
        done && "bg-muted text-foreground",
        !active && !done && "bg-muted/60 text-muted-foreground",
      )}
    >
      <span className="flex size-6 items-center justify-center rounded-full bg-black/10 text-xs tabular-nums dark:bg-white/15">
        {n}
      </span>
      {label}
    </span>
  )
}

function SelectStep({
  procedures,
  initialProcedureId,
  selectedIds,
  onSelectedIdsChange,
  onNext,
  onCancel,
}: {
  procedures: MemberProcedurePool[]
  initialProcedureId?: string
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
  onNext: (rows: Row[]) => void
  onCancel: () => void
}) {
  const defaultProcedureId =
    (initialProcedureId && procedures.some((p) => p.id === initialProcedureId)
      ? initialProcedureId
      : procedures[0]?.id) ?? null

  const [procedureId, setProcedureId] = useState<string | null>(defaultProcedureId)
  const [query, setQuery] = useState("")
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])

  const q = query.trim().toLowerCase()
  const searching = q.length > 0

  const catalog = useMemo(() => {
    const rows: Row[] = []
    for (const proc of procedures) {
      for (const p of proc.participants) {
        rows.push({ ...p, procedureId: proc.id, procedureName: proc.name })
      }
    }
    return rows
  }, [procedures])

  const rowById = useMemo(() => new Map(catalog.map((r) => [r.id, r])), [catalog])

  const matched = useMemo(
    () => (searching ? catalog.filter((r) => matchesQuery(r, q)) : catalog),
    [catalog, searching, q],
  )

  const rows = useMemo(() => {
    if (searching) return matched
    if (!procedureId) return []
    return matched.filter((r) => r.procedureId === procedureId)
  }, [matched, searching, procedureId])

  const procedureMatchCount = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of matched) counts.set(r.procedureId, (counts.get(r.procedureId) ?? 0) + 1)
    return counts
  }, [matched])

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someSelected = rows.some((r) => selected.has(r.id))

  function toggle(row: Row, checked: boolean) {
    if (checked) {
      if (selected.has(row.id)) return
      onSelectedIdsChange([...selectedIds, row.id])
      return
    }
    onSelectedIdsChange(selectedIds.filter((id) => id !== row.id))
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      const next = new Set(selectedIds)
      for (const r of rows) next.add(r.id)
      onSelectedIdsChange([...next])
      return
    }
    const visible = new Set(rows.map((r) => r.id))
    onSelectedIdsChange(selectedIds.filter((id) => !visible.has(id)))
  }

  const canNext = selectedIds.length > 0
  const selectedPeople = useMemo(
    () => selectedIds.map((id) => rowById.get(id)).filter((r): r is Row => r !== undefined),
    [selectedIds, rowById],
  )
  const selectedFromProcedures = useMemo(() => {
    const ids = new Set(selectedPeople.map((r) => r.procedureId))
    return ids.size
  }, [selectedPeople])

  return (
    <>
      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          placeholder="ID, ФИО, должность, ССП, ВСП или логин — по всем процедурам"
          className="pl-8"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {selectedPeople.length > 0 && (
        <div className="rounded-lg border bg-muted/40 px-3 py-2">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium">
              Выбрано {selectedPeople.length}{" "}
              {pluralRu(selectedPeople.length, "участник", "участника", "участников")}
              {selectedFromProcedures > 1
                ? ` из ${selectedFromProcedures} ${pluralRu(selectedFromProcedures, "процедуры", "процедур", "процедур")}`
                : ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onSelectedIdsChange([])}
            >
              Очистить выбор
            </Button>
          </div>
          <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
            {selectedPeople.map((p) => (
              <span
                key={p.id}
                className="inline-flex max-w-full items-center gap-1 rounded-md bg-background px-1.5 py-0.5 text-[11px] ring-1 ring-border"
                title={`${p.fullName} · ${p.procedureName}`}
              >
                <span className="truncate">{p.fullName}</span>
                <button
                  type="button"
                  aria-label={`Убрать ${p.fullName}`}
                  className="rounded-sm text-muted-foreground hover:text-foreground"
                  onClick={() => onSelectedIdsChange(selectedIds.filter((id) => id !== p.id))}
                >
                  <Trash2Icon className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid min-h-96 gap-3 md:grid-cols-[240px_1fr]">
        <aside className="flex flex-col overflow-hidden rounded-lg border">
          <div className="border-b bg-table-head px-3 py-2 text-xs font-semibold">Процедуры</div>
          <div className="max-h-96 overflow-y-auto md:max-h-[28rem]">
            {procedures.map((p) => {
              const activeItem = !searching && p.id === procedureId
              const matchCount = searching ? (procedureMatchCount.get(p.id) ?? 0) : p.participants.length
              const selectedInProc = p.participants.filter((person) => selected.has(person.id)).length
              return (
                <button
                  key={p.id}
                  type="button"
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 border-b px-3 py-2.5 text-left text-xs last:border-b-0 hover:bg-muted/50",
                    activeItem && "bg-muted",
                    searching && matchCount === 0 && "opacity-50",
                  )}
                  onClick={() => {
                    // Только смена списка — выбранные сотрудники не трогаем.
                    setProcedureId(p.id)
                    if (searching) setQuery("")
                  }}
                >
                  <span className="font-medium whitespace-normal">{p.name}</span>
                  <span className="text-muted-foreground">
                    {matchCount} {pluralRu(matchCount, "участник", "участника", "участников")}
                    {selectedInProc > 0 ? ` · выбрано ${selectedInProc}` : ""}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[auto_1fr] items-end gap-2 border-b bg-table-head px-3 py-2 text-xs font-semibold sm:grid-cols-[auto_4.5rem_1fr_0.85fr_0.85fr_0.8fr_1fr] sm:gap-3">
            <Checkbox
              disabled={rows.length === 0}
              checked={allSelected}
              indeterminate={!allSelected && someSelected}
              onCheckedChange={(checked) => toggleAll(Boolean(checked))}
              aria-label="Выбрать всех на экране"
            />
            <span className="leading-tight sm:hidden">Выбрать всех ({rows.length})</span>
            <span className="hidden leading-tight sm:block">
              ID
              <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                Выбрать всех ({rows.length})
              </span>
            </span>
            <span className="hidden leading-tight sm:block">ФИО</span>
            <span className="hidden leading-tight sm:block">Должность</span>
            <span className="hidden leading-tight sm:block">Подразделение ССП</span>
            <span className="hidden leading-tight sm:block">
              Дата формирования персонального отчёта
            </span>
            <span className="hidden leading-tight sm:block">Процедура</span>
          </div>
          <div className="max-h-96 overflow-y-auto md:max-h-[28rem]">
            {rows.length === 0 ? (
              <p className="px-3 py-10 text-center text-xs text-muted-foreground">
                {searching ? "Никого не найдено" : "Выберите процедуру слева"}
              </p>
            ) : (
              rows.map((p) => (
                <label
                  key={`${p.procedureId}-${p.id}`}
                  className="grid cursor-pointer grid-cols-[auto_1fr] items-start gap-2 border-b px-3 py-2 text-xs last:border-b-0 hover:bg-muted/50 sm:grid-cols-[auto_4.5rem_1fr_0.85fr_0.85fr_0.8fr_1fr] sm:gap-3"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={selected.has(p.id)}
                    onCheckedChange={(checked) => toggle(p, Boolean(checked))}
                  />
                  <span className="tabular-nums text-muted-foreground">{p.personnelId || "—"}</span>
                  <span className="font-medium">{p.fullName}</span>
                  <span className="text-muted-foreground">{p.position || "—"}</span>
                  <span className="text-muted-foreground">{p.sspUnit || "—"}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {p.reportFormedAt ? formatDate(p.reportFormedAt) : "—"}
                  </span>
                  <span className="text-muted-foreground">{p.procedureName}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        <Button variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button
          disabled={!canNext}
          onClick={() => {
            const chosen = selectedIds
              .map((id) => rowById.get(id))
              .filter((r): r is Row => r !== undefined)
            onNext(chosen)
          }}
        >
          Далее · группировка
        </Button>
      </DialogFooter>
    </>
  )
}

function GroupingStep({
  people,
  draftGroups,
  assignment,
  highlighted,
  onDraftGroupsChange,
  onAssignmentChange,
  onHighlightedChange,
  onBack,
  onSkip,
  onConfirm,
}: {
  people: Row[]
  draftGroups: DraftGroup[]
  assignment: Record<string, string>
  highlighted: Set<string>
  onDraftGroupsChange: (groups: DraftGroup[]) => void
  onAssignmentChange: (next: Record<string, string>) => void
  onHighlightedChange: (next: Set<string>) => void
  onBack: () => void
  onSkip: () => void
  onConfirm: () => void
}) {
  /** pick — отмечаем сотрудников; assign — выбираем группу для отмеченных. */
  const [phase, setPhase] = useState<"pick" | "assign">("pick")
  const [bulkIds, setBulkIds] = useState<string[]>([])
  const bulk = useMemo(() => new Set(bulkIds), [bulkIds])
  const groupsById = useMemo(() => new Map(draftGroups.map((g) => [g.id, g])), [draftGroups])

  function addGroup() {
    const id = newGroupId()
    onDraftGroupsChange([
      ...draftGroups,
      {
        id,
        name: `Группа ${draftGroups.length + 1}`,
        color: nextGroupColorId(draftGroups.map((g) => g.color)),
      },
    ])
  }

  function removeGroup(id: string) {
    onDraftGroupsChange(draftGroups.filter((g) => g.id !== id))
    const next = { ...assignment }
    for (const [pid, gid] of Object.entries(next)) {
      if (gid === id) delete next[pid]
    }
    onAssignmentChange(next)
  }

  function setGroupColor(id: string, color: string) {
    onDraftGroupsChange(draftGroups.map((g) => (g.id === id ? { ...g, color } : g)))
  }

  function clearPersonGroup(personId: string) {
    const next = { ...assignment }
    delete next[personId]
    onAssignmentChange(next)
  }

  function assignGroupToBulk(groupId: string) {
    if (bulkIds.length === 0) return
    const next = { ...assignment }
    for (const id of bulkIds) next[id] = groupId
    onAssignmentChange(next)
    setBulkIds([])
    setPhase("pick")
  }

  function toggleBulk(personId: string, checked: boolean) {
    if (checked) setBulkIds((ids) => (ids.includes(personId) ? ids : [...ids, personId]))
    else setBulkIds((ids) => ids.filter((id) => id !== personId))
  }

  function toggleBulkAll(checked: boolean) {
    setBulkIds(checked ? people.map((p) => p.id) : [])
  }

  function toggleHighlight(personId: string, checked: boolean) {
    const next = new Set(highlighted)
    if (checked) next.add(personId)
    else next.delete(personId)
    onHighlightedChange(next)
  }

  function toggleHighlightAll(checked: boolean) {
    if (checked) onHighlightedChange(new Set(people.map((p) => p.id)))
    else onHighlightedChange(new Set())
  }

  const assignedCount = people.filter((p) => Boolean(assignment[p.id])).length
  const allBulk = people.length > 0 && people.every((p) => bulk.has(p.id))
  const someBulk = people.some((p) => bulk.has(p.id))
  const allHighlighted = people.length > 0 && people.every((p) => highlighted.has(p.id))
  const someHighlighted = people.some((p) => highlighted.has(p.id))

  return (
    <>
      <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {phase === "pick"
          ? "Отметьте сотрудников слева, затем нажмите «Выбрать группу». Присвоенная группа появится в столбце «Группа» справа, перед «Выделить»."
          : `Выберите группу для ${bulkIds.length} ${pluralRu(bulkIds.length, "участника", "участников", "участников")}. Она отобразится в столбце «Группа».`}{" "}
        Для цвета группы — 6 готовых оттенков или свой цвет из палитры. Если группы не нужны — «Добавить без группировки».
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={addGroup}>
          <PlusIcon /> Создать группу
        </Button>
        <span className="text-xs text-muted-foreground">
          Участников: {people.length}
          {bulkIds.length > 0 && ` · отмечено ${bulkIds.length}`}
          {draftGroups.length > 0 && ` · в группах ${assignedCount}`}
          {highlighted.size > 0 && ` · выделено ${highlighted.size}`}
        </span>
      </div>

      {draftGroups.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {draftGroups.map((g) => {
            const inGroup = people.filter((p) => assignment[p.id] === g.id).length
            const custom = isHexColor(g.color)
            const hex = groupColorHex(g.color)
            return (
              <div
                key={g.id}
                className={cn(
                  "grid gap-2 rounded-lg border px-2 py-2",
                  phase === "assign" && "border-primary/40 bg-primary/5",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn("size-3.5 shrink-0 rounded-full", groupSwatchClass(g.color))}
                    style={groupDotStyle(g.color)}
                    aria-hidden
                  />
                  <Input
                    value={g.name}
                    className="h-7 text-xs"
                    placeholder="Название группы"
                    disabled={phase === "assign"}
                    onChange={(e) =>
                      onDraftGroupsChange(
                        draftGroups.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)),
                      )
                    }
                  />
                  {phase === "assign" ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-[11px]"
                      onClick={() => assignGroupToBulk(g.id)}
                    >
                      Присвоить
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Удалить группу"
                      onClick={() => removeGroup(g.id)}
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                </div>
                {phase === "pick" && (
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    role="radiogroup"
                    aria-label={`Цвет «${g.name}»`}
                  >
                    <span className="mr-1 text-[11px] text-muted-foreground">Цвет:</span>
                    {GROUP_COLOR_OPTIONS.map((c) => {
                      const active = g.color === c.id
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={c.label}
                          title={c.label}
                          className={cn(
                            "size-5 rounded-full ring-offset-1 ring-offset-background transition-shadow",
                            c.swatch,
                            active
                              ? "ring-2 ring-foreground"
                              : "ring-1 ring-border hover:ring-foreground/40",
                          )}
                          onClick={() => setGroupColor(g.id, c.id)}
                        />
                      )
                    })}
                    <label
                      className={cn(
                        "relative size-5 cursor-pointer overflow-hidden rounded-full ring-offset-1 ring-offset-background",
                        custom
                          ? "ring-2 ring-foreground"
                          : "ring-1 ring-border hover:ring-foreground/40",
                      )}
                      title="Свой цвет"
                    >
                      <span
                        className="absolute inset-0"
                        style={{
                          background:
                            "conic-gradient(#f43f5e, #f59e0b, #84cc16, #14b8a6, #3b82f6, #8b5cf6, #f43f5e)",
                        }}
                        aria-hidden
                      />
                      <input
                        type="color"
                        value={hex}
                        aria-label="Выбрать цвет из палитры"
                        className="absolute inset-0 cursor-pointer opacity-0"
                        onChange={(e) => setGroupColor(g.id, e.target.value)}
                      />
                    </label>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      в группе: {inGroup}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {phase === "pick" && (
        <div className="max-h-80 overflow-auto rounded-lg border">
          <div className="grid grid-cols-[auto_1fr_minmax(8rem,11rem)_5.5rem] items-center gap-2 border-b bg-table-head px-3 py-2 text-xs font-semibold">
            <Checkbox
              disabled={people.length === 0}
              checked={allBulk}
              indeterminate={!allBulk && someBulk}
              onCheckedChange={(checked) => toggleBulkAll(Boolean(checked))}
              aria-label="Отметить всех"
            />
            <span>Участник</span>
            <span>Группа</span>
            <span className="inline-flex items-center justify-center gap-1.5">
              <Checkbox
                disabled={people.length === 0}
                checked={allHighlighted}
                indeterminate={!allHighlighted && someHighlighted}
                onCheckedChange={(checked) => toggleHighlightAll(Boolean(checked))}
                aria-label="Выделить всех"
              />
              Выделить
            </span>
          </div>
          {people.map((p) => {
            const group = p.id in assignment ? groupsById.get(assignment[p.id]) : undefined
            return (
              <div
                key={p.id}
                className={cn(
                  "grid grid-cols-[auto_1fr_minmax(8rem,11rem)_5.5rem] items-center gap-2 border-b px-3 py-2 text-xs last:border-b-0",
                  (bulk.has(p.id) || highlighted.has(p.id)) && "bg-muted/50",
                )}
              >
                <Checkbox
                  checked={bulk.has(p.id)}
                  onCheckedChange={(checked) => toggleBulk(p.id, Boolean(checked))}
                  aria-label={`Отметить ${p.fullName}`}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.fullName}</p>
                  <p className="truncate text-muted-foreground">
                    {[p.position || "—", p.procedureName].join(" · ")}
                  </p>
                </div>
                <div className="min-w-0">
                  {group ? (
                    <span
                      className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5"
                      title={group.name}
                    >
                      <span
                        className={cn("size-2.5 shrink-0 rounded-full", groupSwatchClass(group.color))}
                        style={groupDotStyle(group.color)}
                        aria-hidden
                      />
                      <span className="truncate font-medium">{group.name.trim() || "Группа"}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
                        aria-label={`Убрать из группы «${group.name}»`}
                        onClick={() => clearPersonGroup(p.id)}
                      >
                        <Trash2Icon className="size-3" />
                      </button>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="flex justify-center">
                  <Checkbox
                    checked={highlighted.has(p.id)}
                    onCheckedChange={(checked) => toggleHighlight(p.id, Boolean(checked))}
                    aria-label={`Выделить ${p.fullName}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {phase === "assign" && (
        <div className="rounded-lg border px-3 py-3 text-xs">
          <p className="mb-2 font-medium">
            Отмечено {bulkIds.length}{" "}
            {pluralRu(bulkIds.length, "участник", "участника", "участников")}. Нажмите «Присвоить»
            у нужной группы выше.
          </p>
          <ul className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
            {people
              .filter((p) => bulk.has(p.id))
              .map((p) => (
                <li
                  key={p.id}
                  className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]"
                >
                  {p.fullName}
                </li>
              ))}
          </ul>
        </div>
      )}

      <DialogFooter className="gap-2 sm:justify-between">
        {phase === "pick" ? (
          <>
            <Button variant="outline" onClick={onBack}>
              Назад
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onSkip}>
                Добавить без группировки
              </Button>
              <Button
                variant="secondary"
                disabled={bulkIds.length === 0 || draftGroups.length === 0}
                onClick={() => setPhase("assign")}
              >
                Выбрать группу
                {bulkIds.length > 0 ? ` (${bulkIds.length})` : ""}
              </Button>
              <Button onClick={onConfirm} disabled={draftGroups.length === 0 || assignedCount === 0}>
                Добавить с группировкой
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => setPhase("pick")}
            >
              Назад к списку
            </Button>
            <Button
              variant="secondary"
              disabled={draftGroups.length === 0}
              onClick={addGroup}
            >
              <PlusIcon /> Новая группа
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  )
}
