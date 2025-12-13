"use client"

import { AdminLayout } from "@/components/admin-layout"
import { BookingsTable } from "./bookings-table"
import { BookingsFilters } from "./bookings-filters"
import { useState } from "react"

export default function BookingsPage() {
  const [filters, setFilters] = useState({
    search: "",
    sortBy: "",
  })

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Бронирования</h1>
          <p className="text-slate-500 mt-1">Управление всеми бронированиями платформы</p>
        </div>

        {/* Filters */}
        <BookingsFilters filters={filters} setFilters={setFilters} />

        {/* Table */}
        <BookingsTable filters={filters} />
      </div>
    </AdminLayout>
  )
}
