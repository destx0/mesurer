import {
  REVIEW_STATE_SCHEMA_VERSION,
  type ReviewAnnotation,
  type ReviewComment,
  type ReviewState,
  type ReviewWorkspace,
} from "./model"
import { isLayoutGuide } from "../layout-guides"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value))

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const isPoint = (value: unknown): value is { x: number; y: number } =>
  isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)

const isRect = (value: unknown): value is {
  left: number
  top: number
  width: number
  height: number
} =>
  isRecord(value) &&
  isFiniteNumber(value.left) &&
  isFiniteNumber(value.top) &&
  isFiniteNumber(value.width) &&
  isFiniteNumber(value.height)

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((entry) => typeof entry === "string")

const isTextStyle = (value: unknown): value is { font: "handwritten" | "code" | "serif" | "sans-serif"; color: string } =>
  isRecord(value) &&
  (value.font === "handwritten" || value.font === "code" || value.font === "serif" || value.font === "sans-serif") &&
  typeof value.color === "string"

const isDomFingerprint = (value: unknown) => {
  if (!isRecord(value)) return false
  return (
    typeof value.tagName === "string" &&
    isStringRecord(value.attributes) &&
    isRect(value.bounds) &&
    (value.selector === undefined || typeof value.selector === "string") &&
    (value.domPath === undefined || Array.isArray(value.domPath)) &&
    (value.framePath === undefined || Array.isArray(value.framePath)) &&
    (value.shadowPath === undefined || Array.isArray(value.shadowPath))
  )
}

const isScreenshotAsset = (value: unknown) => {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    (value.mimeType === "image/png" || value.mimeType === "image/jpeg" || value.mimeType === "image/webp") &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    (value.dataUrl === undefined || typeof value.dataUrl === "string") &&
    (value.storageKey === undefined || typeof value.storageKey === "string")
  )
}

const isAnnotation = (value: unknown): value is ReviewAnnotation => {
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.id !== "string") {
    return false
  }
  if (value.type === "arrow") {
    return isPoint(value.start) && isPoint(value.end) && typeof value.color === "string" && isFiniteNumber(value.width)
  }
  if (value.type === "pen") {
    return Array.isArray(value.points) && value.points.every(isPoint) && typeof value.color === "string" && isFiniteNumber(value.width)
  }
  if (value.type === "rectangle") {
    return isRect(value.rect) && typeof value.color === "string" && isFiniteNumber(value.width)
  }
  if (value.type === "text") {
    return isFiniteNumber(value.x) && isFiniteNumber(value.y) && typeof value.text === "string"
  }
  if (value.type === "measurement") {
    if (value.kind === "element") {
      return isRect(value.rect) && isRect(value.normalizedRect)
    }
    return (
      value.kind === "distance" &&
      isRect(value.rectA) &&
      isRect(value.rectB) &&
      isRect(value.normalizedRectA) &&
      isRect(value.normalizedRectB) &&
      Array.isArray(value.connectors)
    )
  }
  return (
    value.type === "guide" &&
    (value.orientation === "vertical" || value.orientation === "horizontal") &&
    isFiniteNumber(value.position)
  )
}

const isMeasurement = (value: unknown) =>
  isRecord(value) &&
  typeof value.id === "string" &&
  isRect(value.rect) &&
  isRect(value.normalizedRect) &&
  isFiniteNumber(value.deltaX) &&
  isFiniteNumber(value.deltaY) &&
  (value.originRect === undefined || isRect(value.originRect)) &&
  (value.snapped === undefined || typeof value.snapped === "boolean")

const isDistance = (value: unknown) =>
  isRecord(value) &&
  typeof value.id === "string" &&
  isRect(value.rectA) &&
  isRect(value.rectB) &&
  isRect(value.normalizedRectA) &&
  isRect(value.normalizedRectB) &&
  Array.isArray(value.connectors) &&
  value.connectors.every((connector) =>
    isRecord(connector) &&
    isFiniteNumber(connector.x1) &&
    isFiniteNumber(connector.y1) &&
    isFiniteNumber(connector.x2) &&
    isFiniteNumber(connector.y2),
  ) &&
  (value.guideIds === undefined || Array.isArray(value.guideIds)) &&
  (value.horizontal === null || isRecord(value.horizontal)) &&
  (value.vertical === null || isRecord(value.vertical)) &&
  (value.extraHorizontals === undefined || Array.isArray(value.extraHorizontals)) &&
  (value.extraVerticals === undefined || Array.isArray(value.extraVerticals)) &&
  (value.pinTargetRect === undefined || value.pinTargetRect === null || isRect(value.pinTargetRect)) &&
  (value.pinCursor === undefined || value.pinCursor === null || isPoint(value.pinCursor)) &&
  (value.pinCursorOffset === undefined || value.pinCursorOffset === null || isPoint(value.pinCursorOffset))

const isComment = (value: unknown): value is ReviewComment => {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    isPoint(value.position) &&
    (value.status === "open" || value.status === "resolved") &&
    typeof value.createdVersion === "string" &&
    typeof value.text === "string" &&
    Array.isArray(value.messages) &&
    value.messages.every((message) => {
      if (!isRecord(message)) return false
      return (
        typeof message.id === "string" &&
        message.role === "user" &&
        typeof message.text === "string" &&
        isFiniteNumber(message.createdAt)
      )
    }) &&
    isFiniteNumber(value.createdAt) &&
    isFiniteNumber(value.updatedAt)
  )
}

const isWorkspace = (value: unknown): value is ReviewWorkspace => {
  if (!isRecord(value)) return false
  const isArrow = (entry: unknown) =>
    isRecord(entry) && typeof entry.id === "string" && isPoint(entry.start) && isPoint(entry.end) && typeof entry.color === "string" && isFiniteNumber(entry.width)
  const isPenStroke = (entry: unknown) =>
    isRecord(entry) && typeof entry.id === "string" && Array.isArray(entry.points) && entry.points.every(isPoint) && typeof entry.color === "string" && isFiniteNumber(entry.width)
  const isText = (entry: unknown) =>
    isRecord(entry) && typeof entry.id === "string" && isFiniteNumber(entry.x) && isFiniteNumber(entry.y) && typeof entry.text === "string"
  const isGuide = (entry: unknown) =>
    isRecord(entry) && typeof entry.id === "string" && (entry.orientation === "vertical" || entry.orientation === "horizontal") && isFiniteNumber(entry.position)
  return (
    Array.isArray(value.guides) && value.guides.every(isGuide) &&
    Array.isArray(value.arrows) && value.arrows.every(isArrow) &&
    Array.isArray(value.penStrokes) && value.penStrokes.every(isPenStroke) &&
    Array.isArray(value.textAnnotations) && value.textAnnotations.every(isText) &&
    Array.isArray(value.measurements) && value.measurements.every(isMeasurement) &&
    Array.isArray(value.heldDistances) && value.heldDistances.every(isDistance) &&
    Array.isArray(value.comments) && value.comments.every(isComment) &&
    Array.isArray(value.layoutGuides) && value.layoutGuides.every(isLayoutGuide) &&
    (value.textStyle === undefined || isTextStyle(value.textStyle))
  )
}

export const normalizeReviewState = (value: unknown): ReviewState | null => {
  if (!isRecord(value) || value.schemaVersion !== REVIEW_STATE_SCHEMA_VERSION) return null
  if (!isRecord(value.project) || typeof value.project.id !== "string" || typeof value.project.name !== "string") return null
  if (!isRecord(value.page) || typeof value.page.id !== "string" || typeof value.page.projectId !== "string" || typeof value.page.url !== "string") return null
  if (!Array.isArray(value.versions) || !isRecord(value.review)) return null
  if (typeof value.review.id !== "string" || typeof value.review.pageId !== "string") return null
  if (!Array.isArray(value.review.comments) || !Array.isArray(value.review.annotations)) return null

  const versions = value.versions.filter((version): version is ReviewState["versions"][number] => {
    if (!isRecord(version) || typeof version.id !== "string" || typeof version.pageId !== "string" || !isFiniteNumber(version.number) || !isFiniteNumber(version.createdAt)) return false
    if (!isRecord(version.snapshot) || typeof version.snapshot.url !== "string" || !isFiniteNumber(version.snapshot.capturedAt)) return false
    if (!isRecord(version.snapshot.viewport) || !isFiniteNumber(version.snapshot.viewport.width) || !isFiniteNumber(version.snapshot.viewport.height) || !isFiniteNumber(version.snapshot.viewport.devicePixelRatio)) return false
    if (!isPoint(version.snapshot.scroll) || (version.snapshot.screenshot !== undefined && !isScreenshotAsset(version.snapshot.screenshot))) return false
    if (!isRecord(version.domContext) || !isRecord(version.domContext.fingerprints)) return false
    return Object.values(version.domContext.fingerprints).every(isDomFingerprint)
  })
  if (versions.length === 0) return null

  const comments = value.review.comments.filter(isComment)
  const annotations = value.review.annotations.filter(isAnnotation)
  const versionIds = Array.isArray(value.page.versionIds)
    ? value.page.versionIds.filter((id: unknown): id is string => typeof id === "string")
    : versions.map((version) => version.id)

  return {
    schemaVersion: REVIEW_STATE_SCHEMA_VERSION,
    project: { id: value.project.id, name: value.project.name },
    page: {
      id: value.page.id,
      projectId: value.page.projectId,
      url: value.page.url,
      ...(typeof value.page.title === "string" ? { title: value.page.title } : {}),
      versionIds,
    },
    versions,
    review: {
      id: value.review.id,
      pageId: value.review.pageId,
      createdAt: isFiniteNumber(value.review.createdAt) ? value.review.createdAt : 0,
      updatedAt: isFiniteNumber(value.review.updatedAt) ? value.review.updatedAt : 0,
      comments,
      annotations,
      ...(isTextStyle(value.review.textStyle) ? { textStyle: value.review.textStyle } : {}),
      ...(isWorkspace(value.review.workspace) ? { workspace: value.review.workspace } : {}),
    },
  }
}

export const serializeReviewState = (state: ReviewState): string => {
  const normalized = normalizeReviewState(state)
  if (!normalized) throw new Error("Cannot serialize invalid review state")
  return JSON.stringify(normalized)
}

export const deserializeReviewState = (value: string): ReviewState | null => {
  try {
    return normalizeReviewState(JSON.parse(value) as unknown)
  } catch {
    return null
  }
}
