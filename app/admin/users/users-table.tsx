"use client"

import { useEffect, useState } from "react"
import { getFirebaseServices } from "@/lib/firebase"
import { collection, getDocs, deleteDoc, doc, query, limit, orderBy, startAfter, endBefore, QueryDocumentSnapshot, DocumentData } from "firebase/firestore"
import type { User } from "@/types"
import { Trash2, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface UsersTableProps {
  filters: {
    search: string
  }
}

export function UsersTable({ filters }: UsersTableProps) {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [firstDoc, setFirstDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [pageHistory, setPageHistory] = useState<QueryDocumentSnapshot<DocumentData>[]>([])
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPreviousPage, setHasPreviousPage] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [allFilteredUsers, setAllFilteredUsers] = useState<User[]>([])
  const usersPerPage = 10

  useEffect(() => {
    setCurrentPage(1)
    setAllFilteredUsers([])
    loadUsers(true)
  }, [filters])

  const loadUsers = async (reset = false, direction: 'next' | 'prev' | 'first' = 'first') => {
    setIsLoading(true)
    try {
      const { db } = getFirebaseServices()
      
      // Build base query
      let q = query(collection(db!, "users"), orderBy("createdAt", "desc"))
      
      // If there's a search query, fetch ALL users from the collection
      const hasSearch = filters.search && filters.search.trim().length > 0
      
      if (hasSearch) {
        // Fetch all users when searching (no pagination limit)
        const snapshot = await getDocs(q)
        let allUsersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        })) as User[]
        
        // Apply search filter on full collection (by name and email)
        const searchLower = filters.search.toLowerCase()
        allUsersData = allUsersData.filter(
          (user) =>
            user.name?.toLowerCase().includes(searchLower) ||
            user.email?.toLowerCase().includes(searchLower),
        )
        
        // Store all filtered users for pagination
        setAllFilteredUsers(allUsersData)
        
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
        
        const startIndex = (page - 1) * usersPerPage
        const endIndex = startIndex + usersPerPage
        const paginatedUsers = allUsersData.slice(startIndex, endIndex)
        const hasMore = endIndex < allUsersData.length
        
        setUsers(paginatedUsers)
        setHasNextPage(hasMore)
        setHasPreviousPage(page > 1)
        setLastDoc(null)
        setFirstDoc(null)
        
        return
      }
      
      // Server-side pagination when NOT searching
      let shouldReverse = false
      
      if (reset || direction === 'first') {
        q = query(q, limit(usersPerPage + 1))
        setPageHistory([])
      } else if (direction === 'next' && lastDoc) {
        if (firstDoc) {
          setPageHistory((prev) => [...prev, firstDoc])
        }
        q = query(q, startAfter(lastDoc), limit(usersPerPage + 1))
      } else if (direction === 'prev') {
        if (pageHistory.length > 0) {
          const prevFirstDoc = pageHistory[pageHistory.length - 1]
          const newHistory = pageHistory.slice(0, -1)
          setPageHistory(newHistory)
          
          if (newHistory.length === 0) {
            q = query(q, limit(usersPerPage + 1))
            shouldReverse = false
          } else {
            q = query(q, endBefore(prevFirstDoc), limit(usersPerPage + 1))
            shouldReverse = true
          }
        } else {
          q = query(q, limit(usersPerPage + 1))
          shouldReverse = false
        }
      }

      const snapshot = await getDocs(q)
      let docs = snapshot.docs
      
      if (shouldReverse) {
        docs = [...docs].reverse()
      }
      
      const hasMore = docs.length > usersPerPage
      const usersDocs = hasMore ? docs.slice(0, usersPerPage) : docs
      
      const usersData = usersDocs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      })) as User[]

      setUsers(usersData)
      setHasNextPage(hasMore)
      
      if (usersDocs.length > 0) {
        setLastDoc(usersDocs[usersDocs.length - 1])
        setFirstDoc(usersDocs[0])
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
      console.error("Error loading users:", error)
      alert("Ошибка загрузки пользователей")
    } finally {
      setIsLoading(false)
    }
  }

  const handleNextPage = () => {
    if (hasNextPage) {
      if (filters.search && filters.search.trim().length > 0 && allFilteredUsers.length > 0) {
        const nextPage = currentPage + 1
        const startIndex = (nextPage - 1) * usersPerPage
        const endIndex = startIndex + usersPerPage
        const paginatedUsers = allFilteredUsers.slice(startIndex, endIndex)
        const hasMore = endIndex < allFilteredUsers.length
        
        setUsers(paginatedUsers)
        setCurrentPage(nextPage)
        setHasNextPage(hasMore)
        setHasPreviousPage(true)
      } else {
        loadUsers(false, 'next')
      }
    }
  }

  const handlePreviousPage = () => {
    if (hasPreviousPage) {
      if (filters.search && filters.search.trim().length > 0 && allFilteredUsers.length > 0) {
        const prevPage = Math.max(1, currentPage - 1)
        const startIndex = (prevPage - 1) * usersPerPage
        const endIndex = startIndex + usersPerPage
        const paginatedUsers = allFilteredUsers.slice(startIndex, endIndex)
        
        setUsers(paginatedUsers)
        setCurrentPage(prevPage)
        setHasNextPage(endIndex < allFilteredUsers.length)
        setHasPreviousPage(prevPage > 1)
      } else {
        loadUsers(false, 'prev')
      }
    }
  }

  const handleDelete = async (userId: string) => {
    if (!window.confirm("Вы уверены, что хотите удалить этого пользователя?")) return

    setDeletingId(userId)
    try {
      const { db } = getFirebaseServices()
      await deleteDoc(doc(db!, "users", userId))
      loadUsers(true) // Reload after deletion
    } catch (error) {
      console.error("Error deleting user:", error)
      alert("Не удалось удалить пользователя")
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
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Аватар</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Имя</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Дата регистрации</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  Пользователи не найдены
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    {user.avatar ? (
                      <img
                        src={user.avatar || "/placeholder.svg"}
                        alt={user?.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
                        {user?.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900 font-medium">{user.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {user.createdAt.toLocaleDateString("ru-RU", {
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
                          onClick={() => handleDelete(user.id)}
                          disabled={deletingId === user.id}
                        >
                          <Trash2 className="w-4 h-4" />
                          {deletingId === user.id ? "Удаление..." : "Удалить"}
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
      {users.length > 0 && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-6 py-4">
          <div className="text-sm text-slate-600">
            Показано {users.length} {users.length === 1 ? 'пользователь' : users.length < 5 ? 'пользователя' : 'пользователей'}
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
