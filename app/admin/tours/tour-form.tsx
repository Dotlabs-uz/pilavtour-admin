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
import { Trash2 } from "lucide-react"

interface TourFormProps {
  tourId?: string
}

export function TourForm({ tourId }: TourFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(!!tourId)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<TourFormData>({
    resolver: zodResolver(tourSchema),
  })

  const images = watch("images") || []
  const itinerary = watch("itinerary") || []
  const dates = watch("dates") || []

  useEffect(() => {
    if (tourId) {
      loadTour()
    }
  }, [tourId])

  const loadTour = async () => {
    try {
      const { db } = getFirebaseServices()
      const tourDoc = await getDoc(doc(db, "tours", tourId!))

      if (tourDoc.exists()) {
        reset(tourDoc.data() as any)
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
      const { storage } = getFirebaseServices()
      const uploadedUrls: string[] = []

      for (const file of Array.from(files)) {
        const storageRef = ref(storage, `tours/${tourId || "new"}/${Date.now()}-${file.name}`)
        await uploadBytes(storageRef, file)
        const url = await getDownloadURL(storageRef)
        uploadedUrls.push(url)
      }

      // Add to images array
      const currentImages = watch("images") || []
      reset({
        ...watch(),
        images: [...currentImages, ...uploadedUrls],
      })
    } catch (error) {
      console.error("Error uploading images:", error)
      alert("Failed to upload images")
    } finally {
      setUploadingImages(false)
    }
  }

  const onSubmit = async (data: TourFormData) => {
    setIsSaving(true)
    try {
      const { db } = getFirebaseServices()
      const tourData = {
        ...data,
        createdAt: tourId ? undefined : serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      if (tourId) {
        await updateDoc(doc(db, "tours", tourId), tourData)
      } else {
        const newDocRef = doc(collection(db, "tours"))
        await setDoc(newDocRef, tourData)
      }

      router.push("/admin/tours")
    } catch (error) {
      console.error("Error saving tour:", error)
      alert("Failed to save tour")
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Title Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Title (7 Languages)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LANGUAGES.map((lang) => (
            <div key={lang}>
              <label className="block text-sm font-medium text-slate-700 mb-2 uppercase">{lang}</label>
              <input
                {...register(`title.${lang as keyof MultiLangText}`)}
                maxLength={50}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                placeholder={`Title in ${lang}`}
              />
              {errors.title?.[lang as keyof MultiLangText] && (
                <p className="text-red-500 text-xs mt-1">{errors.title[lang as keyof MultiLangText]?.message}</p>
              )}
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
                maxLength={1000}
                rows={4}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                placeholder={`Description in ${lang}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Price</label>
            <input
              {...register("price")}
              type="text"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="e.g., 500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Style</label>
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
            <label className="block text-sm font-medium text-slate-700 mb-2">Duration Days</label>
            <input
              {...register("duration.days", { valueAsNumber: true })}
              type="number"
              min="1"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Duration Nights</label>
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
            <label className="block text-sm font-medium text-slate-700 mb-2">Max Group Count (Optional)</label>
            <input
              {...register("maxGroupCount", { valueAsNumber: true })}
              type="number"
              min="1"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
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
        <h2 className="text-lg font-semibold text-slate-900">Images</h2>
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
            <div className="text-slate-600">{uploadingImages ? "Uploading..." : "Click to upload images"}</div>
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

      {/* Submit */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSaving}
          className="flex-1 bg-accent text-white py-3 rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
        >
          {isSaving ? "Saving..." : tourId ? "Update Tour" : "Create Tour"}
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
