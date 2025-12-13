"use client"

import { useEffect, useState } from "react"
import { getFirebaseServices } from "@/lib/firebase"
import { collection, getDocs, deleteDoc, doc, query, limit, orderBy, startAfter, endBefore, QueryDocumentSnapshot, DocumentData, getDoc } from "firebase/firestore"
import type { Booking, User, Tour } from "@/types"
import { Trash2, Eye, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface BookingsTableProps {
  filters: {
    search: string
    sortBy: string
  }
}

export function BookingsTable({ filters }: BookingsTableProps) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [firstDoc, setFirstDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [pageHistory, setPageHistory] = useState<QueryDocumentSnapshot<DocumentData>[]>([])
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPreviousPage, setHasPreviousPage] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [allFilteredBookings, setAllFilteredBookings] = useState<Booking[]>([])
  const bookingsPerPage = 10
  const router = useRouter()

  useEffect(() => {
    setCurrentPage(1)
    setAllFilteredBookings([])
    loadBookings(true)
  }, [filters])

  const loadBookings = async (reset = false, direction: 'next' | 'prev' | 'first' = 'first') => {
    setIsLoading(true)
    try {
      const { db } = getFirebaseServices()
      
      // Build base query
      let q = query(collection(db!, "bookings"))
      
      // Apply sorting - use createdAt as primary sort
      if (filters.sortBy === "asc") {
        q = query(q, orderBy("createdAt", "asc"))
      } else {
        q = query(q, orderBy("createdAt", "desc"))
      }
      
      // If there's a search query, fetch ALL bookings from the collection
      const hasSearch = filters.search && filters.search.trim().length > 0
      
      if (hasSearch) {
        // Fetch all bookings when searching (no pagination limit)
        const snapshot = await getDocs(q)
        let allBookingsData = await Promise.all(
          snapshot.docs.map(async (bookingDoc) => {
            const data = bookingDoc.data()
            let user: User | undefined
            let tour: Tour | undefined

            // Fetch user data
            if (data.userId) {
              try {
                const userDoc = await getDoc(doc(db!, "users", data.userId))
                if (userDoc.exists()) {
                  user = {
                    id: userDoc.id,
                    ...userDoc.data(),
                    createdAt: userDoc.data().createdAt?.toDate?.() || new Date(),
                  } as User
                }
              } catch (error) {
                console.error("Error fetching user:", error)
              }
            }

            // Fetch tour data
            if (data.tourId) {
              try {
                const tourDoc = await getDoc(doc(db!, "tours", data.tourId))
                if (tourDoc.exists()) {
                  tour = {
                    id: tourDoc.id,
                    ...tourDoc.data(),
                    createdAt: tourDoc.data().createdAt?.toDate?.() || new Date(),
                    updatedAt: tourDoc.data().updatedAt?.toDate?.() || new Date(),
                  } as Tour
                }
              } catch (error) {
                console.error("Error fetching tour:", error)
              }
            }

            return {
              id: bookingDoc.id,
              ...data,
              bookingDate: data.bookingDate?.toDate?.() || new Date(),
              travelDate: data.travelDate?.toDate?.() || undefined,
              createdAt: data.createdAt?.toDate?.() || new Date(),
              updatedAt: data.updatedAt?.toDate?.() || new Date(),
              user,
              tour,
            } as Booking
          })
        )
        
        // Apply search filter on full collection (by user name and email)
        const searchLower = filters.search.toLowerCase()
        allBookingsData = allBookingsData.filter(
          (booking) =>
            booking.user?.name?.toLowerCase().includes(searchLower) ||
            booking.user?.email?.toLowerCase().includes(searchLower),
        )
        
        // Apply client-side sorting for search results
        if (filters.sortBy === "asc") {
          allBookingsData.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        } else {
          allBookingsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        }
        
        // Store all filtered bookings for pagination
        setAllFilteredBookings(allBookingsData)
        
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
        
        const startIndex = (page - 1) * bookingsPerPage
        const endIndex = startIndex + bookingsPerPage
        const paginatedBookings = allBookingsData.slice(startIndex, endIndex)
        const hasMore = endIndex < allBookingsData.length
        
        setBookings(paginatedBookings)
        setHasNextPage(hasMore)
        setHasPreviousPage(page > 1)
        setLastDoc(null)
        setFirstDoc(null)
        
        return
      }
      
      // Server-side pagination when NOT searching
      let shouldReverse = false
      
      if (reset || direction === 'first') {
        q = query(q, limit(bookingsPerPage + 1))
        setPageHistory([])
      } else if (direction === 'next' && lastDoc) {
        if (firstDoc) {
          setPageHistory((prev) => [...prev, firstDoc])
        }
        q = query(q, startAfter(lastDoc), limit(bookingsPerPage + 1))
      } else if (direction === 'prev') {
        if (pageHistory.length > 0) {
          const prevFirstDoc = pageHistory[pageHistory.length - 1]
          const newHistory = pageHistory.slice(0, -1)
          setPageHistory(newHistory)
          
          if (newHistory.length === 0) {
            q = query(q, limit(bookingsPerPage + 1))
            shouldReverse = false
          } else {
            q = query(q, endBefore(prevFirstDoc), limit(bookingsPerPage + 1))
            shouldReverse = true
          }
        } else {
          q = query(q, limit(bookingsPerPage + 1))
          shouldReverse = false
        }
      }

      const snapshot = await getDocs(q)
      let docs = snapshot.docs
      
      if (shouldReverse) {
        docs = [...docs].reverse()
      }
      
      const hasMore = docs.length > bookingsPerPage
      const bookingsDocs = hasMore ? docs.slice(0, bookingsPerPage) : docs
      
      // Fetch user and tour data for each booking
      const bookingsData = await Promise.all(
        bookingsDocs.map(async (bookingDoc) => {
          const data = bookingDoc.data()
          let user: User | undefined
          let tour: Tour | undefined

          // Fetch user data
          if (data.userId) {
            try {
              const userDoc = await getDoc(doc(db!, "users", data.userId))
              if (userDoc.exists()) {
                user = {
                  id: userDoc.id,
                  ...userDoc.data(),
                  createdAt: userDoc.data().createdAt?.toDate?.() || new Date(),
                } as User
              }
            } catch (error) {
              console.error("Error fetching user:", error)
            }
          }

          // Fetch tour data
          if (data.tourId) {
            try {
              const tourDoc = await getDoc(doc(db!, "tours", data.tourId))
              if (tourDoc.exists()) {
                tour = {
                  id: tourDoc.id,
                  ...tourDoc.data(),
                  createdAt: tourDoc.data().createdAt?.toDate?.() || new Date(),
                  updatedAt: tourDoc.data().updatedAt?.toDate?.() || new Date(),
                } as Tour
              }
            } catch (error) {
              console.error("Error fetching tour:", error)
            }
          }

          return {
            id: bookingDoc.id,
            ...data,
            bookingDate: data.bookingDate?.toDate?.() || new Date(),
            travelDate: data.travelDate?.toDate?.() || undefined,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
            user,
            tour,
          } as Booking
        })
      )

      setBookings(bookingsData)
      setHasNextPage(hasMore)
      
      if (bookingsDocs.length > 0) {
        setLastDoc(bookingsDocs[bookingsDocs.length - 1])
        setFirstDoc(bookingsDocs[0])
      } else {
        setLastDoc(null)
        setFirstDoc(null)
      }
      
      if (direction === 'prev') {
        const newHistoryLength = pageHistory.length > 0 ? pageHistory.length - 1 : 0
        setHasPreviousPage(newHistoryLength > 0)
      } else if (direction === 'next') {
        setHasPreviousPage(true)
      } else {
        setHasPreviousPage(false)
      }
    } catch (error) {
      console.error("Error loading bookings:", error)
      alert("Ошибка загрузки бронирований")
    } finally {
      setIsLoading(false)
    }
  }

  const handleNextPage = () => {
    if (hasNextPage) {
      if (filters.search && filters.search.trim().length > 0 && allFilteredBookings.length > 0) {
        const nextPage = currentPage + 1
        const startIndex = (nextPage - 1) * bookingsPerPage
        const endIndex = startIndex + bookingsPerPage
        const paginatedBookings = allFilteredBookings.slice(startIndex, endIndex)
        const hasMore = endIndex < allFilteredBookings.length
        
        setBookings(paginatedBookings)
        setCurrentPage(nextPage)
        setHasNextPage(hasMore)
        setHasPreviousPage(true)
      } else {
        loadBookings(false, 'next')
      }
    }
  }

  const handlePreviousPage = () => {
    if (hasPreviousPage) {
      if (filters.search && filters.search.trim().length > 0 && allFilteredBookings.length > 0) {
        const prevPage = Math.max(1, currentPage - 1)
        const startIndex = (prevPage - 1) * bookingsPerPage
        const endIndex = startIndex + bookingsPerPage
        const paginatedBookings = allFilteredBookings.slice(startIndex, endIndex)
        
        setBookings(paginatedBookings)
        setCurrentPage(prevPage)
        setHasNextPage(endIndex < allFilteredBookings.length)
        setHasPreviousPage(prevPage > 1)
      } else {
        loadBookings(false, 'prev')
      }
    }
  }

  const handleDelete = async (bookingId: string) => {
    if (!window.confirm("Вы уверены, что хотите удалить это бронирование?")) return

    setDeletingId(bookingId)
    try {
      const { db } = getFirebaseServices()
      await deleteDoc(doc(db!, "bookings", bookingId))
      loadBookings(true) // Reload after deletion
    } catch (error) {
      console.error("Error deleting booking:", error)
      alert("Не удалось удалить бронирование")
    } finally {
      setDeletingId(null)
    }
  }

  const handleView = (bookingId: string) => {
    router.push(`/admin/bookings/${bookingId}`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "completed":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-slate-100 text-slate-800"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Подтверждено"
      case "pending":
        return "В ожидании"
      case "cancelled":
        return "Отменено"
      case "completed":
        return "Завершено"
      default:
        return status
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
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Пользователь</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Тур</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Статус</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Количество человек</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Цена</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Дата бронирования</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                  Бронирования не найдены
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {booking.user?.avatar ? (
                        <img
                          src={booking.user.avatar}
                          alt={booking.user?.name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
                          {booking.user?.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                      )}
                      <div>
                        <div className="text-sm text-slate-900 font-medium">{booking.user?.name || "Неизвестно"}</div>
                        <div className="text-xs text-slate-500">{booking.user?.email || ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900">
                    <div className="max-w-xs truncate" title={booking.tour?.title?.ru || booking.tour?.title?.uz || "Тур не найден"}>
                      {booking.tour?.title?.ru || booking.tour?.title?.uz || "Тур не найден"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(booking.status)}`}>
                      {getStatusText(booking.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{booking.numberOfPeople}</td>
                  <td className="px-6 py-4 text-sm text-slate-900 font-medium">{booking.totalPrice}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {booking.bookingDate.toLocaleDateString("ru-RU", {
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
                        <DropdownMenuItem
                          onClick={() => handleView(booking.id)}
                        >
                          <Eye className="w-4 h-4" />
                          Просмотр
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleDelete(booking.id)}
                          disabled={deletingId === booking.id}
                        >
                          <Trash2 className="w-4 h-4" />
                          {deletingId === booking.id ? "Удаление..." : "Удалить"}
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

      {/* Pagination */}
      {bookings.length > 0 && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-6 py-4">
          <div className="text-sm text-slate-600">
            Показано {bookings.length} {bookings.length === 1 ? 'бронирование' : bookings.length < 5 ? 'бронирования' : 'бронирований'}
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
              Страница {filters.search && filters.search.trim().length > 0 ? currentPage : pageHistory.length + 1}
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
