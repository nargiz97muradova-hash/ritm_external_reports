import type { Competency, LearningStyle } from "./definitions"

/** Результаты одного участника по опроснику (в будущем — из источника Zetic). */
export interface ParticipantResults {
  /** Проявленность компетенций, % */
  competencies: Record<Competency, number>
  /** Ключ роли из ROLE_GRID */
  role: string
  /** Потенциал к развитию, 0–100 */
  potential: number
  /** Менеджерские навыки, 0–100 */
  managerSkills: number
  /** Значения шкал 0–10 по ключам из SCALE_SECTIONS */
  scales: Record<string, number>
  learningStyle: LearningStyle
}

export type ReportGroupKind = "team" | "leader"

export interface ReportGroup {
  id: ReportGroupKind
  name: string
}

export interface ReportParticipant {
  /** Порядковый номер в отчёте (по алфавиту) */
  number: number
  id: string
  fullName: string
  position: string
  group: ReportGroupKind
  results: ParticipantResults
}

export interface IntegralPoint {
  competency: Competency
  /** Средняя проявленность, % */
  manifestation: number
  /** Согласованность ответов, % */
  consistency: number
}

export interface TeamReportData {
  title: string
  createdAt: string
  survey: string
  company: string
  procedureNames: string[]
  groups: ReportGroup[]
  participants: ReportParticipant[]
  integralAll: IntegralPoint[]
  integralTeam: IntegralPoint[]
  competencyAverages: Record<string, number>
  /** Средние по шкалам: [scaleKey][groupId | "average"] */
  heat: Record<string, Record<string, number>>
  /** Результаты демонстрационные — источник оценки не подключён */
  isDemo: boolean
}
