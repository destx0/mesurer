import { snapdom } from "@zumer/snapdom"
import type { CapturedReviewImage } from "./types"

const FALLBACK_IMAGE_URL = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" preserveAspectRatio="none">
    <rect width="40" height="40" fill="#94a3b8" fill-opacity=".07"/>
    <path d="M0 0L40 40M40 0L0 40" stroke="#64748b" stroke-opacity=".14" stroke-width=".5"/>
  </svg>
`)}`

export const captureDocumentWithSnapdom = async (
  ownerDocument: Document,
  ownerWindow: Window,
): Promise<CapturedReviewImage> => {
  const root = ownerDocument.documentElement
  const width = Math.max(root.scrollWidth, ownerDocument.body?.scrollWidth ?? 0, ownerWindow.innerWidth)
  const height = Math.max(root.scrollHeight, ownerDocument.body?.scrollHeight ?? 0, ownerWindow.innerHeight)
  const result = await snapdom(root, {
    dpr: ownerWindow.devicePixelRatio,
    clip: { x: 0, y: 0, width, height },
    exclude: "[data-mesurer-comments-layer], .mesurer-color-picker, .mesurer-screenshot-preview, [aria-label='Screenshot selection']",
    excludeMode: "remove",
    format: "png",
    placeholders: true,
    fallbackURL: FALLBACK_IMAGE_URL,
  })
  const blob = await result.toBlob({ format: "png" })
  const bitmap = await createImageBitmap(blob)
  const size = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return {
    blob,
    ...size,
    mimeType: "image/png",
    origin: { x: 0, y: 0 },
    cssWidth: width,
    cssHeight: height,
    scale: 1,
  }
}
