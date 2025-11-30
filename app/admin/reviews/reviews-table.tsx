"use client"

import { useEffect, useState } from "react"
import { getFirebaseServices } from "@/lib/firebase"
import { collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore"
import type { Review, User } from "@/types"
import { Trash2, MoreHorizontal } from "lucide-react"

interface ReviewsTableProps {
  filters: {
    sortBy: string
    rateSort: string
  }
}

export function ReviewsTable({ filters }: ReviewsTableProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadReviews()
  }, [filters])

  const loadReviews = async () => {
    try {
      const { db } = getFirebaseServices()
      const snapshot = await getDocs(collection(db, "reviews"))
      const reviewsData = snapshot.docs.map((doc) => ({
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
              const userDoc = await getDocs(query(collection(db, "users"), where("id", "==", review.userId)))
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

      // Sort
      if (filters.sortBy === "asc") {
        reviewsWithUsers.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      } else {
        reviewsWithUsers.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      }

      if (filters.rateSort === "asc") {
        reviewsWithUsers.sort((a, b) => a.rate - b.rate)
      } else if (filters.rateSort === "desc") {
        reviewsWithUsers.sort((a, b) => b.rate - a.rate)
      }

      setReviews(reviewsWithUsers)
    } catch (error) {
      console.error("Error loading reviews:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (reviewId: string) => {
    if (!window.confirm("Are you sure you want to delete this review?")) return

    setDeletingId(reviewId)
    try {
      const { db } = getFirebaseServices()
      await deleteDoc(doc(db, "reviews", reviewId))
      setReviews(reviews.filter((review) => review.id !== reviewId))
      // TODO: Recount tour/article rating after deletion
    } catch (error) {
      console.error("Error deleting review:", error)
      alert("Failed to delete review")
    } finally {
      setDeletingId(null)
      setOpenDropdown(null)
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
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">User Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Comment</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Rating</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Date</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {reviews.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  No reviews found
                </td>
              </tr>
            ) : (
              reviews.map((review) => (
                <tr key={review.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 text-sm text-slate-900 font-medium">{review.user?.name || "Unknown"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{review.user?.email || "N/A"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{review.comment}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                      {"⭐"} {review.rate.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {review.createdAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === review.id ? null : review.id)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>

                      {openDropdown === review.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                          <button
                            onClick={() => handleDelete(review.id)}
                            disabled={deletingId === review.id}
                            className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 transition disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            {deletingId === review.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
