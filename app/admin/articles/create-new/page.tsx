"use client"

import { AdminLayout } from "@/components/admin-layout"
import { ArticleForm } from "../article-form"

export default function CreateArticlePage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Создать новую статью</h1>
          <p className="text-slate-500 mt-1">Опубликовать новую статью в блоге</p>
        </div>

        <ArticleForm />
      </div>
    </AdminLayout>
  )
}
