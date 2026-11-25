import type { Metadata } from "next"
import { Suspense } from "react"
import { connection } from "next/server"
import { TableFallback } from "@/components/list-section"
import { SectionTabs } from "@/components/section-tabs"
import { listEmployeesForSearch } from "@/lib/store"
import { EmployeeSearchPanel } from "./employee-search-panel"

export const metadata: Metadata = { title: "Поиск сотрудника · Внешняя оценка" }

export default function EmployeeSearchPage() {
  return (
    <div className="flex flex-col gap-3">
      <SectionTabs active="employee-search" />
      <section className="rounded-xl bg-background shadow-xs">
        <div className="border-b px-4 py-3">
          <h1 className="text-base font-semibold">Поиск сотрудника</h1>
        </div>
        <Suspense fallback={<TableFallback />}>
          <EmployeeSearchData />
        </Suspense>
      </section>
    </div>
  )
}

async function EmployeeSearchData() {
  await connection()
  const employees = await listEmployeesForSearch()
  return <EmployeeSearchPanel employees={employees} />
}
