"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { articleSchema, type ArticleFormData } from "@/schemas/article-schema"
import { getFirebaseServices } from "@/lib/firebase"
import { collection, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { LANGUAGES, type MultiLangText } from "@/types"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"

interface ArticleFormProps {
  articleId?: string
}

export function ArticleForm({ articleId }: ArticleFormProps) {
  const router = useRouter()
  const { user } = useAuthStore()
  const [isLoading, setIsLoading] = useState(!!articleId)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema),
  })

  const coverImage = watch("coverImage")

  useEffect(() => {
    if (articleId) {
      loadArticle()
    }
  }, [articleId])

  const loadArticle = async () => {
    try {
      const { db } = getFirebaseServices()
      const articleDoc = await getDoc(doc(db, "articles", articleId!))

      if (articleDoc.exists()) {
        reset(articleDoc.data() as any)
      }
    } catch (error) {
      console.error("Error loading article:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const { storage } = getFirebaseServices()
      const storageRef = ref(storage, `articles/${articleId || "new"}/${Date.now()}-${file.name}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)

      reset({
        ...watch(),
        coverImage: url,
      })
    } catch (error) {
      console.error("Error uploading image:", error)
      alert("Failed to upload image")
    } finally {
      setUploadingImage(false)
    }
  }

  const onSubmit = async (data: ArticleFormData) => {
    if (!user) {
      alert("You must be logged in")
      return
    }

    setIsSaving(true)
    try {
      const { db } = getFirebaseServices()
      const articleData = {
        ...data,
        authorId: user.id,
        likes: 0,
        views: 0,
        createdAt: articleId ? undefined : serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      if (articleId) {
        await updateDoc(doc(db, "articles", articleId), articleData)
      } else {
        const newDocRef = doc(collection(db, "articles"))
        await setDoc(newDocRef, articleData)
      }

      router.push("/admin/articles")
    } catch (error) {
      console.error("Error saving article:", error)
      alert("Failed to save article")
    } finally {
      setIsSaving(false)
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Title Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Title (7 Languages)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LANGUAGES.map((lang) => (
            <div key={lang}>
              <label className="block text-sm font-medium text-slate-700 mb-2 uppercase">{lang}</label>
              <input
                {...register(`title.${lang as keyof MultiLangText}`)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                placeholder={`Title in ${lang}`}
              />
              {errors.title?.[lang as keyof MultiLangText] && <p className="text-red-500 text-xs mt-1">Required</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Description Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Description (7 Languages)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LANGUAGES.map((lang) => (
            <div key={lang}>
              <label className="block text-sm font-medium text-slate-700 mb-2 uppercase">{lang}</label>
              <textarea
                {...register(`description.${lang as keyof MultiLangText}`)}
                rows={6}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                placeholder={`Description in ${lang}`}
              />
              {errors.description?.[lang as keyof MultiLangText] && (
                <p className="text-red-500 text-xs mt-1">Required</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cover Image */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Cover Image</h2>
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploadingImage}
            className="hidden"
            id="cover-input"
          />
          <label htmlFor="cover-input" className="cursor-pointer flex flex-col items-center gap-2">
            <div className="text-slate-600">{uploadingImage ? "Uploading..." : "Click to upload cover image"}</div>
          </label>
        </div>

        {coverImage && (
          <div className="mt-4">
            <img src={coverImage || "/placeholder.svg"} alt="Cover" className="w-full h-48 object-cover rounded-lg" />
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 bg-accent text-white py-3 rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
        >
          {isSaving ? "Saving..." : articleId ? "Update Article" : "Create Article"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 bg-slate-200 text-slate-900 py-3 rounded-lg hover:bg-slate-300 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
