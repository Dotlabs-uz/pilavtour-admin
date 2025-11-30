"use client"

import { AdminLayout } from "@/components/admin-layout"
import Link from "next/link"
import { Plus } from "lucide-react"
import { ToursTable } from "./tours-table"
import { ToursFilters } from "./tours-filters"
import { useState } from "react"

export default function ToursPage() {
  const [filters, setFilters] = useState({
    sortBy: "desc",
    style: "",
    priceSort: "",
    search: "",
  })

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header with Button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Tours</h1>
            <p className="text-slate-500 mt-1">Manage all tours and experiences</p>
          </div>
          <Link
            href="/admin/tours/create-new"
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition"
          >
            <Plus className="w-5 h-5" />
            Create New
          </Link>
        </div>

        {/* Filters */}
        <ToursFilters filters={filters} setFilters={setFilters} />

        {/* Table */}
        <ToursTable filters={filters} />
      </div>
    </AdminLayout>
  )
}
