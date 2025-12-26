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

// Server-side HTML entity decoder (for API route)
// Decodes common HTML entities returned by Google Translate API
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "'") // Right single quotation mark
    .replace(/&#8216;/g, "'") // Left single quotation mark
    .replace(/&#8220;/g, '"') // Left double quotation mark
    .replace(/&#8221;/g, '"') // Right double quotation mark
}

export async function POST(req: NextRequest) {
  try {
    const { text, targetLanguages, detectLanguage } = await req.json()

    if (!text || !targetLanguages) {
      return NextResponse.json({ error: "Text and target languages are required" }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Google Translate API key not configured" }, { status: 500 })
    }

    let sourceLanguage: string | undefined = undefined

    // Detect language if requested
    if (detectLanguage) {
      try {
        const detectResponse = await fetch(
          `https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              q: text,
            }),
          },
        )

        if (detectResponse.ok) {
          const detectResult = await detectResponse.json()
          sourceLanguage = detectResult.data.detections[0][0].language
        }
      } catch (error) {
        console.error("Language detection error:", error)
        // Continue without source language - Google will auto-detect
      }
    }

    const translations: Record<Language, string> = {} as Record<Language, string>

    // Translate to all target languages
    const translationPromises = targetLanguages.map(async (lang: Language): Promise<{ lang: Language; text: string }> => {
      try {
        const targetCode = LANGUAGE_CODES[lang]
        const requestBody: any = {
          q: text,
          target: targetCode,
        }
        
        // Add source language if detected
        if (sourceLanguage) {
          requestBody.source = sourceLanguage
        }

        const response = await fetch(
          `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          },
        )

        if (!response.ok) {
          console.error(`Translation failed for ${lang}`)
          return { lang, text } as { lang: Language; text: string } // Fallback to original text
        }

        const result = await response.json()
        const translatedText = result.data.translations[0].translatedText
        // Decode HTML entities (e.g., &#39; -> ')
        const decodedText = decodeHtmlEntities(translatedText)
        return {
          lang,
          text: decodedText,
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
