"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Participant } from "@/lib/types"

export type ParticipantDraft = Omit<
  Participant,
  "id" | "externalLink" | "reportAccess" | "reportFormedAt"
>

const EMPTY: ParticipantDraft = {
  personnelId: "",
  fullName: "",
  position: "",
  sspUnit: "",
  vspUnit: "",
  externalLogin: "",
  notify: true,
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PERSONNEL_ID = /^\d{5,6}$/

export function ParticipantDialog({
  open,
  onOpenChange,
  initial,
  existingLogins,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null — добавление нового сотрудника */
  initial: Participant | null
  /** Логины других участников (в нижнем регистре) для проверки дублей */
  existingLogins: Set<string>
  onSubmit: (data: ParticipantDraft) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && (
          <ParticipantForm
            key={initial?.id ?? "new"}
            initial={initial}
            existingLogins={existingLogins}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ParticipantForm({
  initial,
  existingLogins,
  onSubmit,
}: {
  initial: Participant | null
  existingLogins: Set<string>
  onSubmit: (data: ParticipantDraft) => void
}) {
  const [form, setForm] = useState<ParticipantDraft>(() =>
    initial
      ? {
          personnelId: initial.personnelId ?? "",
          fullName: initial.fullName,
          position: initial.position,
          sspUnit: initial.sspUnit,
          vspUnit: initial.vspUnit,
          externalLogin: initial.externalLogin,
          notify: initial.notify,
        }
      : EMPTY,
  )
  const [touched, setTouched] = useState(false)

  const login = form.externalLogin.trim()
  const personnelId = form.personnelId.trim()
  const errors = {
    personnelId: !personnelId
      ? "Укажите персональный ID"
      : !PERSONNEL_ID.test(personnelId)
        ? "Персональный ID — 5 или 6 цифр"
        : null,
    fullName: !form.fullName.trim() ? "Укажите ФИО" : null,
    externalLogin: !login
      ? "Укажите внешний логин"
      : !EMAIL.test(login)
        ? "Логин должен быть в формате адреса почты"
        : existingLogins.has(login.toLowerCase())
          ? "Сотрудник с таким логином уже есть в списке"
          : null,
  }
  const hasErrors = Object.values(errors).some(Boolean)

  function set<K extends keyof ParticipantDraft>(key: K, value: ParticipantDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (!hasErrors) onSubmit(form)
      }}
    >
      <DialogHeader>
        <DialogTitle>{initial ? "Редактировать сотрудника" : "Добавить сотрудника"}</DialogTitle>
        <DialogDescription>
          Внешний логин используется для входа в опросник и рассылки уведомлений.
        </DialogDescription>
      </DialogHeader>

      <Field id="p-personnel" label="Персональный ID" required error={touched ? errors.personnelId : null}>
        <Input
          id="p-personnel"
          autoFocus
          inputMode="numeric"
          value={form.personnelId}
          placeholder="123456"
          aria-invalid={(touched && !!errors.personnelId) || undefined}
          onChange={(e) => set("personnelId", e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
      </Field>
      <Field id="p-name" label="ФИО" required error={touched ? errors.fullName : null}>
        <Input
          id="p-name"
          value={form.fullName}
          placeholder="Фамилия Имя Отчество"
          aria-invalid={(touched && !!errors.fullName) || undefined}
          onChange={(e) => set("fullName", e.target.value)}
        />
      </Field>
      <Field id="p-position" label="Должность">
        <Input id="p-position" value={form.position} onChange={(e) => set("position", e.target.value)} />
      </Field>
      <Field id="p-ssp" label="Подразделение ССП">
        <Input id="p-ssp" value={form.sspUnit} onChange={(e) => set("sspUnit", e.target.value)} />
      </Field>
      <Field id="p-vsp" label="Подразделение ВСП">
        <Input id="p-vsp" value={form.vspUnit} onChange={(e) => set("vspUnit", e.target.value)} />
      </Field>
      <Field id="p-login" label="Внешний логин" required error={touched ? errors.externalLogin : null}>
        <Input
          id="p-login"
          type="email"
          value={form.externalLogin}
          placeholder="name@example.com"
          aria-invalid={(touched && !!errors.externalLogin) || undefined}
          onChange={(e) => set("externalLogin", e.target.value)}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={form.notify} onCheckedChange={(v) => set("notify", v)} />
        Отправить уведомление
      </label>

      <DialogFooter>
        <Button type="submit">{initial ? "Сохранить" : "Добавить"}</Button>
      </DialogFooter>
    </form>
  )
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string
  label: string
  required?: boolean
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-semibold">
        {required && <span className="text-destructive">*</span>}
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
