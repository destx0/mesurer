import type { MesurerStoredWorkspace } from "../persistence"
import type { CommentTarget } from "../types"
import type { TextStyleSettings } from "../text-style"
import { captureDomFingerprint } from "./dom-fingerprint"
import type {
  DomFingerprint,
  PageVersion,
  Review,
  ReviewAnnotation,
  ReviewComment,
  ReviewPage,
  ReviewProject,
  ReviewState,
} from "./model"

type ReviewStateCaptureOptions = {
  project: ReviewProject
  page: ReviewPage
  version: PageVersion
  reviewId: string
  workspace: MesurerStoredWorkspace & { textStyle?: TextStyleSettings }
  now?: number
}

const stylesToRecord = (value: string) => {
  const styles: Record<string, string> = {}
  for (const line of value.split("\n")) {
    const separator = line.indexOf(":")
    if (separator === -1) continue
    styles[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
  }
  return styles
}

const commentTargetToFingerprint = (target: CommentTarget): DomFingerprint => ({
  selector: target.selector,
  framePath: target.framePath,
  frameShadowPaths: target.frameShadowPaths,
  shadowPath: target.shadowPath,
  tagName: target.tagName,
  attributes: target.attributes,
  text: target.textSnippet,
  htmlPreview: target.htmlPreview,
  bounds: target.rect,
  styles: stylesToRecord(target.styles),
})

export const createReviewStateFromWorkspace = ({
  project,
  page,
  version,
  reviewId,
  workspace,
  now = Date.now(),
}: ReviewStateCaptureOptions): ReviewState => {
  const fingerprints = { ...version.domContext.fingerprints }
  const addTarget = (id: string, element: Element | null | undefined) => {
    if (element) fingerprints[id] = captureDomFingerprint(element)
    return element ? id : undefined
  }

  const comments: ReviewComment[] = (workspace.comments ?? []).map((comment) => {
    const targetId = `comment:${comment.id}`
    fingerprints[targetId] = commentTargetToFingerprint(comment.target)
    const text = comment.messages[0]?.text ?? ""
    return {
      id: comment.id,
      targetId,
      text,
      messages: comment.messages,
      position: comment.target.documentPoint ?? {
        x: comment.target.rect.left + comment.target.rect.width * (comment.target.anchor?.x ?? 1),
        y: comment.target.rect.top + comment.target.rect.height * (comment.target.anchor?.y ?? 0),
      },
      status: comment.status,
      createdVersion: version.id,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    }
  })

  const annotations: ReviewAnnotation[] = [
    ...workspace.arrows.map((arrow) => ({ type: "arrow" as const, ...arrow })),
    ...workspace.penStrokes.map((stroke) => ({ type: "pen" as const, ...stroke })),
    ...workspace.textAnnotations.map((text) => ({ type: "text" as const, ...text })),
    ...workspace.guides.map((guide) => ({ type: "guide" as const, ...guide })),
    ...workspace.measurements.map(({ elementRef, ...measurement }) => ({
      type: "measurement" as const,
      kind: "element" as const,
      ...measurement,
      targetId: addTarget(`measurement:${measurement.id}`, elementRef),
    })),
    ...workspace.heldDistances.map(({ elementRefA, elementRefB, pinTargetRef, ...distance }) => ({
      type: "measurement" as const,
      kind: "distance" as const,
      ...distance,
      targetIds: {
        a: addTarget(`distance:${distance.id}:a`, elementRefA),
        b: addTarget(`distance:${distance.id}:b`, elementRefB),
        pin: addTarget(`distance:${distance.id}:pin`, pinTargetRef),
      },
    })),
  ]

  const nextVersion = {
    ...version,
    domContext: { fingerprints },
  }
  const nextPage = {
    ...page,
    versionIds: page.versionIds.includes(version.id)
      ? page.versionIds
      : [...page.versionIds, version.id],
  }
  const review: Review = {
    id: reviewId,
    pageId: page.id,
    createdAt: now,
    updatedAt: now,
    comments,
    annotations,
    textStyle: workspace.textStyle,
  }

  return {
    schemaVersion: 1,
    project,
    page: nextPage,
    versions: [nextVersion],
    review,
  }
}
