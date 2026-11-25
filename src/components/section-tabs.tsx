import Link from "next/link"
import { ChartColumnIcon, SearchIcon, UsersRoundIcon, UsersIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const SECTIONS = [
  { key: "procedures", label: "Процедуры", href: "/procedures", icon: UsersRoundIcon },
  { key: "team-reports", label: "Командные отчёты", href: "/team-reports", icon: UsersIcon },
  { key: "reporting", label: "Отчётность", href: "/reporting", icon: ChartColumnIcon },
  { key: "employee-search", label: "Поиск сотрудника", href: "/employee-search", icon: SearchIcon },
] as const

export type Section = (typeof SECTIONS)[number]["key"]

/** Переключатель разделов «Внешней оценки» над списками. */
export function SectionTabs({ active }: { active: Section }) {
  return (
    <nav aria-label="Разделы внешней оценки" className="flex flex-wrap gap-2">
      {SECTIONS.map(({ key, label, href, icon: Icon }) => {
        const current = key === active
        return (
          <Link
            key={key}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors",
              current
                ? "border-primary/30 bg-background shadow-xs"
                : "border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground",
            )}
          >
            <Icon className={cn("size-4", current && "text-primary")} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
