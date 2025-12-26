"use client"

import { useEffect, useRef } from "react"

interface BasicHtmlEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
  rows?: number
  className?: string
}

/**
 * Converts HTML to plain text for editing
 * - <br> tags -> line breaks
 * - &nbsp; -> spaces
 * - Other HTML tags are stripped
 */
function htmlToPlainText(html: string): string {
  if (!html) return ""
  
  // Replace <br> and <br/> with line breaks
  let text = html.replace(/<br\s*\/?>/gi, "\n")
  
  // Replace &nbsp; with regular spaces
  text = text.replace(/&nbsp;/g, " ")
  
  // Replace other HTML entities
  text = text.replace(/&amp;/g, "&")
  text = text.replace(/&lt;/g, "<")
  text = text.replace(/&gt;/g, ">")
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  
  // Strip remaining HTML tags
  text = text.replace(/<[^>]*>/g, "")
  
  return text
}

/**
 * Converts plain text to HTML
 * - Line breaks -> <br>
 * - Multiple spaces -> preserved with &nbsp;
 * - Tabs -> preserved
 */
function plainTextToHtml(text: string): string {
  if (!text) return ""
  
  // Escape HTML special characters first
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
  
  // Convert line breaks to <br>
  html = html.replace(/\n/g, "<br>")
  
  // Convert tabs to 4 non-breaking spaces (or keep as is)
  html = html.replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")
  
  // Preserve multiple spaces by converting to &nbsp;
  // This regex finds 2+ consecutive spaces and replaces them
  html = html.replace(/  +/g, (match) => {
    return match.split("").map(() => "&nbsp;").join("")
  })
  
  return html
}

export function BasicHtmlEditor({ 
  value, 
  onChange, 
  placeholder, 
  disabled = false,
  rows = 8,
  className = ""
}: BasicHtmlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isInternalUpdate = useRef(false)

  // Convert HTML value to plain text for editing
  const plainTextValue = htmlToPlainText(value)

  // Handle textarea changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const plainText = e.target.value
    const html = plainTextToHtml(plainText)
    
    isInternalUpdate.current = true
    onChange(html)
    
    // Reset flag after a short delay
    setTimeout(() => {
      isInternalUpdate.current = false
    }, 0)
  }

  // Update textarea when value changes externally (but not from our own updates)
  useEffect(() => {
    if (!isInternalUpdate.current && textareaRef.current) {
      const newPlainText = htmlToPlainText(value)
      if (textareaRef.current.value !== newPlainText) {
        textareaRef.current.value = newPlainText
      }
    }
  }, [value])

  return (
    <textarea
      ref={textareaRef}
      value={plainTextValue}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
      rows={rows}
      className={`w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm min-h-[200px] whitespace-pre-wrap font-sans ${className}`}
    />
  )
}

