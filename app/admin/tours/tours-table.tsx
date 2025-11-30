"use client"

import { useEffect, useState } from "react"
import { getFirebaseServices } from "@/lib/firebase"
import { collection, getDocs, deleteDoc, doc, query, limit, orderBy, startAfter, endBefore, where, QueryDocumentSnapshot, DocumentData } from "firebase/firestore"
import type { Tour } from "@/types"
import { Trash2, Eye, Edit, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ToursTableProps {
  filters: {
    sortBy: string
    style: string
    priceSort: string
    search: string
  }
}

export function ToursTable({ filters }: ToursTableProps) {
  const [tours, setTours] = useState<Tour[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [firstDoc, setFirstDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [pageHistory, setPageHistory] = useState<QueryDocumentSnapshot<DocumentData>[]>([]) // Stores firstDoc of each page for backward navigation
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPreviousPage, setHasPreviousPage] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [allFilteredTours, setAllFilteredTours] = useState<Tour[]>([]) // Store all filtered tours when searching
  const toursPerPage = 10;

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
    setAllFilteredTours([]) // Clear filtered tours cache
    loadTours(true) // Reset pagination when filters change
  }, [filters])

  const loadTours = async (reset = false, direction: 'next' | 'prev' | 'first' = 'first') => {
    setIsLoading(true)
    try {
      const { db } = getFirebaseServices()
      
      // Build base query
      let q = query(collection(db!, "tours"))
      
      // Apply style filter if provided
      if (filters.style) {
        q = query(q, where("style", "==", filters.style))
      }
      
      // Apply sorting - use createdAt as primary sort
      // Note: Price sorting will be done client-side as it requires numeric conversion
      if (filters.sortBy === "asc") {
        q = query(q, orderBy("createdAt", "asc"))
      } else {
        q = query(q, orderBy("createdAt", "desc"))
      }
      
      // If there's a search query, fetch ALL tours from the collection
      // Otherwise, use server-side pagination
      const hasSearch = filters.search && filters.search.trim().length > 0
      
      let allToursData: Tour[] = []
      
      if (hasSearch) {
        // Fetch all tours when searching (no pagination limit)
        const snapshot = await getDocs(q)
        allToursData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data() as any,
          createdAt: (doc.data() as any).createdAt?.toDate?.() || new Date(),
          updatedAt: (doc.data() as any).updatedAt?.toDate?.() || new Date(),
        })) as Tour[]
        
        // Apply search filter on full collection
        const searchLower = filters.search.toLowerCase()
        allToursData = allToursData.filter(
          (tour) =>
            tour.title?.en?.toLowerCase().includes(searchLower) ||
            tour.title?.uz?.toLowerCase().includes(searchLower) ||
            tour.title?.ru?.toLowerCase().includes(searchLower),
        )
        
        // Apply price sort (client-side)
        if (filters.priceSort === "asc") {
          allToursData.sort((a, b) => Number.parseFloat(a.price || "0") - Number.parseFloat(b.price || "0"))
        } else if (filters.priceSort === "desc") {
          allToursData.sort((a, b) => Number.parseFloat(b.price || "0") - Number.parseFloat(a.price || "0"))
        }
        
        // Store all filtered tours for pagination
        setAllFilteredTours(allToursData)
        
        // Client-side pagination for search results
        let page = currentPage
        if (reset || direction === 'first') {
          page = 1
          setCurrentPage(1)
        } else if (direction === 'next') {
          page = currentPage + 1
          setCurrentPage(page)
        } else if (direction === 'prev') {
          page = Math.max(1, currentPage - 1)
          setCurrentPage(page)
        }
        
        const startIndex = (page - 1) * toursPerPage
        const endIndex = startIndex + toursPerPage
        const paginatedTours = allToursData.slice(startIndex, endIndex)
        const hasMore = endIndex < allToursData.length
        
        setTours(paginatedTours)
        setHasNextPage(hasMore)
        setHasPreviousPage(page > 1)
        setLastDoc(null)
        setFirstDoc(null)
        
        return
      }
      
      // Server-side pagination when NOT searching
      let shouldReverse = false
      
      if (reset || direction === 'first') {
        q = query(q, limit(toursPerPage + 1)) // Fetch one extra to check if there's a next page
        setPageHistory([])
      } else if (direction === 'next' && lastDoc) {
        // Save current firstDoc to history for backward navigation BEFORE moving forward
        if (firstDoc) {
          setPageHistory((prev) => [...prev, firstDoc])
        }
        q = query(q, startAfter(lastDoc), limit(toursPerPage + 1))
      } else if (direction === 'prev') {
        if (pageHistory.length > 0) {
          // Go back: use endBefore with the firstDoc from history
          const prevFirstDoc = pageHistory[pageHistory.length - 1]
          const newHistory = pageHistory.slice(0, -1)
          
          // Update history BEFORE querying
          setPageHistory(newHistory)
          
          if (newHistory.length === 0) {
            // Going back to first page - just reload from start (no endBefore needed)
            q = query(q, limit(toursPerPage + 1))
            shouldReverse = false // Don't reverse when querying from start
          } else {
            // Use endBefore to get the previous page
            // Note: endBefore returns results in reverse order, so we need to reverse them
            q = query(q, endBefore(prevFirstDoc), limit(toursPerPage + 1))
            shouldReverse = true // Reverse when using endBefore
          }
        } else {
          // Already on first page - just reload from start
          q = query(q, limit(toursPerPage + 1))
          shouldReverse = false
        }
      }

      const snapshot = await getDocs(q)
      let docs = snapshot.docs
      
      // Reverse docs if going backward with endBefore (endBefore returns in reverse order)
      if (shouldReverse) {
        docs = [...docs].reverse()
      }
      
      // Check if there's a next page
      const hasMore = docs.length > toursPerPage
      const toursDocs = hasMore ? docs.slice(0, toursPerPage) : docs
      
      let toursData = toursDocs.map((doc) => ({
        id: doc.id,
        ...doc.data() as any,
        createdAt: (doc.data() as any).createdAt?.toDate?.() || new Date(),
        updatedAt: (doc.data() as any).updatedAt?.toDate?.() || new Date(),
      })) as Tour[]

      // Apply price sort (client-side)
      if (filters.priceSort === "asc") {
        toursData.sort((a, b) => Number.parseFloat(a.price || "0") - Number.parseFloat(b.price || "0"))
      } else if (filters.priceSort === "desc") {
        toursData.sort((a, b) => Number.parseFloat(b.price || "0") - Number.parseFloat(a.price || "0"))
      }

      setTours(toursData)
      setHasNextPage(hasMore)
      
      if (toursDocs.length > 0) {
        setLastDoc(toursDocs[toursDocs.length - 1])
        setFirstDoc(toursDocs[0])
      } else {
        setLastDoc(null)
        setFirstDoc(null)
      }
      
      // Update hasPreviousPage based on direction
      if (direction === 'prev') {
        // After going back, we removed one item from history
        // Calculate the new length directly
        const newHistoryLength = pageHistory.length > 0 ? pageHistory.length - 1 : 0
        setHasPreviousPage(newHistoryLength > 0)
      } else if (direction === 'next') {
        // After going forward, we saved firstDoc to history, so we can go back
        setHasPreviousPage(true)
      } else {
        // First load or reset - no previous page
        setHasPreviousPage(false)
      }
    } catch (error) {
      console.error("Error loading tours:", error)
      alert("Ошибка загрузки туров")
    } finally {
      setIsLoading(false)
    }
  }

  const handleNextPage = () => {
    if (hasNextPage) {
      // If searching, use client-side pagination
      if (filters.search && filters.search.trim().length > 0 && allFilteredTours.length > 0) {
        const nextPage = currentPage + 1
        const startIndex = (nextPage - 1) * toursPerPage
        const endIndex = startIndex + toursPerPage
        const paginatedTours = allFilteredTours.slice(startIndex, endIndex)
        const hasMore = endIndex < allFilteredTours.length
        
        setTours(paginatedTours)
        setCurrentPage(nextPage)
        setHasNextPage(hasMore)
        setHasPreviousPage(true)
      } else {
        loadTours(false, 'next')
      }
    }
  }

  const handlePreviousPage = () => {
    if (hasPreviousPage) {
      // If searching, use client-side pagination
      if (filters.search && filters.search.trim().length > 0 && allFilteredTours.length > 0) {
        const prevPage = Math.max(1, currentPage - 1)
        const startIndex = (prevPage - 1) * toursPerPage
        const endIndex = startIndex + toursPerPage
        const paginatedTours = allFilteredTours.slice(startIndex, endIndex)
        
        setTours(paginatedTours)
        setCurrentPage(prevPage)
        setHasNextPage(endIndex < allFilteredTours.length)
        setHasPreviousPage(prevPage > 1)
      } else {
        loadTours(false, 'prev')
      }
    }
  }

  const handleDelete = async (tourId: string) => {
    if (!window.confirm("Вы уверены, что хотите удалить этот тур?")) return

    setDeletingId(tourId)
    try {
      const { db } = getFirebaseServices()
      await deleteDoc(doc(db!, "tours", tourId))
      // Remove deleted tour from current list
      setTours(tours.filter((tour) => tour.id !== tourId))
      
      // If current page becomes empty, reload
      const remainingTours = tours.filter((tour) => tour.id !== tourId)
      if (remainingTours.length === 0) {
        // If we have previous pages, go back, otherwise reload from start
        if (hasPreviousPage) {
          handlePreviousPage()
        } else {
          loadTours(true, 'first')
        }
      }
    } catch (error) {
      console.error("Error deleting tour:", error)
      alert("Не удалось удалить тур")
    } finally {
      setDeletingId(null)
    }
  }


  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Название</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Стиль</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Рейтинг</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Дата создания</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tours.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Туры не найдены
                  </td>
                </tr>
              ) : (
                tours.map((tour) => (
                <tr key={tour.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 text-sm text-slate-900 font-medium w-50 max-w-100 truncate">{tour.title.ru}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                      {tour.style}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {"⭐"} {tour?.rating?.toFixed(1) || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {tour.createdAt.toLocaleDateString("ru-RU", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition">
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild>
                          <Link
                            href={`https://pilavtour.uz/trips/${tour.id}`}
                            target="_blank"
                            className="flex items-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            Просмотр
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/admin/tours/${tour.id}/edit`}
                            className="flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4" />
                            Редактировать
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleDelete(tour.id)}
                          disabled={deletingId === tour.id}
                        >
                          <Trash2 className="w-4 h-4" />
                          {deletingId === tour.id ? "Удаление..." : "Удалить"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>

    {/* Pagination */}
    {tours.length > 0 && (
      <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-6 py-4">
        <div className="text-sm text-slate-600">
          Показано {tours.length} {tours.length === 1 ? 'тур' : 'туров'}
          {hasNextPage && ' (есть еще)'}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviousPage}
            disabled={!hasPreviousPage || isLoading}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Предыдущая страница"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <span className="text-sm text-slate-600 px-4">
            Страница {pageHistory.length + 1}
          </span>

          <button
            onClick={handleNextPage}
            disabled={!hasNextPage || isLoading}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Следующая страница"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    )}
  </div>
  )
}
