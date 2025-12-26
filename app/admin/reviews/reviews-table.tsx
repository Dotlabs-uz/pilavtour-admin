"use client"

import { useEffect, useState } from "react"
import { getFirebaseServices } from "@/lib/firebase"
import { collection, getDocs, deleteDoc, doc, query, where, limit, orderBy, startAfter, endBefore, QueryDocumentSnapshot, DocumentData } from "firebase/firestore"
import type { Review, User } from "@/types"
import { Trash2, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ReviewsTableProps {
  filters: {
    sortBy: string
    rateSort: string
  }
}

export function ReviewsTable({ filters }: ReviewsTableProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [firstDoc, setFirstDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [pageHistory, setPageHistory] = useState<QueryDocumentSnapshot<DocumentData>[]>([])
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPreviousPage, setHasPreviousPage] = useState(false)
  const reviewsPerPage = 10

  useEffect(() => {
    loadReviews(true)
  }, [filters])

  const loadReviews = async (reset = false, direction: 'next' | 'prev' | 'first' = 'first') => {
    setIsLoading(true)
    try {
      const { db } = getFirebaseServices()
      
      // Build base query
      let q = query(collection(db!, "reviews"))
      
      // Apply sorting - use createdAt as primary sort
      // Note: Rate sorting will be done client-side as it requires numeric conversion
      if (filters.sortBy === "asc") {
        q = query(q, orderBy("createdAt", "asc"))
      } else {
        q = query(q, orderBy("createdAt", "desc"))
      }
      
      // Server-side pagination
      let shouldReverse = false
      
      if (reset || direction === 'first') {
        q = query(q, limit(reviewsPerPage + 1))
        setPageHistory([])
      } else if (direction === 'next' && lastDoc) {
        if (firstDoc) {
          setPageHistory((prev) => [...prev, firstDoc])
        }
        q = query(q, startAfter(lastDoc), limit(reviewsPerPage + 1))
      } else if (direction === 'prev') {
        if (pageHistory.length > 0) {
          const prevFirstDoc = pageHistory[pageHistory.length - 1]
          const newHistory = pageHistory.slice(0, -1)
          setPageHistory(newHistory)
          
          if (newHistory.length === 0) {
            q = query(q, limit(reviewsPerPage + 1))
            shouldReverse = false
          } else {
            q = query(q, endBefore(prevFirstDoc), limit(reviewsPerPage + 1))
            shouldReverse = true
          }
        } else {
          q = query(q, limit(reviewsPerPage + 1))
          shouldReverse = false
        }
      }

      const snapshot = await getDocs(q)
      let docs = snapshot.docs
      
      if (shouldReverse) {
        docs = [...docs].reverse()
      }
      
      const hasMore = docs.length > reviewsPerPage
      const reviewsDocs = hasMore ? docs.slice(0, reviewsPerPage) : docs
      
      let reviewsData = reviewsDocs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
      })) as Review[]

      // Load user data for each review
      const reviewsWithUsers = await Promise.all(
        reviewsData.map(async (review) => {
          if (review.userId) {
            try {
              const userDoc = await getDocs(query(collection(db!, "users"), where("id", "==", review.userId)))
              if (!userDoc.empty) {
                review.user = {
                  id: review.userId,
                  ...userDoc.docs[0].data(),
                } as User
              }
            } catch (error) {
              console.error("Error loading user:", error)
            }
          }
          return review
        }),
      )

      // Apply rate sort (client-side)
      if (filters.rateSort === "asc") {
        reviewsWithUsers.sort((a, b) => a.rate - b.rate)
      } else if (filters.rateSort === "desc") {
        reviewsWithUsers.sort((a, b) => b.rate - a.rate)
      }

      setReviews(reviewsWithUsers)
      setHasNextPage(hasMore)
      
      if (reviewsDocs.length > 0) {
        setLastDoc(reviewsDocs[reviewsDocs.length - 1])
        setFirstDoc(reviewsDocs[0])
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
      console.error("Error loading reviews:", error)
      alert("Ошибка загрузки отзывов")
    } finally {
      setIsLoading(false)
    }
  }

  const handleNextPage = () => {
    if (hasNextPage) {
      loadReviews(false, 'next')
    }
  }

  const handlePreviousPage = () => {
    if (hasPreviousPage) {
      loadReviews(false, 'prev')
    }
  }

  const handleDelete = async (reviewId: string) => {
    if (!window.confirm("Вы уверены, что хотите удалить этот отзыв?")) return

    setDeletingId(reviewId)
    try {
      const { db } = getFirebaseServices()
      await deleteDoc(doc(db!, "reviews", reviewId))
      loadReviews(true) // Reload after deletion
      // TODO: Recount tour/article rating after deletion
    } catch (error) {
      console.error("Error deleting review:", error)
      alert("Не удалось удалить отзыв")
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
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Имя пользователя</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Комментарий</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Рейтинг</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Дата</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {reviews.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  Отзывы не найдены
                </td>
              </tr>
            ) : (
              reviews.map((review) => (
                <tr key={review.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 text-sm text-slate-900 font-medium">{review.user?.name || "Неизвестно"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{review.user?.email || "Н/Д"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{review.comment}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                      {"⭐"} {review.rate.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {review.createdAt.toLocaleDateString("ru-RU", {
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
                          variant="destructive"
                            onClick={() => handleDelete(review.id)}
                            disabled={deletingId === review.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          {deletingId === review.id ? "Удаление..." : "Удалить"}
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
      {reviews.length > 0 && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-6 py-4">
          <div className="text-sm text-slate-600">
            Показано {reviews.length} {reviews.length === 1 ? 'отзыв' : reviews.length < 5 ? 'отзыва' : 'отзывов'}
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
