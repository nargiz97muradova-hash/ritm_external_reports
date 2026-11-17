"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"
import { ChartColumnIcon, DownloadIcon, LockIcon, LockOpenIcon, PlusIcon, UserMinusIcon } from "lucide-react"
import { toast } from "sonner"
import { AccessStatus } from "@/app/procedures/_components/access-status"
import { downloadParticipantsExcel } from "@/app/procedures/_components/excel"
import { Cell, EmptyState, HeadCell } from "@/app/procedures/_components/table-bits"
import { useParticipantView } from "@/app/procedures/_components/use-participant-view"
import { ParticipantAvatar } from "@/components/participant-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { pluralRu } from "@/lib/format"
import {
  memberKey,
  type MemberRef,
  type Participant,
  type ProcedureOption,
  type TeamReport,
  type TeamReportInput,
} from "@/lib/types"
import {
  createTeamReportAction,
  setTeamReportAccessAction,
  updateTeamReportAction,
} from "../actions"
import { AddMembersDialog } from "./add-members-dialog"
import { HrbpPicker } from "./hrbp-picker"
import { LeadersPicker } from "./leader-picker"
import { TeamReportActionsMenu } from "./team-report-actions-menu"

function toInput(report: TeamReport | null): TeamReportInput {
  return {
    name: report?.name ?? "",
    leaders: report?.leaders ?? [],
    hrbpIds: report?.hrbpIds ?? [],
    members: report?.members ?? [],
  }
}

/** Строка таблицы команды: участник + его процедура. id = ключ участника. */
type MemberRow = Participant & { ref: MemberRef; procedureName: string }

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
  const [pending, startTransition] = useTransition()

  // После сохранения сервер присылает свежие данные — синхронизируем форму.
  const [syncedFrom, setSyncedFrom] = useState(report)
  if (report !== syncedFrom) {
    setSyncedFrom(report)
    setForm(initial)
    setSelected(new Set())
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  /** Все участники запущенных процедур по ключу «процедура:участник». */
  const lookup = useMemo(() => {
    const map = new Map<string, MemberRow>()
    for (const procedure of procedures) {
      for (const p of procedure.participants) {
        const ref = { procedureId: procedure.id, participantId: p.id }
        map.set(memberKey(ref), { ...p, id: memberKey(ref), ref, procedureName: procedure.name })
      }
    }
    return map
  }, [procedures])

  const leaders = useMemo(
    () => form.leaders.map((ref) => lookup.get(memberKey(ref))).filter((m) => m !== undefined),
    [form.leaders, lookup],
  )
  const members = useMemo(
    () => form.members.map((ref) => lookup.get(memberKey(ref))).filter((m) => m !== undefined),
    [form.members, lookup],
  )
  const memberKeys = useMemo(() => new Set(form.members.map(memberKey)), [form.members])
  const memberLogins = useMemo(
    () => new Set(members.map((m) => m.externalLogin.toLowerCase())),
    [members],
  )
  const leaderLogins = useMemo(
    () => new Set(leaders.map((m) => m.externalLogin.toLowerCase())),
    [leaders],
  )

  const view = useParticipantView(members)
  const rows = view.rows as MemberRow[]
  const visibleIds = rows.map((p) => p.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someSelected = visibleIds.some((id) => selected.has(id))
  const showProcedure = new Set(members.map((m) => m.ref.procedureId)).size > 1

  const errors = {
    name: !form.name.trim() ? "Укажите название" : null,
    leaders: leaders.length === 0 ? "Выберите хотя бы одного руководителя" : null,
    members: members.length === 0 ? "Добавьте в команду хотя бы одного участника" : null,
  }
  const hasErrors = Object.values(errors).some(Boolean)
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : null)

  function removeSelected() {
    const n = selected.size
    setForm((f) => ({ ...f, members: f.members.filter((m) => !selected.has(memberKey(m))) }))
    setSelected(new Set())
    toast.success(
      `Из команды ${pluralRu(n, "убран", "убраны", "убраны")} ${n} ${pluralRu(n, "участник", "участника", "участников")}. Нажмите «Сохранить», чтобы применить изменения.`,
    )
  }

  function save() {
    setSubmitted(true)
    if (hasErrors) return void toast.error("Заполните обязательные поля и добавьте участников")
    startTransition(async () => {
      if (report) {
        const res = await updateTeamReportAction(report.id, form)
        if (!res.ok) return void toast.error(res.error)
        toast.success("Изменения сохранены")
        router.refresh()
      } else {
        const res = await createTeamReportAction(form)
        if (!res.ok) return void toast.error(res.error)
        toast.success("Командный отчёт создан")
        router.replace(`/team-reports/${res.data.id}`)
      }
    })
  }

  function toggleAccess() {
    if (!report) return
    startTransition(async () => {
      const next = report.reportAccess === "open" ? "closed" : "open"
      const res = await setTeamReportAccessAction(report.id, next)
      if (!res.ok) return void toast.error(res.error)
      toast.success(next === "open" ? "Доступ руководителям открыт" : "Доступ руководителям закрыт")
      router.refresh()
    })
  }

  if (procedures.length === 0 && !report) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl bg-background p-10 text-center shadow-xs">
        <h1 className="text-base font-semibold">Нет запущенных процедур</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Командный отчёт собирается из участников запущенных процедур. Запустите процедуру и
          возвращайтесь.
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
          {report && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1 text-xs">
                Доступ руководителей: <AccessStatus access={report.reportAccess} />
              </span>
              <Button variant="outline" disabled={pending} onClick={toggleAccess}>
                {report.reportAccess === "open" ? <LockIcon /> : <LockOpenIcon />}
                {report.reportAccess === "open" ? "Закрыть доступ" : "Открыть доступ"}
              </Button>
              <Button
                variant="secondary"
                render={<Link href={`/team-reports/${report.id}/report`} />}
                nativeButton={false}
              >
                <ChartColumnIcon /> Просмотр отчёта
              </Button>
              <TeamReportActionsMenu
                id={report.id}
                name={report.name}
                access={report.reportAccess}
                showOpen={false}
                afterDelete={() => router.replace("/team-reports")}
              />
            </div>
          )}
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-3">
          <Field id="name" label="Название" error={show("name")}>
            <Input
              id="name"
              value={form.name}
              placeholder="Например, команда отдела аналитики"
              aria-invalid={!!show("name") || undefined}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field
            id="leaders"
            label="Руководители"
            error={show("leaders")}
            hint="Увидят отчёт на главной странице сервиса «Оценка» в разделе «Внешняя оценка»"
          >
            <LeadersPicker
              id="leaders"
              procedures={procedures}
              value={form.leaders}
              memberLogins={memberLogins}
              invalid={!!show("leaders")}
              onChange={(leaders) => setForm((f) => ({ ...f, leaders }))}
            />
          </Field>
          <Field
            id="hrbp"
            label="HRBP"
            required={false}
            hint="Увидят отчёт в разделе «Администрирование → Внешняя оценка»"
          >
            <HrbpPicker
              id="hrbp"
              value={form.hrbpIds}
              onChange={(hrbpIds) => setForm((f) => ({ ...f, hrbpIds }))}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl bg-background shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-base font-semibold">Состав команды</h2>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={procedures.length === 0} onClick={() => setAddOpen(true)}>
              <PlusIcon /> Добавить участников
            </Button>
            <Button variant="destructive" disabled={selected.size === 0} onClick={removeSelected}>
              <UserMinusIcon /> Убрать из команды{selected.size > 0 && ` (${selected.size})`}
            </Button>
            <Button
              variant="secondary"
              className="ml-auto"
              disabled={members.length === 0 || pending}
              onClick={() =>
                startTransition(() => downloadParticipantsExcel(members, form.name || "Состав команды"))
              }
            >
              <DownloadIcon /> Скачать Excel
            </Button>
          </div>

          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <Table className="min-w-[1000px] text-xs">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                  <HeadCell
                    className="w-10"
                    label={
                      <Checkbox
                        aria-label="Выбрать всех"
                        disabled={visibleIds.length === 0}
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
                  <HeadCell label="ФИО" view={view} sortKey="fullName" searchKey="fullName" />
                  <HeadCell label="Должность" view={view} filterKey="position" participants={members} />
                  <HeadCell label="Подразделение ССП" view={view} filterKey="sspUnit" participants={members} />
                  <HeadCell label="Подразделение ВСП" view={view} filterKey="vspUnit" participants={members} />
                  <HeadCell label="Внешний логин" view={view} searchKey="externalLogin" />
                  {showProcedure && <HeadCell label="Процедура" />}
                  <HeadCell label="Личный отчёт" className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9}>
                      <EmptyState filtered={view.isFiltered} onReset={view.reset} />
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((p) => (
                  <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Выбрать ${p.fullName}`}
                        checked={selected.has(p.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selected)
                          if (checked) next.add(p.id)
                          else next.delete(p.id)
                          setSelected(next)
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <ParticipantAvatar fullName={p.fullName} />
                    </TableCell>
                    <TableCell className="whitespace-normal">{p.fullName}</TableCell>
                    <TableCell className="whitespace-normal"><Cell>{p.position}</Cell></TableCell>
                    <TableCell className="whitespace-normal"><Cell>{p.sspUnit}</Cell></TableCell>
                    <TableCell className="whitespace-normal"><Cell>{p.vspUnit}</Cell></TableCell>
                    <TableCell>{p.externalLogin}</TableCell>
                    {showProcedure && (
                      <TableCell className="max-w-48 whitespace-normal text-muted-foreground">
                        {p.procedureName}
                      </TableCell>
                    )}
                    <TableCell>
                      <AccessStatus access={p.reportAccess} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className={show("members") ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {show("members") ??
              (members.length > 0
                ? `В команде ${members.length} ${pluralRu(members.length, "участник", "участника", "участников")}` +
                  (leaders.length
                    ? ` и ${leaders.length} ${pluralRu(leaders.length, "руководитель", "руководителя", "руководителей")}`
                    : "") +
                  (view.isFiltered ? `, показано ${rows.length}` : "")
                : null)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
          <Button size="lg" className="px-4" disabled={pending} onClick={save}>
            Сохранить
          </Button>
          {dirty && <span className="text-xs text-muted-foreground">Есть несохранённые изменения</span>}
        </div>
      </section>

      <AddMembersDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        procedures={procedures}
        memberKeys={memberKeys}
        memberLogins={memberLogins}
        leaderLogins={leaderLogins}
        onAdd={(refs) => {
          setForm((f) => ({ ...f, members: [...f.members, ...refs] }))
          setAddOpen(false)
          toast.success(
            `Добавлено ${refs.length} ${pluralRu(refs.length, "участник", "участника", "участников")}`,
          )
        }}
      />
    </div>
  )
}

function Field({
  id,
  label,
  error,
  hint,
  required = true,
  children,
}: {
  id: string
  label: string
  error?: string | null
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 content-start gap-1.5">
      <Label htmlFor={id} className="text-xs font-semibold">
        {required && <span className="text-destructive">*</span>}
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        hint && <p className="text-[11px] leading-snug text-pretty text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
