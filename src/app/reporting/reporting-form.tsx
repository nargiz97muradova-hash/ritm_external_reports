"use client"

import { useMemo, useState } from "react"
import { ChevronDownIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const REPORT_TYPES = [
  { value: "monitoring", label: "Отчёт по мониторингу" },
  { value: "employees-full", label: "Отчёт полный по сотрудникам" },
] as const

const PERIODS = [
  { value: "2025", label: "2025" },
  { value: "2025-q1", label: "I квартал 2025" },
  { value: "2025-q2", label: "II квартал 2025" },
  { value: "2025-q3", label: "III квартал 2025" },
  { value: "2025-q4", label: "IV квартал 2025" },
  { value: "2026", label: "2026" },
  { value: "2026-q1", label: "I квартал 2026" },
] as const

type Option = { value: string; label: string }

export function ReportingForm({
  procedures,
}: {
  procedures: { id: string; name: string }[]
}) {
  const procedureOptions = useMemo<Option[]>(
    () => procedures.map((p) => ({ value: p.id, label: p.name })),
    [procedures],
  )

  const [reportType, setReportType] = useState("")
  const [procedureIds, setProcedureIds] = useState<string[]>([])
  const [periods, setPeriods] = useState<string[]>([])

  function submit() {
    if (procedureIds.length === 0) return void toast.error("Выберите хотя бы одну процедуру")
    if (!reportType) return void toast.error("Выберите тип отчёта")
    if (periods.length === 0) return void toast.error("Выберите хотя бы один период")
    toast.success("Отчёт сформирован")
  }

  return (
    <div className="grid gap-5 p-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Field label="Список процедур" htmlFor="procedures">
          <MultiSelect
            id="procedures"
            options={procedureOptions}
            value={procedureIds}
            placeholder="Выберите процедуру/ы"
            selectAllLabel="Выбрать все процедуры"
            onChange={setProcedureIds}
          />
        </Field>

        <Field label="Тип отчета" htmlFor="report-type">
          <Select
            items={REPORT_TYPES.map((o) => ({ value: o.value, label: o.label }))}
            value={reportType || null}
            onValueChange={(v) => setReportType(v ?? "")}
          >
            <SelectTrigger id="report-type" className="h-9 w-full">
              <SelectValue placeholder="Выберите тип отчета" />
            </SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Период" htmlFor="periods">
          <MultiSelect
            id="periods"
            options={[...PERIODS]}
            value={periods}
            placeholder="Выберите период/ы"
            onChange={setPeriods}
          />
        </Field>
      </div>

      <div>
        <Button onClick={submit}>Сформировать отчет</Button>
      </div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold">
        {label}
      </Label>
      {children}
    </div>
  )
}

function MultiSelect({
  id,
  options,
  value,
  placeholder,
  selectAllLabel,
  disabled,
  onChange,
}: {
  id: string
  options: Option[]
  value: string[]
  placeholder: string
  selectAllLabel?: string
  disabled?: boolean
  onChange: (value: string[]) => void
}) {
  const selected = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]))
    return value
      .map((v) => {
        const label = map.get(v)
        return label ? { value: v, label } : null
      })
      .filter((item): item is { value: string; label: string } => item !== null)
  }, [options, value])

  const allValues = useMemo(() => options.map((o) => o.value), [options])
  const allSelected = options.length > 0 && allValues.every((v) => value.includes(v))
  const someSelected = value.some((v) => allValues.includes(v))

  function toggle(optionValue: string, checked: boolean | "indeterminate") {
    const on = checked === true
    onChange(on ? [...value, optionValue] : value.filter((v) => v !== optionValue))
  }

  function toggleAll(checked: boolean | "indeterminate") {
    onChange(checked === true ? allValues : [])
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            id={id}
            disabled={disabled}
            className={cn(
              "flex min-h-9 w-full items-start justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-2 text-left text-sm outline-none transition-colors",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-60",
              selected.length === 0 && "items-center text-muted-foreground",
            )}
          />
        }
      >
        {selected.length === 0 ? (
          <span className="min-w-0 flex-1 truncate">{placeholder}</span>
        ) : (
          <span className="min-w-0 flex-1">
            {selected.map((item) => (
              <span key={item.value} className="block truncate">
                {item.label}
              </span>
            ))}
          </span>
        )}
        <ChevronDownIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-56 gap-1 p-2" align="start">
        <div className="max-h-64 overflow-y-auto">
          {options.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">Нет значений</p>
          )}
          {selectAllLabel && options.length > 0 && (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border-b px-2 py-1.5 text-xs font-medium hover:bg-muted">
              <Checkbox
                className="mt-px"
                checked={allSelected}
                indeterminate={!allSelected && someSelected}
                onCheckedChange={toggleAll}
              />
              <span>{selectAllLabel}</span>
            </label>
          )}
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted"
            >
              <Checkbox
                className="mt-px"
                checked={value.includes(opt.value)}
                onCheckedChange={(checked) => toggle(opt.value, checked)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
        {value.length > 0 && (
          <Button variant="ghost" size="sm" className="justify-start" onClick={() => onChange([])}>
            Сбросить
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
