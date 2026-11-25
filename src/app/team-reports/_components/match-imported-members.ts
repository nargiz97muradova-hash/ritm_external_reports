import type { TeamReportInput } from "@/lib/types"

type Importable = {
  id: string
  procedureId: string
  externalLogin: string
}

export type ImportMatch<T extends Importable> =
  | { matched: false; unknown: number; duplicates: number }
  | {
      matched: true
      accepted: T[]
      unknown: number
      duplicates: number
    }

/**
 * Сопоставляет строки Excel с участниками процедур по внешнему логину.
 * Участников можно брать из разных процедур; при нескольких совпадениях
 * предпочтительна текущая основная процедура отчёта.
 */
export function matchImportedMembers<T extends Importable>(
  rows: { externalLogin: string }[],
  people: T[],
  preferredProcedureId: string | null,
  memberIds: string[],
  leaderIds: string[],
): ImportMatch<T> {
  const byLogin = new Map<string, T[]>()
  for (const person of people) {
    const key = person.externalLogin.trim().toLowerCase()
    if (!key) continue
    const list = byLogin.get(key) ?? []
    list.push(person)
    byLogin.set(key, list)
  }

  const matched: T[] = []
  let unknown = 0
  let duplicates = 0

  for (const row of rows) {
    const key = row.externalLogin.trim().toLowerCase()
    if (!key) {
      unknown++
      continue
    }
    const candidates = byLogin.get(key) ?? []
    if (candidates.length === 0) {
      unknown++
      continue
    }
    const person =
      (preferredProcedureId
        ? candidates.find((candidate) => candidate.procedureId === preferredProcedureId)
        : undefined) ?? candidates[0]
    if (matched.some((item) => item.id === person.id) || memberIds.includes(person.id)) {
      duplicates++
      continue
    }
    if (leaderIds.includes(person.id)) {
      duplicates++
      continue
    }
    matched.push(person)
  }

  if (matched.length === 0) return { matched: false, unknown, duplicates }

  return {
    matched: true,
    accepted: matched,
    unknown,
    duplicates,
  }
}

/** Новые участники и группы после загрузки Excel (из любых процедур). */
export function formAfterMemberImport<T extends Importable>(
  form: TeamReportInput,
  accepted: T[],
): Pick<TeamReportInput, "procedureId" | "memberIds" | "leaderIds" | "groups" | "highlightedIds"> {
  const acceptedIds = accepted.map((person) => person.id)
  const addedSet = new Set(acceptedIds)
  const memberIds = [...form.memberIds.filter((id) => !addedSet.has(id)), ...acceptedIds]
  const memberSet = new Set(memberIds)
  return {
    procedureId:
      form.procedureId ||
      accepted[0]?.procedureId ||
      "",
    memberIds,
    leaderIds: form.leaderIds.filter((id) => !addedSet.has(id)),
    groups: form.groups
      .map((group) => ({
        ...group,
        memberIds: group.memberIds.filter((id) => memberIds.includes(id)),
      }))
      .filter((group) => group.memberIds.length > 0),
    highlightedIds: form.highlightedIds.filter((id) => memberSet.has(id)),
  }
}
