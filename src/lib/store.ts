import "server-only"

import { promises as fs } from "node:fs"
import path from "node:path"
import { buildSeed, buildTeamReportSeed } from "./seed"
import type {
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
  } else if (db.teamReports.some((r) => !Array.isArray(r.members))) {
    db.teamReports = db.teamReports.map(migrateTeamReport)
    await writeDb(db)
  }
  return db
}

/** Старый формат: одна процедура на отчёт (procedureId, leaderId, memberIds). */
interface LegacyTeamReport {
  procedureId: string
  leaderId: string
  memberIds: string[]
}

function migrateTeamReport(r: TeamReport | (TeamReport & LegacyTeamReport)): TeamReport {
  if (Array.isArray(r.members)) return r
  const legacy = r as TeamReport & LegacyTeamReport
  const { procedureId, leaderId, memberIds, ...rest } = legacy
  return {
    ...rest,
    leader: { procedureId, participantId: leaderId },
    members: memberIds.map((participantId) => ({ procedureId, participantId })),
  }
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

/**
 * Удаляет процедуру. Её участники убираются из командных отчётов;
 * отчёт удаляется целиком, если из этой процедуры был руководитель или в команде никого не осталось.
 */
export function deleteProcedure(id: string): Promise<void> {
  return mutate((db) => {
    db.procedures = db.procedures.filter((p) => p.id !== id)
    db.teamReports = db.teamReports
      .map((r) => ({ ...r, members: r.members.filter((m) => m.procedureId !== id) }))
      .filter((r) => r.leader.procedureId !== id && r.members.length > 0)
  })
}

// ---------- Командные отчёты ----------

/** Процедуры, из которых можно набирать команды (запущенные и завершённые). */
export async function listLaunchedProcedures(): Promise<ProcedureOption[]> {
  const db = await readDb()
  return db.procedures
    .filter((p) => p.status !== "draft")
    .map(({ id, name, type, status, startDate, endDate, participants }) => ({
      id,
      name,
      type,
      status,
      startDate,
      endDate,
      participants,
    }))
}

export async function listTeamReports(): Promise<TeamReportSummary[]> {
  const db = await readDb()
  const procedures = new Map(db.procedures.map((p) => [p.id, p]))
  return db.teamReports.map((r) => {
    const leader = procedures
      .get(r.leader.procedureId)
      ?.participants.find((p) => p.id === r.leader.participantId)
    const procedureIds = [...new Set([r.leader, ...r.members].map((m) => m.procedureId))]
    return {
      id: r.id,
      name: r.name,
      procedures: procedureIds.flatMap((pid) => {
        const p = procedures.get(pid)
        return p ? [{ id: p.id, name: p.name }] : []
      }),
      leaderName: leader?.fullName ?? "—",
      memberCount: r.members.length,
      reportAccess: r.reportAccess,
      creator: r.creator,
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
    return report
  })
}

export function deleteTeamReport(id: string): Promise<void> {
  return mutate((db) => {
    db.teamReports = db.teamReports.filter((r) => r.id !== id)
  })
}
