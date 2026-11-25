import { cn } from "@/lib/utils"
import { STATUS_LABELS, TEAM_REPORT_STATUS_LABELS, type ProcedureStatus, type TeamReportStatus } from "@/lib/types"

const STYLES: Record<ProcedureStatus, string> = {
  draft: "bg-muted text-foreground/80",
  in_progress: "bg-accent text-primary",
  completed: "bg-success/10 text-success",
}

export function StatusBadge({ status }: { status: ProcedureStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded px-1.5 text-[10px] font-semibold tracking-wide uppercase",
        STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

const TEAM_STYLES: Record<TeamReportStatus, string> = {
  draft: "bg-muted text-foreground/80",
  active: "bg-success/10 text-success",
  archived: "bg-foreground/10 text-foreground/70",
}

export function TeamReportStatusBadge({ status }: { status: TeamReportStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded px-1.5 text-[10px] font-semibold tracking-wide uppercase",
        TEAM_STYLES[status],
      )}
    >
      {TEAM_REPORT_STATUS_LABELS[status]}
    </span>
  )
}
