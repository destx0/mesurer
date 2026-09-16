import type { Point } from "../../types"

export type CapturedReviewImage = {
  blob: Blob
  width: number
  height: number
  mimeType: "image/png"
  origin: Point
  cssWidth: number
  cssHeight: number
  scale?: number
}
