import type { createEphemeralReviewUrl } from "./ephemeral-url"

declare const __MESURER_SNAPDOM_CAPTURE__: boolean | undefined

export type CreateReviewViewer = typeof createEphemeralReviewUrl

// The viewer's page is a sizeable template that only saving a review needs. A build without the
// capture engine (the extension's content script) leaves it out too, and its host loads both.
export const createReviewViewer: CreateReviewViewer = async (...args) => {
  const loadViewer = __MESURER_SNAPDOM_CAPTURE__ ? () => import("./ephemeral-url") : undefined
  if (!loadViewer) throw new Error("No review viewer")
  const { createEphemeralReviewUrl } = await loadViewer()
  return createEphemeralReviewUrl(...args)
}
