"use client"

import { AdminLayout } from "@/components/admin-layout"
import { TourForm } from "../tour-form"

export default function CreateTourPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Create New Tour</h1>
          <p className="text-slate-500 mt-1">Add a new tour to your catalog</p>
        </div>

        <TourForm />
      </div>
    </AdminLayout>
  )
}
