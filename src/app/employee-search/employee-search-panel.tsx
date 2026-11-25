"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { InboxIcon, SearchIcon } from "lucide-react"
import { AccessStatus, ACCESS_LABELS } from "@/app/procedures/_components/access-status"
import { EmptyState } from "@/app/procedures/_components/table-bits"
import { ColumnFilter, uniqueOptions } from "@/components/column-filters"
import { ParticipantAvatar } from "@/components/participant-avatar"
import { SimplePagination } from "@/components/simple-pagination"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { STATUS_LABELS, type EmployeeSearchHit, type ProcedureStatus } from "@/lib/types"

const PAGE_SIZE = 10

type ResultFilters = {
  position: string[]
  sspUnit: string[]
  procedureId: string[]
  procedureStatus: string[]
  reportAccess: string[]
}

const EMPTY_FILTERS: ResultFilters = {
  position: [],
  sspUnit: [],
  procedureId: [],
  procedureStatus: [],
  reportAccess: [],
}

export function EmployeeSearchPanel({ employees }: { employees: EmployeeSearchHit[] }) {
  const [query, setQuery] = useState("")
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null)
  const [filters, setFilters] = useState<ResultFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)

  const matched = useMemo(() => {
    if (submittedQuery == null) return []
    const q = submittedQuery.trim().toLowerCase()
    if (q.length < 2) return []
    return employees.filter((person) => person.fullName.toLowerCase().includes(q))
  }, [employees, submittedQuery])

  const filterOptions = useMemo(() => {
    const statuses = [...new Set(matched.map((p) => p.procedureStatus))] as ProcedureStatus[]
    return {
      position: uniqueOptions(matched.map((p) => p.position)),
      sspUnit: uniqueOptions(matched.map((p) => p.sspUnit)),
      procedure: [...new Map(matched.map((p) => [p.procedureId, p.procedureName])).entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "ru")),
      procedureStatus: statuses
        .map((value) => ({ value, label: STATUS_LABELS[value] }))
        .sort((a, b) => a.label.localeCompare(b.label, "ru")),
      reportAccess: [
        { value: "open", label: ACCESS_LABELS.open },
        { value: "closed", label: ACCESS_LABELS.closed },
        { value: "none", label: "Нет ссылки" },
      ].filter((opt) =>
        matched.some((p) => (p.reportAccess ?? "none") === opt.value),
      ),
    }
  }, [matched])

  const results = useMemo(() => {
    return matched.filter((person) => {
      if (filters.position.length && !filters.position.includes(person.position)) return false
      if (filters.sspUnit.length && !filters.sspUnit.includes(person.sspUnit)) return false
      if (filters.procedureId.length && !filters.procedureId.includes(person.procedureId))
        return false
      if (
        filters.procedureStatus.length &&
        !filters.procedureStatus.includes(person.procedureStatus)
      ) {
        return false
      }
      if (
        filters.reportAccess.length &&
        !filters.reportAccess.includes(person.reportAccess ?? "none")
      ) {
        return false
      }
      return true
    })
  }, [matched, filters])

  const isFiltered = Object.values(filters).some((v) => v.length > 0)
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const resultsKey = `${submittedQuery ?? ""}:${results.length}:${JSON.stringify(filters)}`
  const [resultsKeySeen, setResultsKeySeen] = useState(resultsKey)
  if (resultsKeySeen !== resultsKey) {
    setResultsKeySeen(resultsKey)
    setPage(1)
  }

  function search() {
    setSubmittedQuery(query.trim())
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  function setFilter<K extends keyof ResultFilters>(key: K, value: ResultFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const showResults = submittedQuery != null && submittedQuery.trim().length >= 2

  return (
    <div className="grid gap-5 p-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="employee-query" className="text-xs font-semibold">
            ФИО сотрудника
          </Label>
          <Input
            id="employee-query"
            value={query}
            placeholder="Введите ФИО"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") search()
            }}
          />
        </div>

        <Button className="md:mb-px" onClick={search}>
          <SearchIcon /> Найти
        </Button>
      </div>

      {submittedQuery == null && (
        <p className="text-sm text-muted-foreground">
          Введите ФИО (не меньше 2 символов) и нажмите «Найти». После поиска можно сузить список
          фильтрами в таблице.
        </p>
      )}

      {submittedQuery != null && submittedQuery.trim().length < 2 && (
        <p className="text-sm text-destructive">Введите не меньше 2 символов для поиска.</p>
      )}

      {showResults && (
        <div className="grid gap-3">
          <div className="overflow-x-auto rounded-lg border">
            <Table className="min-w-[960px] text-xs">
              <TableHeader className="bg-table-head">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 w-12 font-semibold text-foreground" />
                  <TableHead className="h-9 w-[8%] font-semibold text-foreground">ID</TableHead>
                  <TableHead className="h-9 w-[18%] font-semibold text-foreground">ФИО</TableHead>
                  <TableHead className="h-9 w-[14%] font-semibold text-foreground">
                    <span className="inline-flex items-center gap-1">
                      Должность
                      <ColumnFilter
                        label="Должность"
                        options={filterOptions.position}
                        selected={filters.position}
                        onChange={(v) => setFilter("position", v)}
                      />
                    </span>
                  </TableHead>
                  <TableHead className="h-9 w-[16%] font-semibold text-foreground">
                    <span className="inline-flex items-center gap-1">
                      Подразделение ССП
                      <ColumnFilter
                        label="Подразделение ССП"
                        options={filterOptions.sspUnit}
                        selected={filters.sspUnit}
                        onChange={(v) => setFilter("sspUnit", v)}
                      />
                    </span>
                  </TableHead>
                  <TableHead className="h-9 w-[18%] font-semibold text-foreground">
                    <span className="inline-flex items-center gap-1">
                      Процедура
                      <ColumnFilter
                        label="Процедура"
                        options={filterOptions.procedure}
                        selected={filters.procedureId}
                        onChange={(v) => setFilter("procedureId", v)}
                      />
                    </span>
                  </TableHead>
                  <TableHead className="h-9 w-[10%] font-semibold text-foreground">
                    <span className="inline-flex items-center gap-1">
                      Статус
                      <ColumnFilter
                        label="Статус"
                        options={filterOptions.procedureStatus}
                        selected={filters.procedureStatus}
                        onChange={(v) => setFilter("procedureStatus", v)}
                      />
                    </span>
                  </TableHead>
                  <TableHead className="h-9 w-[10%] font-semibold text-foreground">
                    <span className="inline-flex items-center gap-1">
                      Доступ к отчёту
                      <ColumnFilter
                        label="Доступ к отчёту"
                        options={filterOptions.reportAccess}
                        selected={filters.reportAccess}
                        onChange={(v) => setFilter("reportAccess", v)}
                      />
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8}>
                      {matched.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                          <InboxIcon className="size-10 text-primary/70" strokeWidth={1.5} />
                          <p className="text-xs">Сотрудники не найдены</p>
                        </div>
                      ) : (
                        <EmptyState filtered={isFiltered} onReset={resetFilters} />
                      )}
                    </TableCell>
                  </TableRow>
                )}
                {pageRows.map((person) => (
                  <TableRow key={`${person.procedureId}:${person.id}`}>
                    <TableCell>
                      <ParticipantAvatar fullName={person.fullName} />
                    </TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">
                      {person.personnelId || "—"}
                    </TableCell>
                    <TableCell className="whitespace-normal font-medium">{person.fullName}</TableCell>
                    <TableCell className="whitespace-normal">
                      {person.position || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {person.sspUnit || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <Link
                        href={`/procedures/${person.procedureId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {person.procedureName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={person.procedureStatus} />
                    </TableCell>
                    <TableCell>
                      <AccessStatus access={person.reportAccess} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {results.length > 0 && (
            <SimplePagination
              total={results.length}
              page={currentPage}
              pageCount={pageCount}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </div>
  )
}
