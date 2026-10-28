import type { TextStyleSettings } from "./text-style"

export type Point = {
  x: number
  y: number
}

export type Arrow = {
  id: string
  start: Point
  end: Point
  control?: Point
  color: string
  width: number
  rotation?: number
}

// A point of a pen stroke, with how heavy the ink is there: 0 the thinnest, 1 the thickest. A point
// without it (one drawn before ink had weight) is drawn at the stroke's own width.
export type PenPoint = Point & { w?: number }

// The pens there are to draw with. Each has its own width and the way its ink lies: see core/ink.ts.
export type PenKind = "ink" | "marker"
// What the pen tool has in hand: one of the pens, or the eraser that rubs their strokes out.
export type PenChoice = PenKind | "eraser"

export type PenStroke = {
  id: string
  /** The pen it was drawn with. One drawn before there were several was drawn in ink. */
  kind?: PenKind
  /**
   * Its points are the line the ink follows, as it is drawn, and are not smoothed again. Set on
   * what the eraser leaves of a stroke, so that rubbing part of it out moves none of the rest.
   */
  fixed?: boolean
  points: PenPoint[]
  color: string
  width: number
  rotation?: number
}

export type TextAnnotation = {
  id: string
  x: number
  y: number
  text: string
  scale?: number
  rotation?: number
  boxWidth?: number
  /** What the note was written in. A note keeps its own, whatever the next one is set to. */
  style?: TextStyleSettings
}

export type CommentMessage = {
  id: string
  role: "user"
  text: string
  createdAt: number
}

export type CommentTarget = {
  selector: string
  framePath?: string[]
  frameShadowPaths?: string[][]
  shadowPath?: string[]
  tagName: string
  textSnippet: string
  htmlPreview: string
  attributes: Record<string, string>
  styles: string
  rect: Rect
  documentPoint: Point
  anchor?: Point
  /** The address of the page the element was on when it was commented on. */
  url?: string
  /** The size, in CSS px, of the window that page was in. */
  viewport?: { width: number; height: number }
  /** That window was a responsive preview of this size, not the page itself. */
  preview?: boolean
}

export type CommentThread = {
  id: string
  target: CommentTarget
  messages: CommentMessage[]
  status: "open" | "resolved"
  createdAt: number
  updatedAt: number
}

export type Rect = {
  left: number
  top: number
  width: number
  height: number
}

export type NormalizedRect = {
  left: number
  top: number
  width: number
  height: number
}

export type Measurement = {
  id: string
  rect: Rect
  normalizedRect: NormalizedRect
  elementRef?: Element | null
  originRect?: Rect
  deltaX: number
  deltaY: number
  snapped?: boolean
}

export type BoxEdges = {
  top: number
  right: number
  bottom: number
  left: number
}

export type LayoutGap = {
  row: number
  column: number
}

export type InspectTextAnchor = {
  node: Text
  start: number
  end: number
}

export type InspectMeasurement = {
  id: string
  rect: Rect
  paddingRect: Rect
  marginRect: Rect
  padding: BoxEdges
  margin: BoxEdges
  gap: LayoutGap | null
  label: string
  elementRef?: Element | null
  layoutSpacingElementRef?: Element | null
  originRect?: Rect
  textAnchor?: InspectTextAnchor | null
}

export type Guide = {
  id: string
  orientation: "vertical" | "horizontal"
  position: number
}

export type DistanceOverlay = {
  id: string
  guideIds?: Array<string | null>
  rectA: Rect
  rectB: Rect
  normalizedRectA: NormalizedRect
  normalizedRectB: NormalizedRect
  elementRefA?: Element | null
  elementRefB?: Element | null
  pinTargetRef?: Element | null
  pinTargetRect?: Rect | null
  pinCursor?: Point | null
  pinCursorOffset?: Point | null
  horizontal: {
    x1: number
    x2: number
    y: number
    value: number
  } | null
  extraHorizontals?: Array<{
    x1: number
    x2: number
    y: number
    value: number
  }>
  vertical: {
    y1: number
    y2: number
    x: number
    value: number
  } | null
  extraVerticals?: Array<{
    y1: number
    y2: number
    x: number
    value: number
  }>
  connectors: Array<{
    x1: number
    y1: number
    x2: number
    y2: number
  }>
}

export type OptionTarget = {
  rect: Rect
  element?: Element | null
  guideId?: string
}

export type ToolMode =
  | "none"
  | "select"
  | "text-inspector"
  | "selection"
  | "guides"
  | "xray"
  | "rulers"
  | "arrows"
  | "pen"
  | "text"
  | "comments"

export type OpenMenu =
  | { type: "settings" }
  | { type: "comments"; panel: boolean }
  | { type: "guide-orientation" }
  | { type: "capture" }
  | { type: "pen" }
  | { type: "text" }
  | { type: "guide-context"; ids: string[]; x: number; y: number }
  | { type: "layout-guides" }
  | null

export type PersistentToolMode = Exclude<ToolMode, "none" | "text-inspector" | "xray" | "rulers">
