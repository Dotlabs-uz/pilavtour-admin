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
import { onAuthStateChanged } from "firebase/auth"
import { translateText } from "@/lib/translation"

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
      const articleDoc = await getDoc(doc(db!, "articles", articleId!))

      if (articleDoc.exists()) {
        const data = articleDoc.data()
        // Load with Russian title/description as default (or first available)
        reset({
          title: data.title?.ru || data.title?.en || data.title?.uz || "",
          description: data.description?.ru || data.description?.en || data.description?.uz || "",
          coverImage: data.coverImage || "",
        })
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
      const { storage, auth } = getFirebaseServices()
      
      // Ensure user is authenticated before uploading
      if (!auth?.currentUser) {
        // Wait for auth state to be ready (with timeout)
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            unsubscribe()
            reject(new Error("Таймаут ожидания авторизации"))
          }, 5000)
          
          const unsubscribe = onAuthStateChanged(auth!, (user) => {
            clearTimeout(timeout)
            unsubscribe()
            if (user) {
              resolve()
            } else {
              reject(new Error("Пользователь не авторизован. Пожалуйста, войдите снова."))
            }
          })
        })
      }

      // Refresh the auth token to ensure it's valid for Storage
      if (auth?.currentUser) {
        try {
          await auth.currentUser.getIdToken(true)
        } catch (tokenError) {
          console.error("Error refreshing token:", tokenError)
          throw new Error("Ошибка обновления токена авторизации")
        }
      }

      const storageRef = ref(storage!, `articles/${articleId || "new"}/${Date.now()}-${file.name}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)

      reset({
        ...watch(),
        coverImage: url,
      })
    } catch (error: any) {
      console.error("Error uploading image:", error)
      const errorMessage = error.message || "Не удалось загрузить изображение"
      alert(errorMessage)
    } finally {
      setUploadingImage(false)
    }
  }

  const onSubmit = async (data: ArticleFormData) => {
    if (!user) {
      alert("Вы должны быть авторизованы")
      return
    }

    setIsSaving(true)
    try {
      // Translate title and description to all languages
      const [translatedTitle, translatedDescription] = await Promise.all([
        translateText(data.title, [...LANGUAGES]),
        translateText(data.description, [...LANGUAGES]),
      ])

      const { db } = getFirebaseServices()
      const articleData = {
        title: translatedTitle,
        description: translatedDescription,
        coverImage: data.coverImage,
        authorId: user.id,
        likes: 0,
        views: 0,
        createdAt: articleId ? undefined : serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      if (articleId) {
        await updateDoc(doc(db!, "articles", articleId), articleData)
      } else {
        const newDocRef = doc(collection(db!, "articles"))
        await setDoc(newDocRef, articleData)
      }

      router.push("/admin/articles")
    } catch (error) {
      console.error("Error saving article:", error)
      alert("Не удалось сохранить статью")
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
        <h2 className="text-lg font-semibold text-slate-900">Название</h2>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Название статьи</label>
          <input
            {...register("title")}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
            placeholder="Введите название статьи (будет автоматически переведено на все языки)"
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
        </div>
      </div>

      {/* Description Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Описание</h2>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Описание статьи</label>
          <textarea
            {...register("description")}
            rows={8}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
            placeholder="Введите описание статьи (будет автоматически переведено на все языки)"
          />
          {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
        </div>
      </div>

      {/* Cover Image */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Обложка</h2>
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
            <div className="text-slate-600">{uploadingImage ? "Загрузка..." : "Нажмите, чтобы загрузить обложку"}</div>
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
          {isSaving ? "Сохранение..." : articleId ? "Обновить статью" : "Создать статью"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 bg-slate-200 text-slate-900 py-3 rounded-lg hover:bg-slate-300 transition"
        >
          Отмена
        </button>
      </div>
    </form>
  )
}
