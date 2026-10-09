// What saving a review needs and nothing else does: the capture engine and the viewer's page.
// Kept out of the main entry so a host can load them on demand.
export { captureDocumentWithSnapdom } from "./core/review/capture/snapdom"
export type { DomCaptureOptions } from "./core/review/capture/snapdom"
export { createEphemeralReviewUrl } from "./core/review/ephemeral-url"
