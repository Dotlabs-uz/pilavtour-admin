import type { MultiLangText, Language } from "@/types"
import { detectAndTranslate } from "./language-detection"

export async function translateText(text: string, targetLanguages: Language[], detectLanguage: boolean = true): Promise<MultiLangText> {
  if (!text || text.trim().length === 0) {
    return Object.fromEntries(targetLanguages.map((lang) => [lang, ""])) as MultiLangText
  }

  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        targetLanguages,
        detectLanguage,
      }),
    })

    if (!response.ok) throw new Error("Translation failed")
    return await response.json()
  } catch (error) {
    console.error("Translation error:", error)
    // Fallback: return text in all languages
    return Object.fromEntries(targetLanguages.map((lang) => [lang, text])) as MultiLangText
  }
}
