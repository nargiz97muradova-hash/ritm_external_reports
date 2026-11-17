"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { ChartColumnIcon, CopyIcon, EllipsisIcon, EyeIcon, LockIcon, LockOpenIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ReportAccess } from "@/lib/types"
import {
  deleteTeamReportAction,
  duplicateTeamReportAction,
  setTeamReportAccessAction,
} from "../actions"

export function TeamReportActionsMenu({
  id,
  name,
  access,
  showOpen = true,
  afterDelete,
}: {
  id: string
  name: string
  access: Exclude<ReportAccess, null>
  showOpen?: boolean
  afterDelete?: () => void
}) {
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  function toggleAccess() {
    startTransition(async () => {
      const next = access === "open" ? "closed" : "open"
      const res = await setTeamReportAccessAction(id, next)
      if (!res.ok) return void toast.error(res.error)
      toast.success(next === "open" ? "Доступ руководителям открыт" : "Доступ руководителям закрыт")
      router.refresh()
    })
  }

  function duplicate() {
    startTransition(async () => {
      const res = await duplicateTeamReportAction(id)
      if (!res.ok) return void toast.error(res.error)
      toast.success("Создана копия отчёта")
      router.push(`/team-reports/${res.data.id}`)
    })
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteTeamReportAction(id)
      setConfirmDelete(false)
      if (!res.ok) return void toast.error(res.error)
      toast.success("Командный отчёт удалён")
      afterDelete?.()
      router.refresh()
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label={`Действия с отчётом «${name}»`}
              disabled={pending}
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          {showOpen && (
            <DropdownMenuItem render={<Link href={`/team-reports/${id}`} />}>
              <EyeIcon /> Открыть
            </DropdownMenuItem>
          )}
          <DropdownMenuItem render={<Link href={`/team-reports/${id}/report`} />}>
            <ChartColumnIcon /> Просмотр отчёта
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleAccess}>
            {access === "open" ? <LockIcon /> : <LockOpenIcon />}
            {access === "open" ? "Закрыть доступ" : "Открыть доступ"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={duplicate}>
            <CopyIcon /> Создать копию
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2Icon /> Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить командный отчёт?</AlertDialogTitle>
            <AlertDialogDescription>
              «{name}». Состав команды будет удалён, участники и их индивидуальные отчёты в
              процедуре останутся. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={remove}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
