"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import {
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table"
import { pluralRu } from "@/lib/format"
import type { Participant } from "@/lib/types"
import { importParticipantsAction } from "../actions"
import { downloadParticipantsExcel } from "./excel"
import { ParticipantDialog, type ParticipantDraft } from "./participant-dialog"
import { Cell, EmptyState, HeadCell } from "./table-bits"
import { useParticipantView } from "./use-participant-view"

function newId() {
  return crypto.randomUUID().slice(0, 12)
}

/** Список сотрудников процедуры в статусе «Черновик» — полностью редактируемый. */
export function DraftParticipants({
  participants,
  onChange,
  sendNotifications,
  onSendNotificationsChange,
  procedureName,
}: {
  participants: Participant[]
  onChange: (next: Participant[]) => void
  sendNotifications: boolean
  onSendNotificationsChange: (value: boolean) => void
  procedureName: string
}) {
  const view = useParticipantView(participants)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<{ open: boolean; editing: Participant | null }>({
    open: false,
    editing: null,
  })
  const [busy, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const indexById = useMemo(
    () => new Map(participants.map((p, i) => [p.id, i])),
    [participants],
  )
  const visibleIds = view.rows.map((p) => p.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someVisibleSelected = visibleIds.some((id) => selected.has(id))

  const loginsExcept = (id: string | null) =>
    new Set(participants.filter((p) => p.id !== id).map((p) => p.externalLogin.toLowerCase()))

  function submitParticipant(data: ParticipantDraft) {
    const editing = dialog.editing
    if (editing) {
      onChange(participants.map((p) => (p.id === editing.id ? { ...p, ...data } : p)))
    } else {
      onChange([
        ...participants,
        { ...data, id: newId(), externalLink: null, reportAccess: null, reportFormedAt: null },
      ])
    }
    setDialog({ open: false, editing: null })
  }

  function removeSelected() {
    const count = selected.size
    onChange(participants.filter((p) => !selected.has(p.id)))
    setSelected(new Set())
    toast.success(`${pluralRu(count, "Удалён", "Удалены", "Удалены")} ${count} ${pluralRu(count, "сотрудник", "сотрудника", "сотрудников")}. Нажмите «Сохранить», чтобы применить изменения.`)
  }

  function importFile(file: File) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set("file", file)
      const res = await importParticipantsAction(fd)
      if (!res.ok) return void toast.error(res.error)
      const known = new Set(participants.map((p) => p.externalLogin.toLowerCase()))
      const added: Participant[] = []
      let skipped = 0
      for (const p of res.data.participants) {
        const key = p.externalLogin.toLowerCase()
        if (!p.fullName || !p.externalLogin || known.has(key)) {
          skipped++
          continue
        }
        known.add(key)
        added.push({ ...p, id: newId() })
      }
      onChange([...participants, ...added])
      if (added.length)
        toast.success(
          `Загружено: ${added.length}` + (skipped ? `, пропущено (дубли или пустые поля): ${skipped}` : ""),
        )
      else toast.warning("Новых сотрудников в файле не найдено — все уже есть в списке или не заполнены")
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setDialog({ open: true, editing: null })}>
          <PlusIcon /> Добавить сотрудника
        </Button>
        <Button variant="destructive" disabled={selected.size === 0} onClick={removeSelected}>
          <Trash2Icon /> Удалить сотрудников{selected.size > 0 && ` (${selected.size})`}
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            disabled={participants.length === 0 || busy}
            onClick={() => startTransition(() => downloadParticipantsExcel(participants, procedureName))}
          >
            <DownloadIcon /> Скачать Excel
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
            <UploadIcon /> Загрузить Excel
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ""
              if (file) importFile(file)
            }}
          />
          <label className="flex items-center gap-2 pl-1 text-xs">
            <Checkbox checked={sendNotifications} onCheckedChange={onSendNotificationsChange} />
            Отправлять уведомления
          </label>
        </div>
      </div>

      <div className="max-h-[60vh] overflow-auto rounded-lg border">
        <Table className="min-w-[1100px] text-xs">
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="hover:bg-transparent">
              <HeadCell
                className="w-10"
                label={
                  <Checkbox
                    aria-label="Выбрать всех"
                    disabled={visibleIds.length === 0}
                    checked={allVisibleSelected}
                    indeterminate={!allVisibleSelected && someVisibleSelected}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected)
                      for (const id of visibleIds) {
                        if (checked) next.add(id)
                        else next.delete(id)
                      }
                      setSelected(next)
                    }}
                  />
                }
              />
              <HeadCell label="№" className="w-10" />
              <HeadCell label="ФИО" view={view} sortKey="fullName" searchKey="fullName" />
              <HeadCell label="Должность" view={view} filterKey="position" participants={participants} />
              <HeadCell label="Подразделение ССП" view={view} filterKey="sspUnit" participants={participants} />
              <HeadCell label="Подразделение ВСП" view={view} filterKey="vspUnit" participants={participants} />
              <HeadCell label="Внешний логин" view={view} searchKey="externalLogin" />
              <HeadCell label="Отправить уведомление" className="w-28 text-center" />
              <HeadCell label="Внешняя ссылка" view={view} sortKey="externalLink" />
              <HeadCell label="" className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={10}>
                  <EmptyState filtered={view.isFiltered} onReset={view.reset} />
                </TableCell>
              </TableRow>
            )}
            {view.rows.map((p) => (
              <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label={`Выбрать ${p.fullName}`}
                    checked={selected.has(p.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected)
                      if (checked) next.add(p.id)
                      else next.delete(p.id)
                      setSelected(next)
                    }}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {(indexById.get(p.id) ?? 0) + 1}
                </TableCell>
                <TableCell className="whitespace-normal font-medium">{p.fullName}</TableCell>
                <TableCell className="whitespace-normal"><Cell>{p.position}</Cell></TableCell>
                <TableCell className="whitespace-normal"><Cell>{p.sspUnit}</Cell></TableCell>
                <TableCell className="whitespace-normal"><Cell>{p.vspUnit}</Cell></TableCell>
                <TableCell>{p.externalLogin}</TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    aria-label={`Отправить уведомление: ${p.fullName}`}
                    disabled={!sendNotifications}
                    checked={sendNotifications && p.notify}
                    onCheckedChange={(checked) =>
                      onChange(participants.map((x) => (x.id === p.id ? { ...x, notify: checked } : x)))
                    }
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.externalLink ?? "Появится после запуска"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-primary"
                    aria-label={`Редактировать ${p.fullName}`}
                    onClick={() => setDialog({ open: true, editing: p })}
                  >
                    <PencilIcon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {participants.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Всего {participants.length} {pluralRu(participants.length, "сотрудник", "сотрудника", "сотрудников")}
          {view.isFiltered && `, показано ${view.rows.length}`}
        </p>
      )}

      <ParticipantDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        initial={dialog.editing}
        existingLogins={loginsExcept(dialog.editing?.id ?? null)}
        onSubmit={submitParticipant}
      />
    </div>
  )
}
