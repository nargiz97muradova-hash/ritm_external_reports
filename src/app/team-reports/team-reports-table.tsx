"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { PencilIcon } from "lucide-react"
import { toast } from "sonner"
import { AccessStatus } from "@/app/procedures/_components/access-status"
import { SimplePagination } from "@/components/simple-pagination"
import { SortButton, compareValues, nextSort, type SortDir } from "@/components/sort-button"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDate } from "@/lib/format"
import type { TeamReportSummary } from "@/lib/types"
import { cn } from "@/lib/utils"
import { setTeamReportAccessAction } from "./actions"
import { TeamReportActionsMenu } from "./_components/team-report-actions-menu"

const PAGE_SIZE = 10

type SortKey = "name" | "procedures" | "leaderName" | "memberCount" | "updatedAt"

const COLUMNS: Array<{ label: string; sort?: SortKey; className?: string }> = [
  { label: "Название", sort: "name", className: "w-[18%]" },
  { label: "Процедуры", sort: "procedures" },
  { label: "Руководитель", sort: "leaderName" },
  { label: "Участников", sort: "memberCount" },
  { label: "Доступ к отчёту", className: "w-40" },
  { label: "Создатель отчёта" },
  { label: "Последнее изменение", sort: "updatedAt" },
  { label: "Действие", className: "w-24 text-center" },
]

export function TeamReportsTable({ reports }: { reports: TeamReportSummary[] }) {
  const router = useRouter()
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null)
  const [page, setPage] = useState(1)
  const [pending, startTransition] = useTransition()

  const sorted = useMemo(() => {
    if (!sort) return reports
    const factor = sort.dir === "asc" ? 1 : -1
    const value = (r: TeamReportSummary) =>
      sort.key === "procedures" ? r.procedures.map((p) => p.name).join(", ") : r[sort.key]
    return [...reports].sort((a, b) => factor * compareValues(value(a), value(b)))
  }, [reports, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const rows = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  function toggleAccess(r: TeamReportSummary) {
    startTransition(async () => {
      const next = r.reportAccess === "open" ? "closed" : "open"
      const res = await setTeamReportAccessAction(r.id, next)
      if (!res.ok) return void toast.error(res.error)
      toast.success(next === "open" ? "Доступ руководителю открыт" : "Доступ руководителю закрыт")
      router.refresh()
    })
  }

  return (
    <div className="p-4 pt-3">
      <div className="overflow-x-auto rounded-lg">
        <Table className="min-w-[1100px] text-xs">
          <TableHeader className="bg-table-head">
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((col) => (
                <TableHead key={col.label} className={cn("h-9 font-semibold text-foreground", col.className)}>
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sort && (
                      <SortButton
                        label={col.label}
                        dir={sort?.key === col.sort ? sort.dir : null}
                        onClick={() => {
                          setSort((s) => nextSort(s, col.sort!))
                          setPage(1)
                        }}
                      />
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="h-24 text-center text-muted-foreground">
                  Командных отчётов пока нет. Нажмите «Создать», чтобы собрать команду из участников
                  запущенных процедур.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-60 whitespace-normal">
                  <Link href={`/team-reports/${r.id}`} className="font-medium text-primary hover:underline">
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell className="max-w-56 whitespace-normal">
                  {r.procedures.length === 0 && <span className="text-muted-foreground">—</span>}
                  {r.procedures.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && ", "}
                      <Link href={`/procedures/${p.id}`} className="hover:text-primary hover:underline">
                        {p.name}
                      </Link>
                    </span>
                  ))}
                </TableCell>
                <TableCell>{r.leaderName}</TableCell>
                <TableCell className="tabular-nums">{r.memberCount}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-between gap-2">
                    <AccessStatus access={r.reportAccess} />
                    <button
                      type="button"
                      disabled={pending}
                      className="text-primary hover:underline disabled:opacity-50"
                      onClick={() => toggleAccess(r)}
                    >
                      {r.reportAccess === "open" ? "Закрыть" : "Открыть"}
                    </button>
                  </div>
                </TableCell>
                <TableCell>{r.creator}</TableCell>
                <TableCell className="tabular-nums">{formatDate(r.updatedAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1.5">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="secondary"
                            size="icon-sm"
                            className="text-primary"
                            render={<Link href={`/team-reports/${r.id}`} />}
                            nativeButton={false}
                            aria-label={`Редактировать «${r.name}»`}
                          />
                        }
                      >
                        <PencilIcon />
                      </TooltipTrigger>
                      <TooltipContent>Редактировать</TooltipContent>
                    </Tooltip>
                    <TeamReportActionsMenu id={r.id} name={r.name} access={r.reportAccess} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <SimplePagination total={reports.length} page={current} pageCount={pageCount} onPageChange={setPage} />
    </div>
  )
}
