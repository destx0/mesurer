import {
  hideNodesForCapture,
  waitForNextPaint,
} from "../screenshot"
import { captureVisibleTabPng } from "../screenshot-capture"
import { captureDocumentWithSnapdom } from "./capture"

export type ReviewSnapshotCaptureOptions = {
  ownerDocument: Document
  ownerWindow: Window
  overlay: HTMLElement | null
  captureVisibleTab?: () => Promise<Blob>
  captureDom?: boolean
}

export type ReviewSnapshotCapture = {
  blob: Blob
  width: number
  height: number
  mimeType: "image/png" | "image/jpeg"
  origin?: { x: number; y: number }
  cssWidth?: number
  cssHeight?: number
  scale?: number
}

const getCaptureNodes = (overlay: HTMLElement | null) => [
  overlay,
  overlay?.querySelector<HTMLElement>("[data-mesurer-comments-layer]") ?? null,
  overlay?.querySelector<HTMLElement>(".mesurer-color-picker") ?? null,
  overlay?.querySelector<HTMLElement>(".mesurer-screenshot-preview") ?? null,
  overlay?.querySelector<HTMLElement>("[aria-label='Screenshot selection']") ?? null,
]

const getImageSize = async (blob: Blob) => {
  const bitmap = await createImageBitmap(blob)
  const size = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return size
}

export const captureReviewSnapshot = async ({
  ownerDocument,
  ownerWindow,
  overlay,
  captureVisibleTab,
  captureDom = false,
}: ReviewSnapshotCaptureOptions): Promise<ReviewSnapshotCapture> => {
  const restore = hideNodesForCapture(getCaptureNodes(overlay))
  try {
    await waitForNextPaint(ownerWindow)
    const capture = captureVisibleTab ?? (() => captureVisibleTabPng(ownerDocument, ownerWindow))
    let captured: Awaited<ReturnType<typeof captureDocumentWithSnapdom>> | null = null
    if (captureDom) {
      try {
        captured = await captureDocumentWithSnapdom(ownerDocument, ownerWindow)
      } catch {
        // Fall back to browser capture when DOM serialization cannot handle page content.
      }
    }
    const blob = captured?.blob ?? await capture()
    const size = await getImageSize(blob)
    return {
      blob,
      ...size,
      mimeType: blob.type === "image/jpeg" ? "image/jpeg" : "image/png",
      ...(captured ? {
        origin: captured.origin,
        cssWidth: captured.cssWidth,
        cssHeight: captured.cssHeight,
        scale: captured.scale,
      } : { origin: { x: ownerWindow.scrollX, y: ownerWindow.scrollY }, scale: 1 }),
    }
  } finally {
    restore()
  }
}
