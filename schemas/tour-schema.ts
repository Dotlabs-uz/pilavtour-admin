import { z } from "zod"

export const tourSchema = z.object({
  title: z.string().min(1, "Название обязательно").max(200, "Максимум 200 символов"),
  description: z.string().min(1, "Описание обязательно").max(5000, "Максимум 5000 символов"),
  price: z.string(),
  style: z.enum(["Premium", "Econom", "Standart", "Lux"]),
  duration: z.object({
    days: z.number().positive(),
    nights: z.number().positive(),
  }),
  maxGroupCount: z.number().positive().optional(),
  images: z.array(z.string()).min(1, "At least one image required"),
  itinerary: z.array(
    z.object({
      title: z.string().min(1, "Название обязательно").max(100, "Максимум 100 символов"),
      description: z.string().min(1, "Описание обязательно").max(500, "Максимум 500 символов"),
    }),
  ).optional(),
  dates: z.array(
    z.object({
      startDate: z.date(),
      endDate: z.date(),
      status: z.enum(["Available", "Few spots", "Sold out"]),
      price: z.string(),
    }),
  ).optional(),
  inclusions: z.object({
    included: z.array(z.string()),
    notIncluded: z.array(z.string()),
  }).optional(),
  location: z.string(),
})

export type TourFormData = z.infer<typeof tourSchema>
