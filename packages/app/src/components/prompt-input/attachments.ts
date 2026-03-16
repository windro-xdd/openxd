import { onCleanup, onMount } from "solid-js"
import { showToast } from "@opencode-ai/ui/toast"
import { usePrompt, type ContentPart, type ImageAttachmentPart } from "@/context/prompt"
import { useLanguage } from "@/context/language"
import { uuid } from "@/utils/uuid"
import { getCursorPosition } from "./editor-dom"

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"]
export const ACCEPTED_FILE_TYPES = [...ACCEPTED_IMAGE_TYPES, "application/pdf"]
const LARGE_PASTE_CHARS = 8000
const LARGE_PASTE_BREAKS = 120

// Image compression settings to avoid "Request Entity Too Large" (413) errors
const MAX_IMAGE_SIZE_BYTES = 512 * 1024 // 512KB — safe for most provider payload limits
const MAX_IMAGE_DIMENSION = 2048 // max width/height in pixels
const COMPRESSION_QUALITY = 0.8 // JPEG/WebP quality (0-1)

/**
 * Compress an image file if it exceeds size/dimension limits.
 * Returns the original file if it's already small enough or not compressible (e.g. GIF).
 */
async function compressImage(file: File): Promise<File> {
  // Skip compression for GIFs (animated) and PDFs
  if (file.type === "image/gif" || file.type === "application/pdf") return file
  // Skip if already under the limit
  if (file.size <= MAX_IMAGE_SIZE_BYTES) return file

  return new Promise<File>((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      // Calculate scaled dimensions
      let { width, height } = img
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const scale = MAX_IMAGE_DIMENSION / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      // Prefer WebP for better compression, fall back to JPEG
      const outputType = "image/webp"
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // Compression didn't help, try JPEG
            canvas.toBlob(
              (jpegBlob) => {
                if (!jpegBlob || jpegBlob.size >= file.size) {
                  resolve(file) // give up, return original
                  return
                }
                const ext = file.name.replace(/\.[^.]+$/, "") + ".jpg"
                resolve(new File([jpegBlob], ext, { type: "image/jpeg" }))
              },
              "image/jpeg",
              COMPRESSION_QUALITY,
            )
            return
          }
          const ext = file.name.replace(/\.[^.]+$/, "") + ".webp"
          resolve(new File([blob], ext, { type: outputType }))
        },
        outputType,
        COMPRESSION_QUALITY,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file) // can't decode, return original
    }

    img.src = url
  })
}

function largePaste(text: string) {
  if (text.length >= LARGE_PASTE_CHARS) return true
  let breaks = 0
  for (const char of text) {
    if (char !== "\n") continue
    breaks += 1
    if (breaks >= LARGE_PASTE_BREAKS) return true
  }
  return false
}

type PromptAttachmentsInput = {
  editor: () => HTMLDivElement | undefined
  isFocused: () => boolean
  isDialogActive: () => boolean
  setDraggingType: (type: "image" | "@mention" | null) => void
  focusEditor: () => void
  addPart: (part: ContentPart) => boolean
  readClipboardImage?: () => Promise<File | null>
}

export function createPromptAttachments(input: PromptAttachmentsInput) {
  const prompt = usePrompt()
  const language = useLanguage()

  const addImageAttachment = async (file: File) => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) return

    // Compress large images to avoid 413 "Request Entity Too Large" errors
    const processed = await compressImage(file)

    const reader = new FileReader()
    reader.onload = () => {
      const editor = input.editor()
      if (!editor) return
      const dataUrl = reader.result as string
      const attachment: ImageAttachmentPart = {
        type: "image",
        id: uuid(),
        filename: processed.name,
        mime: processed.type,
        dataUrl,
      }
      const cursorPosition = prompt.cursor() ?? getCursorPosition(editor)
      prompt.set([...prompt.current(), attachment], cursorPosition)
    }
    reader.readAsDataURL(processed)
  }

  const removeImageAttachment = (id: string) => {
    const current = prompt.current()
    const next = current.filter((part) => part.type !== "image" || part.id !== id)
    prompt.set(next, prompt.cursor())
  }

  const handlePaste = async (event: ClipboardEvent) => {
    if (!input.isFocused()) return
    const clipboardData = event.clipboardData
    if (!clipboardData) return

    event.preventDefault()
    event.stopPropagation()

    const items = Array.from(clipboardData.items)
    const fileItems = items.filter((item) => item.kind === "file")
    const imageItems = fileItems.filter((item) => ACCEPTED_FILE_TYPES.includes(item.type))

    if (imageItems.length > 0) {
      for (const item of imageItems) {
        const file = item.getAsFile()
        if (file) await addImageAttachment(file)
      }
      return
    }

    if (fileItems.length > 0) {
      showToast({
        title: language.t("prompt.toast.pasteUnsupported.title"),
        description: language.t("prompt.toast.pasteUnsupported.description"),
      })
      return
    }

    const plainText = clipboardData.getData("text/plain") ?? ""

    // Desktop: Browser clipboard has no images and no text, try platform's native clipboard for images
    if (input.readClipboardImage && !plainText) {
      const file = await input.readClipboardImage()
      if (file) {
        await addImageAttachment(file)
        return
      }
    }

    if (!plainText) return

    if (largePaste(plainText)) {
      if (input.addPart({ type: "text", content: plainText, start: 0, end: 0 })) return
      input.focusEditor()
      if (input.addPart({ type: "text", content: plainText, start: 0, end: 0 })) return
    }

    const inserted = typeof document.execCommand === "function" && document.execCommand("insertText", false, plainText)
    if (inserted) return

    input.addPart({ type: "text", content: plainText, start: 0, end: 0 })
  }

  const handleGlobalDragOver = (event: DragEvent) => {
    if (input.isDialogActive()) return

    event.preventDefault()
    const hasFiles = event.dataTransfer?.types.includes("Files")
    const hasText = event.dataTransfer?.types.includes("text/plain")
    if (hasFiles) {
      input.setDraggingType("image")
    } else if (hasText) {
      input.setDraggingType("@mention")
    }
  }

  const handleGlobalDragLeave = (event: DragEvent) => {
    if (input.isDialogActive()) return
    if (!event.relatedTarget) {
      input.setDraggingType(null)
    }
  }

  const handleGlobalDrop = async (event: DragEvent) => {
    if (input.isDialogActive()) return

    event.preventDefault()
    input.setDraggingType(null)

    const plainText = event.dataTransfer?.getData("text/plain")
    const filePrefix = "file:"
    if (plainText?.startsWith(filePrefix)) {
      const filePath = plainText.slice(filePrefix.length)
      input.focusEditor()
      input.addPart({ type: "file", path: filePath, content: "@" + filePath, start: 0, end: 0 })
      return
    }

    const dropped = event.dataTransfer?.files
    if (!dropped) return

    for (const file of Array.from(dropped)) {
      if (ACCEPTED_FILE_TYPES.includes(file.type)) {
        await addImageAttachment(file)
      }
    }
  }

  onMount(() => {
    document.addEventListener("dragover", handleGlobalDragOver)
    document.addEventListener("dragleave", handleGlobalDragLeave)
    document.addEventListener("drop", handleGlobalDrop)
  })

  onCleanup(() => {
    document.removeEventListener("dragover", handleGlobalDragOver)
    document.removeEventListener("dragleave", handleGlobalDragLeave)
    document.removeEventListener("drop", handleGlobalDrop)
  })

  return {
    addImageAttachment,
    removeImageAttachment,
    handlePaste,
  }
}
