import type { CommentMessage, DistanceOverlay, Guide, Point, Rect } from "../types"
import type { TextStyleSettings } from "../text-style"

export const REVIEW_STATE_SCHEMA_VERSION = 1

export type ReviewId = string
export type PageId = string
export type PageVersionId = string
export type DomTargetId = string

export type ViewportSnapshot = {
  width: number
  height: number
  devicePixelRatio: number
}

export type ScrollSnapshot = Point

export type ScreenshotAsset = {
  id: string
  mimeType: "image/png" | "image/jpeg"
  width: number
  height: number
  dataUrl?: string
  storageKey?: string
}

export type PageSnapshot = {
  url: string
  title?: string
  capturedAt: number
  viewport: ViewportSnapshot
  scroll: ScrollSnapshot
  screenshot?: ScreenshotAsset
}

export type DomAccessibilityFingerprint = {
  role?: string
  name?: string
  label?: string
}

export type DomFingerprint = {
  selector?: string
  domPath?: string[]
  framePath?: string[]
  frameShadowPaths?: string[][]
  shadowPath?: string[]
  tagName: string
  id?: string
  attributes: Record<string, string>
  text?: string
  nearbyText?: string
  htmlPreview?: string
  accessibility?: DomAccessibilityFingerprint
  bounds: Rect
  styles?: Record<string, string>
}

export type DomContext = {
  fingerprints: Record<DomTargetId, DomFingerprint>
}

export type PageVersion = {
  id: PageVersionId
  pageId: PageId
  number: number
  createdAt: number
  snapshot: PageSnapshot
  domContext: DomContext
}

export type ReviewComment = {
  id: string
  targetId?: DomTargetId
  text: string
  messages: CommentMessage[]
  position: Point
  status: "open" | "resolved"
  createdVersion: PageVersionId
  createdAt: number
  updatedAt: number
}

export type ArrowAnnotation = {
  type: "arrow"
  id: string
  start: Point
  end: Point
  control?: Point
  color: string
  width: number
  rotation?: number
}

export type PenAnnotation = {
  type: "pen"
  id: string
  points: Point[]
  color: string
  width: number
  rotation?: number
}

export type RectangleAnnotation = {
  type: "rectangle"
  id: string
  rect: Rect
  color: string
  width: number
  rotation?: number
}

export type TextAnnotation = {
  type: "text"
  id: string
  x: number
  y: number
  text: string
  scale?: number
  rotation?: number
  boxWidth?: number
}

export type MeasurementAnnotation = {
  type: "measurement"
  kind: "element"
  id: string
  rect: Rect
  normalizedRect: Rect
  targetId?: DomTargetId
}

export type DistanceMeasurementAnnotation = {
  type: "measurement"
  kind: "distance"
  id: string
  guideIds?: Array<string | null>
  rectA: Rect
  rectB: Rect
  normalizedRectA: Rect
  normalizedRectB: Rect
  targetIds?: {
    a?: DomTargetId
    b?: DomTargetId
    pin?: DomTargetId
  }
  horizontal: DistanceOverlay["horizontal"]
  vertical: DistanceOverlay["vertical"]
  connectors: DistanceOverlay["connectors"]
}

export type GuideAnnotation = Guide & { type: "guide" }

export type ReviewAnnotation =
  | ArrowAnnotation
  | PenAnnotation
  | RectangleAnnotation
  | TextAnnotation
  | MeasurementAnnotation
  | DistanceMeasurementAnnotation
  | GuideAnnotation

export type Review = {
  id: ReviewId
  pageId: PageId
  createdAt: number
  updatedAt: number
  comments: ReviewComment[]
  annotations: ReviewAnnotation[]
  textStyle?: TextStyleSettings
}

export type ReviewPage = {
  id: PageId
  projectId: string
  url: string
  title?: string
  versionIds: PageVersionId[]
}

export type ReviewProject = {
  id: string
  name: string
}

export type ReviewState = {
  schemaVersion: typeof REVIEW_STATE_SCHEMA_VERSION
  project: ReviewProject
  page: ReviewPage
  versions: PageVersion[]
  review: Review
}

export type LegacyCommentReference = {
  id: string
  target: DomFingerprint
  messages: CommentMessage[]
  status: "open" | "resolved"
  createdAt: number
  updatedAt: number
}
