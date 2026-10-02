import { describe, expect, it } from "vitest"
import { deserializeReviewState, serializeReviewState } from "./codec"
import type { ReviewState } from "./model"

const state: ReviewState = {
  schemaVersion: 1,
  project: { id: "project", name: "Project" },
  page: { id: "page", projectId: "project", url: "https://example.com", versionIds: ["version"] },
  versions: [{
    id: "version",
    pageId: "page",
    number: 1,
    createdAt: 1,
    snapshot: { url: "https://example.com", capturedAt: 1, viewport: { width: 1280, height: 720, devicePixelRatio: 1 }, scroll: { x: 0, y: 0 } },
    domContext: { fingerprints: {} },
  }],
  review: {
    id: "review",
    pageId: "page",
    createdAt: 1,
    updatedAt: 1,
    comments: [],
    annotations: [],
    workspace: {
      guides: [{ id: "guide", orientation: "vertical", position: 12 }],
      arrows: [{ id: "arrow", start: { x: 1, y: 2 }, end: { x: 3, y: 4 }, color: "#000", width: 2 }],
      penStrokes: [{ id: "pen", points: [{ x: 1, y: 2 }], color: "#000", width: 2 }],
      textAnnotations: [{ id: "text", x: 1, y: 2, text: "Note" }],
      measurements: [{ id: "measurement", rect: { left: 1, top: 2, width: 3, height: 4 }, normalizedRect: { left: 1, top: 2, width: 3, height: 4 }, deltaX: 1, deltaY: 2, snapped: true }],
      heldDistances: [{ id: "distance", rectA: { left: 1, top: 2, width: 3, height: 4 }, rectB: { left: 5, top: 6, width: 7, height: 8 }, normalizedRectA: { left: 1, top: 2, width: 3, height: 4 }, normalizedRectB: { left: 5, top: 6, width: 7, height: 8 }, horizontal: null, vertical: null, connectors: [] }],
      comments: [],
      layoutGuides: [{ id: "layout", kind: "columns", visible: true, color: "#000", opacity: 0.2, count: 4, size: 100, gutter: 20, offset: 0, align: "stretch" }],
      textStyle: { font: "code", color: "#000" },
    },
  },
}

describe("review state codec", () => {
  it("round-trips every serializable workspace field", () => {
    expect(deserializeReviewState(serializeReviewState(state))).toEqual(state)
  })

  it("rejects review states without a valid version", () => {
    expect(deserializeReviewState(JSON.stringify({ ...state, versions: [] }))).toBeNull()
  })
})
