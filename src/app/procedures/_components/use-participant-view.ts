"use client"

import { useMemo, useState } from "react"
import { compareValues, nextSort, type SortDir } from "@/components/sort-button"
import type { Participant } from "@/lib/types"

export type SortKey = "fullName" | "externalLink" | "personnelId"
export type ListFilterKey = "position" | "sspUnit" | "vspUnit" | "reportAccess"
export type SearchKey = "fullName" | "externalLogin" | "personnelId"

/** Сортировка, поиск и фильтры по колонкам таблицы сотрудников. */
export function useParticipantView<T extends Participant>(participants: T[]) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null)
  const [search, setSearch] = useState<Record<SearchKey, string>>({
    fullName: "",
    externalLogin: "",
    personnelId: "",
  })
  const [filters, setFilters] = useState<Record<ListFilterKey, string[]>>({
    position: [],
    sspUnit: [],
    vspUnit: [],
    reportAccess: [],
  })

  const rows = useMemo(() => {
    const q = {
      fullName: search.fullName.trim().toLowerCase(),
      externalLogin: search.externalLogin.trim().toLowerCase(),
      personnelId: search.personnelId.trim().toLowerCase(),
    }
    let list: T[] = participants.filter((p) => {
      if (q.fullName && !p.fullName.toLowerCase().includes(q.fullName)) return false
      if (q.externalLogin && !p.externalLogin.toLowerCase().includes(q.externalLogin)) return false
      if (q.personnelId && !(p.personnelId ?? "").toLowerCase().includes(q.personnelId)) return false
      for (const key of ["position", "sspUnit", "vspUnit"] as const) {
        if (filters[key].length && !filters[key].includes(p[key])) return false
      }
      if (filters.reportAccess.length && !filters.reportAccess.includes(p.reportAccess ?? "none"))
        return false
      return true
    })
    if (sort) {
      const factor = sort.dir === "asc" ? 1 : -1
      list = [...list].sort((a, b) => factor * compareValues(a[sort.key], b[sort.key]))
    }
    return list
  }, [participants, search, filters, sort])

  const isFiltered =
    Object.values(search).some(Boolean) || Object.values(filters).some((v) => v.length > 0)

  return {
    rows,
    isFiltered,
    sort,
    toggleSort: (key: SortKey) => setSort((s) => nextSort(s, key)),
    search,
    setSearch: (key: SearchKey, value: string) => setSearch((s) => ({ ...s, [key]: value })),
    filters,
    setFilter: (key: ListFilterKey, value: string[]) => setFilters((f) => ({ ...f, [key]: value })),
    reset: () => {
      setSearch({ fullName: "", externalLogin: "", personnelId: "" })
      setFilters({ position: [], sspUnit: [], vspUnit: [], reportAccess: [] })
    },
  }
}

export type ParticipantView = ReturnType<typeof useParticipantView>
