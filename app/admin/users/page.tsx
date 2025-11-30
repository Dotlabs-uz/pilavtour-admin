"use client"

import { AdminLayout } from "@/components/admin-layout"
import { UsersTable } from "./users-table"

export default function UsersPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Users</h1>
          <p className="text-slate-500 mt-1">Manage all users in your platform</p>
        </div>

        {/* Table */}
        <UsersTable />
      </div>
    </AdminLayout>
  )
}
