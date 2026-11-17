export type ProcedureStatus = "draft" | "in_progress" | "completed"

/** Доступ участника к его отчёту. null — ссылка ещё не выдана / отчёта нет. */
export type ReportAccess = "open" | "closed" | null

export interface Participant {
  id: string
  fullName: string
  position: string
  sspUnit: string
  vspUnit: string
  externalLogin: string
  notify: boolean
  externalLink: string | null
  reportAccess: ReportAccess
}

export interface Procedure {
  id: string
  name: string
  type: string
  status: ProcedureStatus
  /** ISO-дата yyyy-mm-dd */
  startDate: string
  /** ISO-дата yyyy-mm-dd */
  endDate: string
  creator: string
  /** ISO-дата и время */
  updatedAt: string
  sendNotifications: boolean
  participants: Participant[]
}

/** Строка списка процедур — без самих участников. */
export interface ProcedureSummary
  extends Omit<Procedure, "participants" | "sendNotifications"> {
  participantCount: number
}

export interface ProcedureInput {
  name: string
  type: string
  startDate: string
  endDate: string
  sendNotifications: boolean
  participants: Participant[]
}

/**
 * Командный отчёт: команда из участников запущенных процедур
 * (возможно, разных) и руководитель, который получает сводный отчёт.
 */
export interface TeamReport {
  id: string
  name: string
  /** Получатель отчёта — участник одной из процедур */
  leader: MemberRef
  /** Участники команды */
  members: MemberRef[]
  reportAccess: Exclude<ReportAccess, null>
  creator: string
  /** ISO-дата и время */
  updatedAt: string
}

/** Ссылка на участника конкретной процедуры. */
export interface MemberRef {
  procedureId: string
  participantId: string
}

export function memberKey(ref: MemberRef): string {
  return `${ref.procedureId}:${ref.participantId}`
}

export interface TeamReportSummary {
  id: string
  name: string
  procedures: { id: string; name: string }[]
  leaderName: string
  memberCount: number
  reportAccess: Exclude<ReportAccess, null>
  creator: string
  updatedAt: string
}

export interface TeamReportInput {
  name: string
  leader: MemberRef | null
  members: MemberRef[]
}

/** Процедура, из которой можно набирать участников команды. */
export type ProcedureOption = Pick<
  Procedure,
  "id" | "name" | "type" | "status" | "startDate" | "endDate" | "participants"
>

export const PROCEDURE_TYPES = ['Опросник "Zetic"'] as const

export const STATUS_LABELS: Record<ProcedureStatus, string> = {
  draft: "Черновик",
  in_progress: "В процессе",
  completed: "Завершена",
}
