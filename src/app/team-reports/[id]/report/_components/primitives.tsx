import {
  groupChipClass,
  groupChipStyle,
  groupDotClass,
  groupDotStyle,
} from "@/lib/report/group-colors"
import type { ReportParticipant } from "@/lib/report/types"
import { cn } from "@/lib/utils"

/** Номер участника в кружке; цвет зависит от группы сравнения. */
export function Chip({
  participant,
  groupIds = [],
  size = "md",
}: {
  participant: ReportParticipant
  /** Порядок групп в отчёте — для стабильной палитры */
  groupIds?: string[]
  size?: "sm" | "md"
}) {
  const leader = participant.group === "leader"
  const label = `${participant.number}. ${participant.fullName}${leader ? " — руководитель" : ""}${
    participant.highlighted ? " — выделен" : ""
  }`
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tabular-nums",
        size === "sm" ? "size-5 text-[10px]" : "size-7 text-xs",
        groupChipClass(participant.group, groupIds, participant.groupColor),
        participant.highlighted && "ring-2 ring-foreground/70 ring-offset-1 ring-offset-background",
      )}
      style={groupChipStyle(participant.groupColor)}
    >
      {participant.number}
    </span>
  )
}

export function ChipList({
  participants,
  groupIds,
  size,
  className,
}: {
  participants: ReportParticipant[]
  groupIds?: string[]
  size?: "sm" | "md"
  className?: string
}) {
  if (participants.length === 0) return null
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {participants.map((p) => (
        <Chip key={p.id} participant={p} groupIds={groupIds} size={size} />
      ))}
    </div>
  )
}

export function ReportSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("scroll-mt-20 rounded-xl bg-background shadow-xs break-inside-avoid-page", className)}
    >
      <div className="border-b px-4 py-3">
        <h2 id={`${id}-title`} className="text-base font-semibold">
          {title}
        </h2>
        {description && <p className="mt-1 max-w-4xl text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

/** Блок «Описание отчёта» с пояснениями к визуализации. */
export function Explanation({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-lg bg-muted/70 p-4 text-xs leading-relaxed text-foreground/80">
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Описание отчёта
      </p>
      <div className="grid gap-2">{children}</div>
    </div>
  )
}

export function GroupLegend({
  groups,
}: {
  groups?: Array<{ id: string; name: string; color?: string }>
}) {
  const items =
    groups && groups.length > 0
      ? groups
      : [
          { id: "team", name: "Участник команды" },
          { id: "leader", name: "Руководитель" },
        ]
  const ids = items.map((g) => g.id)
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {items.map((g) => (
        <span key={g.id} className="inline-flex items-center gap-1.5">
          <span
            className={cn("size-3 rounded-full", groupDotClass(g.id, ids, g.color))}
            style={groupDotStyle(g.color)}
          />
          {g.name}
        </span>
      ))}
      <span>Наведите на номер, чтобы увидеть ФИО</span>
    </div>
  )
}
