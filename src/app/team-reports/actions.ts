"use server"

import { revalidatePath } from "next/cache"
import { CURRENT_USER } from "@/lib/current-user"
import * as store from "@/lib/store"
import { memberKey, type MemberRef, type ReportAccess, type TeamReportInput } from "@/lib/types"

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
  leader: MemberRef
  members: MemberRef[]
}

/** Проверяет ввод: руководитель и участники — из запущенных процедур, без повторов. */
async function check(
  input: TeamReportInput,
): Promise<{ ok: true; data: Checked } | { ok: false; error: string }> {
  const name = input.name.trim()
  if (!name) return fail("Укажите название отчёта")
  if (!input.leader) return fail("Выберите руководителя")

  const procedures = new Map((await store.listLaunchedProcedures()).map((p) => [p.id, p]))
  const find = (ref: MemberRef) =>
    procedures.get(ref.procedureId)?.participants.find((p) => p.id === ref.participantId)

  const leader = find(input.leader)
  if (!leader) return fail("Руководитель должен быть участником запущенной процедуры")

  const seenKeys = new Set<string>([memberKey(input.leader)])
  const seenLogins = new Set<string>([leader.externalLogin.toLowerCase()])
  const members: MemberRef[] = []
  for (const ref of input.members) {
    const participant = find(ref)
    if (!participant)
      return fail("В команде есть участники, которых нет в запущенных процедурах")
    const login = participant.externalLogin.toLowerCase()
    if (seenKeys.has(memberKey(ref)) || seenLogins.has(login)) continue
    seenKeys.add(memberKey(ref))
    seenLogins.add(login)
    members.push({ procedureId: ref.procedureId, participantId: ref.participantId })
  }
  if (members.length === 0) return fail("Добавьте в команду хотя бы одного участника")
  return { ok: true, data: { name, leader: input.leader, members } }
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
    leader: { ...source.leader },
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
