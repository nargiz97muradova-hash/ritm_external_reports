"use client"

import { PlusIcon, XIcon } from "lucide-react"
import { PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface ChipItem {
  key: string
  label: string
  hint?: string
}

/**
 * Поле множественного выбора: выбранные значения плашками с крестиком
 * и кнопка, открывающая поповер выбора (должно быть внутри <Popover>).
 */
export function ChipsField({
  id,
  items,
  placeholder,
  addLabel,
  invalid,
  onRemove,
}: {
  id?: string
  items: ChipItem[]
  placeholder: string
  addLabel: string
  invalid?: boolean
  onRemove: (key: string) => void
}) {
  return (
    <div
      data-invalid={invalid || undefined}
      className={cn(
        // Кнопка «Выбрать» закреплена в правом верхнем углу: поле растёт вниз,
        // а окно выбора, привязанное к кнопке, не сдвигается под курсором.
        "relative flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input py-1 pr-24 pl-1 data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20",
      )}
    >
      {items.length === 0 && <span className="px-1.5 text-sm text-muted-foreground">{placeholder}</span>}
      {items.map((item) => (
        <span
          key={item.key}
          title={item.hint ? `${item.label} · ${item.hint}` : item.label}
          className="inline-flex max-w-full items-center gap-1 rounded-md bg-accent py-0.5 pr-0.5 pl-2 text-xs text-accent-foreground"
        >
          <span className="truncate">
            {item.label}
            {item.hint && <span className="text-muted-foreground"> · {item.hint}</span>}
          </span>
          <button
            type="button"
            aria-label={`Убрать ${item.label}`}
            onClick={() => onRemove(item.key)}
            className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <PopoverTrigger
        render={
          <button
            id={id}
            type="button"
            className="absolute top-1 right-1 inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        <PlusIcon className="size-3.5" />
        {addLabel}
      </PopoverTrigger>
    </div>
  )
}
