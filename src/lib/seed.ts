import type { Participant, Procedure, TeamReport } from "./types"
import { buildExternalLink } from "./links"
import { HRBP_DIRECTORY } from "./hrbp"

// Все данные вымышленные — только для демонстрации интерфейса.

const LAST_NAMES = [
  "Смирнов", "Кузнецов", "Попов", "Васильев", "Петров", "Соколов", "Михайлов",
  "Новиков", "Фёдоров", "Морозов", "Волков", "Алексеев", "Лебедев", "Семёнов",
  "Егоров", "Павлов", "Козлов", "Степанов", "Николаев", "Орлов",
]
const FIRST_NAMES = [
  "Алексей", "Дмитрий", "Сергей", "Андрей", "Михаил", "Илья", "Павел",
  "Артём", "Константин", "Максим", "Олег", "Роман",
]
const PATRONYMICS = [
  "Александрович", "Дмитриевич", "Сергеевич", "Андреевич", "Михайлович",
  "Игоревич", "Павлович", "Викторович", "Олегович", "Николаевич",
]
const POSITIONS = [
  "специалист", "главный специалист", "руководитель проекта",
  "главный руководитель проекта", "директор проектов",
  "исполнительный директор", "управляющий директор",
]
const SSP_UNITS = [
  "Департамент по работе с персоналом",
  "Департамент автоматизации внутренних сервисов",
  "Департамент развития корпоративных платформ",
  "Департамент цифровой трансформации",
]
const VSP_UNITS = [
  "Управление развития HR-технологий",
  "Управление открытых систем",
  "Управление корпоративных систем / Отдел подбора и развития персонала",
  "Управление аналитики",
  "",
]

const CREATORS = ["Смирнова Анна Сергеевна", "Орлов Павел Андреевич"]

function pick<T>(list: readonly T[], n: number): T {
  return list[n % list.length]
}

function makeParticipants(
  procedureIndex: number,
  count: number,
  launched: boolean,
): Participant[] {
  return Array.from({ length: count }, (_, i) => {
    const n = procedureIndex * 1000 + i
    const id = `p${procedureIndex}-${i + 1}`
    let reportAccess: Participant["reportAccess"] = null
    if (launched) reportAccess = i % 3 === 0 ? "open" : "closed"
    return {
      id,
      fullName: `${pick(LAST_NAMES, n * 7)} ${pick(FIRST_NAMES, n * 3 + 1)} ${pick(PATRONYMICS, n * 5 + 2)}`,
      position: pick(POSITIONS, n * 11),
      sspUnit: pick(SSP_UNITS, n * 13),
      vspUnit: pick(VSP_UNITS, n * 17),
      externalLogin: `user${String(10000 + ((n * 7919) % 89999))}@example.com`,
      notify: true,
      externalLink: launched ? buildExternalLink(id) : null,
      reportAccess,
    }
  })
}

const SEED: Array<
  Omit<Procedure, "participants" | "id" | "sendNotifications"> & { count: number }
> = [
  { name: "Тестовая процедура 150 сотрудников", type: 'Опросник "Zetic"', status: "draft", startDate: "2026-09-29", endDate: "2026-10-31", creator: CREATORS[0], updatedAt: "2026-10-19T10:00:00.000Z", count: 151 },
  { name: "Тест стирания отчётов", type: 'Опросник "Zetic"', status: "in_progress", startDate: "2026-09-29", endDate: "2026-11-30", creator: CREATORS[0], updatedAt: "2026-11-11T10:00:00.000Z", count: 6 },
  { name: "Тестовая процедура 250 сотрудников", type: 'Опросник "Zetic"', status: "draft", startDate: "2026-09-29", endDate: "2026-10-31", creator: CREATORS[0], updatedAt: "2026-09-29T10:00:00.000Z", count: 250 },
  { name: "Процедура для тестирования с Zetic", type: 'Опросник "Zetic"', status: "in_progress", startDate: "2026-09-28", endDate: "2026-10-31", creator: CREATORS[1], updatedAt: "2026-11-02T10:00:00.000Z", count: 8 },
  { name: "Процедура для демо 1", type: 'Опросник "Zetic"', status: "draft", startDate: "2026-09-28", endDate: "2026-09-30", creator: CREATORS[1], updatedAt: "2026-10-19T10:00:00.000Z", count: 7 },
  { name: "Тестовая процедура ДЕМО", type: 'Опросник "Zetic"', status: "in_progress", startDate: "2026-09-24", endDate: "2026-09-30", creator: CREATORS[1], updatedAt: "2026-10-19T10:00:00.000Z", count: 5 },
  { name: "Тестовая процедура 1", type: 'Опросник "Zetic"', status: "in_progress", startDate: "2026-09-23", endDate: "2026-09-24", creator: CREATORS[0], updatedAt: "2026-09-29T10:00:00.000Z", count: 425 },
]

export function buildSeed(): Procedure[] {
  return SEED.map(({ count, ...p }, idx) => ({
    ...p,
    id: String(idx + 1),
    sendNotifications: true,
    participants: makeParticipants(idx + 1, count, p.status !== "draft"),
  }))
}

/** Демо командные отчёты: по одной команде на подразделение ССП в запущенных процедурах. */
export function buildTeamReportSeed(procedures: Procedure[]): TeamReport[] {
  const reports: TeamReport[] = []
  for (const procedure of procedures) {
    if (procedure.status === "draft") continue
    const byUnit = new Map<string, Participant[]>()
    for (const p of procedure.participants) {
      if (!p.sspUnit) continue
      byUnit.set(p.sspUnit, [...(byUnit.get(p.sspUnit) ?? []), p])
    }
    const teams = [...byUnit.entries()].filter(([, members]) => members.length >= 2).slice(0, 2)
    for (const [unit, members] of teams) {
      const team = members.slice(0, 12)
      reports.push({
        id: String(reports.length + 1),
        name: `${unit.replace(/^Департамент\s+/i, "Команда: ")}`,
        leaders: [{ procedureId: procedure.id, participantId: team[0].id }],
        hrbpIds: [HRBP_DIRECTORY[reports.length % HRBP_DIRECTORY.length].id],
        members: team.slice(1).map((m) => ({ procedureId: procedure.id, participantId: m.id })),
        reportAccess: reports.length % 2 === 0 ? "closed" : "open",
        creator: procedure.creator,
        updatedAt: procedure.updatedAt,
      })
    }
  }
  return reports
}
