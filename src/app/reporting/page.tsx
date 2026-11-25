import type { Metadata } from "next"
import { Suspense } from "react"
import { connection } from "next/server"
import { TableFallback } from "@/components/list-section"
import { SectionTabs } from "@/components/section-tabs"
import { listProcedures } from "@/lib/store"
import { ReportingForm } from "./reporting-form"

export const metadata: Metadata = { title: "Отчётность · Внешняя оценка" }

export default function ReportingPage() {
  return (
    <div className="flex flex-col gap-3">
      <SectionTabs active="reporting" />
      <section className="rounded-xl bg-background shadow-xs">
        <div className="border-b px-4 py-3">
          <h1 className="text-base font-semibold">Отчетность</h1>
        </div>
        <Suspense fallback={<TableFallback />}>
          <ReportingData />
        </Suspense>
      </section>
    </div>
  )
}

async function ReportingData() {
  await connection()
  const procedures = await listProcedures()
  return (
    <ReportingForm
      procedures={procedures.map((p) => ({ id: p.id, name: p.name }))}
    />
  )
}
