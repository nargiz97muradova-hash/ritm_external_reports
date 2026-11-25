"use server"

import { revalidatePath } from "next/cache"
import { actionError as fail, type ActionResult as Result } from "@/lib/action-result"
import { CURRENT_USER } from "@/lib/current-user"
import { normalizeReportContentSections } from "@/lib/report/definitions"
import * as store from "@/lib/store"
import type { ReportAccess, TeamReportInput, TeamReportStatus } from "@/lib/types"

// TODO: при подключении к реальной системе — проверять права пользователя в каждом действии.

function revalidate(reportId?: string) {
  revalidatePath("/team-reports", "layout")
  if (reportId) {
    revalidatePath(`/team-reports/${reportId}`)
    revalidatePath(`/team-reports/${reportId}/report`)
  }
}

/** Проверяет ввод и возвращает нормализованные данные или текст ошибки. */
async function check(
  input: TeamReportInput,
): Promise<{ ok: true; data: TeamReportInput } | { ok: false; error: string }> {
  const name = input.name.trim()
  if (!name) return fail("Укажите название отчёта")
  const procedure = await store.getProcedure(input.procedureId)
  if (!procedure) return fail("Выберите процедуру")
  if (procedure.status === "draft")
    return fail("Командный отчёт можно создать только по запущенной процедуре")
  const ids = new Set(procedure.participants.map((p) => p.id))
  const leaderIds = [...new Set(input.leaderIds)]
  if (leaderIds.some((id) => !ids.has(id)))
    return fail("Выберите руководителей из участников основной процедуры")
  const leaderSet = new Set(leaderIds)
  // Участников команды и сотрудников ДРП можно брать из любых запущенных процедур.
  const launched = await store.listLaunchedProcedures()
  const allPeople = new Set(launched.flatMap((p) => p.participants.map((person) => person.id)))
  const hrbpIds = [...new Set(input.hrbpIds)].filter((id) => !leaderSet.has(id))
  if (hrbpIds.some((id) => !allPeople.has(id)))
    return fail("Среди сотрудников ДРП есть люди, которых нет в запущенных процедурах")
  const memberIds = [...new Set(input.memberIds)].filter((id) => !leaderSet.has(id))
  if (memberIds.length === 0) return fail("Добавьте в команду хотя бы одного участника")
  if (memberIds.some((id) => !allPeople.has(id)))
    return fail("В команде есть участники, которых нет в запущенных процедурах")
  const memberSet = new Set(memberIds)
  const groups = (input.groups ?? [])
    .map((g, i) => ({
      id: g.id.trim() || `g${i + 1}`,
      name: g.name.trim(),
      memberIds: [...new Set(g.memberIds)].filter((id) => memberSet.has(id)),
      color: g.color?.trim() || undefined,
    }))
    .filter((g) => g.name && g.memberIds.length > 0)
  const highlightedIds = [...new Set(input.highlightedIds ?? [])].filter(
    (id) => memberSet.has(id) || leaderSet.has(id),
  )
  const contentSections = normalizeReportContentSections(input.contentSections)
  if (contentSections.length === 0)
    return fail("Выберите хотя бы один раздел содержания отчёта")
  return {
    ok: true,
    data: {
      name,
      procedureId: procedure.id,
      leaderIds,
      hrbpIds,
      memberIds,
      groups,
      highlightedIds,
      contentSections,
    },
  }
}

export async function createTeamReportAction(
  input: TeamReportInput,
): Promise<Result<{ id: string }>> {
  const checked = await check(input)
  if (!checked.ok) return checked
  const created = await store.insertTeamReport({
    ...checked.data,
    status: "draft",
    reportAccess: "closed",
    hrbpReportAccess: "closed",
    reportEmailSent: false,
    hrbpEmailSent: false,
    creator: CURRENT_USER.fullName,
    updatedBy: CURRENT_USER.fullName,
    updatedAt: new Date().toISOString(),
  })
  revalidate()
  return { ok: true, data: { id: created.id } }
}

export async function updateTeamReportAction(
  id: string,
  input: TeamReportInput,
): Promise<Result> {
  const existing = await store.getTeamReport(id)
  if (!existing) return fail("Командный отчёт не найден")
  if (existing.status === "archived")
    return fail("Архивный отчёт нельзя редактировать")
  const checked = await check(input)
  if (!checked.ok) return checked
  if (existing.status === "active" && !sameIds(existing.memberIds, checked.data.memberIds))
    return fail("Добавлять и убирать сотрудников можно только в статусе «Черновик»")
  if (
    existing.status !== "draft" &&
    !sameIds(
      normalizeReportContentSections(existing.contentSections),
      checked.data.contentSections,
    )
  ) {
    return fail("Содержание отчёта можно менять только в статусе «Черновик»")
  }
  await store.updateTeamReport(id, (r) => {
    Object.assign(r, checked.data)
    if (existing.status !== "draft") {
      r.contentSections = normalizeReportContentSections(existing.contentSections)
    }
  })
  revalidate(id)
  return { ok: true, data: undefined }
}

export type TeamReportAccessAudience = "leader" | "hrbp"

export async function setTeamReportAccessAction(
  id: string,
  access: Exclude<ReportAccess, null>,
  audience: TeamReportAccessAudience = "leader",
  options?: { sendEmail?: boolean },
): Promise<Result> {
  const existing = await store.getTeamReport(id)
  if (!existing) return fail("Командный отчёт не найден")
  if (existing.status !== "active")
    return fail("Показать отчёт можно только в статусе «Активный»")
  await store.updateTeamReport(id, (r) => {
    if (audience === "hrbp") {
      r.hrbpReportAccess = access
      if (access === "open" && options?.sendEmail) r.hrbpEmailSent = true
    } else {
      r.reportAccess = access
      if (access === "open" && options?.sendEmail) r.reportEmailSent = true
    }
  })
  revalidate()
  return { ok: true, data: undefined }
}

export async function duplicateTeamReportAction(id: string): Promise<Result<{ id: string }>> {
  const source = await store.getTeamReport(id)
  if (!source) return fail("Командный отчёт не найден")
  const created = await store.insertTeamReport({
    name: `${source.name} (копия)`,
    procedureId: source.procedureId,
    leaderIds: [...source.leaderIds],
    hrbpIds: [...source.hrbpIds],
    memberIds: [...source.memberIds],
    groups: source.groups.map((g) => ({ ...g, memberIds: [...g.memberIds] })),
    highlightedIds: [...(source.highlightedIds ?? [])],
    contentSections: [...normalizeReportContentSections(source.contentSections)],
    status: "draft",
    reportAccess: "closed",
    hrbpReportAccess: "closed",
    reportEmailSent: false,
    hrbpEmailSent: false,
    creator: CURRENT_USER.fullName,
    updatedBy: CURRENT_USER.fullName,
    updatedAt: new Date().toISOString(),
  })
  revalidate()
  return { ok: true, data: { id: created.id } }
}

export async function setTeamReportStatusAction(
  id: string,
  status: TeamReportStatus,
): Promise<Result> {
  const existing = await store.getTeamReport(id)
  if (!existing) return fail("Командный отчёт не найден")
  if (status === existing.status) return { ok: true, data: undefined }
  if (status === "archived" && existing.status !== "active")
    return fail("В архив можно отправить только активный отчёт")
  if (status === "draft" && existing.status !== "active")
    return fail("В черновик можно вернуть только активный отчёт")
  if (status === "active") {
    if (existing.status !== "draft" && existing.status !== "archived")
      return fail("Нельзя активировать отчёт из текущего статуса")
    if (existing.memberIds.length === 0)
      return fail("Добавьте в команду хотя бы одного сотрудника перед активацией")
  }
  await store.updateTeamReport(id, (r) => {
    r.status = status
    if (status === "draft" || status === "archived") {
      r.reportAccess = "closed"
      r.hrbpReportAccess = "closed"
    }
  })
  revalidate()
  return { ok: true, data: undefined }
}

function sameIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  const ids = new Set(left)
  return right.every((id) => ids.has(id))
}

export async function deleteTeamReportAction(id: string): Promise<Result> {
  await store.deleteTeamReport(id)
  revalidate()
  return { ok: true, data: undefined }
}
