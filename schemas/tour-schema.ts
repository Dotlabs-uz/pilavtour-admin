import { z } from "zod"

const multiLangTextSchema = z.object({
  uz: z.string().max(50, "Max 50 characters"),
  ru: z.string().max(50, "Max 50 characters"),
  en: z.string().max(50, "Max 50 characters"),
  sp: z.string().max(50, "Max 50 characters"),
  uk: z.string().max(50, "Max 50 characters"),
  it: z.string().max(50, "Max 50 characters"),
  ge: z.string().max(50, "Max 50 characters"),
})

export const tourSchema = z.object({
  title: multiLangTextSchema,
  description: multiLangTextSchema.extend({
    uz: z.string().max(1000),
    ru: z.string().max(1000),
    en: z.string().max(1000),
    sp: z.string().max(1000),
    uk: z.string().max(1000),
    it: z.string().max(1000),
    ge: z.string().max(1000),
  }),
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
      title: z.string().max(30),
      description: z.string().max(200),
    }),
  ),
  dates: z.array(
    z.object({
      startDate: z.date(),
      endDate: z.date(),
      status: z.enum(["Available", "Few spots", "Sold out"]),
      price: z.string(),
    }),
  ),
  inclusions: z.object({
    included: z.array(z.string()),
    notIncluded: z.array(z.string()),
  }),
  location: z.string(),
})

export type TourFormData = z.infer<typeof tourSchema>
