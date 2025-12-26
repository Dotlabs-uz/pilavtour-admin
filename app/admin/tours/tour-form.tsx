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
import { Slider } from "@/components/ui/slider"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"

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
    defaultValues: {
      physicalRating: 5,
    },
  })

  const images = watch("images") || []
  const itinerary = watch("itinerary") || []
  const itineraryImage = watch("itineraryImage") || ""
  const inclusions = watch("inclusions") || { included: [], notIncluded: [] }
  const physicalRating = watch("physicalRating") ?? 5

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
            accommodation: item.accommodation?.map((acc: any) => typeof acc === "string" ? acc : acc?.ru || acc?.en || acc?.uz || "") || [],
            meals: item.meals?.map((meal: any) => typeof meal === "string" ? meal : meal?.ru || meal?.en || meal?.uz || "") || [],
            includedActivities: item.includedActivities?.map((act: any) => typeof act === "string" ? act : act?.ru || act?.en || act?.uz || "") || [],
            optionalActivities: item.optionalActivities?.map((act: any) => typeof act === "string" ? act : act?.ru || act?.en || act?.uz || "") || [],
            specialInformation: item.specialInformation?.ru || item.specialInformation?.en || item.specialInformation?.uz || (typeof item.specialInformation === "string" ? item.specialInformation : ""),
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
          name: data.name?.ru || data.name?.en || data.name?.uz || "",
          title: data.title?.ru || data.title?.en || data.title?.uz || "",
          description: data.description?.ru || data.description?.en || data.description?.uz || "",
          price: data.price || "",
          style: data.style || "Standart",
          duration: data.duration || { days: 1, nights: 0 },
          groupSize: typeof data.groupSize === "string" ? data.groupSize : data.groupSize?.ru || data.groupSize?.en || data.groupSize?.uz || "",
          start: data.start || "",
          end: data.end || "",
          theme: typeof data.theme === "string" ? data.theme : data.theme?.ru || data.theme?.en || data.theme?.uz || "",
          physicalRating: data.physicalRating || undefined,
          images: data.images || [],
          itineraryImage: data.itineraryImage || "",
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
      
      // Translate name, title and description to all languages (only if provided)
      const [translatedName, translatedTitle, translatedDescription] = await Promise.all([
        data.name ? translateText(data.name, [...LANGUAGES]) : Promise.resolve(emptyMultiLang),
        data.title ? translateText(data.title, [...LANGUAGES]) : Promise.resolve(emptyMultiLang),
        data.description ? translateText(data.description, [...LANGUAGES]) : Promise.resolve(emptyMultiLang),
      ])

      // Translate itinerary items
      const translatedItinerary = await Promise.all(
        (data.itinerary || []).map(async (item) => {
          const [translatedTitle, translatedDescription, translatedSpecialInfo] = await Promise.all([
            item.title ? translateText(item.title, [...LANGUAGES]) : Promise.resolve(emptyMultiLang),
            item.description ? translateText(item.description, [...LANGUAGES]) : Promise.resolve(emptyMultiLang),
            item.specialInformation ? translateText(item.specialInformation, [...LANGUAGES]) : Promise.resolve(emptyMultiLang),
          ])
          
          // Translate accommodation array
          const translatedAccommodation = await Promise.all(
            (item.accommodation || []).map((acc: string | undefined) => acc ? translateText(acc, [...LANGUAGES]) : Promise.resolve(emptyMultiLang))
          )
          
          // Translate meals array
          const translatedMeals = await Promise.all(
            (item.meals || []).map((meal: string | undefined) => meal ? translateText(meal, [...LANGUAGES]) : Promise.resolve(emptyMultiLang))
          )
          
          // Translate included activities array
          const translatedIncludedActivities = await Promise.all(
            (item.includedActivities || []).map((act: string | undefined) => act ? translateText(act, [...LANGUAGES]) : Promise.resolve(emptyMultiLang))
          )
          
          // Translate optional activities array
          const translatedOptionalActivities = await Promise.all(
            (item.optionalActivities || []).map((act: string | undefined) => act ? translateText(act, [...LANGUAGES]) : Promise.resolve(emptyMultiLang))
          )
          
          return {
            title: translatedTitle,
            description: translatedDescription,
            accommodation: translatedAccommodation,
            meals: translatedMeals,
            includedActivities: translatedIncludedActivities,
            optionalActivities: translatedOptionalActivities,
            specialInformation: translatedSpecialInfo,
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

      // Translate location, theme and groupSize
      const translatedLocation = data.location ? await translateText(data.location, [...LANGUAGES]) : undefined
      const translatedTheme = data.theme ? await translateText(data.theme, [...LANGUAGES]) : undefined
      const translatedGroupSize = data.groupSize ? await translateText(data.groupSize, [...LANGUAGES]) : undefined

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
        name: translatedName,
        title: translatedTitle,
        description: translatedDescription,
        price: data.price || "",
        style: data.style || "Standart",
        duration: data.duration || { days: 1, nights: 0 },
        groupSize: translatedGroupSize,
        start: data.start || "",
        end: data.end || "",
        theme: translatedTheme,
        physicalRating: data.physicalRating,
        images: data.images || [],
        itineraryImage: data.itineraryImage || "",
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
          <label className="block text-sm font-medium text-slate-700 mb-2">Название</label>
          <input
            {...register("name")}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
            placeholder="Введите название (будет автоматически переведено на все языки)"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Заголовок</label>
          <input
            {...register("title")}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
            placeholder="Введите заголовок (будет автоматически переведено на все языки)"
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
            <label className="block text-sm font-medium text-slate-700 mb-2">Размер группы</label>
            <input
              {...register("groupSize")}
              type="text"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Введите размер группы (будет автоматически переведено на все языки)"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Начало</label>
            <input
              {...register("start")}
              type="text"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Введите начало"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Конец</label>
            <input
              {...register("end")}
              type="text"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Введите конец"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Тема</label>
            <select
              {...register("theme")}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Выберите тему</option>
              <option value="8 to 35s">8 to 35s</option>
              <option value="Multi-active">Multi-active</option>
              <option value="Camping">Camping</option>
              <option value="Explorer">Explorer</option>
              <option value="Family">Family</option>
              <option value="Festivals">Festivals</option>
              <option value="Food">Food</option>
              <option value="Women's Expeditions">Women's Expeditions</option>
              <option value="Religious Tours">Religious Tours</option>
            </select>
            {errors.theme && <p className="text-red-500 text-xs mt-1">{errors.theme.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Физическая оценка (1-5): {physicalRating}</label>
            <Slider
              value={[physicalRating]}
              onValueChange={(values) => setValue("physicalRating", values[0], { shouldValidate: true })}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
            {errors.physicalRating && <p className="text-red-500 text-xs mt-1">{errors.physicalRating.message}</p>}
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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Маршрут</h2>
          <button
            type="button"
            onClick={() => {
              const currentItinerary = getValues("itinerary") || []
              reset({
                ...getValues(),
                itinerary: [...currentItinerary, { 
                  title: "", 
                  description: "",
                  accommodation: [],
                  meals: [],
                  includedActivities: [],
                  optionalActivities: [],
                  specialInformation: "",
                }],
              })
            }}
            className="flex items-center gap-2 text-accent hover:text-orange-600 text-sm"
          >
            <Plus className="w-4 h-4" />
            Добавить день
          </button>
        </div>

        {/* Itinerary Image Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Изображение маршрута</label>
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4">
            {itineraryImage ? (
              <div className="relative group">
                <img
                  src={itineraryImage}
                  alt="Itinerary"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    reset({
                      ...getValues(),
                      itineraryImage: "",
                    })
                  }}
                  className="absolute inset-0 bg-black bg-opacity-50 rounded-lg opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                >
                  <Trash2 className="w-5 h-5 text-white" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    
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
                              reject(new Error("Пользователь не авторизован"))
                            }
                          })
                        })
                      }
                      
                      if (auth?.currentUser) {
                        await auth.currentUser.getIdToken(true)
                      }
                      
                      const storageRef = ref(storage!, `tours/${tourId || "new"}/itinerary/${Date.now()}-${file.name}`)
                      await uploadBytes(storageRef, file)
                      const url = await getDownloadURL(storageRef)
                      
                      reset({
                        ...getValues(),
                        itineraryImage: url,
                      })
                    } catch (error: any) {
                      console.error("Error uploading image:", error)
                      alert(error.message || "Не удалось загрузить изображение")
                    } finally {
                      setUploadingImages(false)
                    }
                  }}
                  disabled={uploadingImages}
                  className="hidden"
                  id="itinerary-image"
                />
                <label 
                  htmlFor="itinerary-image"
                  className="cursor-pointer flex flex-col items-center gap-2 text-slate-600"
                >
                  <div>{uploadingImages ? "Загрузка..." : "Нажмите, чтобы загрузить изображение маршрута"}</div>
                </label>
              </div>
            )}
          </div>
        </div>
        
        <Accordion type="multiple" className="space-y-2">
          {itinerary.map((item, idx) => {
            const dayTitle = watch(`itinerary.${idx}.title`) || ""
            const dayAccommodation = watch(`itinerary.${idx}.accommodation`) || []
            const dayMeals = watch(`itinerary.${idx}.meals`) || []
            const dayIncludedActivities = watch(`itinerary.${idx}.includedActivities`) || []
            const dayOptionalActivities = watch(`itinerary.${idx}.optionalActivities`) || []
            
            return (
              <AccordionItem key={idx} value={`day-${idx}`} className="border border-slate-200 rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="font-semibold text-slate-900">День {idx + 1}</span>
                    {dayTitle && <span className="text-slate-600">- {dayTitle}</span>}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  {/* Day Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Название дня (будет автоматически переведено на все языки)
                    </label>
                    <input
                      {...register(`itinerary.${idx}.title`)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                      placeholder="Введите название дня"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Описание (будет автоматически переведено на все языки)
                    </label>
                    <textarea
                      {...register(`itinerary.${idx}.description`)}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                      placeholder="Введите описание дня"
                    />
                  </div>

                  {/* Accommodation */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Размещение</label>
                    <div className="space-y-2">
                      {dayAccommodation.map((_, accIdx) => (
                        <div key={accIdx} className="flex items-center gap-2">
                          <input
                            {...register(`itinerary.${idx}.accommodation.${accIdx}`)}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                            placeholder="Размещение (будет автоматически переведено на все языки)"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const currentItinerary = getValues("itinerary") || []
                              const newAccommodation = (currentItinerary[idx]?.accommodation || []).filter((_, i) => i !== accIdx)
                              reset({
                                ...getValues(),
                                itinerary: currentItinerary.map((it, i) => 
                                  i === idx ? { ...it, accommodation: newAccommodation } : it
                                ),
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
                          const currentItinerary = getValues("itinerary") || []
                          const newAccommodation = [...(currentItinerary[idx]?.accommodation || []), ""]
                          reset({
                            ...getValues(),
                            itinerary: currentItinerary.map((it, i) => 
                              i === idx ? { ...it, accommodation: newAccommodation } : it
                            ),
                          })
                        }}
                        className="flex items-center gap-2 text-sm text-accent hover:text-orange-600"
                      >
                        <Plus className="w-4 h-4" />
                        Добавить размещение
                      </button>
                    </div>
                  </div>

                  {/* Meals */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Питание</label>
                    <div className="space-y-2">
                      {dayMeals.map((_, mealIdx) => (
                        <div key={mealIdx} className="flex items-center gap-2">
                          <input
                            {...register(`itinerary.${idx}.meals.${mealIdx}`)}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                            placeholder="Питание (будет автоматически переведено на все языки)"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const currentItinerary = getValues("itinerary") || []
                              const newMeals = (currentItinerary[idx]?.meals || []).filter((_, i) => i !== mealIdx)
                              reset({
                                ...getValues(),
                                itinerary: currentItinerary.map((it, i) => 
                                  i === idx ? { ...it, meals: newMeals } : it
                                ),
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
                          const currentItinerary = getValues("itinerary") || []
                          const newMeals = [...(currentItinerary[idx]?.meals || []), ""]
                          reset({
                            ...getValues(),
                            itinerary: currentItinerary.map((it, i) => 
                              i === idx ? { ...it, meals: newMeals } : it
                            ),
                          })
                        }}
                        className="flex items-center gap-2 text-sm text-accent hover:text-orange-600"
                      >
                        <Plus className="w-4 h-4" />
                        Добавить питание
                      </button>
                    </div>
                  </div>

                  {/* Included Activities */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Включенные активности</label>
                    <div className="space-y-2">
                      {dayIncludedActivities.map((_, actIdx) => (
                        <div key={actIdx} className="flex items-center gap-2">
                          <input
                            {...register(`itinerary.${idx}.includedActivities.${actIdx}`)}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                            placeholder="Включенная активность (будет автоматически переведено на все языки)"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const currentItinerary = getValues("itinerary") || []
                              const newActivities = (currentItinerary[idx]?.includedActivities || []).filter((_, i) => i !== actIdx)
                              reset({
                                ...getValues(),
                                itinerary: currentItinerary.map((it, i) => 
                                  i === idx ? { ...it, includedActivities: newActivities } : it
                                ),
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
                          const currentItinerary = getValues("itinerary") || []
                          const newActivities = [...(currentItinerary[idx]?.includedActivities || []), ""]
                          reset({
                            ...getValues(),
                            itinerary: currentItinerary.map((it, i) => 
                              i === idx ? { ...it, includedActivities: newActivities } : it
                            ),
                          })
                        }}
                        className="flex items-center gap-2 text-sm text-accent hover:text-orange-600"
                      >
                        <Plus className="w-4 h-4" />
                        Добавить включенную активность
                      </button>
                    </div>
                  </div>

                  {/* Optional Activities */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Опциональные активности</label>
                    <div className="space-y-2">
                      {dayOptionalActivities.map((_, actIdx) => (
                        <div key={actIdx} className="flex items-center gap-2">
                          <input
                            {...register(`itinerary.${idx}.optionalActivities.${actIdx}`)}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                            placeholder="Опциональная активность (будет автоматически переведено на все языки)"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const currentItinerary = getValues("itinerary") || []
                              const newActivities = (currentItinerary[idx]?.optionalActivities || []).filter((_, i) => i !== actIdx)
                              reset({
                                ...getValues(),
                                itinerary: currentItinerary.map((it, i) => 
                                  i === idx ? { ...it, optionalActivities: newActivities } : it
                                ),
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
                          const currentItinerary = getValues("itinerary") || []
                          const newActivities = [...(currentItinerary[idx]?.optionalActivities || []), ""]
                          reset({
                            ...getValues(),
                            itinerary: currentItinerary.map((it, i) => 
                              i === idx ? { ...it, optionalActivities: newActivities } : it
                            ),
                          })
                        }}
                        className="flex items-center gap-2 text-sm text-accent hover:text-orange-600"
                      >
                        <Plus className="w-4 h-4" />
                        Добавить опциональную активность
                      </button>
                    </div>
                  </div>

                  {/* Special Information */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Особая информация (будет автоматически переведено на все языки)
                    </label>
                    <textarea
                      {...register(`itinerary.${idx}.specialInformation`)}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                      placeholder="Введите особую информацию для этого дня"
                    />
                  </div>

                  {/* Delete Day Button */}
                  <div className="pt-2 border-t border-slate-200">
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
                      className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Удалить день
                    </button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
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
          disabled={isSubmitting}
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
