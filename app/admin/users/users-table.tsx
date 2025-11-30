"use client"

import { useEffect, useState } from "react"
import { getFirebaseServices } from "@/lib/firebase"
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore"
import type { User } from "@/types"
import { Trash2, MoreHorizontal } from "lucide-react"

export function UsersTable() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const { db } = getFirebaseServices()
      const usersCollection = collection(db!, "users")
      const snapshot = await getDocs(usersCollection)
      const usersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      })) as User[]
      setUsers(usersData)
    } catch (error) {
      console.error("Error loading users:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return

    setDeletingId(userId)
    try {
      const { db } = getFirebaseServices()
      await deleteDoc(doc(db!, "users", userId))
      setUsers(users.filter((user) => user.id !== userId))
    } catch (error) {
      console.error("Error deleting user:", error)
      alert("Failed to delete user")
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
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Avatar</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Email</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Date Applied</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  No users found
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
                    {user.createdAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === user.id ? null : user.id)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>

                      {/* Dropdown Menu */}
                      {openDropdown === user.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                          <button
                            onClick={() => handleDelete(user.id)}
                            disabled={deletingId === user.id}
                            className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 transition disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            {deletingId === user.id ? "Deleting..." : "Delete"}
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
