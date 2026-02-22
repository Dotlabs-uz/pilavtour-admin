module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/app/api/translate/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
;
const LANGUAGE_CODES = {
    uz: "uz",
    ru: "ru",
    en: "en",
    sp: "es",
    uk: "uk",
    it: "it",
    ge: "de"
};
// Server-side HTML entity decoder (for API route)
// Decodes common HTML entities returned by Google Translate API
function decodeHtmlEntities(text) {
    return text.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&#x2F;/g, "/").replace(/&nbsp;/g, " ").replace(/&#8217;/g, "'") // Right single quotation mark
    .replace(/&#8216;/g, "'") // Left single quotation mark
    .replace(/&#8220;/g, '"') // Left double quotation mark
    .replace(/&#8221;/g, '"') // Right double quotation mark
    ;
}
async function POST(req) {
    try {
        const { text, targetLanguages, detectLanguage } = await req.json();
        if (!text || !targetLanguages) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "Text and target languages are required"
            }, {
                status: 400
            });
        }
        const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_API_KEY;
        if (!apiKey) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "Google Translate API key not configured"
            }, {
                status: 500
            });
        }
        let sourceLanguage = undefined;
        // Detect language if requested
        if (detectLanguage) {
            try {
                const detectResponse = await fetch(`https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        q: text
                    })
                });
                if (detectResponse.ok) {
                    const detectResult = await detectResponse.json();
                    sourceLanguage = detectResult.data.detections[0][0].language;
                }
            } catch (error) {
                console.error("Language detection error:", error);
            // Continue without source language - Google will auto-detect
            }
        }
        const translations = {};
        // Translate to all target languages
        const translationPromises = targetLanguages.map(async (lang)=>{
            try {
                const targetCode = LANGUAGE_CODES[lang];
                const requestBody = {
                    q: text,
                    target: targetCode
                };
                // Add source language if detected      
                if (sourceLanguage) {
                    requestBody.source = sourceLanguage;
                }
                const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(requestBody)
                });
                if (!response.ok) {
                    console.error(`Translation failed for ${lang}`);
                    return {
                        lang,
                        text
                    }; // Fallback to original text
                }
                const result = await response.json();
                const translatedText = result.data.translations[0].translatedText;
                // Decode HTML entities (e.g., &#39; -> ')
                const decodedText = decodeHtmlEntities(translatedText);
                return {
                    lang,
                    text: decodedText
                };
            } catch (error) {
                console.error(`Error translating to ${lang}:`, error);
                return {
                    lang,
                    text
                }; // Fallback to original text
            }
        });
        const results = await Promise.all(translationPromises);
        results.forEach((result)=>{
            translations[result.lang] = result.text;
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(translations);
    } catch (error) {
        console.error("Translation error:", error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Translation failed"
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__9ac2da5c._.js.map