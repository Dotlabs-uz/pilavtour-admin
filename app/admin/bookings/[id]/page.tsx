"use client"

import { AdminLayout } from "@/components/admin-layout"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { getFirebaseServices } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import type { Booking, User, Tour } from "@/types"
import { ArrowLeft } from "lucide-react"

export default function BookingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const bookingId = params.id as string
  const [booking, setBooking] = useState<Booking | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadBooking()
  }, [bookingId])

  const loadBooking = async () => {
    setIsLoading(true)
    try {
      const { db } = getFirebaseServices()
      const bookingDoc = await getDoc(doc(db!, "bookings", bookingId))

      if (!bookingDoc.exists()) {
        alert("Бронирование не найдено")
        router.push("/admin/bookings")
        return
      }

      const data = bookingDoc.data()
      let user: User | undefined
      let tour: Tour | undefined

      // Fetch user data
      if (data.userId) {
        try {
          const userDoc = await getDoc(doc(db!, "users", data.userId))
          if (userDoc.exists()) {
            user = {
              id: userDoc.id,
              ...userDoc.data(),
              createdAt: userDoc.data().createdAt?.toDate?.() || new Date(),
            } as User
          }
        } catch (error) {
          console.error("Error fetching user:", error)
        }
      }

      // Fetch tour data
      if (data.tourId) {
        try {
          const tourDoc = await getDoc(doc(db!, "tours", data.tourId))
          if (tourDoc.exists()) {
            tour = {
              id: tourDoc.id,
              ...tourDoc.data(),
              createdAt: tourDoc.data().createdAt?.toDate?.() || new Date(),
              updatedAt: tourDoc.data().updatedAt?.toDate?.() || new Date(),
            } as Tour
          }
        } catch (error) {
          console.error("Error fetching tour:", error)
        }
      }

      setBooking({
        id: bookingDoc.id,
        ...data,
        bookingDate: data.bookingDate?.toDate?.() || new Date(),
        travelDate: data.travelDate?.toDate?.() || undefined,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
        user,
        tour,
      } as Booking)
    } catch (error) {
      console.error("Error loading booking:", error)
      alert("Ошибка загрузки бронирования")
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "completed":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-slate-100 text-slate-800"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Подтверждено"
      case "pending":
        return "В ожидании"
      case "cancelled":
        return "Отменено"
      case "completed":
        return "Завершено"
      default:
        return status
    }
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      </AdminLayout>
    )
  }

  if (!booking) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-slate-500">Бронирование не найдено</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/admin/bookings")}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Детали бронирования</h1>
            <p className="text-slate-500 mt-1">Информация о бронировании и пользователе</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Booking Information */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Информация о бронировании</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600">ID бронирования</label>
                <p className="text-slate-900 mt-1">{booking.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">Статус</label>
                <p className="mt-1">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${getStatusColor(booking.status)}`}>
                    {getStatusText(booking.status)}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">Количество человек</label>
                <p className="text-slate-900 mt-1">{booking.numberOfPeople}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">Общая цена</label>
                <p className="text-slate-900 mt-1 font-semibold">{booking.totalPrice}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">Дата бронирования</label>
                <p className="text-slate-900 mt-1">
                  {booking.bookingDate.toLocaleDateString("ru-RU", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {booking.travelDate && (
                <div>
                  <label className="text-sm font-medium text-slate-600">Дата поездки</label>
                  <p className="text-slate-900 mt-1">
                    {booking.travelDate.toLocaleDateString("ru-RU", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              )}
              {booking.notes && (
                <div>
                  <label className="text-sm font-medium text-slate-600">Примечания</label>
                  <p className="text-slate-900 mt-1">{booking.notes}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-slate-600">Дата создания</label>
                <p className="text-slate-900 mt-1">
                  {booking.createdAt.toLocaleDateString("ru-RU", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* User Information */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Информация о пользователе</h2>
            {booking.user ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {booking.user.avatar ? (
                    <img
                      src={booking.user.avatar}
                      alt={booking.user.name}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-slate-200 flex items-center justify-center text-xl font-semibold text-slate-600">
                      {booking.user.name?.charAt(0).toUpperCase() || "?"}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{booking.user.name}</h3>
                    <p className="text-slate-600">{booking.user.email}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">ID пользователя</label>
                  <p className="text-slate-900 mt-1">{booking.user.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Роль</label>
                  <p className="text-slate-900 mt-1 capitalize">{booking.user.role}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Дата регистрации</label>
                  <p className="text-slate-900 mt-1">
                    {booking.user.createdAt.toLocaleDateString("ru-RU", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500">Информация о пользователе не найдена</p>
            )}
          </div>

          {/* Tour Information */}
          {booking.tour && (
            <div className="bg-white rounded-lg border border-slate-200 p-6 lg:col-span-2">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Информация о туре</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-600">Название тура</label>
                  <p className="text-slate-900 mt-1">{booking.tour.title?.ru || booking.tour.title?.uz || "Название не указано"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">ID тура</label>
                  <p className="text-slate-900 mt-1">{booking.tour.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Стиль</label>
                  <p className="text-slate-900 mt-1">{booking.tour.style}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Цена</label>
                  <p className="text-slate-900 mt-1 font-semibold">{booking.tour.price}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Длительность</label>
                  <p className="text-slate-900 mt-1">
                    {booking.tour.duration.days} дней / {booking.tour.duration.nights} ночей
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600">Рейтинг</label>
                  <p className="text-slate-900 mt-1">{booking.tour.rating}</p>
                </div>
                {booking.tour.location && (
                  <div>
                    <label className="text-sm font-medium text-slate-600">Местоположение</label>
                    <p className="text-slate-900 mt-1">{booking.tour.location.ru || booking.tour.location.uz}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
