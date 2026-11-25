import "server-only"

import { promises as fs } from "node:fs"
import path from "node:path"
import { CURRENT_USER } from "./current-user"
import { allReportContentSectionIds } from "./report/definitions"
import { buildSeed, buildTeamReportSeed } from "./seed"
import type {
  EmployeeSearchHit,
  Participant,
  Procedure,
  ProcedureOption,
  ProcedureSummary,
  TeamReport,
  TeamReportSummary,
} from "./types"

/**
 * Простое файловое хранилище (data/db.json) — заменяется на настоящий API/БД.
 * При первом обращении заполняется демо-данными.
 */
const DB_PATH = path.join(process.cwd(), "data", "db.json")

interface Db {
  procedures: Procedure[]
  teamReports: TeamReport[]
}

let writeQueue: Promise<unknown> = Promise.resolve()

async function readDb(): Promise<Db> {
  let db: Db
  try {
    db = JSON.parse(await fs.readFile(DB_PATH, "utf8")) as Db
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
    const procedures = buildSeed()
    db = { procedures, teamReports: buildTeamReportSeed(procedures) }
    await writeDb(db)
    return db
  }
  // Файл из предыдущей версии — без командных отчётов.
  if (!Array.isArray(db.teamReports)) {
    db.teamReports = buildTeamReportSeed(db.procedures)
    await writeDb(db)
  }
  let touched = false
  if (db.teamReports.some((report) => migrateTeamReport(report))) touched = true
  for (const procedure of db.procedures) {
    for (const person of procedure.participants) {
      if (!("reportFormedAt" in person)) {
        person.reportFormedAt =
          person.reportAccess !== null ? procedure.updatedAt : null
        touched = true
      }
      if (!("personnelId" in person) || !person.personnelId) {
        const digits = person.id.replace(/\D/g, "")
        const n = Number(digits.slice(-6) || "0")
        person.personnelId = String(10000 + (n % 899999))
        touched = true
      }
    }
  }
  if (touched) await writeDb(db)
  return db
}

/** Дополняет запись командного отчёта полями, которых не было в старых файлах. */
function migrateTeamReport(report: TeamReport & { leaderId?: string }): boolean {
  let touched = false
  if (!Array.isArray(report.hrbpIds)) {
    report.hrbpIds = []
    touched = true
  }
  if (!Array.isArray(report.leaderIds)) {
    report.leaderIds = report.leaderId ? [report.leaderId] : []
    delete report.leaderId
    touched = true
  }
  if (report.hrbpReportAccess !== "open" && report.hrbpReportAccess !== "closed") {
    report.hrbpReportAccess = "closed"
    touched = true
  }
  if (!Array.isArray(report.groups)) {
    report.groups = []
    touched = true
  }
  if (!Array.isArray(report.highlightedIds)) {
    report.highlightedIds = []
    touched = true
  }
  if (!Array.isArray(report.contentSections)) {
    report.contentSections = allReportContentSectionIds()
    touched = true
  }
  if (!report.updatedBy) {
    report.updatedBy = report.creator
    touched = true
  }
  if (typeof report.reportEmailSent !== "boolean") {
    report.reportEmailSent = false
    touched = true
  }
  if (typeof report.hrbpEmailSent !== "boolean") {
    report.hrbpEmailSent = false
    touched = true
  }
  if (report.status !== "draft" && report.status !== "active" && report.status !== "archived") {
    report.status =
      report.reportAccess === "open" || report.hrbpReportAccess === "open" ? "active" : "draft"
    touched = true
  }
  return touched
}

async function writeDb(db: Db): Promise<void> {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true })
  // Уникальное имя: параллельные записи (например, первичное заполнение) не мешают друг другу.
  const tmp = `${DB_PATH}.${process.pid}.${crypto.randomUUID()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8")
  await fs.rename(tmp, DB_PATH)
}

/** Последовательно выполняет изменения, чтобы параллельные записи не затирали друг друга. */
function mutate<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const run = writeQueue.then(async () => {
    const db = await readDb()
    const result = await fn(db)
    await writeDb(db)
    return result
  })
  writeQueue = run.catch(() => undefined)
  return run
}

function nextId(items: { id: string }[]): string {
  return String(items.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1)
}

function joinNames(ids: string[] | undefined, peopleById: Map<string, string>): string {
  const names = (ids ?? [])
    .map((id) => peopleById.get(id))
    .filter((name): name is string => Boolean(name))
  return names.length ? names.join(", ") : "—"
}

// ---------- Процедуры ----------

export async function listProcedures(): Promise<ProcedureSummary[]> {
  const db = await readDb()
  return db.procedures.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    status: p.status,
    startDate: p.startDate,
    endDate: p.endDate,
    creator: p.creator,
    updatedAt: p.updatedAt,
    participantCount: p.participants.length,
  }))
}

export async function getProcedure(id: string): Promise<Procedure | null> {
  const db = await readDb()
  return db.procedures.find((p) => p.id === id) ?? null
}

export function insertProcedure(data: Omit<Procedure, "id">): Promise<Procedure> {
  return mutate((db) => {
    const procedure: Procedure = { ...data, id: nextId(db.procedures) }
    db.procedures.unshift(procedure)
    return procedure
  })
}

export function updateProcedure(
  id: string,
  fn: (p: Procedure) => void,
): Promise<Procedure> {
  return mutate((db) => {
    const procedure = db.procedures.find((p) => p.id === id)
    if (!procedure) throw new Error("Процедура не найдена")
    fn(procedure)
    procedure.updatedAt = new Date().toISOString()
    return procedure
  })
}

/** Удаляет процедуру вместе с её командными отчётами. */
export function deleteProcedure(id: string): Promise<void> {
  return mutate((db) => {
    db.procedures = db.procedures.filter((p) => p.id !== id)
    db.teamReports = db.teamReports.filter((r) => r.procedureId !== id)
  })
}

export async function countTeamReportsForProcedure(id: string): Promise<number> {
  const db = await readDb()
  return db.teamReports.filter((r) => r.procedureId === id).length
}

/** Все участники всех процедур — для раздела «Поиск сотрудника». */
export async function listEmployeesForSearch(): Promise<EmployeeSearchHit[]> {
  const db = await readDb()
  const rows: EmployeeSearchHit[] = []
  for (const procedure of db.procedures) {
    for (const person of procedure.participants) {
      rows.push(toEmployeeSearchHit(person, procedure))
    }
  }
  return rows
}

function toEmployeeSearchHit(person: Participant, procedure: Procedure): EmployeeSearchHit {
  return {
    id: person.id,
    personnelId: person.personnelId,
    fullName: person.fullName,
    position: person.position,
    sspUnit: person.sspUnit,
    vspUnit: person.vspUnit,
    externalLogin: person.externalLogin,
    reportAccess: person.reportAccess,
    procedureId: procedure.id,
    procedureName: procedure.name,
    procedureStatus: procedure.status,
  }
}

// ---------- Командные отчёты ----------

/** Процедуры, по которым можно строить командные отчёты (запущенные и завершённые). */
export async function listLaunchedProcedures(): Promise<ProcedureOption[]> {
  const db = await readDb()
  return db.procedures
    .filter((p) => p.status !== "draft")
    .map(({ id, name, status, startDate, endDate, participants }) => ({
      id,
      name,
      status,
      startDate,
      endDate,
      participants,
    }))
}

export async function listTeamReports(): Promise<TeamReportSummary[]> {
  const db = await readDb()
  const procedures = new Map(db.procedures.map((p) => [p.id, p]))
  const peopleById = new Map(
    db.procedures.flatMap((p) => p.participants.map((person) => [person.id, person.fullName] as const)),
  )
  return db.teamReports.map((r) => {
    const procedure = procedures.get(r.procedureId)
    return {
      id: r.id,
      name: r.name,
      procedureId: r.procedureId,
      procedureName: procedure?.name ?? "—",
      leaderName: joinNames(r.leaderIds, peopleById),
      hrbpName: joinNames(r.hrbpIds, peopleById),
      memberCount: r.memberIds.length,
      status:
        r.status === "active" || r.status === "archived" || r.status === "draft"
          ? r.status
          : "draft",
      reportAccess: r.reportAccess,
      hrbpReportAccess: r.hrbpReportAccess ?? "closed",
      reportEmailSent: Boolean(r.reportEmailSent),
      hrbpEmailSent: Boolean(r.hrbpEmailSent),
      creator: r.creator,
      updatedBy: r.updatedBy || r.creator,
      updatedAt: r.updatedAt,
    }
  })
}

export async function getTeamReport(id: string): Promise<TeamReport | null> {
  const db = await readDb()
  return db.teamReports.find((r) => r.id === id) ?? null
}

export function insertTeamReport(data: Omit<TeamReport, "id">): Promise<TeamReport> {
  return mutate((db) => {
    const report: TeamReport = { ...data, id: nextId(db.teamReports) }
    db.teamReports.unshift(report)
    return report
  })
}

export function updateTeamReport(
  id: string,
  fn: (r: TeamReport) => void,
): Promise<TeamReport> {
  return mutate((db) => {
    const report = db.teamReports.find((r) => r.id === id)
    if (!report) throw new Error("Командный отчёт не найден")
    fn(report)
    report.updatedAt = new Date().toISOString()
    report.updatedBy = CURRENT_USER.fullName
    return report
  })
}

export function deleteTeamReport(id: string): Promise<void> {
  return mutate((db) => {
    db.teamReports = db.teamReports.filter((r) => r.id !== id)
  })
}
