"use client"

import { useEffect, useState } from "react"
import { getFirebaseServices } from "@/lib/firebase"
import { collection, getDocs, deleteDoc, doc, query, limit, orderBy, startAfter, endBefore, QueryDocumentSnapshot, DocumentData } from "firebase/firestore"
import type { Article } from "@/types"
import { Trash2, Eye, Edit, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ArticlesTableProps {
  filters: {
    sortBy: string
    search: string
  }
}

export function ArticlesTable({ filters }: ArticlesTableProps) {
  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [firstDoc, setFirstDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [pageHistory, setPageHistory] = useState<QueryDocumentSnapshot<DocumentData>[]>([])
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPreviousPage, setHasPreviousPage] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [allFilteredArticles, setAllFilteredArticles] = useState<Article[]>([])
  const articlesPerPage = 10

  useEffect(() => {
    setCurrentPage(1)
    setAllFilteredArticles([])
    loadArticles(true)
  }, [filters])

  const loadArticles = async (reset = false, direction: 'next' | 'prev' | 'first' = 'first') => {
    setIsLoading(true)
    try {
      const { db } = getFirebaseServices()
      
      // Build base query
      let q = query(collection(db!, "articles"))
      
      // Apply sorting
      if (filters.sortBy === "asc") {
        q = query(q, orderBy("createdAt", "asc"))
      } else {
        q = query(q, orderBy("createdAt", "desc"))
      }
      
      // If there's a search query, fetch ALL articles from the collection
      const hasSearch = filters.search && filters.search.trim().length > 0
      
      if (hasSearch) {
        // Fetch all articles when searching (no pagination limit)
        const snapshot = await getDocs(q)
        let allArticlesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
        })) as Article[]
        
        // Apply search filter on full collection (by title.ru only)
        const searchLower = filters.search.toLowerCase()
        allArticlesData = allArticlesData.filter(
          (article) => article.title.ru?.toLowerCase().includes(searchLower),
        )
        
        // Store all filtered articles for pagination
        setAllFilteredArticles(allArticlesData)
        
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
        
        const startIndex = (page - 1) * articlesPerPage
        const endIndex = startIndex + articlesPerPage
        const paginatedArticles = allArticlesData.slice(startIndex, endIndex)
        const hasMore = endIndex < allArticlesData.length
        
        setArticles(paginatedArticles)
        setHasNextPage(hasMore)
        setHasPreviousPage(page > 1)
        setLastDoc(null)
        setFirstDoc(null)
        
        return
      }
      
      // Server-side pagination when NOT searching
      let shouldReverse = false
      
      if (reset || direction === 'first') {
        q = query(q, limit(articlesPerPage + 1))
        setPageHistory([])
      } else if (direction === 'next' && lastDoc) {
        if (firstDoc) {
          setPageHistory((prev) => [...prev, firstDoc])
        }
        q = query(q, startAfter(lastDoc), limit(articlesPerPage + 1))
      } else if (direction === 'prev') {
        if (pageHistory.length > 0) {
          const prevFirstDoc = pageHistory[pageHistory.length - 1]
          const newHistory = pageHistory.slice(0, -1)
          setPageHistory(newHistory)
          
          if (newHistory.length === 0) {
            q = query(q, limit(articlesPerPage + 1))
            shouldReverse = false
          } else {
            q = query(q, endBefore(prevFirstDoc), limit(articlesPerPage + 1))
            shouldReverse = true
          }
        } else {
          q = query(q, limit(articlesPerPage + 1))
          shouldReverse = false
        }
      }

      const snapshot = await getDocs(q)
      let docs = snapshot.docs
      
      if (shouldReverse) {
        docs = [...docs].reverse()
      }
      
      const hasMore = docs.length > articlesPerPage
      const articlesDocs = hasMore ? docs.slice(0, articlesPerPage) : docs
      
      const articlesData = articlesDocs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
      })) as Article[]

      setArticles(articlesData)
      setHasNextPage(hasMore)
      
      if (articlesDocs.length > 0) {
        setLastDoc(articlesDocs[articlesDocs.length - 1])
        setFirstDoc(articlesDocs[0])
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
      console.error("Error loading articles:", error)
      alert("Ошибка загрузки статей")
    } finally {
      setIsLoading(false)
    }
  }

  const handleNextPage = () => {
    if (hasNextPage) {
      if (filters.search && filters.search.trim().length > 0 && allFilteredArticles.length > 0) {
        const nextPage = currentPage + 1
        const startIndex = (nextPage - 1) * articlesPerPage
        const endIndex = startIndex + articlesPerPage
        const paginatedArticles = allFilteredArticles.slice(startIndex, endIndex)
        const hasMore = endIndex < allFilteredArticles.length
        
        setArticles(paginatedArticles)
        setCurrentPage(nextPage)
        setHasNextPage(hasMore)
        setHasPreviousPage(true)
      } else {
        loadArticles(false, 'next')
      }
    }
  }

  const handlePreviousPage = () => {
    if (hasPreviousPage) {
      if (filters.search && filters.search.trim().length > 0 && allFilteredArticles.length > 0) {
        const prevPage = Math.max(1, currentPage - 1)
        const startIndex = (prevPage - 1) * articlesPerPage
        const endIndex = startIndex + articlesPerPage
        const paginatedArticles = allFilteredArticles.slice(startIndex, endIndex)
        
        setArticles(paginatedArticles)
        setCurrentPage(prevPage)
        setHasNextPage(endIndex < allFilteredArticles.length)
        setHasPreviousPage(prevPage > 1)
      } else {
        loadArticles(false, 'prev')
      }
    }
  }

  const handleDelete = async (articleId: string) => {
    if (!window.confirm("Вы уверены, что хотите удалить эту статью?")) return

    setDeletingId(articleId)
    try {
      const { db } = getFirebaseServices()
      await deleteDoc(doc(db!, "articles", articleId))
      loadArticles(true) // Reload after deletion
    } catch (error) {
      console.error("Error deleting article:", error)
      alert("Не удалось удалить статью")
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
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Название</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Лайки</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Просмотры</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Дата создания</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {articles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  Статьи не найдены
                </td>
              </tr>
            ) : (
              articles.map((article) => (
                <tr key={article.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 text-sm text-slate-900 font-medium">{article.title.en}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{article.likes}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{article.views}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {article.createdAt.toLocaleDateString("ru-RU", {
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
                            href={`https://pilavtour.uz/articles/${article.id}`}
                            target="_blank"
                            className="flex items-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            Просмотр
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/admin/articles/${article.id}/edit`}
                            className="flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4" />
                            Редактировать
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                            onClick={() => handleDelete(article.id)}
                            disabled={deletingId === article.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          {deletingId === article.id ? "Удаление..." : "Удалить"}
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
      {articles.length > 0 && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-6 py-4">
          <div className="text-sm text-slate-600">
            Показано {articles.length} {articles.length === 1 ? 'статья' : articles.length < 5 ? 'статьи' : 'статей'}
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
