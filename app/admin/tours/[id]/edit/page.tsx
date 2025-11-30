"use client"

import { AdminLayout } from "@/components/admin-layout"
import { TourForm } from "../../tour-form"
import { useParams } from "next/navigation"

export default function EditTourPage() {
  const params = useParams()
  const tourId = params.id as string

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Edit Tour</h1>
          <p className="text-slate-500 mt-1">Update tour information</p>
        </div>

        <TourForm tourId={tourId} />
      </div>
    </AdminLayout>
  )
}
