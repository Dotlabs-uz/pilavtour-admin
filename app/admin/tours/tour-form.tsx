"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
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

const toDateInputValue = (value?: Date | string | null) => {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
}

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
    getValues,
    setValue,
    formState: { errors, isValid, isSubmitting },
  } = useForm<TourFormData>({
    resolver: zodResolver(tourSchema),
  })

  const images = watch("images") || []
  const itinerary = watch("itinerary") || []
  const inclusions = watch("inclusions") || { included: [], notIncluded: [] }

  const { fields: dateFields, append: appendDate, remove: removeDate } = useFieldArray({
    control,
    name: "dates",
  })

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
        const normalizeDates =
          data.dates?.map((d: any) => ({
            startDate: toDateInputValue(d?.startDate?.toDate ? d.startDate.toDate() : d?.startDate) || "",
            endDate: toDateInputValue(d?.endDate?.toDate ? d.endDate.toDate() : d?.endDate) || "",
            status: d?.status || "Available",
            price: d?.price || "",
          })) || []

        // Normalize itinerary to use Russian (or first available) language
        const normalizeItinerary =
          data.itinerary?.map((item: any) => ({
            title: item.title?.ru || item.title?.en || item.title?.uz || (typeof item.title === "string" ? item.title : ""),
            description: item.description?.ru || item.description?.en || item.description?.uz || (typeof item.description === "string" ? item.description : ""),
          })) || []

        // Normalize inclusions to use Russian (or first available) language
        const normalizeIncluded =
          data.inclusions?.included?.map((item: any) =>
            typeof item === "string" ? item : item?.ru || item?.en || item?.uz || ""
          ) || []
        const normalizeNotIncluded =
          data.inclusions?.notIncluded?.map((item: any) =>
            typeof item === "string" ? item : item?.ru || item?.en || item?.uz || ""
          ) || []

        reset({
          title: data.title?.ru || data.title?.en || data.title?.uz || "",
          description: data.description?.ru || data.description?.en || data.description?.uz || "",
          price: data.price || "",
          style: data.style || "Standart",
          duration: data.duration || { days: 1, nights: 0 },
          maxGroupCount: data.maxGroupCount || undefined,
          images: data.images || [],
          itinerary: normalizeItinerary,
          dates: normalizeDates,
          inclusions: { included: normalizeIncluded, notIncluded: normalizeNotIncluded },
          location: typeof data.location === "string" ? data.location : data.location?.ru || data.location?.en || data.location?.uz || "",
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

      const currentImages = getValues("images") || []
      reset({
        ...getValues(),
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

  const getEmptyMultiLang = (): MultiLangText => {
    return {
      uz: "",
      ru: "",
      en: "",
      sp: "",
      uk: "",
      it: "",
      ge: "",
    }
  }

  const onSubmit = async (data: TourFormData) => {
    try {
      const emptyMultiLang = getEmptyMultiLang()
      
      // Translate title and description to all languages (only if provided)
      const [translatedTitle, translatedDescription] = await Promise.all([
        data.title ? translateText(data.title, [...LANGUAGES]) : Promise.resolve(emptyMultiLang),
        data.description ? translateText(data.description, [...LANGUAGES]) : Promise.resolve(emptyMultiLang),
      ])

      // Translate itinerary items
      const translatedItinerary = await Promise.all(
        (data.itinerary || []).map(async (item) => {
          const [translatedTitle, translatedDescription] = await Promise.all([
            item.title ? translateText(item.title, [...LANGUAGES]) : Promise.resolve(emptyMultiLang),
            item.description ? translateText(item.description, [...LANGUAGES]) : Promise.resolve(emptyMultiLang),
          ])
          return {
            title: translatedTitle,
            description: translatedDescription,
          }
        })
      )

      // Translate inclusions
      const translatedIncluded = await Promise.all(
        (data.inclusions?.included || []).map((item) => item ? translateText(item, [...LANGUAGES]) : Promise.resolve(emptyMultiLang))
      )
      const translatedNotIncluded = await Promise.all(
        (data.inclusions?.notIncluded || []).map((item) => item ? translateText(item, [...LANGUAGES]) : Promise.resolve(emptyMultiLang))
      )

      // Translate location
      const translatedLocation = data.location ? await translateText(data.location, [...LANGUAGES]) : undefined

      // Convert date strings to Date objects for Firestore
      const normalizedDates = (data.dates || [])
        .map((date) => {
          const startDate = date.startDate 
            ? (typeof date.startDate === "string" && date.startDate ? new Date(date.startDate) : date.startDate instanceof Date ? date.startDate : null)
            : null
          const endDate = date.endDate 
            ? (typeof date.endDate === "string" && date.endDate ? new Date(date.endDate) : date.endDate instanceof Date ? date.endDate : null)
            : null
          return {
            startDate,
            endDate,
            status: date.status || "Available",
            price: date.price || "",
          }
        })
        .filter((date) => date.startDate && date.endDate && !isNaN(date.startDate.getTime()) && !isNaN(date.endDate.getTime())) // Only include valid dates with both start and end

      const { db } = getFirebaseServices()
      const tourData = {
        title: translatedTitle,
        description: translatedDescription,
        price: data.price || "",
        style: data.style || "Standart",
        duration: data.duration || { days: 1, nights: 0 },
        maxGroupCount: data.maxGroupCount,
        images: data.images || [],
        itinerary: translatedItinerary,
        dates: normalizedDates.length > 0 ? normalizedDates : undefined,
        inclusions: data.inclusions ? {
          included: translatedIncluded,
          notIncluded: translatedNotIncluded,
        } : undefined,
        location: translatedLocation,
        updatedAt: serverTimestamp(),
        ...(tourId ? {} : { createdAt: serverTimestamp() }),
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
              placeholder="e.g., Samarkand, Bukhara (будет автоматически переведено на все языки)"
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
                    const currentImages = getValues("images") || []
                    const newImages = currentImages.filter((_, i) => i !== idx)
                    reset({
                      ...getValues(),
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
                  const currentItinerary = getValues("itinerary") || []
                  const newItinerary = currentItinerary.filter((_, i) => i !== idx)
                  reset({
                    ...getValues(),
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
                placeholder="Название дня (будет автоматически переведено на все языки)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
              <textarea
                {...register(`itinerary.${idx}.description`)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                placeholder="Описание дня (будет автоматически переведено на все языки)"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const currentItinerary = getValues("itinerary") || []
            reset({
              ...getValues(),
              itinerary: [...currentItinerary, { title: "", description: "" }],
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
        {dateFields.map((field, idx) => (
          <div key={field.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-slate-900">Дата {idx + 1}</h3>
              <button
                type="button"
                onClick={() => removeDate(idx)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Дата начала</label>
                <input
                  {...register(`dates.${idx}.startDate`)}
                  type="date"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Дата окончания</label>
                <input
                  {...register(`dates.${idx}.endDate`)}
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
            appendDate({
              startDate: "",
              endDate: "",
              status: "Available" as const,
              price: "",
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
                    placeholder="Включенный пункт (будет автоматически переведено на все языки)"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const currentInclusions = getValues("inclusions") || { included: [], notIncluded: [] }
                      const newIncluded = currentInclusions.included?.filter((_, i) => i !== idx) || []
                      reset({
                        ...getValues(),
                        inclusions: { ...currentInclusions, included: newIncluded },
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
                  const currentInclusions = getValues("inclusions") || { included: [], notIncluded: [] }
                  reset({
                    ...getValues(),
                    inclusions: { ...currentInclusions, included: [...(currentInclusions.included || []), ""] },
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
                    placeholder="Не включенный пункт (будет автоматически переведено на все языки)"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const currentInclusions = getValues("inclusions") || { included: [], notIncluded: [] }
                      const newNotIncluded = currentInclusions.notIncluded?.filter((_, i) => i !== idx) || []
                      reset({
                        ...getValues(),
                        inclusions: { ...currentInclusions, notIncluded: newNotIncluded },
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
                  const currentInclusions = getValues("inclusions") || { included: [], notIncluded: [] }
                  reset({
                    ...getValues(),
                    inclusions: { ...currentInclusions, notIncluded: [...(currentInclusions.notIncluded || []), ""] },
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
