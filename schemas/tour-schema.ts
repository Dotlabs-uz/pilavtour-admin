import { z } from "zod"

// Helper to convert string dates to Date objects
const dateStringToDate = z.string().transform((str) => {
  if (!str) return null
  const date = new Date(str)
  return isNaN(date.getTime()) ? null : date
})

export const tourSchema = z.object({
  name: z.string().optional().or(z.literal("")),
  title: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  price: z.string().optional().or(z.literal("")),
  style: z.enum(["Premium", "Econom", "Standart", "Lux"]).optional(),
  duration: z.object({
    days: z.number().positive().optional(),
    nights: z.number().positive().optional(),
  }).optional(),
  groupSize: z.string().optional().or(z.literal("")),
  start: z.string().optional().or(z.literal("")),
  end: z.string().optional().or(z.literal("")),
  theme: z.enum(["8 to 35s", "Multi-active", "Camping", "Explorer", "Family", "Festivals", "Food", "Women's Expeditions", "Religious Tours"]).optional(),
  physicalRating: z.number().min(1).max(5).optional(),
  images: z.array(z.string()).optional(),
  itinerary: z.array(
    z.object({
      title: z.string().optional().or(z.literal("")),
      description: z.string().optional().or(z.literal("")),
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
