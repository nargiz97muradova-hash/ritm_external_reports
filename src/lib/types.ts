export type ProcedureStatus = "draft" | "in_progress" | "completed"

/**
 * Черновик — состав команды можно менять.
 * Активный — отчёт можно показать руководителю и сотруднику ДРП.
 * Архив — доступ руководителю и ДРП закрыт, администратор только просматривает.
 */
export type TeamReportStatus = "draft" | "active" | "archived"

/** Доступ участника к его отчёту. null — ссылка ещё не выдана / отчёта нет. */
export type ReportAccess = "open" | "closed" | null

export interface Participant {
  id: string
  /** Персональный ID сотрудника, обычно 5–6 цифр */
  personnelId: string
  fullName: string
  position: string
  sspUnit: string
  vspUnit: string
  externalLogin: string
  notify: boolean
  externalLink: string | null
  reportAccess: ReportAccess
  /** ISO-дата формирования персонального отчёта; null — отчёта ещё нет */
  reportFormedAt: string | null
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
 * Дополнительная группа участников для сравнения в отчёте
 * (тепловые карты, раздел «Группы участников»). Может отсутствовать.
 */
export interface TeamComparisonGroup {
  id: string
  name: string
  memberIds: string[]
  /** Ключ цвета из палитры отчёта (sky, amber, …) */
  color?: string
}

/**
 * Командный отчёт: группа участников одной запущенной процедуры
 * и руководитель, который получает сводный отчёт по команде.
 */
export interface TeamReport {
  id: string
  name: string
  procedureId: string
  /** id руководителей — получателей отчёта (необязательно) */
  leaderIds: string[]
  /** id сотрудников ДРП, закреплённых за отчётом */
  hrbpIds: string[]
  /** id участников процедуры, входящих в команду */
  memberIds: string[]
  /**
   * Пользовательские группы для сравнения в отчёте.
   * Пустой массив — без доп. группировки (одна команда + руководители).
   */
  groups: TeamComparisonGroup[]
  /** Участники, выделенные в группировке (акцент в отчёте). */
  highlightedIds: string[]
  /**
   * id разделов содержания командного отчёта (см. REPORT_CONTENT_SECTIONS).
   * По умолчанию — все разделы. Менять можно только в статусе «Черновик».
   */
  contentSections: string[]
  status: TeamReportStatus
  /** доступ руководителей к отчёту */
  reportAccess: Exclude<ReportAccess, null>
  /** доступ сотрудника ДРП к отчёту */
  hrbpReportAccess: Exclude<ReportAccess, null>
  /** письмо руководителям об открытии доступа */
  reportEmailSent: boolean
  /** письмо сотрудникам ДРП об открытии доступа */
  hrbpEmailSent: boolean
  creator: string
  /** Кто внёс последнее изменение (может отличаться от создателя) */
  updatedBy: string
  /** ISO-дата и время */
  updatedAt: string
}

export interface TeamReportSummary {
  id: string
  name: string
  procedureId: string
  procedureName: string
  leaderName: string
  hrbpName: string
  memberCount: number
  status: TeamReportStatus
  reportAccess: Exclude<ReportAccess, null>
  hrbpReportAccess: Exclude<ReportAccess, null>
  reportEmailSent: boolean
  hrbpEmailSent: boolean
  creator: string
  updatedBy: string
  updatedAt: string
}

export interface TeamReportInput {
  name: string
  procedureId: string
  leaderIds: string[]
  hrbpIds: string[]
  memberIds: string[]
  groups: TeamComparisonGroup[]
  highlightedIds: string[]
  contentSections: string[]
}

/** Процедура, доступная для командного отчёта, — с участниками. */
export type ProcedureOption = Pick<
  Procedure,
  "id" | "name" | "status" | "startDate" | "endDate" | "participants"
>

/** Участник процедуры для раздела «Поиск сотрудника». */
export interface EmployeeSearchHit {
  id: string
  personnelId: string
  fullName: string
  position: string
  sspUnit: string
  vspUnit: string
  externalLogin: string
  reportAccess: ReportAccess
  procedureId: string
  procedureName: string
  procedureStatus: ProcedureStatus
}

export const PROCEDURE_TYPES = ['Опросник "Zetic"'] as const

export const STATUS_LABELS: Record<ProcedureStatus, string> = {
  draft: "Черновик",
  in_progress: "В процессе",
  completed: "Завершена",
}

export const TEAM_REPORT_STATUS_LABELS: Record<TeamReportStatus, string> = {
  draft: "Черновик",
  active: "Активный",
  archived: "Архив",
}
