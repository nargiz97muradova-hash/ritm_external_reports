"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useRef, useState, useTransition } from "react"
import { CircleHelpIcon, DownloadIcon, FileTextIcon, LockIcon, LockOpenIcon, PlusIcon, UploadIcon, UserMinusIcon } from "lucide-react"
import { toast } from "sonner"
import { AccessStatus } from "@/app/procedures/_components/access-status"
import { importParticipantsAction } from "@/app/procedures/actions"
import { downloadParticipantsExcel } from "@/app/procedures/_components/excel"
import { ReportDialog } from "@/app/procedures/_components/report-dialog"
import { Cell, EmptyState, HeadCell } from "@/app/procedures/_components/table-bits"
import { useParticipantView } from "@/app/procedures/_components/use-participant-view"
import { ColumnFilter } from "@/components/column-filters"
import { ParticipantAvatar } from "@/components/participant-avatar"
import { TeamReportStatusBadge } from "@/components/status-badge"
import { SimplePagination } from "@/components/simple-pagination"
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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useWarnUnsaved } from "@/components/use-warn-unsaved"
import { teamReportAccessMessage } from "@/lib/access-message"
import { formatLastChange, pluralRu } from "@/lib/format"
import {
  REPORT_CONTENT_SECTIONS,
  allReportContentSectionIds,
  normalizeReportContentSections,
} from "@/lib/report/definitions"
import { groupDotStyle, groupSwatchClass } from "@/lib/report/group-colors"
import type { Participant, ProcedureOption, ReportAccess, TeamReport, TeamReportInput, TeamReportStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  createTeamReportAction,
  setTeamReportAccessAction,
  setTeamReportStatusAction,
  updateTeamReportAction,
  type TeamReportAccessAudience,
} from "../actions"
import { AddMembersDialog } from "./add-members-dialog"
import { EmailSentStatus } from "./email-sent-status"
import { formAfterMemberImport, matchImportedMembers } from "./match-imported-members"
import { PeopleMultiPicker } from "./people-multi-picker"

type Person = Participant & { procedureId: string }

const MEMBERS_PAGE_SIZE = 10
const NO_GROUP = "__none__"

function toInput(report: TeamReport | null): TeamReportInput {
  return {
    name: report?.name ?? "",
    procedureId: report?.procedureId ?? "",
    leaderIds: report?.leaderIds ?? [],
    hrbpIds: report?.hrbpIds ?? [],
    memberIds: report?.memberIds ?? [],
    groups: report?.groups ?? [],
    highlightedIds: report?.highlightedIds ?? [],
    contentSections: normalizeReportContentSections(report?.contentSections),
  }
}

export function TeamReportEditor({
  report,
  procedures,
}: {
  report: TeamReport | null
  procedures: ProcedureOption[]
}) {
  const router = useRouter()
  const initial = useMemo(() => toInput(report), [report])
  const [form, setForm] = useState<TeamReportInput>(initial)
  const [submitted, setSubmitted] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [personalReport, setPersonalReport] = useState<Person | null>(null)
  const [confirmStatus, setConfirmStatus] = useState<TeamReportStatus | null>(null)
  const [membersPage, setMembersPage] = useState(1)
  const [groupFilter, setGroupFilter] = useState<string[]>([])
  const [pending, startTransition] = useTransition()
  const excelInputRef = useRef<HTMLInputElement>(null)

  // После сохранения сервер присылает свежие данные — синхронизируем форму.
  const [syncedFrom, setSyncedFrom] = useState(report)
  if (report !== syncedFrom) {
    setSyncedFrom(report)
    setForm(initial)
    setSelected(new Set())
    setMembersPage(1)
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  useWarnUnsaved(dirty)

  const people = useMemo<Person[]>(
    () => procedures.flatMap((p) => p.participants.map((person) => ({ ...person, procedureId: p.id }))),
    [procedures],
  )
  const procedureNameById = useMemo(
    () => new Map(procedures.map((p) => [p.id, p.name])),
    [procedures],
  )
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])
  const leaders = useMemo(
    () => form.leaderIds.map((id) => byId.get(id)).filter((p) => p !== undefined),
    [form.leaderIds, byId],
  )
  const members = useMemo(
    () => form.memberIds.map((id) => byId.get(id)).filter((p) => p !== undefined),
    [form.memberIds, byId],
  )
  const groupByMemberId = useMemo(() => {
    const map = new Map<string, { name: string; color?: string }>()
    for (const g of form.groups) {
      const name = g.name.trim()
      if (!name) continue
      for (const id of g.memberIds) map.set(id, { name, color: g.color })
    }
    return map
  }, [form.groups])
  const procedureId =
    leaders[0]?.procedureId ?? members[0]?.procedureId ?? form.procedureId
  const procedurePeople = useMemo(
    () => (procedureId ? people.filter((p) => p.procedureId === procedureId) : []),
    [people, procedureId],
  )
  const leaderCandidates = useMemo(
    () => (procedureId ? procedurePeople : people),
    [procedureId, people, procedurePeople],
  )
  const leaderSet = useMemo(() => new Set(form.leaderIds), [form.leaderIds])
  const takenIds = useMemo(
    () => new Set([...form.leaderIds, ...form.memberIds]),
    [form.leaderIds, form.memberIds],
  )
  const memberProcedures = useMemo(
    () =>
      procedures
        .map((p) => ({
          id: p.id,
          name: p.name,
          participants: p.participants.filter((person) => !takenIds.has(person.id)),
        }))
        .filter((p) => p.participants.length > 0),
    [procedures, takenIds],
  )
  const hrbpCandidates = useMemo(
    () => people.filter((p) => !leaderSet.has(p.id)),
    [people, leaderSet],
  )

  const view = useParticipantView(members)
  const groupFilterOptions = useMemo(() => {
    const options = form.groups
      .filter((g) => g.name.trim())
      .map((g) => ({ value: g.id, label: g.name.trim() }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"))
    if (members.some((m) => !groupByMemberId.has(m.id))) {
      options.push({ value: NO_GROUP, label: "Без группы" })
    }
    return options
  }, [form.groups, members, groupByMemberId])
  const memberRows = useMemo(() => {
    if (groupFilter.length === 0) return view.rows
    const selectedGroups = new Set(groupFilter)
    return view.rows.filter((p) => {
      const groupId = form.groups.find((g) => g.memberIds.includes(p.id))?.id ?? NO_GROUP
      return selectedGroups.has(groupId)
    })
  }, [view.rows, groupFilter, form.groups])
  const membersFiltered = view.isFiltered || groupFilter.length > 0
  const membersPageCount = Math.max(1, Math.ceil(memberRows.length / MEMBERS_PAGE_SIZE))
  const currentMembersPage = Math.min(membersPage, membersPageCount)
  const pageRows = memberRows.slice(
    (currentMembersPage - 1) * MEMBERS_PAGE_SIZE,
    currentMembersPage * MEMBERS_PAGE_SIZE,
  )
  const visibleIds = pageRows.map((p) => p.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someSelected = visibleIds.some((id) => selected.has(id))

  function resetMemberFilters() {
    view.reset()
    setGroupFilter([])
  }

  const memberQuery = `${membersFiltered}:${memberRows.length}:${groupFilter.join(",")}`
  const [memberQuerySeen, setMemberQuerySeen] = useState(memberQuery)
  if (memberQuerySeen !== memberQuery) {
    setMemberQuerySeen(memberQuery)
    setMembersPage(1)
  }

  const errors = {
    name: !form.name.trim() ? "Укажите название" : null,
    members: members.length === 0 ? "Добавьте в команду хотя бы одного участника" : null,
    procedureId: members.length > 0 && !procedureId ? "Не удалось определить процедуру команды" : null,
    content:
      form.contentSections.length === 0
        ? "Выберите хотя бы один раздел содержания отчёта"
        : null,
  }
  const hasErrors = Object.values(errors).some(Boolean)
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : null)

  const canEdit = !report || report.status !== "archived"
  const canEditMembers = !report || report.status === "draft"
  const canEditContent = !report || report.status === "draft"
  const canOpenAccess = report?.status === "active"
  const isArchived = report?.status === "archived"
  const contentSelected = new Set(form.contentSections)
  const allContentSelected = REPORT_CONTENT_SECTIONS.every((s) => contentSelected.has(s.id))
  const someContentSelected = REPORT_CONTENT_SECTIONS.some((s) => contentSelected.has(s.id))

  function toggleContentSection(id: string, checked: boolean | "indeterminate") {
    if (!canEditContent) return
    const on = checked === true
    setForm((f) => {
      const next = new Set(f.contentSections)
      if (on) next.add(id)
      else next.delete(id)
      return {
        ...f,
        contentSections: REPORT_CONTENT_SECTIONS.map((s) => s.id).filter((sid) => next.has(sid)),
      }
    })
  }

  function toggleAllContentSections(checked: boolean | "indeterminate") {
    if (!canEditContent) return
    set("contentSections", checked === true ? allReportContentSectionIds() : [])
  }

  function set<K extends keyof TeamReportInput>(key: K, value: TeamReportInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setLeaders(ids: string[]) {
    if (ids.length === 0) {
      setForm((f) => ({ ...f, leaderIds: [] }))
      return
    }
    const first = byId.get(ids[0])
    if (!first) return
    // Руководители — из одной процедуры; участники команды могут быть из нескольких.
    const nextIds = ids.filter((id) => byId.get(id)?.procedureId === first.procedureId)
    const nextSet = new Set(nextIds)
    if (!canEditMembers) {
      if (nextIds.some((id) => form.memberIds.includes(id))) {
        toast.error("Добавлять и убирать сотрудников можно только в статусе «Черновик»")
        return
      }
      setForm((f) => ({
        ...f,
        leaderIds: nextIds,
        procedureId: first.procedureId,
        hrbpIds: f.hrbpIds.filter((h) => !nextSet.has(h)),
      }))
      return
    }
    setForm((f) => {
      const memberIds = f.memberIds.filter((m) => !nextSet.has(m))
      const memberSet = new Set(memberIds)
      return {
        ...f,
        leaderIds: nextIds,
        procedureId: first.procedureId,
        memberIds,
        hrbpIds: f.hrbpIds.filter((h) => !nextSet.has(h)),
        groups: f.groups
          .map((g) => ({ ...g, memberIds: g.memberIds.filter((id) => memberIds.includes(id)) }))
          .filter((g) => g.memberIds.length > 0),
        highlightedIds: f.highlightedIds.filter((id) => memberSet.has(id) || nextSet.has(id)),
      }
    })
  }

  function removeSelected() {
    if (!canEditMembers) return
    const n = selected.size
    const memberIds = form.memberIds.filter((id) => !selected.has(id))
    setForm((f) => ({
      ...f,
      memberIds,
      groups: f.groups
        .map((g) => ({ ...g, memberIds: g.memberIds.filter((id) => !selected.has(id)) }))
        .filter((g) => g.memberIds.length > 0),
      highlightedIds: f.highlightedIds.filter((id) => !selected.has(id)),
    }))
    setSelected(new Set())
    toast.success(
      `Из команды ${pluralRu(n, "убран", "убраны", "убраны")} ${n} ${pluralRu(n, "участник", "участника", "участников")}. Нажмите «Сохранить», чтобы применить изменения.`,
    )
  }

  /** Назначает группу одному или нескольким участникам (пустой groupId — без группы). */
  function assignMembersToGroup(memberIds: string[], groupId: string | null) {
    if (!canEditMembers || memberIds.length === 0) return
    const ids = new Set(memberIds)
    setForm((f) => ({
      ...f,
      groups: f.groups.map((g) => {
        const without = g.memberIds.filter((id) => !ids.has(id))
        if (groupId && g.id === groupId) {
          return { ...g, memberIds: [...new Set([...without, ...memberIds])] }
        }
        return { ...g, memberIds: without }
      }),
    }))
  }

  const groupSelectItems = useMemo(
    () => [
      { value: NO_GROUP, label: "Без группы" },
      ...form.groups.map((g) => ({
        value: g.id,
        label: g.name.trim() || "Без названия",
      })),
    ],
    [form.groups],
  )

  /** Загрузка Excel: сопоставление по внешнему логину с участниками запущенных процедур. */
  function importExcel(file: File) {
    if (!canEditMembers) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set("file", file)
      const res = await importParticipantsAction(fd)
      if (!res.ok) return void toast.error(res.error)

      const plan = matchImportedMembers(
        res.data.participants,
        people,
        procedureId || null,
        form.memberIds,
        form.leaderIds,
      )
      if (!plan.matched) {
        return void toast.warning(
          plan.unknown || plan.duplicates
            ? "Новых участников не добавлено: логины не найдены в процедурах или уже в команде"
            : "В файле нет строк с сотрудниками",
        )
      }

      setForm((current) => ({
        ...current,
        ...formAfterMemberImport(current, plan.accepted),
      }))

      const skipped = plan.unknown + plan.duplicates
      toast.success(
        `Загружено: ${plan.accepted.length}` +
          (skipped ? `, пропущено: ${skipped}` : "") +
          ". Нажмите «Сохранить», чтобы применить изменения.",
      )
    })
  }

  function save() {
    setSubmitted(true)
    if (hasErrors) return void toast.error("Заполните обязательные поля и добавьте участников")
    const payload: TeamReportInput = {
      ...form,
      procedureId,
    }
    startTransition(async () => {
      if (report) {
        const res = await updateTeamReportAction(report.id, payload)
        if (!res.ok) return void toast.error(res.error)
        toast.success("Изменения сохранены")
        router.refresh()
      } else {
        const res = await createTeamReportAction(payload)
        if (!res.ok) return void toast.error(res.error)
        toast.success("Командный отчёт создан")
        router.replace(`/team-reports/${res.data.id}`)
      }
    })
  }

  function changeStatus(next: TeamReportStatus) {
    if (!report) return
    if (dirty) return void toast.error("Сначала сохраните изменения")
    startTransition(async () => {
      const res = await setTeamReportStatusAction(report.id, next)
      setConfirmStatus(null)
      if (!res.ok) return void toast.error(res.error)
      toast.success(
        next === "archived"
          ? "Отчёт отправлен в архив"
          : next === "draft"
            ? "Отчёт возвращён в черновик"
            : report.status === "archived"
              ? "Отчёт восстановлен"
              : "Отчёт активирован",
      )
      router.refresh()
    })
  }

  function toggleAccess(audience: TeamReportAccessAudience, sendEmail = false) {
    if (!report || !canOpenAccess) return
    const current = audience === "hrbp" ? report.hrbpReportAccess : report.reportAccess
    const next: Exclude<ReportAccess, null> = current === "open" ? "closed" : "open"
    startTransition(async () => {
      const res = await setTeamReportAccessAction(report.id, next, audience, { sendEmail })
      if (!res.ok) return void toast.error(res.error)
      toast.success(teamReportAccessMessage(audience, next === "open", sendEmail))
      router.refresh()
    })
  }

  if (procedures.length === 0 && !report) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl bg-background p-10 text-center shadow-xs">
        <h1 className="text-base font-semibold">Нет запущенных процедур</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Командный отчёт собирается из участников процедуры, которая уже запущена. Запустите
          процедуру и возвращайтесь.
        </p>
        <Button render={<Link href="/procedures" />} nativeButton={false}>
          К списку процедур
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-xl bg-background shadow-xs">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <h1 className="text-base font-semibold">Данные командного отчёта</h1>
          {report && <TeamReportStatusBadge status={report.status} />}
          {report && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {report.status === "draft" && (
                <Button size="sm" disabled={pending || members.length === 0} onClick={() => setConfirmStatus("active")}>
                  Активировать
                </Button>
              )}
              {report.status === "active" && (
                <>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirmStatus("draft")}>
                    Вернуть в черновик
                  </Button>
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => setConfirmStatus("archived")}>
                    В архив
                  </Button>
                </>
              )}
              {report.status === "archived" && (
                <Button size="sm" disabled={pending} onClick={() => setConfirmStatus("active")}>
                  Восстановить
                </Button>
              )}
              <Button
                variant="secondary"
                render={<Link href={`/team-reports/${report.id}/report`} />}
                nativeButton={false}
                onClick={(e) => {
                  if (!dirty) return
                  e.preventDefault()
                  toast.error("Сначала сохраните изменения")
                }}
              >
                <FileTextIcon /> Командный отчёт
              </Button>
            </div>
          )}
        </div>
        <div className="grid gap-5 p-4">
          {isArchived && (
            <p className="text-xs text-muted-foreground">
              Отчёт в архиве: доступ руководителю и сотруднику ДРП закрыт. Администратор может
              просматривать данные, редактирование недоступно.
            </p>
          )}
          <Field id="name" label="Название" error={show("name")} required>
            <Input
              id="name"
              className="w-1/2"
              value={form.name}
              placeholder="Например, команда отдела аналитики"
              disabled={!canEdit}
              aria-invalid={!!show("name") || undefined}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="overflow-hidden rounded-lg border border-primary/25 bg-primary/5">
              <h3 className="flex items-center gap-1.5 border-b border-primary/15 bg-primary/10 px-3 py-2 text-sm font-semibold">
                <Label htmlFor="leader" className="text-sm font-semibold">
                  Руководитель
                </Label>
                <Hint
                  label="Где руководитель увидит отчёт"
                  text="Увидит командный отчёт в сервисе «Оценка», в разделе «Внешняя оценка»."
                />
              </h3>
              <div className="grid content-start gap-3 p-3">
                <PeopleMultiPicker
                  id="leader"
                  participants={leaderCandidates}
                  value={form.leaderIds}
                  disabled={!canEdit || people.length === 0}
                  placeholder="Выберите руководителей"
                  listLabel="Руководители"
                  removeRoleLabel="руководителя"
                  onChange={setLeaders}
                />
                {report && (
                  <AccessControls
                    label="Доступ для руководителя"
                    access={report.reportAccess}
                    emailSent={report.reportEmailSent}
                    pending={pending}
                    disabled={!canOpenAccess}
                    onToggle={(sendEmail) => toggleAccess("leader", sendEmail)}
                  />
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-primary/25 bg-primary/5">
              <h3 className="flex items-center gap-1.5 border-b border-primary/15 bg-primary/10 px-3 py-2 text-sm font-semibold">
                <Label htmlFor="hrbp" className="text-sm font-semibold">
                  Сотрудник ДРП
                </Label>
                <Hint
                  label="Где сотрудник ДРП увидит отчёт"
                  text="Увидит командный отчёт в администрировании сервиса «Внешняя оценка»."
                />
              </h3>
              <div className="grid content-start gap-3 p-3">
                <PeopleMultiPicker
                  id="hrbp"
                  participants={hrbpCandidates}
                  value={form.hrbpIds}
                  disabled={!canEdit || people.length === 0}
                  placeholder="Выберите сотрудников ДРП"
                  listLabel="Сотрудники ДРП"
                  removeRoleLabel="сотрудника ДРП"
                  onChange={(ids) => set("hrbpIds", ids)}
                />
                {report && (
                  <AccessControls
                    label="Доступ для сотрудника ДРП"
                    access={report.hrbpReportAccess ?? "closed"}
                    emailSent={report.hrbpEmailSent}
                    pending={pending}
                    disabled={!canOpenAccess}
                    onToggle={(sendEmail) => toggleAccess("hrbp", sendEmail)}
                  />
                )}
              </div>
            </section>
          </div>
        </div>
        {report && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-t px-4 py-3 text-xs text-muted-foreground">
            <span>Создатель отчёта: {report.creator}</span>
            <span>Последнее изменение: {formatLastChange(report.updatedAt, report.updatedBy)}</span>
          </div>
        )}
      </section>

      <section className="rounded-xl bg-background shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-base font-semibold">Содержание командного отчёта</h2>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {canEditContent ? (
            <p className="text-xs text-muted-foreground">
              Отметьте разделы, которые войдут в командный отчёт. После «Сохранить» они появятся на
              странице отчёта.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Содержание отчёта можно менять только в статусе «Черновик».
            </p>
          )}
          {show("content") && <p className="text-xs text-destructive">{show("content")}</p>}
          <label className="inline-flex w-fit items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={allContentSelected}
              indeterminate={!allContentSelected && someContentSelected}
              disabled={!canEditContent}
              onCheckedChange={toggleAllContentSections}
              aria-label="Выбрать все разделы"
            />
            Выбрать все
          </label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {REPORT_CONTENT_SECTIONS.map((section) => (
              <label
                key={section.id}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm",
                  canEditContent ? "cursor-pointer hover:bg-muted" : "cursor-default opacity-80",
                )}
              >
                <Checkbox
                  className="mt-0.5"
                  checked={contentSelected.has(section.id)}
                  disabled={!canEditContent}
                  onCheckedChange={(checked) => toggleContentSection(section.id, checked)}
                />
                <span>{section.title}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-background shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-base font-semibold">Список сотрудников</h2>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {isArchived ? (
            <p className="text-xs text-muted-foreground">
              Архивный отчёт доступен только для просмотра.
            </p>
          ) : (
            !canEditMembers && (
              <p className="text-xs text-muted-foreground">
                Состав команды можно менять только в статусе «Черновик».
              </p>
            )
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={!canEditMembers || memberProcedures.length === 0} onClick={() => setAddOpen(true)}>
              <PlusIcon /> Добавить сотрудников
            </Button>
            <Button variant="destructive" disabled={!canEditMembers || selected.size === 0} onClick={removeSelected}>
              <UserMinusIcon /> Удалить сотрудников{selected.size > 0 && ` (${selected.size})`}
            </Button>
            {canEditMembers && form.groups.length > 0 && selected.size > 0 && (
              <Select
                key={selected.size}
                items={groupSelectItems}
                onValueChange={(v) => {
                  if (!v) return
                  const n = selected.size
                  assignMembersToGroup([...selected], v === NO_GROUP ? null : v)
                  toast.success(
                    `Группа обновлена для ${n} ${pluralRu(n, "сотрудника", "сотрудников", "сотрудников")}. Нажмите «Сохранить».`,
                  )
                }}
              >
                <SelectTrigger className="h-8 w-52 text-xs">
                  <SelectValue placeholder="Группа для выбранных" />
                </SelectTrigger>
                <SelectContent>
                  {groupSelectItems.map((item) => {
                    const opt = form.groups.find((g) => g.id === item.value)
                    return (
                      <SelectItem key={item.value} value={item.value}>
                        <span className="inline-flex items-center gap-1.5">
                          {opt && (
                            <span
                              className={cn(
                                "size-2.5 shrink-0 rounded-full",
                                groupSwatchClass(opt.color),
                              )}
                              style={groupDotStyle(opt.color)}
                              aria-hidden
                            />
                          )}
                          {item.label}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  startTransition(() =>
                    downloadParticipantsExcel(members, form.name || "Список сотрудников"),
                  )
                }
              >
                <DownloadIcon /> Скачать Excel
              </Button>
              <Button
                variant="secondary"
                disabled={!canEditMembers || pending || people.length === 0}
                onClick={() => excelInputRef.current?.click()}
              >
                <UploadIcon /> Загрузить Excel
              </Button>
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                disabled={!canEditMembers}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (file) importExcel(file)
                }}
              />
            </div>
          </div>
          {memberProcedures.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Нет доступных участников для добавления в команду.
            </p>
          )}

          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <Table className="w-full min-w-[1140px] table-fixed text-xs">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                  <HeadCell
                    className="w-10"
                    label={
                      <Checkbox
                        aria-label="Выбрать всех"
                        disabled={!canEditMembers || visibleIds.length === 0}
                        checked={allSelected}
                        indeterminate={!allSelected && someSelected}
                        onCheckedChange={(checked) => {
                          const next = new Set(selected)
                          for (const id of visibleIds) {
                            if (checked) next.add(id)
                            else next.delete(id)
                          }
                          setSelected(next)
                        }}
                      />
                    }
                  />
                  <HeadCell label="" className="w-12" />
                  <HeadCell
                    label="ID"
                    className="w-[7%]"
                    view={view}
                    sortKey="personnelId"
                    searchKey="personnelId"
                  />
                  <HeadCell
                    label="ФИО"
                    className="w-[14%]"
                    view={view}
                    sortKey="fullName"
                    searchKey="fullName"
                  />
                  <HeadCell
                    label="Должность"
                    className="w-[13%]"
                    view={view}
                    filterKey="position"
                    participants={members}
                  />
                  <HeadCell
                    label="Подразделение ССП"
                    className="w-[13%]"
                    view={view}
                    filterKey="sspUnit"
                    participants={members}
                  />
                  <HeadCell
                    label="Подразделение ВСП"
                    className="w-[13%]"
                    view={view}
                    filterKey="vspUnit"
                    participants={members}
                  />
                  <HeadCell label="Процедура" className="w-[11%]" />
                  <HeadCell
                    label={
                      <span className="inline-flex items-center gap-1">
                        Группа
                        <ColumnFilter
                          label="Группа"
                          options={groupFilterOptions}
                          selected={groupFilter}
                          onChange={setGroupFilter}
                        />
                      </span>
                    }
                    className="w-[11%]"
                  />
                  <HeadCell label="Персональный отчёт" className="w-28 text-center" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberRows.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={10}>
                      <EmptyState filtered={membersFiltered} onReset={resetMemberFilters} />
                    </TableCell>
                  </TableRow>
                )}
                {pageRows.map((p) => {
                  const hasReport = p.reportAccess !== null
                  const group = groupByMemberId.get(p.id)
                  return (
                    <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                      <TableCell className="w-10">
                        <Checkbox
                          aria-label={`Выбрать ${p.fullName}`}
                          disabled={!canEditMembers}
                          checked={selected.has(p.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selected)
                            if (checked) next.add(p.id)
                            else next.delete(p.id)
                            setSelected(next)
                          }}
                        />
                      </TableCell>
                      <TableCell className="w-12">
                        <ParticipantAvatar fullName={p.fullName} />
                      </TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap">
                        <Cell>{p.personnelId || "—"}</Cell>
                      </TableCell>
                      <TableCell className="whitespace-normal">{p.fullName}</TableCell>
                      <TableCell className="whitespace-normal"><Cell>{p.position}</Cell></TableCell>
                      <TableCell className="whitespace-normal"><Cell>{p.sspUnit}</Cell></TableCell>
                      <TableCell className="whitespace-normal"><Cell>{p.vspUnit}</Cell></TableCell>
                      <TableCell className="whitespace-normal">
                        <Cell>{procedureNameById.get(p.procedureId) ?? "—"}</Cell>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {canEditMembers && form.groups.length > 0 ? (
                          <Select
                            items={groupSelectItems}
                            value={
                              form.groups.find((g) => g.memberIds.includes(p.id))?.id ?? NO_GROUP
                            }
                            onValueChange={(v) => {
                              if (!v) return
                              assignMembersToGroup([p.id], v === NO_GROUP ? null : v)
                            }}
                          >
                            <SelectTrigger
                              className="h-7 w-full min-w-0 text-xs"
                              aria-label={`Группа: ${p.fullName}`}
                            >
                              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                                {group && (
                                  <span
                                    className={cn(
                                      "size-2.5 shrink-0 rounded-full",
                                      groupSwatchClass(group.color),
                                    )}
                                    style={groupDotStyle(group.color)}
                                    aria-hidden
                                  />
                                )}
                                <SelectValue />
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              {groupSelectItems.map((item) => {
                                const opt = form.groups.find((g) => g.id === item.value)
                                return (
                                  <SelectItem key={item.value} value={item.value}>
                                    <span className="inline-flex items-center gap-1.5">
                                      {opt && (
                                        <span
                                          className={cn(
                                            "size-2.5 shrink-0 rounded-full",
                                            groupSwatchClass(opt.color),
                                          )}
                                          style={groupDotStyle(opt.color)}
                                          aria-hidden
                                        />
                                      )}
                                      {item.label}
                                    </span>
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        ) : group ? (
                          <span className="inline-flex max-w-full items-center gap-1.5">
                            <span
                              className={cn(
                                "size-2.5 shrink-0 rounded-full",
                                groupSwatchClass(group.color),
                              )}
                              style={groupDotStyle(group.color)}
                              aria-hidden
                            />
                            <span className="truncate">{group.name}</span>
                          </span>
                        ) : (
                          <Cell>{form.groups.length === 0 ? "Нет групп" : "—"}</Cell>
                        )}
                      </TableCell>
                      <TableCell className="w-28 text-center">
                        <Button
                          size="icon-sm"
                          variant="secondary"
                          disabled={!hasReport}
                          className={cn(hasReport && "text-primary")}
                          aria-label={`Персональный отчёт: ${p.fullName}`}
                          onClick={() => setPersonalReport(p)}
                        >
                          <FileTextIcon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {memberRows.length > 0 && (
            <SimplePagination
              total={memberRows.length}
              page={currentMembersPage}
              pageCount={membersPageCount}
              onPageChange={setMembersPage}
            />
          )}
          {show("members") && <p className="text-xs text-destructive">{show("members")}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
          <Button size="lg" className="px-4" disabled={pending || !canEdit} onClick={save}>
            Сохранить
          </Button>
          {dirty && canEdit && (
            <span className="text-xs text-muted-foreground">Есть несохранённые изменения</span>
          )}
        </div>
      </section>

      <AddMembersDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        procedures={memberProcedures}
        initialProcedureId={procedureId || undefined}
        existingGroups={form.groups}
        onAdd={({ memberIds: ids, groups: newGroups, highlightedIds: newHighlighted }) => {
          if (!canEditMembers) return
          const addedSet = new Set(ids)
          setForm((f) => {
            const memberIds = [...f.memberIds.filter((id) => !addedSet.has(id)), ...ids]
            const memberSet = new Set(memberIds)
            const primaryProcedureId =
              f.procedureId ||
              byId.get(f.leaderIds[0] ?? "")?.procedureId ||
              byId.get(ids[0] ?? "")?.procedureId ||
              ""
            const merged = new Map(
              f.groups
                .map((g) => ({
                  ...g,
                  memberIds: g.memberIds.filter((id) => memberSet.has(id)),
                }))
                .filter((g) => g.memberIds.length > 0)
                .map((g) => [g.id, g] as const),
            )
            for (const g of newGroups) {
              const prev = merged.get(g.id)
              if (prev) {
                merged.set(g.id, {
                  ...prev,
                  name: g.name || prev.name,
                  color: g.color ?? prev.color,
                  memberIds: [...new Set([...prev.memberIds, ...g.memberIds])],
                })
              } else if (g.memberIds.length > 0) {
                merged.set(g.id, g)
              }
            }
            return {
              ...f,
              procedureId: primaryProcedureId,
              memberIds,
              leaderIds: f.leaderIds.filter((id) => !addedSet.has(id)),
              groups: [...merged.values()],
              highlightedIds: [
                ...f.highlightedIds.filter((id) => memberSet.has(id) && !addedSet.has(id)),
                ...newHighlighted.filter((id) => memberSet.has(id)),
              ],
            }
          })
          setSelected(new Set())
          setAddOpen(false)
          toast.success(
            `Добавлено ${ids.length} ${pluralRu(ids.length, "участник", "участника", "участников")}` +
              (newGroups.length
                ? ` · ${newGroups.length} ${pluralRu(newGroups.length, "группа", "группы", "групп")}`
                : ""),
          )
        }}
      />
      <ReportDialog
        participant={personalReport}
        procedureName={
          personalReport
            ? (procedureNameById.get(personalReport.procedureId) ?? "—")
            : ""
        }
        onOpenChange={(open) => !open && setPersonalReport(null)}
      />
      <AlertDialog open={confirmStatus !== null} onOpenChange={(open) => !open && !pending && setConfirmStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmStatus === "archived"
                ? "Отправить отчёт в архив?"
                : confirmStatus === "draft"
                  ? "Вернуть отчёт в черновик?"
                  : report?.status === "archived"
                    ? "Восстановить отчёт?"
                    : "Активировать отчёт?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmStatus === "archived"
                ? "Доступ руководителя и сотрудника ДРП будет закрыт. Администратор сможет просматривать отчёт, но не редактировать."
                : confirmStatus === "draft"
                  ? "Состав команды снова можно будет менять. Доступ руководителя и сотрудника ДРП будет закрыт."
                  : report?.status === "archived"
                    ? "Отчёт снова станет активным. При необходимости откройте доступ руководителю и сотруднику ДРП."
                    : "После активации состав команды нельзя будет менять. Отчёт можно будет показать руководителю и сотруднику ДРП."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending || !confirmStatus}
              onClick={() => confirmStatus && changeStatus(confirmStatus)}
            >
              {confirmStatus === "archived"
                ? "В архив"
                : confirmStatus === "draft"
                  ? "Вернуть в черновик"
                  : report?.status === "archived"
                    ? "Восстановить"
                    : "Активировать"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AccessControls({
  label,
  access,
  emailSent,
  pending,
  disabled,
  onToggle,
}: {
  label: string
  access: Exclude<ReportAccess, null>
  emailSent: boolean
  pending: boolean
  disabled?: boolean
  onToggle: (sendEmail: boolean) => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sendEmail, setSendEmail] = useState(true)
  const closing = access === "open"
  const actionLabel = closing ? "Закрыть доступ" : "Открыть доступ"

  return (
    <>
      <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-xs whitespace-nowrap">
            <span className="font-semibold">{label}:</span> <AccessStatus access={access} />
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || disabled}
            title={disabled ? "Доступ открывается в статусе «Активный»" : undefined}
            onClick={() => {
              setSendEmail(true)
              setConfirmOpen(true)
            }}
          >
            {closing ? <LockIcon /> : <LockOpenIcon />}
            {actionLabel}
          </Button>
        </div>
        <EmailSentStatus sent={emailSent} />
        {disabled && (
          <p className="text-xs text-muted-foreground">
            Показать отчёт можно только в статусе «Активный».
          </p>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{actionLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              {closing
                ? `${label} будет закрыт. Получатели больше не смогут открыть отчёт.`
                : `${label} будет открыт. Получатели смогут просматривать отчёт.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!closing && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(Boolean(v))} />
              Отправить письмо на электронную почту
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant={closing ? "destructive" : "default"}
              disabled={pending}
              onClick={() => {
                setConfirmOpen(false)
                onToggle(closing ? false : sendEmail)
              }}
            >
              {actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Hint({ label, text }: { label: string; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className="inline-flex size-5 items-center justify-center rounded-full text-primary/80 hover:bg-primary/10 hover:text-primary"
          />
        }
      >
        <CircleHelpIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-72 whitespace-normal text-left">{text}</TooltipContent>
    </Tooltip>
  )
}

function Field({
  id,
  label,
  error,
  required,
  children,
}: {
  id: string
  label: string
  error?: string | null
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id} className="text-xs font-semibold">
        {required && <span className="text-destructive">*</span>}
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
