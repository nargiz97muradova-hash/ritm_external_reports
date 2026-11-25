import type { CSSProperties } from "react"

/** 6 базовых цветов групп + произвольный hex через color picker. */
export const GROUP_COLOR_OPTIONS = [
  {
    id: "primary",
    label: "Синий",
    hex: "#3b82f6",
    chip: "bg-primary/20 ring-1 ring-primary/40 text-primary",
    dot: "bg-primary/20 ring-1 ring-primary/40",
    swatch: "bg-primary",
  },
  {
    id: "sky",
    label: "Голубой",
    hex: "#38bdf8",
    chip: "bg-sky-200/80 ring-1 ring-sky-400/50 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100",
    dot: "bg-sky-400 ring-1 ring-sky-500/40",
    swatch: "bg-sky-400",
  },
  {
    id: "amber",
    label: "Янтарный",
    hex: "#f59e0b",
    chip: "bg-amber-200/80 ring-1 ring-amber-400/50 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100",
    dot: "bg-amber-400 ring-1 ring-amber-500/40",
    swatch: "bg-amber-400",
  },
  {
    id: "violet",
    label: "Фиолетовый",
    hex: "#8b5cf6",
    chip: "bg-violet-200/80 ring-1 ring-violet-400/50 text-violet-950 dark:bg-violet-900/50 dark:text-violet-100",
    dot: "bg-violet-400 ring-1 ring-violet-500/40",
    swatch: "bg-violet-400",
  },
  {
    id: "rose",
    label: "Розовый",
    hex: "#f43f5e",
    chip: "bg-rose-200/80 ring-1 ring-rose-400/50 text-rose-950 dark:bg-rose-900/50 dark:text-rose-100",
    dot: "bg-rose-400 ring-1 ring-rose-500/40",
    swatch: "bg-rose-400",
  },
  {
    id: "teal",
    label: "Бирюзовый",
    hex: "#14b8a6",
    chip: "bg-teal-200/80 ring-1 ring-teal-400/50 text-teal-950 dark:bg-teal-900/50 dark:text-teal-100",
    dot: "bg-teal-400 ring-1 ring-teal-500/40",
    swatch: "bg-teal-400",
  },
] as const

export type GroupColorId = (typeof GROUP_COLOR_OPTIONS)[number]["id"]

const BY_ID = new Map(GROUP_COLOR_OPTIONS.map((c) => [c.id, c]))

const HEX_RE = /^#([0-9a-fA-F]{6})$/

export function isGroupColorId(value: string | null | undefined): value is GroupColorId {
  return Boolean(value && BY_ID.has(value as GroupColorId))
}

export function isHexColor(value: string | null | undefined): value is string {
  return Boolean(value && HEX_RE.test(value))
}

export function isGroupColor(value: string | null | undefined): boolean {
  return isGroupColorId(value) || isHexColor(value)
}

export function nextGroupColorId(used: Array<string | null | undefined>): GroupColorId {
  const taken = new Set(used.filter(isGroupColorId))
  return GROUP_COLOR_OPTIONS.find((c) => !taken.has(c.id))?.id ?? GROUP_COLOR_OPTIONS[0].id
}

/** Hex для пресета или произвольного цвета — для color input и inline-стилей. */
export function groupColorHex(color?: string | null): string {
  if (isHexColor(color)) return color
  if (isGroupColorId(color)) return BY_ID.get(color)!.hex
  return GROUP_COLOR_OPTIONS[0].hex
}

function resolvePreset(
  groupId: string,
  groupIds: string[],
  color?: string | null,
): (typeof GROUP_COLOR_OPTIONS)[number] {
  if (isGroupColorId(color)) return BY_ID.get(color)!
  const idx = Math.max(0, groupIds.filter((id) => id !== "leader").indexOf(groupId))
  return GROUP_COLOR_OPTIONS[idx % GROUP_COLOR_OPTIONS.length]
}

export function groupChipClass(
  groupId: string,
  groupIds: string[],
  color?: string | null,
): string | undefined {
  if (groupId === "leader") return "bg-success text-white ring-2 ring-success/30"
  if (isHexColor(color)) return undefined
  return resolvePreset(groupId, groupIds, color).chip
}

export function groupDotClass(
  groupId: string,
  groupIds: string[],
  color?: string | null,
): string | undefined {
  if (groupId === "leader") return "bg-success ring-2 ring-success/30"
  if (isHexColor(color)) return undefined
  return resolvePreset(groupId, groupIds, color).dot
}

export function groupSwatchClass(color?: string | null): string | undefined {
  if (isHexColor(color)) return undefined
  if (isGroupColorId(color)) return BY_ID.get(color)!.swatch
  return GROUP_COLOR_OPTIONS[0].swatch
}

/** Inline-стили для произвольного hex (чип номера участника). */
export function groupChipStyle(color?: string | null): CSSProperties | undefined {
  if (!isHexColor(color)) return undefined
  return {
    backgroundColor: `${color}33`,
    color,
    boxShadow: `inset 0 0 0 1px ${color}66`,
  }
}

/** Inline-стили для кружка легенды / столбца групп. */
export function groupDotStyle(color?: string | null): CSSProperties | undefined {
  if (!isHexColor(color)) return undefined
  return {
    backgroundColor: color,
    boxShadow: `inset 0 0 0 1px ${color}99`,
  }
}
