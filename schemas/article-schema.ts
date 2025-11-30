import { z } from "zod"

const multiLangTextSchema = z.object({
  uz: z.string().min(1),
  ru: z.string().min(1),
  en: z.string().min(1),
  sp: z.string().min(1),
  uk: z.string().min(1),
  it: z.string().min(1),
  ge: z.string().min(1),
})

export const articleSchema = z.object({
  title: multiLangTextSchema,
  description: multiLangTextSchema,
  coverImage: z.string().optional(),
})

export type ArticleFormData = z.infer<typeof articleSchema>
