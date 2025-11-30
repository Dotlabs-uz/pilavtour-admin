"use client"

import { AdminLayout } from "@/components/admin-layout"
import { ArticleForm } from "../../article-form"
import { useParams } from "next/navigation"

export default function EditArticlePage() {
  const params = useParams()
  const articleId = params.id as string

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Редактировать статью</h1>
          <p className="text-slate-500 mt-1">Обновить информацию о статье</p>
        </div>

        <ArticleForm articleId={articleId} />
      </div>
    </AdminLayout>
  )
}
