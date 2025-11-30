import type { MultiLangText, Language } from "@/types"

export async function translateText(text: string, targetLanguages: Language[]): Promise<MultiLangText> {
  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        targetLanguages,
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
