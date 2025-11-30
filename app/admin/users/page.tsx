"use client"

import { AdminLayout } from "@/components/admin-layout"
import { UsersTable } from "./users-table"
import { UsersFilters } from "./users-filters"
import { useState } from "react"

export default function UsersPage() {
  const [filters, setFilters] = useState({
    search: "",
  })

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Пользователи</h1>
          <p className="text-slate-500 mt-1">Управление всеми пользователями платформы</p>
        </div>

        {/* Filters */}
        <UsersFilters filters={filters} setFilters={setFilters} />

        {/* Table */}
        <UsersTable filters={filters} />
      </div>
    </AdminLayout>
  )
}
