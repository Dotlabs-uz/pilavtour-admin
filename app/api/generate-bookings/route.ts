import { NextResponse } from "next/server"
import { getFirebaseServices } from "@/lib/firebase"
import { collection, getDocs, addDoc, Timestamp } from "firebase/firestore"

const statuses: ("pending" | "confirmed" | "cancelled" | "completed")[] = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
]

const notes = [
  "Хочу забронировать номер с видом на море",
  "Нужна помощь с визой",
  "Предпочитаю утренние рейсы",
  "Вегетарианское питание",
  "Путешествую с детьми",
  "Нужен трансфер из аэропорта",
  "Особые требования к размещению",
  "",
  "",
  "",
]

export async function POST() {
  try {
    const { db } = getFirebaseServices()

    console.log("Fetching users and tours...")

    // Fetch users
    const usersSnapshot = await getDocs(collection(db!, "users"))
    const users = usersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    if (users.length === 0) {
      return NextResponse.json(
        { error: "No users found in the database. Please create some users first." },
        { status: 400 }
      )
    }

    // Fetch tours
    const toursSnapshot = await getDocs(collection(db!, "tours"))
    const tours = toursSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<{ id: string; price?: string | number }>

    if (tours.length === 0) {
      return NextResponse.json(
        { error: "No tours found in the database. Please create some tours first." },
        { status: 400 }
      )
    }

    console.log(`Found ${users.length} users and ${tours.length} tours`)

    // Generate 15 bookings
    const bookingsToCreate = 15
    const bookings = []

    for (let i = 0; i < bookingsToCreate; i++) {
      // Random user and tour
      const randomUser = users[Math.floor(Math.random() * users.length)]
      const randomTour = tours[Math.floor(Math.random() * tours.length)]
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)]
      const randomNote = notes[Math.floor(Math.random() * notes.length)]
      const numberOfPeople = Math.floor(Math.random() * 5) + 1 // 1-5 people

      // Get tour price and calculate total
      const priceStr = randomTour.price?.toString() || "0"
      const tourPrice = parseFloat(priceStr) || 100
      const totalPrice = (tourPrice * numberOfPeople).toFixed(2)

      // Random dates
      const now = new Date()
      const bookingDate = new Date(
        now.getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000 // Random date within last 90 days
      )
      const travelDate = new Date(
        bookingDate.getTime() + Math.random() * 60 * 24 * 60 * 60 * 1000 // Travel date 0-60 days after booking
      )

      const createdAt = bookingDate
      const updatedAt = bookingDate

      const booking = {
        userId: randomUser.id,
        tourId: randomTour.id,
        status: randomStatus,
        numberOfPeople,
        totalPrice: `${totalPrice} USD`,
        bookingDate: Timestamp.fromDate(bookingDate),
        travelDate: Timestamp.fromDate(travelDate),
        notes: randomNote || undefined,
        createdAt: Timestamp.fromDate(createdAt),
        updatedAt: Timestamp.fromDate(updatedAt),
      }

      bookings.push(booking)
    }

    console.log(`Creating ${bookings.length} bookings...`)

    // Create bookings in Firestore
    const createdBookings = []
    for (const booking of bookings) {
      const docRef = await addDoc(collection(db!, "bookings"), booking)
      createdBookings.push({
        id: docRef.id,
        ...booking,
      })
      console.log(`Created booking for user ${booking.userId} and tour ${booking.tourId}`)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdBookings.length} bookings`,
      bookings: createdBookings,
    })
  } catch (error: any) {
    console.error("Error generating bookings:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate bookings" },
      { status: 500 }
    )
  }
}
