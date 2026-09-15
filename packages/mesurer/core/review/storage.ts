import { deserializeReviewState, serializeReviewState } from "./codec"
import type { ReviewState } from "./model"

export type ReviewStateStorage = {
  load: (key: string) => ReviewState | null
  save: (key: string, state: ReviewState) => void
  remove: (key: string) => void
}

export const createLocalReviewStateStorage = (
  ownerWindow: Window,
): ReviewStateStorage => ({
  load: (key) => {
    try {
      const value = ownerWindow.localStorage.getItem(key)
      return value ? deserializeReviewState(value) : null
    } catch {
      return null
    }
  },
  save: (key, state) => {
    ownerWindow.localStorage.setItem(key, serializeReviewState(state))
  },
  remove: (key) => {
    ownerWindow.localStorage.removeItem(key)
  },
})
