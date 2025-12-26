export const LANGUAGES = ["uz", "ru", "en", "sp", "uk", "it", "ge"] as const
export type Language = (typeof LANGUAGES)[number]

export interface MultiLangText {
  uz: string
  ru: string
  en: string
  sp: string
  uk: string
  it: string
  ge: string
}

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  createdAt: Date
  role: "admin" | "user"
}

export interface Tour {
  id: string
  title: MultiLangText
  description: MultiLangText
  price: string
  style: "Premium" | "Econom" | "Standart" | "Lux"
  rating: number
  createdAt: Date
  updatedAt: Date
  duration: {
    days: number
    nights: number
  }
  maxGroupCount?: number
  images: string[]
  itineraryImage?: string
  itinerary: Array<{
    title: MultiLangText
    description: MultiLangText
    accommodation?: MultiLangText[]
    meals?: MultiLangText[]
    includedActivities?: MultiLangText[]
    optionalActivities?: MultiLangText[]
    specialInformation?: MultiLangText
  }>
  dates: Array<{
    startDate: Date
    endDate: Date
    status: "Available" | "Few spots" | "Sold out"
    price: string
  }>
  inclusions: {
    included: MultiLangText[]
    notIncluded: MultiLangText[]
  }
  location: MultiLangText
}

export interface Article {
  id: string
  title: MultiLangText
  description: MultiLangText
  likes: number
  views: number
  createdAt: Date
  updatedAt: Date
  authorId: string
  coverImage?: string
}

export interface Review {
  id: string
  userId: string
  user?: User
  comment: string
  rate: number
  createdAt: Date
  updatedAt: Date
  tourId?: string
  articleId?: string
}

export interface Admin {
  id: string
  email: string
  createdAt: Date
  updatedAt: Date
}

export interface Booking {
  id: string
  userId: string
  user?: User
  tourId: string
  tour?: Tour
  status: "pending" | "confirmed" | "cancelled" | "completed"
  numberOfPeople: number
  totalPrice: string
  bookingDate: Date
  travelDate?: Date
  notes?: string
  createdAt: Date
  updatedAt: Date
}
