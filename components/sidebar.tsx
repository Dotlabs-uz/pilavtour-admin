"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { getFirebaseServices } from "@/lib/firebase"
import { signOut } from "firebase/auth"
import { useState } from "react"
import { Users, MapPin, FileText, Star, X, Menu, LogOut } from "lucide-react"

const menuItems = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/tours", label: "Tours", icon: MapPin },
  { href: "/admin/articles", label: "Articles", icon: FileText },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)

  const handleLogout = async () => {
    try {
      const { auth } = getFirebaseServices()
      await signOut(auth!)
      logout()
      document.cookie = "auth-token=; path=/; max-age=0"
      router.push("/login")
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white border border-slate-200 rounded-lg"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white p-6 transition-transform duration-300 z-40 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="mb-8 pt-4">
          <h2 className="text-2xl font-bold">Pilav Tours</h2>
          <p className="text-slate-400 text-sm">Admin Dashboard</p>
        </div>

        {/* Menu Items */}
        <nav className="space-y-2 mb-8">
          {menuItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive ? "bg-accent text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
                onClick={() => setIsOpen(false)}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="border-t border-slate-700 pt-4 mt-auto">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition w-full"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-30" onClick={() => setIsOpen(false)} />
      )}
    </>
  )
}
