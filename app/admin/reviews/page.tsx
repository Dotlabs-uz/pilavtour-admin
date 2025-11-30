"use client"

import { AdminLayout } from "@/components/admin-layout"
import { ReviewsTable } from "./reviews-table"
import { ReviewsFilters } from "./reviews-filters"
import { useState } from "react"

export default function ReviewsPage() {
  const [filters, setFilters] = useState({
    sortBy: "desc",
    rateSort: "",
  })

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Отзывы</h1>
          <p className="text-slate-500 mt-1">Управление отзывами и оценками клиентов</p>
        </div>

        {/* Filters */}
        <ReviewsFilters filters={filters} setFilters={setFilters} />

        {/* Table */}
        <ReviewsTable filters={filters} />
      </div>
    </AdminLayout>
  )
}
