import { z } from "zod"

// Helper to convert string dates to Date objects
const dateStringToDate = z.string().transform((str) => {
  if (!str) return null
  const date = new Date(str)
  return isNaN(date.getTime()) ? null : date
})

export const tourSchema = z.object({
  title: z.string().max(200, "Максимум 200 символов").optional().or(z.literal("")),
  description: z.string().max(5000, "Максимум 5000 символов").optional().or(z.literal("")),
  price: z.string().optional().or(z.literal("")),
  style: z.enum(["Premium", "Econom", "Standart", "Lux"]).optional(),
  duration: z.object({
    days: z.number().positive().optional(),
    nights: z.number().positive().optional(),
  }).optional(),
  maxGroupCount: z.number().positive().optional(),
  images: z.array(z.string()).optional(),
  itinerary: z.array(
    z.object({
      title: z.string().max(100, "Максимум 100 символов").optional().or(z.literal("")),
      description: z.string().max(500, "Максимум 500 символов").optional().or(z.literal("")),
    }),
  ).optional(),
  dates: z.array(
    z.object({
      startDate: z.union([z.date(), z.string()]).optional(),
      endDate: z.union([z.date(), z.string()]).optional(),
      status: z.enum(["Available", "Few spots", "Sold out"]).optional(),
      price: z.string().optional().or(z.literal("")),
    }),
  ).optional(),
  inclusions: z.object({
    included: z.array(z.string().optional().or(z.literal(""))).optional(),
    notIncluded: z.array(z.string().optional().or(z.literal(""))).optional(),
  }).optional(),
  location: z.string().optional().or(z.literal("")),
})

export type TourFormData = z.infer<typeof tourSchema>
