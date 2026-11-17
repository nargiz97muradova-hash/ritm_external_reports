"use server"

import { revalidatePath } from "next/cache"
import { CURRENT_USER } from "@/lib/current-user"
import { HRBP_IDS } from "@/lib/hrbp"
import * as store from "@/lib/store"
import { type MemberRef, type ReportAccess, type TeamReportInput } from "@/lib/types"

// TODO: при подключении к реальной системе — проверять права пользователя в каждом действии.

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error }
}

function revalidate() {
  revalidatePath("/team-reports", "layout")
}

interface Checked {
  name: string
  leaders: MemberRef[]
  hrbpIds: string[]
  members: MemberRef[]
}

/**
 * Проверяет ввод: руководители и участники — из запущенных процедур,
 * один человек (по логину) встречается только один раз, HRBP — из закрытого перечня.
 */
async function check(
  input: TeamReportInput,
): Promise<{ ok: true; data: Checked } | { ok: false; error: string }> {
  const name = input.name.trim()
  if (!name) return fail("Укажите название отчёта")
  if (input.leaders.length === 0) return fail("Выберите хотя бы одного руководителя")
  if (input.hrbpIds.some((id) => !HRBP_IDS.has(id))) return fail("Выбран HRBP не из справочника")

  const procedures = new Map((await store.listLaunchedProcedures()).map((p) => [p.id, p]))
  const find = (ref: MemberRef) =>
    procedures.get(ref.procedureId)?.participants.find((p) => p.id === ref.participantId)

  const seenLogins = new Set<string>()
  /** Оставляет уникальных по логину; null — если кого-то нет в запущенных процедурах. */
  const unique = (refs: MemberRef[]): MemberRef[] | null => {
    const result: MemberRef[] = []
    for (const ref of refs) {
      const person = find(ref)
      if (!person) return null
      const login = person.externalLogin.toLowerCase()
      if (seenLogins.has(login)) continue
      seenLogins.add(login)
      result.push({ procedureId: ref.procedureId, participantId: ref.participantId })
    }
    return result
  }

  const leaders = unique(input.leaders)
  if (!leaders) return fail("Руководители должны быть участниками запущенных процедур")
  const members = unique(input.members)
  if (!members) return fail("В команде есть участники, которых нет в запущенных процедурах")
  if (members.length === 0) return fail("Добавьте в команду хотя бы одного участника")
  return { ok: true, data: { name, leaders, hrbpIds: [...new Set(input.hrbpIds)], members } }
}

export async function createTeamReportAction(
  input: TeamReportInput,
): Promise<Result<{ id: string }>> {
  const checked = await check(input)
  if (!checked.ok) return checked
  const created = await store.insertTeamReport({
    ...checked.data,
    reportAccess: "closed",
    creator: CURRENT_USER.fullName,
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
  const checked = await check(input)
  if (!checked.ok) return checked
  await store.updateTeamReport(id, (r) => Object.assign(r, checked.data))
  revalidate()
  return { ok: true, data: undefined }
}

export async function setTeamReportAccessAction(
  id: string,
  access: Exclude<ReportAccess, null>,
): Promise<Result> {
  const existing = await store.getTeamReport(id)
  if (!existing) return fail("Командный отчёт не найден")
  await store.updateTeamReport(id, (r) => {
    r.reportAccess = access
  })
  revalidate()
  return { ok: true, data: undefined }
}

export async function duplicateTeamReportAction(id: string): Promise<Result<{ id: string }>> {
  const source = await store.getTeamReport(id)
  if (!source) return fail("Командный отчёт не найден")
  const created = await store.insertTeamReport({
    name: `${source.name} (копия)`,
    leaders: source.leaders.map((m) => ({ ...m })),
    hrbpIds: [...source.hrbpIds],
    members: source.members.map((m) => ({ ...m })),
    reportAccess: "closed",
    creator: CURRENT_USER.fullName,
    updatedAt: new Date().toISOString(),
  })
  revalidate()
  return { ok: true, data: { id: created.id } }
}

export async function deleteTeamReportAction(id: string): Promise<Result> {
  await store.deleteTeamReport(id)
  revalidate()
  return { ok: true, data: undefined }
}
