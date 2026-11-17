"use client"

import { useState } from "react"
import { SearchIcon } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent } from "@/components/ui/popover"
import { HRBP_DIRECTORY } from "@/lib/hrbp"
import { ChipsField } from "./chips-field"

/** Множественный выбор HRBP из закрытого перечня. */
export function HrbpPicker({
  id,
  value,
  onChange,
}: {
  id?: string
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const found = HRBP_DIRECTORY.filter(
    (h) => !q || h.fullName.toLowerCase().includes(q) || h.unit.toLowerCase().includes(q),
  )
  const selected = new Set(value)

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <ChipsField
        id={id}
        placeholder="Не выбраны"
        addLabel="Выбрать"
        items={value.flatMap((hid) => {
          const h = HRBP_DIRECTORY.find((x) => x.id === hid)
          return h ? [{ key: h.id, label: h.fullName }] : []
        })}
        onRemove={(key) => onChange(value.filter((v) => v !== key))}
      />
      <PopoverContent className="w-96 max-w-[calc(100vw-2rem)] gap-2 p-2" align="end">
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            placeholder="ФИО или подразделение"
            className="pl-8"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {found.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">Никого не найдено</p>
          )}
          {found.map((h) => (
            <label
              key={h.id}
              className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted"
            >
              <Checkbox
                className="mt-0.5"
                checked={selected.has(h.id)}
                onCheckedChange={(checked) =>
                  onChange(checked ? [...value, h.id] : value.filter((v) => v !== h.id))
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{h.fullName}</span>
                <span className="block truncate text-muted-foreground">{h.unit}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="px-1 text-[11px] text-muted-foreground">
          Выбрано: {value.length}. HRBP увидят отчёт в разделе «Администрирование → Внешняя оценка».
        </p>
      </PopoverContent>
    </Popover>
  )
}
