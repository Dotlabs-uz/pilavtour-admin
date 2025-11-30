import { z } from "zod"

export const articleSchema = z.object({
  title: z.string().min(1, "Название обязательно"),
  description: z.string().min(1, "Описание обязательно"),
  coverImage: z.string().optional(),
})

export type ArticleFormData = z.infer<typeof articleSchema>
