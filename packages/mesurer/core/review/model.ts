import type {
  Arrow,
  CommentMessage,
  DistanceOverlay,
  Guide,
  Measurement,
  PenStroke,
  Point,
  Rect,
  TextAnnotation as BaseTextAnnotation,
} from "../types"
import type { TextStyleSettings } from "../text-style"
import type { LayoutGuide } from "../layout-guides"

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

export type ArrowAnnotation = Arrow & { type: "arrow" }

export type PenAnnotation = PenStroke & { type: "pen" }

export type RectangleAnnotation = {
  type: "rectangle"
  id: string
  rect: Rect
  color: string
  width: number
  rotation?: number
}

export type TextAnnotation = BaseTextAnnotation & { type: "text" }

export type ReviewMeasurement = Omit<Measurement, "elementRef">

export type MeasurementAnnotation = ReviewMeasurement & {
  type: "measurement"
  kind: "element"
  targetId?: DomTargetId
}

export type ReviewDistance = Omit<DistanceOverlay, "elementRefA" | "elementRefB" | "pinTargetRef">

export type DistanceMeasurementAnnotation = ReviewDistance & {
  type: "measurement"
  kind: "distance"
  targetIds?: {
    a?: DomTargetId
    b?: DomTargetId
    pin?: DomTargetId
  }
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

export type ReviewWorkspace = {
  guides: Guide[]
  arrows: Arrow[]
  penStrokes: PenStroke[]
  textAnnotations: BaseTextAnnotation[]
  measurements: ReviewMeasurement[]
  heldDistances: ReviewDistance[]
  comments: ReviewComment[]
  layoutGuides: LayoutGuide[]
  textStyle?: TextStyleSettings
}

export type Review = {
  id: ReviewId
  pageId: PageId
  createdAt: number
  updatedAt: number
  comments: ReviewComment[]
  annotations: ReviewAnnotation[]
  textStyle?: TextStyleSettings
  workspace?: ReviewWorkspace
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
