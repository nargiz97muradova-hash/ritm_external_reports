import { ORGANIZATION } from "@/lib/organization"
import type { Procedure, TeamReport } from "@/lib/types"
import { COMPETENCIES, SCALE_SECTIONS } from "./definitions"
import { demoResults } from "./demo-results"
import type {
  IntegralPoint,
  ReportGroup,
  ReportParticipant,
  TeamReportData,
} from "./types"

const mean = (values: number[]) =>
  values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0

function stdev(values: number[]) {
  const m = mean(values)
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)))
}

/** Максимально возможное стандартное отклонение для шкалы 0–100 — 50. */
function integral(participants: ReportParticipant[]): IntegralPoint[] {
  return COMPETENCIES.map((competency) => {
    const values = participants.map((p) => p.results.competencies[competency])
    return {
      competency,
      manifestation: Math.round(mean(values)),
      consistency: Math.round(Math.max(0, 100 - (stdev(values) / 50) * 100 * 1.6)),
    }
  })
}

/** Собирает данные командного отчёта: участники, группы и агрегаты. */
export function buildTeamReportData(
  report: TeamReport,
  procedure: Procedure,
  /** Участники могут быть из других процедур — передайте все нужные. */
  extraProcedures: Array<Pick<Procedure, "participants">> = [],
): TeamReportData {
  const byId = new Map<string, Procedure["participants"][number]>()
  for (const pool of [procedure, ...extraProcedures]) {
    for (const p of pool.participants) byId.set(p.id, p)
  }
  const customGroups = (report.groups ?? []).filter((g) => g.memberIds.length > 0 && g.name.trim())

  const memberGroupId = new Map<string, string>()
  for (const g of customGroups) {
    for (const id of g.memberIds) memberGroupId.set(id, g.id)
  }

  const people: Array<{ id: string; group: string }> = [
    ...report.leaderIds.filter((id) => byId.has(id)).map((id) => ({ id, group: "leader" })),
  ]

  for (const id of report.memberIds) {
    if (!byId.has(id)) continue
    if (customGroups.length > 0) {
      people.push({ id, group: memberGroupId.get(id) ?? "team" })
    } else {
      people.push({ id, group: "team" })
    }
  }

  const highlighted = new Set(report.highlightedIds ?? [])
  const groupColorById = new Map(customGroups.map((g) => [g.id, g.color]))

  const participants: ReportParticipant[] = people
    .map(({ id, group }) => {
      const p = byId.get(id)!
      return {
        number: 0,
        id,
        fullName: p.fullName,
        position: p.position,
        group,
        groupColor: groupColorById.get(group),
        highlighted: highlighted.has(id),
        results: demoResults(id),
      }
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"))
    .map((p, i) => ({ ...p, number: i + 1 }))

  const groups: ReportGroup[] = []
  if (customGroups.length > 0) {
    for (const g of customGroups) {
      groups.push({ id: g.id, name: g.name.trim(), color: g.color })
    }
    const ungrouped = participants.filter((p) => p.group === "team")
    if (ungrouped.length > 0) groups.push({ id: "team", name: "Без группы" })
  } else {
    groups.push({ id: "team", name: report.name })
  }
  if (report.leaderIds.some((id) => byId.has(id))) {
    groups.push({ id: "leader", name: "Руководитель" })
  }

  const byGroup = new Map<string, ReportParticipant[]>()
  for (const g of groups) byGroup.set(g.id, [])
  for (const p of participants) {
    const list = byGroup.get(p.group)
    if (list) list.push(p)
  }

  const nonLeaders = participants.filter((p) => p.group !== "leader")

  const heat: TeamReportData["heat"] = {}
  for (const section of SCALE_SECTIONS) {
    for (const scaleGroup of section.groups) {
      for (const scale of scaleGroup.scales) {
        const row: Record<string, number> = {}
        const present: number[] = []
        for (const g of groups) {
          const cohort = byGroup.get(g.id) ?? []
          const avg = mean(cohort.map((p) => p.results.scales[scale.key]))
          row[g.id] = avg
          if (cohort.length) present.push(avg)
        }
        row.average = mean(present)
        heat[scale.key] = row
      }
    }
  }

  return {
    title: report.name,
    createdAt: report.updatedAt,
    survey: procedure.type,
    company: ORGANIZATION.name,
    procedureName: procedure.name,
    groups,
    participants,
    integralAll: integral(participants),
    integralTeam: integral(nonLeaders),
    competencyAverages: Object.fromEntries(
      COMPETENCIES.map((c) => [c, Math.round(mean(participants.map((p) => p.results.competencies[c])))]),
    ),
    heat,
    isDemo: true,
  }
}
