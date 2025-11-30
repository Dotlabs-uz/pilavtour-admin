"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { tourSchema, type TourFormData } from "@/schemas/tour-schema"
import { getFirebaseServices } from "@/lib/firebase"
import { collection, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { LANGUAGES, type MultiLangText } from "@/types"
import { useRouter } from "next/navigation"
import { Trash2, Plus, Calendar } from "lucide-react"
import { onAuthStateChanged } from "firebase/auth"
import { translateText } from "@/lib/translation"

interface TourFormProps {
  tourId?: string
}

export function TourForm({ tourId }: TourFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(!!tourId)
  const [uploadingImages, setUploadingImages] = useState(false)
  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = useForm<TourFormData>({
    resolver: zodResolver(tourSchema),
  })

  const images = watch("images") || []
  const itinerary = watch("itinerary") || []
  const dates = watch("dates") || []
  const inclusions = watch("inclusions") || { included: [], notIncluded: [] }

  useEffect(() => {
    if (tourId) {
      loadTour()
    }
  }, [tourId])

  const loadTour = async () => {
    try {
      const { db } = getFirebaseServices()
      const tourDoc = await getDoc(doc(db!, "tours", tourId!))

      if (tourDoc.exists()) {
        const data = tourDoc.data()
        // Load with Russian title/description as default (or first available)
        reset({
          title: data.title?.ru || data.title?.en || data.title?.uz || "",
          description: data.description?.ru || data.description?.en || data.description?.uz || "",
          price: data.price || "",
          style: data.style || "Standart",
          duration: data.duration || { days: 1, nights: 0 },
          maxGroupCount: data.maxGroupCount || undefined,
          images: data.images || [],
          itinerary: data.itinerary || [],
          dates: data.dates || [],
          inclusions: data.inclusions || { included: [], notIncluded: [] },
          location: data.location || "",
        })
      }
    } catch (error) {
      console.error("Error loading tour:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    setUploadingImages(true)
    try {
      const { storage, auth } = getFirebaseServices()

      if (!auth?.currentUser) {
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

      if (auth?.currentUser) {
        try {
          await auth.currentUser.getIdToken(true)
        } catch (tokenError) {
          console.error("Error refreshing token:", tokenError)
          throw new Error("Ошибка обновления токена авторизации")
        }
      }

      const uploadedUrls: string[] = []

      for (const file of Array.from(files)) {
        const storageRef = ref(storage!, `tours/${tourId || "new"}/${Date.now()}-${file.name}`)
        await uploadBytes(storageRef, file)
        const url = await getDownloadURL(storageRef)
        uploadedUrls.push(url)
      }

      const currentImages = watch("images") || []
      reset({
        ...watch(),
        images: [...currentImages, ...uploadedUrls],
      })
    } catch (error: any) {
      console.error("Error uploading images:", error)
      const errorMessage = error.message || "Не удалось загрузить изображения"
      alert(errorMessage)
    } finally {
      setUploadingImages(false)
    }
  }

  const onSubmit = async (data: TourFormData) => {
    try {
      // Translate title and description to all languages
      const [translatedTitle, translatedDescription] = await Promise.all([
        translateText(data.title, [...LANGUAGES]),
        translateText(data.description, [...LANGUAGES]),
      ])

      const { db } = getFirebaseServices()
      const tourData = {
        title: translatedTitle,
        description: translatedDescription,
        price: data.price,
        style: data.style,
        duration: data.duration,
        maxGroupCount: data.maxGroupCount,
        images: data.images,
        itinerary: data.itinerary || [],
        dates: data.dates || [],
        inclusions: data.inclusions || { included: [], notIncluded: [] },
        location: data.location,
        createdAt: tourId ? undefined : serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      if (tourId) {
        await updateDoc(doc(db!, "tours", tourId), tourData)
      } else {
        const newDocRef = doc(collection(db!, "tours"))
        await setDoc(newDocRef, tourData)
      }

      router.push("/admin/tours")
    } catch (error) {
      console.error("Error saving tour:", error)
      alert("Не удалось сохранить тур")
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Title Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Название</h2>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Название тура</label>
          <input
            {...register("title")}
            maxLength={200}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
            placeholder="Введите название тура (будет автоматически переведено на все языки)"
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
        </div>
      </div>

      {/* Description Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Описание</h2>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Описание тура</label>
          <textarea
            {...register("description")}
            maxLength={5000}
            rows={6}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
            placeholder="Введите описание тура (будет автоматически переведено на все языки)"
          />
          {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Основная информация</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Цена</label>
            <input
              {...register("price")}
              type="text"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="e.g., 500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Стиль</label>
            <select
              {...register("style")}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="Premium">Premium</option>
              <option value="Econom">Econom</option>
              <option value="Standart">Standart</option>
              <option value="Lux">Lux</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Дней</label>
            <input
              {...register("duration.days", { valueAsNumber: true })}
              type="number"
              min="1"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Ночей</label>
            <input
              {...register("duration.nights", { valueAsNumber: true })}
              type="number"
              min="1"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Максимальное количество группы (необязательно)</label>
            <input
              {...register("maxGroupCount", { valueAsNumber: true })}
              type="number"
              min="1"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Местоположение</label>
            <input
              {...register("location")}
              type="text"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="e.g., Samarkand, Bukhara"
            />
          </div>
        </div>
      </div>

      {/* Images */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Изображения</h2>
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploadingImages}
            className="hidden"
            id="image-input"
          />
          <label htmlFor="image-input" className="cursor-pointer flex flex-col items-center gap-2">
            <div className="text-slate-600">{uploadingImages ? "Загрузка..." : "Нажмите, чтобы загрузить изображения"}</div>
          </label>
        </div>

        {images.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            {images.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={img || "/placeholder.svg"}
                  alt={`Tour ${idx + 1}`}
                  className="w-full h-24 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newImages = images.filter((_, i) => i !== idx)
                    reset({
                      ...watch(),
                      images: newImages,
                    })
                  }}
                  className="absolute inset-0 bg-black bg-opacity-50 rounded-lg opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                >
                  <Trash2 className="w-5 h-5 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Itinerary */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Маршрут</h2>
        {itinerary.map((item, idx) => (
          <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-slate-900">День {idx + 1}</h3>
              <button
                type="button"
                onClick={() => {
                  const newItinerary = itinerary.filter((_, i) => i !== idx)
                  reset({
                    ...watch(),
                    itinerary: newItinerary,
                  })
                }}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
              <input
                {...register(`itinerary.${idx}.title`)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                placeholder="Название дня"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
              <textarea
                {...register(`itinerary.${idx}.description`)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                placeholder="Описание дня"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            reset({
              ...watch(),
              itinerary: [...itinerary, { title: "", description: "" }],
            })
          }}
          className="flex items-center gap-2 text-accent hover:text-orange-600"
        >
          <Plus className="w-4 h-4" />
          Добавить день
        </button>
      </div>

      {/* Dates */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Даты туров</h2>
        {dates.map((date, idx) => (
          <div key={idx} className="border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-slate-900">Дата {idx + 1}</h3>
              <button
                type="button"
                onClick={() => {
                  const newDates = dates.filter((_, i) => i !== idx)
                  reset({
                    ...watch(),
                    dates: newDates,
                  })
                }}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Дата начала</label>
                <input
                  {...register(`dates.${idx}.startDate`, { valueAsDate: true })}
                  type="date"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Дата окончания</label>
                <input
                  {...register(`dates.${idx}.endDate`, { valueAsDate: true })}
                  type="date"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Статус</label>
                <select
                  {...register(`dates.${idx}.status`)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                >
                  <option value="Available">Доступно</option>
                  <option value="Few spots">Мало мест</option>
                  <option value="Sold out">Распродано</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Цена</label>
                <input
                  {...register(`dates.${idx}.price`)}
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                  placeholder="Цена для этой даты"
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            reset({
              ...watch(),
              dates: [...dates, { startDate: new Date(), endDate: new Date(), status: "Available" as const, price: "" }],
            })
          }}
          className="flex items-center gap-2 text-accent hover:text-orange-600"
        >
          <Plus className="w-4 h-4" />
          Добавить дату
        </button>
      </div>

      {/* Inclusions */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Что включено / не включено</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3">Включено</h3>
            <div className="space-y-2">
              {inclusions.included?.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    {...register(`inclusions.included.${idx}`)}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                    placeholder="Включенный пункт"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newIncluded = inclusions.included?.filter((_, i) => i !== idx) || []
                      reset({
                        ...watch(),
                        inclusions: { ...inclusions, included: newIncluded },
                      })
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  reset({
                    ...watch(),
                    inclusions: { ...inclusions, included: [...(inclusions.included || []), ""] },
                  })
                }}
                className="flex items-center gap-2 text-sm text-accent hover:text-orange-600"
              >
                <Plus className="w-4 h-4" />
                Добавить
              </button>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3">Не включено</h3>
            <div className="space-y-2">
              {inclusions.notIncluded?.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    {...register(`inclusions.notIncluded.${idx}`)}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                    placeholder="Не включенный пункт"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newNotIncluded = inclusions.notIncluded?.filter((_, i) => i !== idx) || []
                      reset({
                        ...watch(),
                        inclusions: { ...inclusions, notIncluded: newNotIncluded },
                      })
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  reset({
                    ...watch(),
                    inclusions: { ...inclusions, notIncluded: [...(inclusions.notIncluded || []), ""] },
                  })
                }}
                className="flex items-center gap-2 text-sm text-accent hover:text-orange-600"
              >
                <Plus className="w-4 h-4" />
                Добавить
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSubmitting || !isValid}
          className="flex-1 bg-accent text-white py-3 rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
        >
          {isSubmitting ? "Сохранение..." : tourId ? "Обновить тур" : "Создать тур"}
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
