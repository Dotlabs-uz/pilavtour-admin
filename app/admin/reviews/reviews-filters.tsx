"use client"

interface ReviewsFiltersProps {
  filters: {
    sortBy: string
    rateSort: string
  }
  setFilters: (filters: any) => void
}

export function ReviewsFilters({ filters, setFilters }: ReviewsFiltersProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Created At Sort */}
        <select
          value={filters.sortBy}
          onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">Дата создания</option>
          <option value="desc">Сначала новые</option>
          <option value="asc">Сначала старые</option>
        </select>

        {/* Rating Sort */}
        <select
          value={filters.rateSort}
          onChange={(e) => setFilters({ ...filters, rateSort: e.target.value })}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">Все рейтинги</option>
          <option value="asc">Рейтинг от низкого к высокому</option>
          <option value="desc">Рейтинг от высокого к низкому</option>
        </select>
      </div>
    </div>
  )
}
