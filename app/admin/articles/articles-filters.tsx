"use client"

import { Search } from "lucide-react"

interface ArticlesFiltersProps {
  filters: {
    sortBy: string
    search: string
  }
  setFilters: (filters: any) => void
}

export function ArticlesFilters({ filters, setFilters }: ArticlesFiltersProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Created At Sort */}
        <select
          value={filters.sortBy}
          onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">Created Date</option>
          <option value="desc">Newest First</option>
          <option value="asc">Oldest First</option>
        </select>
      </div>
    </div>
  )
}
