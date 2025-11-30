import { type NextRequest, NextResponse } from "next/server"
import type { Language } from "@/types"

export async function POST(req: NextRequest) {
  try {
    const { text, targetLanguages } = await req.json()

    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: text,
          target: "en",
        }),
      },
    )

    if (!response.ok) throw new Error("Translation failed")

    const result = await response.json()
    const baseText = result.data.translations[0].translatedText

    const translations: Record<Language, string> = {
      en: baseText,
      uz: text,
      ru: text,
      sp: text,
      uk: text,
      it: text,
      ge: text,
    }

    // TODO: Implement actual translation for all languages
    return NextResponse.json(translations)
  } catch (error) {
    return NextResponse.json({ error: "Translation failed" }, { status: 500 })
  }
}
