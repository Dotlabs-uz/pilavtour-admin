"use client"

import { useEffect, useState } from "react"
import { getFirebaseServices } from "@/lib/firebase"
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore"
import type { Article } from "@/types"
import { Trash2, Eye, Edit, MoreHorizontal } from "lucide-react"
import Link from "next/link"

interface ArticlesTableProps {
  filters: {
    sortBy: string
    search: string
  }
}

export function ArticlesTable({ filters }: ArticlesTableProps) {
  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadArticles()
  }, [filters])

  const loadArticles = async () => {
    try {
      const { db } = getFirebaseServices()
      const snapshot = await getDocs(collection(db, "articles"))
      let articlesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
      })) as Article[]

      // Apply search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        articlesData = articlesData.filter(
          (article) =>
            article.title.en.toLowerCase().includes(searchLower) ||
            article.title.uz.toLowerCase().includes(searchLower) ||
            article.title.ru.toLowerCase().includes(searchLower),
        )
      }

      // Sort
      if (filters.sortBy === "asc") {
        articlesData.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      } else {
        articlesData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      }

      setArticles(articlesData)
    } catch (error) {
      console.error("Error loading articles:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (articleId: string) => {
    if (!window.confirm("Are you sure you want to delete this article?")) return

    setDeletingId(articleId)
    try {
      const { db } = getFirebaseServices()
      await deleteDoc(doc(db, "articles", articleId))
      setArticles(articles.filter((article) => article.id !== articleId))
    } catch (error) {
      console.error("Error deleting article:", error)
      alert("Failed to delete article")
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
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Likes</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Views</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Date Created</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {articles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  No articles found
                </td>
              </tr>
            ) : (
              articles.map((article) => (
                <tr key={article.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 text-sm text-slate-900 font-medium">{article.title.en}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{article.likes}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{article.views}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {article.createdAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === article.id ? null : article.id)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>

                      {openDropdown === article.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                          <Link
                            href={`https://pilavtour.uz/articles/${article.id}`}
                            target="_blank"
                            className="block w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-600 flex items-center gap-2 transition"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </Link>
                          <Link
                            href={`/admin/articles/${article.id}/edit`}
                            className="block w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-600 flex items-center gap-2 transition"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(article.id)}
                            disabled={deletingId === article.id}
                            className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 transition disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            {deletingId === article.id ? "Deleting..." : "Delete"}
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
