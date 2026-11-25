"use server"

import ExcelJS from "exceljs"
import { revalidatePath } from "next/cache"
import { actionError as fail, type ActionResult as Result } from "@/lib/action-result"
import { buildExternalLink } from "@/lib/links"
import * as store from "@/lib/store"
import { CURRENT_USER } from "@/lib/current-user"
import type {
  Participant,
  ProcedureInput,
  ReportAccess,
} from "@/lib/types"

// TODO: при подключении к реальной системе — проверять права пользователя в каждом действии.

function revalidate() {
  revalidatePath("/procedures", "layout")
  // Командные отчёты показывают участников процедур и удаляются вместе с процедурой.
  revalidatePath("/team-reports", "layout")
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function validate(input: ProcedureInput): string | null {
  if (!input.name.trim()) return "Укажите название процедуры"
  if (!input.type.trim()) return "Выберите тип процедуры"
  if (!ISO_DATE.test(input.startDate)) return "Укажите дату начала"
  if (!ISO_DATE.test(input.endDate)) return "Укажите дату окончания"
  if (input.endDate < input.startDate)
    return "Дата окончания не может быть раньше даты начала"
  for (const p of input.participants) {
    if (!p.fullName.trim()) return "У каждого сотрудника должно быть указано ФИО"
    const personnelId = p.personnelId?.trim() ?? ""
    if (!personnelId)
      return `Укажите персональный ID для сотрудника «${p.fullName || "без ФИО"}»`
    if (!/^\d{5,6}$/.test(personnelId))
      return `Персональный ID «${personnelId}» должен содержать 5 или 6 цифр`
    if (!p.externalLogin.trim())
      return `Укажите внешний логин для сотрудника «${p.fullName}»`
  }
  const logins = new Set<string>()
  for (const p of input.participants) {
    const key = p.externalLogin.trim().toLowerCase()
    if (logins.has(key)) return `Внешний логин ${p.externalLogin} указан дважды`
    logins.add(key)
  }
  return null
}

function cleanParticipants(list: Participant[]): Participant[] {
  return list.map((p) => ({
    id: p.id,
    personnelId: p.personnelId.trim(),
    fullName: p.fullName.trim(),
    position: p.position.trim(),
    sspUnit: p.sspUnit.trim(),
    vspUnit: p.vspUnit.trim(),
    externalLogin: p.externalLogin.trim(),
    notify: Boolean(p.notify),
    externalLink: p.externalLink ?? null,
    reportAccess: p.reportAccess ?? null,
    reportFormedAt: p.reportAccess ? (p.reportFormedAt ?? null) : null,
  }))
}

export async function createProcedureAction(
  input: ProcedureInput,
): Promise<Result<{ id: string }>> {
  const error = validate(input)
  if (error) return fail(error)
  const created = await store.insertProcedure({
    name: input.name.trim(),
    type: input.type,
    status: "draft",
    startDate: input.startDate,
    endDate: input.endDate,
    creator: CURRENT_USER.fullName,
    updatedAt: new Date().toISOString(),
    sendNotifications: input.sendNotifications,
    participants: cleanParticipants(input.participants),
  })
  revalidate()
  return { ok: true, data: { id: created.id } }
}

export async function updateProcedureAction(
  id: string,
  input: ProcedureInput,
): Promise<Result> {
  const error = validate(input)
  if (error) return fail(error)
  const existing = await store.getProcedure(id)
  if (!existing) return fail("Процедура не найдена")
  if (existing.status !== "draft")
    return fail("Редактировать можно только процедуру в статусе «Черновик»")
  await store.updateProcedure(id, (p) => {
    p.name = input.name.trim()
    p.type = input.type
    p.startDate = input.startDate
    p.endDate = input.endDate
    p.sendNotifications = input.sendNotifications
    p.participants = cleanParticipants(input.participants)
  })
  revalidate()
  return { ok: true, data: undefined }
}

export async function launchProcedureAction(id: string): Promise<Result> {
  const existing = await store.getProcedure(id)
  if (!existing) return fail("Процедура не найдена")
  if (existing.status !== "draft") return fail("Процедура уже запущена")
  if (existing.participants.length === 0)
    return fail("Добавьте хотя бы одного сотрудника перед запуском")
  const formedAt = new Date().toISOString()
  await store.updateProcedure(id, (p) => {
    p.status = "in_progress"
    for (const participant of p.participants) {
      participant.externalLink ??= buildExternalLink(participant.id)
      if (participant.reportAccess === null) {
        participant.reportAccess = "closed"
        participant.reportFormedAt = formedAt
      } else {
        participant.reportFormedAt ??= formedAt
      }
    }
  })
  revalidate()
  return { ok: true, data: undefined }
}

export async function completeProcedureAction(id: string): Promise<Result> {
  const existing = await store.getProcedure(id)
  if (!existing) return fail("Процедура не найдена")
  if (existing.status !== "in_progress")
    return fail("Завершить можно только процедуру в процессе")
  await store.updateProcedure(id, (p) => {
    p.status = "completed"
  })
  revalidate()
  return { ok: true, data: undefined }
}

export async function duplicateProcedureAction(
  id: string,
): Promise<Result<{ id: string }>> {
  const source = await store.getProcedure(id)
  if (!source) return fail("Процедура не найдена")
  const stamp = Date.now().toString(36)
  const created = await store.insertProcedure({
    name: `${source.name} (копия)`,
    type: source.type,
    status: "draft",
    startDate: source.startDate,
    endDate: source.endDate,
    creator: CURRENT_USER.fullName,
    updatedAt: new Date().toISOString(),
    sendNotifications: source.sendNotifications,
    participants: source.participants.map((p, i) => ({
      ...p,
      id: `${stamp}-${i + 1}`,
      externalLink: null,
      reportAccess: null,
      reportFormedAt: null,
    })),
  })
  revalidate()
  return { ok: true, data: { id: created.id } }
}

export async function deleteProcedureAction(id: string): Promise<Result> {
  await store.deleteProcedure(id)
  revalidate()
  return { ok: true, data: undefined }
}

export async function setReportAccessAction(
  id: string,
  participantIds: string[],
  access: Exclude<ReportAccess, null>,
): Promise<Result<{ changed: number }>> {
  const existing = await store.getProcedure(id)
  if (!existing) return fail("Процедура не найдена")
  if (existing.status === "draft")
    return fail("Доступ к отчётам доступен после запуска процедуры")
  const ids = new Set(participantIds)
  let changed = 0
  await store.updateProcedure(id, (p) => {
    for (const participant of p.participants) {
      if (!ids.has(participant.id) || participant.reportAccess === null) continue
      if (participant.reportAccess !== access) changed++
      participant.reportAccess = access
    }
  })
  revalidate()
  return { ok: true, data: { changed } }
}

// ---------- Excel ----------

const EXCEL_COLUMNS = [
  { header: "Персональный ID", key: "personnelId", width: 16 },
  { header: "ФИО", key: "fullName", width: 36 },
  { header: "Должность", key: "position", width: 30 },
  { header: "Подразделение ССП", key: "sspUnit", width: 44 },
  { header: "Подразделение ВСП", key: "vspUnit", width: 44 },
  { header: "Внешний логин", key: "externalLogin", width: 30 },
  { header: "Отправить уведомление", key: "notify", width: 22 },
  { header: "Внешняя ссылка", key: "externalLink", width: 60 },
  { header: "Доступ к отчётам", key: "reportAccess", width: 18 },
] as const

const ACCESS_LABEL: Record<string, string> = { open: "Открыт", closed: "Закрыт" }

export async function exportParticipantsAction(
  participants: Participant[],
): Promise<Result<{ base64: string }>> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Сотрудники")
  ws.columns = EXCEL_COLUMNS.map((c) => ({ ...c }))
  ws.getRow(1).font = { bold: true }
  for (const p of participants) {
    ws.addRow({
      ...p,
      notify: p.notify ? "Да" : "Нет",
      externalLink: p.externalLink ?? "",
      reportAccess: p.reportAccess ? ACCESS_LABEL[p.reportAccess] : "",
    })
  }
  const buffer = await wb.xlsx.writeBuffer()
  return { ok: true, data: { base64: Buffer.from(buffer).toString("base64") } }
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ""
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text
    if ("result" in value && value.result != null) return String(value.result)
    if ("richText" in value)
      return value.richText.map((r) => r.text).join("")
  }
  return String(value)
}

export async function importParticipantsAction(
  formData: FormData,
): Promise<Result<{ participants: Omit<Participant, "id">[] }>> {
  const file = formData.get("file")
  if (!(file instanceof File)) return fail("Файл не выбран")
  if (file.size > 10 * 1024 * 1024) return fail("Файл больше 10 МБ")

  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(await file.arrayBuffer())
  } catch {
    return fail("Не удалось прочитать файл. Загрузите файл в формате .xlsx")
  }
  const ws = wb.worksheets[0]
  if (!ws) return fail("В файле нет листов")

  const headerIndex = new Map<string, number>()
  ws.getRow(1).eachCell((cell, col) => {
    headerIndex.set(cellText(cell.value).trim().toLowerCase(), col)
  })
  const col = (header: string) => headerIndex.get(header.toLowerCase())
  if (!col("ФИО") || !col("Внешний логин"))
    return fail("В первой строке должны быть колонки «ФИО» и «Внешний логин»")

  const participants: Omit<Participant, "id">[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const get = (header: string) => {
      const c = col(header)
      return c ? cellText(row.getCell(c).value).trim() : ""
    }
    const fullName = get("ФИО")
    const externalLogin = get("Внешний логин")
    if (!fullName && !externalLogin) return
    const notify = get("Отправить уведомление").toLowerCase()
    participants.push({
      personnelId: get("Персональный ID"),
      fullName,
      position: get("Должность"),
      sspUnit: get("Подразделение ССП"),
      vspUnit: get("Подразделение ВСП"),
      externalLogin,
      notify: notify === "" || ["да", "1", "true", "yes"].includes(notify),
      externalLink: null,
      reportAccess: null,
      reportFormedAt: null,
    })
  })
  if (participants.length === 0) return fail("В файле нет строк с сотрудниками")
  return { ok: true, data: { participants } }
}
