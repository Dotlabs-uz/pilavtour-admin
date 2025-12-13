import { type NextRequest, NextResponse } from "next/server"
import type { Language } from "@/types"

const LANGUAGE_CODES: Record<Language, string> = {
  uz: "uz",
  ru: "ru",
  en: "en",
  sp: "es", // Spanish
  uk: "uk",
  it: "it",
  ge: "de", // German (internal key: ge, Google Translate API code: de)
}

export async function POST(req: NextRequest) {
  try {
    const { text, targetLanguages } = await req.json()

    if (!text || !targetLanguages) {
      return NextResponse.json({ error: "Text and target languages are required" }, { status: 400 })
    }

    const translations: Record<Language, string> = {} as Record<Language, string>

    // Translate to all target languages
    const translationPromises = targetLanguages.map(async (lang: Language): Promise<{ lang: Language; text: string }> => {
      try {
        const targetCode = LANGUAGE_CODES[lang]
        const response = await fetch(
          `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              q: text,
              target: targetCode,
            }),
          },
        )

        if (!response.ok) {
          console.error(`Translation failed for ${lang}`)
          return { lang, text } as { lang: Language; text: string } // Fallback to original text
        }

        const result = await response.json()
        return {
          lang,
          text: result.data.translations[0].translatedText,
        } as { lang: Language; text: string }
      } catch (error) {
        console.error(`Error translating to ${lang}:`, error)
        return { lang, text } as { lang: Language; text: string } // Fallback to original text
      }
    })

    const results: Array<{ lang: Language; text: string }> = await Promise.all(translationPromises)
    results.forEach((result) => {
      translations[result.lang] = result.text
    })

    return NextResponse.json(translations)
  } catch (error) {
    console.error("Translation error:", error)
    return NextResponse.json({ error: "Translation failed" }, { status: 500 })
  }
}
