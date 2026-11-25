import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ArrowLeftIcon, FlaskConicalIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"
import { buildTeamReportData } from "@/lib/report/build"
import {
  REPORT_CONTENT_SECTIONS,
  SCALE_SECTIONS,
  TRAFFIC_TEXT,
  normalizeReportContentSections,
  type ReportContentSectionId,
} from "@/lib/report/definitions"
import { groupDotClass, groupDotStyle } from "@/lib/report/group-colors"
import type { TeamReportData } from "@/lib/report/types"
import { getProcedure, getTeamReport, listLaunchedProcedures } from "@/lib/store"
import { cn } from "@/lib/utils"
import { CompetencyTraffic } from "./_components/competency-traffic"
import { Heatmap } from "./_components/heatmap"
import { IntegralMatrix } from "./_components/integral-matrix"
import { LearningStyles } from "./_components/learning-styles"
import { PotentialMatrix } from "./_components/potential-matrix"
import { Chip, GroupLegend, ReportSection } from "./_components/primitives"
import { PrintButton } from "./_components/print-button"
import { RoleDescriptions, RolesGrid } from "./_components/roles"
import { ScaleStrips } from "./_components/scale-strips"

export default function TeamReportViewPage({ params }: PageProps<"/team-reports/[id]/report">) {
  return (
    <Suspense fallback={<ReportFallback />}>
      <ReportData params={params} />
    </Suspense>
  )
}

async function ReportData({ params }: Pick<PageProps<"/team-reports/[id]/report">, "params">) {
  const { id } = await params
  const report = await getTeamReport(id)
  if (!report) notFound()
  const [procedure, launched] = await Promise.all([
    getProcedure(report.procedureId),
    listLaunchedProcedures(),
  ])
  if (!procedure) notFound()
  const extras = launched.filter((p) => p.id !== procedure.id)
  return (
    <Report
      reportId={report.id}
      data={buildTeamReportData(report, procedure, extras)}
      contentSections={normalizeReportContentSections(report.contentSections)}
    />
  )
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  return `${formatDate(iso)} ${time}`
}

function Report({
  reportId,
  data,
  contentSections,
}: {
  reportId: string
  data: TeamReportData
  contentSections: ReportContentSectionId[]
}) {
  const enabled = new Set<string>(contentSections)
  const show = (id: string) => enabled.has(id)
  const toc = REPORT_CONTENT_SECTIONS.filter((item) => enabled.has(item.id))
  const groupIds = data.groups.map((g) => g.id)
  const nonLeaders = data.participants.filter((p) => p.group !== "leader")
  const groupCounts = Object.fromEntries(
    data.groups.map((g) => [g.id, data.participants.filter((p) => p.group === g.id).length]),
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="ghost" render={<Link href={`/team-reports/${reportId}`} />} nativeButton={false}>
          <ArrowLeftIcon /> К командному отчёту
        </Button>
        <div className="ml-auto">
          <PrintButton />
        </div>
      </div>

      <header className="rounded-xl bg-background p-5 shadow-xs">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">Командный отчёт</p>
        <h1 className="mt-1 text-xl font-semibold">{data.title}</h1>
        <dl className="mt-4 grid gap-x-8 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <Meta label="Дата и время создания отчёта" value={formatDateTime(data.createdAt)} />
          <Meta label="Опрос" value={data.survey} />
          <Meta label="Компания" value={data.company} />
          <Meta label="Проект (процедура)" value={data.procedureName} />
        </dl>
        {data.isDemo && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <FlaskConicalIcon className="mt-px size-4 shrink-0" />
            Состав команды настоящий, а результаты оценки — демонстрационные: источник результатов
            опросника пока не подключён.
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[240px_minmax(0,1fr)]">
        <nav
          aria-label="Разделы отчёта"
          className="self-start rounded-xl bg-background p-3 shadow-xs xl:sticky xl:top-[4.5rem] print:hidden"
        >
          <p className="mb-2 px-2 text-xs font-semibold">Содержание</p>
          <ol className="grid gap-0.5 text-xs xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
            {toc.map((item, i) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="flex gap-2 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <span className="w-4 text-right tabular-nums">{i + 1}</span>
                  {item.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex min-w-0 flex-col gap-3">
          {show("participants") && (
            <ReportSection id="participants" title="Состав участников исследования">
              <GroupLegend groups={data.groups} />
              <ol className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {data.participants.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 odd:bg-muted/40">
                    <Chip participant={p} groupIds={groupIds} />
                    <span className="min-w-0">
                      <span className="block truncate">{p.fullName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.group === "leader"
                          ? "Руководитель"
                          : data.groups.find((g) => g.id === p.group)?.name || p.position || "—"}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </ReportSection>
          )}

          {show("groups") && (
            <ReportSection id="groups" title="Группы участников">
              <p className="mb-3 text-xs text-muted-foreground">
                Группы нужны, чтобы сравнивать профили в тепловых картах и интегральных отчётах. Если
                группировка не задана, все участники входят в одну команду.
              </p>
              <table className="w-full max-w-xl text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-10 pb-2 font-medium">№</th>
                    <th className="pb-2 font-medium">Название группы</th>
                    <th className="pb-2 font-medium">Цвет</th>
                    <th className="pb-2 text-right font-medium">Участников</th>
                  </tr>
                </thead>
                <tbody>
                  {data.groups.map((g, i) => (
                    <tr key={g.id} className="border-t">
                      <td className="py-2 text-muted-foreground">{i + 1}</td>
                      <td className="py-2">{g.name}</td>
                      <td className="py-2">
                        <span
                          className={cn(
                            "inline-block size-4 rounded-full",
                            groupDotClass(g.id, groupIds, g.color),
                          )}
                          style={groupDotStyle(g.color)}
                        />
                      </td>
                      <td className="py-2 text-right tabular-nums">{groupCounts[g.id] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ReportSection>
          )}

          {show("integral-all") && (
            <ReportSection id="integral-all" title="Интегральный отчёт: все участники" description="«Компетенции Zetic» (стандартные индикаторы)">
              <IntegralMatrix points={data.integralAll} />
            </ReportSection>
          )}

          {show("integral-team") && (
            <ReportSection
              id="integral-team"
              title={`Интегральный отчёт: группа «${data.groups[0].name}»`}
              description="«Компетенции Zetic» (стандартные индикаторы), без руководителя"
            >
              {nonLeaders.length > 0 ? (
                <IntegralMatrix points={data.integralTeam} />
              ) : (
                <p className="text-sm text-muted-foreground">В команде нет участников.</p>
              )}
            </ReportSection>
          )}

          {show("traffic") && (
            <ReportSection id="traffic" title="Разметка «Компетенции Zetic»" description={TRAFFIC_TEXT}>
              <CompetencyTraffic participants={data.participants} averages={data.competencyAverages} />
            </ReportSection>
          )}

          {show("roles") && (
            <ReportSection id="roles" title="Командный профиль: распределение ролей в группе">
              <GroupLegend groups={data.groups} />
              <div className="mt-3">
                <RolesGrid participants={data.participants} />
              </div>
            </ReportSection>
          )}

          {show("role-descriptions") && (
            <ReportSection id="role-descriptions" title="Расшифровка профилей">
              <RoleDescriptions />
            </ReportSection>
          )}

          {show("potential") && (
            <ReportSection id="potential" title="Матрица потенциала">
              <PotentialMatrix participants={data.participants} />
            </ReportSection>
          )}

          {SCALE_SECTIONS.filter((section) => show(section.key)).map((section) => (
            <ReportSection key={section.key} id={section.key} title={section.title} description={section.description}>
              <ScaleStrips section={section} participants={data.participants} />
            </ReportSection>
          ))}

          {SCALE_SECTIONS.filter((section) => show(`heat-${section.key}`)).map((section) => (
            <ReportSection key={section.key} id={`heat-${section.key}`} title={`Тепловая карта | ${section.title}`}>
              <Heatmap section={section} groups={data.groups} heat={data.heat} />
            </ReportSection>
          ))}

          {show("learning") && (
            <ReportSection id="learning" title="Командный профиль: стили обучения">
              <LearningStyles participants={data.participants} />
            </ReportSection>
          )}
        </div>
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function ReportFallback() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Загрузка отчёта">
      <div className="h-36 animate-pulse rounded-xl bg-background" />
      <div className="h-96 animate-pulse rounded-xl bg-background" />
    </div>
  )
}
