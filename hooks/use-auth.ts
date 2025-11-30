"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/lib/auth-store"
import { getFirebaseServices } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import type { User } from "@/types"

export function useAuth() {
  const { user, isLoading, setUser, setIsLoading } = useAuthStore()

  useEffect(() => {
    const { auth, db } = getFirebaseServices()

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Check if user is admin
        const adminDoc = await getDoc(doc(db!, "admins", firebaseUser.uid))

        if (adminDoc.exists()) {
          const userData: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || "",
            name: firebaseUser.displayName || "",
            avatar: firebaseUser.photoURL || undefined,
            createdAt: firebaseUser.metadata?.creationTime ? new Date(firebaseUser.metadata.creationTime) : new Date(),
            role: "admin",
          }
          setUser(userData)
        } else {
          setUser(null)
        }
      } else {
        setUser(null)
      }
    })

    return unsubscribe
  }, [setUser])

  return { user, isLoading }
}
