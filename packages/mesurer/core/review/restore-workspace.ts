import type { CommentTarget, CommentThread, DistanceOverlay, Measurement } from "../types"
import type { MesurerStoredWorkspace } from "../persistence"
import { resolveDomFingerprint } from "./dom-fingerprint"
import type { DomFingerprint, ReviewState } from "./model"

const targetFromFingerprint = (
  fingerprint: DomFingerprint | undefined,
  position: { x: number; y: number },
  ownerDocument: Document,
): CommentTarget => {
  if (!fingerprint) {
    return {
      selector: "body",
      tagName: "body",
      textSnippet: "",
      htmlPreview: "",
      attributes: {},
      styles: "",
      rect: { left: position.x, top: position.y, width: 0, height: 0 },
      documentPoint: position,
      anchor: { x: 0.5, y: 0.5 },
    }
  }
  const element = resolveDomFingerprint(fingerprint, ownerDocument).element
  const rect = element
    ? (() => {
        const bounds = element.getBoundingClientRect()
        return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }
      })()
    : fingerprint.bounds
  return {
    selector: fingerprint.selector ?? fingerprint.tagName,
    framePath: fingerprint.framePath,
    frameShadowPaths: fingerprint.frameShadowPaths,
    shadowPath: fingerprint.shadowPath,
    tagName: fingerprint.tagName,
    textSnippet: fingerprint.text ?? "",
    htmlPreview: fingerprint.htmlPreview ?? "",
    attributes: fingerprint.attributes,
    styles: Object.entries(fingerprint.styles ?? {}).map(([name, value]) => `${name}: ${value}`).join("\n"),
    rect,
    documentPoint: position,
    anchor: {
      x: rect.width > 0 ? Math.max(0, Math.min(1, (position.x - rect.left) / rect.width)) : 0.5,
      y: rect.height > 0 ? Math.max(0, Math.min(1, (position.y - rect.top) / rect.height)) : 0.5,
    },
  }
}

export const restoreReviewWorkspace = (
  state: ReviewState,
  ownerDocument: Document = document,
): Partial<MesurerStoredWorkspace> => {
  const workspace = state.review.workspace
  if (!workspace) return {}
  const fingerprintsByVersion = new Map(
    state.versions.map((version) => [version.id, version.domContext.fingerprints]),
  )
  const fingerprints = state.versions[state.versions.length - 1]?.domContext.fingerprints ?? {}
  const annotations = state.review.annotations
  const comments: CommentThread[] = workspace.comments.flatMap((comment) => {
    const target = targetFromFingerprint(
      comment.targetId
        ? fingerprintsByVersion.get(comment.createdVersion)?.[comment.targetId]
        : undefined,
      comment.position,
      ownerDocument,
    )
    return [{
      id: comment.id,
      target,
      messages: comment.messages,
      status: comment.status,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    }]
  })
  const measurements: Measurement[] = workspace.measurements.map((measurement) => {
    const annotation = annotations.find((entry) => entry.type === "measurement" && entry.kind === "element" && entry.id === measurement.id)
    const target = annotation?.type === "measurement" && annotation.kind === "element" && annotation.targetId
      ? resolveDomFingerprint(fingerprints[annotation.targetId], ownerDocument).element
      : null
    return { ...measurement, ...(target ? { elementRef: target } : {}) }
  })
  const heldDistances: DistanceOverlay[] = workspace.heldDistances.map((distance) => {
    const annotation = annotations.find((entry) => entry.type === "measurement" && entry.kind === "distance" && entry.id === distance.id)
    const targetIds = annotation?.type === "measurement" && annotation.kind === "distance" ? annotation.targetIds : undefined
    const elementRefA = targetIds?.a ? resolveDomFingerprint(fingerprints[targetIds.a], ownerDocument).element : null
    const elementRefB = targetIds?.b ? resolveDomFingerprint(fingerprints[targetIds.b], ownerDocument).element : null
    const pinTargetRef = targetIds?.pin ? resolveDomFingerprint(fingerprints[targetIds.pin], ownerDocument).element : null
    return {
      ...distance,
      ...(elementRefA ? { elementRefA } : {}),
      ...(elementRefB ? { elementRefB } : {}),
      ...(pinTargetRef ? { pinTargetRef } : {}),
    }
  })
  return {
    guides: workspace.guides,
    arrows: workspace.arrows,
    penStrokes: workspace.penStrokes,
    // A review saved before each note kept its own style had one style for them all.
    textAnnotations: workspace.textAnnotations.map((text) => {
      const style = text.style ?? workspace.textStyle ?? state.review.textStyle
      return style ? { ...text, style } : text
    }),
    measurements,
    heldDistances,
    comments,
    layoutGuides: workspace.layoutGuides,
  }
}
