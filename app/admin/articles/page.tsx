"use client"

import { AdminLayout } from "@/components/admin-layout"
import Link from "next/link"
import { Plus } from "lucide-react"
import { ArticlesTable } from "./articles-table"
import { ArticlesFilters } from "./articles-filters"
import { useState } from "react"

export default function ArticlesPage() {
  const [filters, setFilters] = useState({
    sortBy: "desc",
    search: "",
  })

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header with Button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Статьи</h1>
            <p className="text-slate-500 mt-1">Управление статьями блога и контентом</p>
          </div>
          <Link
            href="/admin/articles/create-new"
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition"
          >
            <Plus className="w-5 h-5" />
            Создать новую
          </Link>
        </div>

        {/* Filters */}
        <ArticlesFilters filters={filters} setFilters={setFilters} />

        {/* Table */}
        <ArticlesTable filters={filters} />
      </div>
    </AdminLayout>
  )
}
