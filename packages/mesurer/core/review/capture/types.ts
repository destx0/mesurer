export type CapturedReviewImage = {
  blob: Blob
  width: number
  height: number
  mimeType: "image/png" | "image/jpeg"
  origin: { x: number; y: number }
  cssWidth: number
  cssHeight: number
  scale: number
  /** The capture as an SVG document that loads, from their own address, the images that could
   *  not be read into `blob`. Present only when there are some. */
  live?: string
}
