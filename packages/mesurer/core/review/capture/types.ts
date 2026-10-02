export type CapturedReviewImage = {
  blob: Blob
  width: number
  height: number
  mimeType: "image/png" | "image/jpeg"
  origin: { x: number; y: number }
  cssWidth: number
  cssHeight: number
  scale: number
}
