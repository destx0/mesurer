import { snapdom } from "@zumer/snapdom"
import type { CapturedReviewImage } from "./types"

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
