import { z } from "zod"

export const articleSchema = z.object({
  title: z.string(),
  description: z.string(),
  coverImage: z.string().optional(),
})

export type ArticleFormData = z.infer<typeof articleSchema>
