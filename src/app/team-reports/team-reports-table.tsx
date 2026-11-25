"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ColumnFilter, ColumnSearch } from "@/components/column-filters"
import { SimplePagination } from "@/components/simple-pagination"
import { SortButton } from "@/components/sort-button"
import { TeamReportStatusBadge } from "@/components/status-badge"
import { usePagedSort } from "@/components/use-paged-sort"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AccessStatus } from "@/app/procedures/_components/access-status"
import { formatDate } from "@/lib/format"
import { TEAM_REPORT_STATUS_LABELS, type TeamReportStatus, type TeamReportSummary } from "@/lib/types"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 10

type SortKey = "name" | "leaderName" | "hrbpName" | "memberCount" | "updatedAt"

const STATUS_OPTIONS = (Object.keys(TEAM_REPORT_STATUS_LABELS) as TeamReportStatus[]).map(
  (value) => ({ value, label: TEAM_REPORT_STATUS_LABELS[value] }),
)

const COLUMNS: Array<{
  label: string
  lines?: [string, string]
  sort?: SortKey
  className?: string
  search?: "name"
  filter?: "status"
}> = [
  { label: "Название", sort: "name", search: "name", className: "w-[13%]" },
  { label: "Статус", filter: "status", className: "w-[9%]" },
  {
    label: "Количество сотрудников",
    lines: ["Количество", "сотрудников"],
    sort: "memberCount",
    className: "w-[11%]",
  },
  { label: "Руководитель", sort: "leaderName", className: "w-[12%]" },
  { label: "Доступ для руководителя", lines: ["Доступ для", "руководителя"], className: "w-[10%]" },
  { label: "Сотрудник ДРП", sort: "hrbpName", className: "w-[12%]" },
  {
    label: "Доступ для сотрудника ДРП",
    lines: ["Доступ для", "сотрудника ДРП"],
    className: "w-[11%]",
  },
  { label: "Создатель отчёта", lines: ["Создатель", "отчёта"], className: "w-[12%]" },
  {
    label: "Последнее изменение",
    lines: ["Последнее", "изменение"],
    sort: "updatedAt",
    className: "w-[10%]",
  },
]

export function TeamReportsTable({ reports }: { reports: TeamReportSummary[] }) {
  const [nameQuery, setNameQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>([])

  const filtered = useMemo(() => {
    const q = nameQuery.trim().toLowerCase()
    return reports.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false
      if (statusFilter.length > 0 && !statusFilter.includes(r.status)) return false
      return true
    })
  }, [reports, nameQuery, statusFilter])

  const { sort, rows, page, pageCount, setPage, sortBy } = usePagedSort<TeamReportSummary, SortKey>(
    filtered,
    PAGE_SIZE,
  )

  const emptyMessage =
    reports.length === 0
      ? "Командных отчётов пока нет. Нажмите «Создать», чтобы собрать команду из участников запущенной процедуры."
      : "Нет отчётов, подходящих под поиск или фильтр."

  return (
    <div className="p-4 pt-3">
      <div className="rounded-lg">
        <Table className="table-fixed text-xs">
          <TableHeader className="bg-table-head">
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.label}
                  className={cn(
                    "h-auto whitespace-normal py-2 align-bottom font-semibold leading-tight text-foreground",
                    col.className,
                  )}
                >
                  <span className="inline-flex items-end gap-1">
                    {col.lines ? (
                      <span className="whitespace-nowrap">
                        {col.lines[0]}
                        <br />
                        {col.lines[1]}
                      </span>
                    ) : (
                      col.label
                    )}
                    {col.sort && (
                      <SortButton
                        label={col.label}
                        dir={sort?.key === col.sort ? sort.dir : null}
                        onClick={() => sortBy(col.sort!)}
                      />
                    )}
                    {col.search === "name" && (
                      <ColumnSearch label={col.label} value={nameQuery} onChange={setNameQuery} />
                    )}
                    {col.filter === "status" && (
                      <ColumnFilter
                        label={col.label}
                        options={STATUS_OPTIONS}
                        selected={statusFilter}
                        onChange={setStatusFilter}
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
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-normal">
                  <Link href={`/team-reports/${r.id}`} className="font-medium text-primary hover:underline">
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <TeamReportStatusBadge status={r.status} />
                </TableCell>
                <TableCell className="whitespace-normal tabular-nums">{r.memberCount}</TableCell>
                <TableCell className="whitespace-normal">{r.leaderName}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <AccessStatus access={r.reportAccess} />
                </TableCell>
                <TableCell className="whitespace-normal">{r.hrbpName}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <AccessStatus access={r.hrbpReportAccess} />
                </TableCell>
                <TableCell className="whitespace-normal">{r.creator}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{formatDate(r.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <SimplePagination
        total={filtered.length}
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
      />
    </div>
  )
}
