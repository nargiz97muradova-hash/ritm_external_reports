import { ORGANIZATION } from "@/lib/organization"
import { memberKey, type MemberRef, type Procedure, type TeamReport } from "@/lib/types"
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

/**
 * Собирает данные командного отчёта: участники, группы и агрегаты.
 * Участники команды могут быть из разных процедур.
 */
export function buildTeamReportData(report: TeamReport, procedures: Procedure[]): TeamReportData {
  const byProcedure = new Map(procedures.map((p) => [p.id, p]))
  const find = (ref: MemberRef) =>
    byProcedure.get(ref.procedureId)?.participants.find((p) => p.id === ref.participantId)

  const people = [
    ...report.leaders.map((ref) => ({ ref, group: "leader" as const })),
    ...report.members.map((ref) => ({ ref, group: "team" as const })),
  ].flatMap(({ ref, group }) => {
    const p = find(ref)
    return p ? [{ ref, group, p }] : []
  })

  const participants: ReportParticipant[] = people
    .map(({ ref, group, p }) => ({
      number: 0,
      id: memberKey(ref),
      fullName: p.fullName,
      position: p.position,
      group,
      // Результаты привязаны к человеку в процедуре — как в источнике оценки.
      results: demoResults(ref.participantId),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"))
    .map((p, i) => ({ ...p, number: i + 1 }))

  const groups: ReportGroup[] = [
    { id: "team", name: report.name },
    { id: "leader", name: report.leaders.length > 1 ? "Руководители" : "Руководитель" },
  ]
  const team = participants.filter((p) => p.group === "team")
  const leader = participants.filter((p) => p.group === "leader")

  const heat: TeamReportData["heat"] = {}
  for (const section of SCALE_SECTIONS) {
    for (const group of section.groups) {
      for (const scale of group.scales) {
        const teamAvg = mean(team.map((p) => p.results.scales[scale.key]))
        const leaderAvg = mean(leader.map((p) => p.results.scales[scale.key]))
        const present = [team.length ? teamAvg : null, leader.length ? leaderAvg : null].filter(
          (v): v is number => v !== null,
        )
        heat[scale.key] = { team: teamAvg, leader: leaderAvg, average: mean(present) }
      }
    }
  }

  const used = procedures.filter((p) => people.some(({ ref }) => ref.procedureId === p.id))

  return {
    title: report.name,
    createdAt: report.updatedAt,
    survey: [...new Set(used.map((p) => p.type))].join(", ") || "—",
    company: ORGANIZATION.name,
    procedureNames: used.map((p) => p.name),
    groups,
    participants,
    integralAll: integral(participants),
    integralTeam: integral(team),
    competencyAverages: Object.fromEntries(
      COMPETENCIES.map((c) => [c, Math.round(mean(participants.map((p) => p.results.competencies[c])))]),
    ),
    heat,
    isDemo: true,
  }
}
