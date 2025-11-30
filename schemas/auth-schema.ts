import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Неверный адрес электронной почты"),
  password: z.string().min(6, "Пароль должен содержать не менее 6 символов"),
})

export type LoginFormData = z.infer<typeof loginSchema>
