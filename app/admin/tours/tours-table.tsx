"use client"

import { useEffect, useState } from "react"
import { getFirebaseServices } from "@/lib/firebase"
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore"
import type { Tour } from "@/types"
import { Trash2, Eye, Edit, MoreHorizontal } from "lucide-react"
import Link from "next/link"

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
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadTours()
  }, [filters])

  const loadTours = async () => {
    try {
      const { db } = getFirebaseServices()
      const q: any = collection(db, "tours")

      const snapshot = await getDocs(q)
      let toursData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
      })) as Tour[]

      // Apply filters
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        toursData = toursData.filter(
          (tour) =>
            tour.title.en.toLowerCase().includes(searchLower) ||
            tour.title.uz.toLowerCase().includes(searchLower) ||
            tour.title.ru.toLowerCase().includes(searchLower),
        )
      }

      if (filters.style) {
        toursData = toursData.filter((tour) => tour.style === filters.style)
      }

      // Sort
      if (filters.sortBy === "asc") {
        toursData.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      } else {
        toursData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      }

      if (filters.priceSort === "asc") {
        toursData.sort((a, b) => Number.parseFloat(a.price) - Number.parseFloat(b.price))
      } else if (filters.priceSort === "desc") {
        toursData.sort((a, b) => Number.parseFloat(b.price) - Number.parseFloat(a.price))
      }

      setTours(toursData)
    } catch (error) {
      console.error("Error loading tours:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (tourId: string) => {
    if (!window.confirm("Are you sure you want to delete this tour?")) return

    setDeletingId(tourId)
    try {
      const { db } = getFirebaseServices()
      await deleteDoc(doc(db, "tours", tourId))
      setTours(tours.filter((tour) => tour.id !== tourId))
    } catch (error) {
      console.error("Error deleting tour:", error)
      alert("Failed to delete tour")
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
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Title</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Style</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Rating</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Date Created</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {tours.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  No tours found
                </td>
              </tr>
            ) : (
              tours.map((tour) => (
                <tr key={tour.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 text-sm text-slate-900 font-medium">{tour.title.en}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                      {tour.style}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {"⭐"} {tour.rating.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {tour.createdAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === tour.id ? null : tour.id)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>

                      {openDropdown === tour.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                          <Link
                            href={`https://pilavtour.uz/trips/${tour.id}`}
                            target="_blank"
                            className="block w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-600 flex items-center gap-2 transition"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </Link>
                          <Link
                            href={`/admin/tours/${tour.id}/edit`}
                            className="block w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-600 flex items-center gap-2 transition"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(tour.id)}
                            disabled={deletingId === tour.id}
                            className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 transition disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            {deletingId === tour.id ? "Deleting..." : "Delete"}
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
