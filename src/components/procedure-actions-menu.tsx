"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  CopyIcon,
  EllipsisIcon,
  EyeIcon,
  FlagIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"
import {
  completeProcedureAction,
  deleteProcedureAction,
  duplicateProcedureAction,
  launchProcedureAction,
} from "@/app/procedures/actions"
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
import type { ProcedureStatus } from "@/lib/types"

type Confirm = "delete" | "launch" | "complete" | null

const CONFIRM_TEXT: Record<Exclude<Confirm, null>, { title: string; body: string; action: string }> = {
  delete: {
    title: "Удалить процедуру?",
    body: "Процедура и список её участников будут удалены, а её участники — убраны из командных отчётов. Отчёты, где руководитель из этой процедуры, удалятся. Это действие нельзя отменить.",
    action: "Удалить",
  },
  launch: {
    title: "Запустить процедуру?",
    body: "Участники получат внешние ссылки на опросник. После запуска данные процедуры и список сотрудников редактировать нельзя.",
    action: "Запустить",
  },
  complete: {
    title: "Завершить процедуру?",
    body: "Прохождение опроса будет закрыто. Управлять доступом к отчётам можно будет и после завершения.",
    action: "Завершить",
  },
}

export function ProcedureActionsMenu({
  id,
  name,
  status,
  showOpen = true,
  showLaunch = true,
  afterDelete,
}: {
  id: string
  name: string
  status: ProcedureStatus
  showOpen?: boolean
  /** На странице редактирования запуск делается кнопкой «Сохранить и запустить» */
  showLaunch?: boolean
  afterDelete?: () => void
}) {
  const router = useRouter()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [pending, startTransition] = useTransition()

  function run(kind: Exclude<Confirm, null> | "duplicate") {
    startTransition(async () => {
      if (kind === "duplicate") {
        const res = await duplicateProcedureAction(id)
        if (!res.ok) return void toast.error(res.error)
        toast.success("Создана копия процедуры")
        router.push(`/procedures/${res.data.id}`)
        return
      }
      const fn = {
        delete: deleteProcedureAction,
        launch: launchProcedureAction,
        complete: completeProcedureAction,
      }[kind]
      const res = await fn(id)
      setConfirm(null)
      if (!res.ok) return void toast.error(res.error)
      toast.success(
        { delete: "Процедура удалена", launch: "Процедура запущена", complete: "Процедура завершена" }[kind],
      )
      if (kind === "delete") afterDelete?.()
      router.refresh()
    })
  }

  const text = confirm ? CONFIRM_TEXT[confirm] : null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label={`Действия с процедурой «${name}»`}
              disabled={pending}
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {showOpen && (
            <DropdownMenuItem render={<Link href={`/procedures/${id}`} />}>
              <EyeIcon /> Открыть
            </DropdownMenuItem>
          )}
          {status === "draft" && showLaunch && (
            <DropdownMenuItem onClick={() => setConfirm("launch")}>
              <PlayIcon /> Запустить
            </DropdownMenuItem>
          )}
          {status === "in_progress" && (
            <DropdownMenuItem onClick={() => setConfirm("complete")}>
              <FlagIcon /> Завершить
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => run("duplicate")}>
            <CopyIcon /> Создать копию
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirm("delete")}>
            <Trash2Icon /> Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{text?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              «{name}». {text?.body}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm === "delete" ? "destructive" : "default"}
              disabled={pending}
              onClick={() => confirm && run(confirm)}
            >
              {text?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
