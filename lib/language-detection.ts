import type { Language, MultiLangText } from "@/types"
import { LANGUAGES } from "@/types"

/**
 * Detects the language of the input text and translates it to all 7 languages
 * @param text - The text to detect and translate
 * @returns Promise<MultiLangText> - Object with translations in all languages
 */
export async function detectAndTranslate(text: string): Promise<MultiLangText> {
  if (!text || text.trim().length === 0) {
    // Return empty strings for all languages if text is empty
    return Object.fromEntries(LANGUAGES.map((lang) => [lang, ""])) as MultiLangText
  }

  try {
    // Detect language using Google Translate API
    const detectResponse = await fetch(
      `https://translation.googleapis.com/language/translate/v2/detect?key=${process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_API_KEY || process.env.GOOGLE_TRANSLATE_API_KEY}`,
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

    if (!detectResponse.ok) {
      throw new Error("Language detection failed")
    }

    const detectResult = await detectResponse.json()
    const detectedLanguage = detectResult.data.detections[0][0].language

    // Map Google language codes to our Language type
    const languageMap: Record<string, Language> = {
      uz: "uz",
      ru: "ru",
      en: "en",
      es: "sp", // Spanish
      uk: "uk",
      it: "it",
      de: "ge", // German
    }

    // If detected language is already one of our target languages, use it
    // Otherwise, translate from detected language to all target languages
    const sourceLanguage = languageMap[detectedLanguage] || detectedLanguage

    // Translate to all target languages
    const translations: Record<Language, string> = {} as Record<Language, string>

    const LANGUAGE_CODES: Record<Language, string> = {
      uz: "uz",
      ru: "ru",
      en: "en",
      sp: "es",
      uk: "uk",
      it: "it",
      ge: "de",
    }

    // Translate to all languages
    const translationPromises = LANGUAGES.map(async (lang: Language): Promise<{ lang: Language; text: string }> => {
      try {
        // If source language matches target, return original text
        if (sourceLanguage === lang) {
          return { lang, text }
        }

        const targetCode = LANGUAGE_CODES[lang]
        const response = await fetch(
          `https://translation.googleapis.com/language/translate/v2?key=${process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_API_KEY || process.env.GOOGLE_TRANSLATE_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              q: text,
              source: detectedLanguage,
              target: targetCode,
            }),
          },
        )

        if (!response.ok) {
          console.error(`Translation failed for ${lang}`)
          return { lang, text } // Fallback to original text
        }

        const result = await response.json()
        return {
          lang,
          text: result.data.translations[0].translatedText,
        }
      } catch (error) {
        console.error(`Error translating to ${lang}:`, error)
        return { lang, text } // Fallback to original text
      }
    })

    const results = await Promise.all(translationPromises)
    results.forEach((result) => {
      translations[result.lang] = result.text
    })

    return translations as MultiLangText
  } catch (error) {
    console.error("Language detection/translation error:", error)
    // Fallback: return text in all languages (assuming it's already in one of them)
    return Object.fromEntries(LANGUAGES.map((lang) => [lang, text])) as MultiLangText
  }
}
