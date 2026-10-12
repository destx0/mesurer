export type MesurerFeatures = {
  screenshot?: boolean
  rulers?: boolean
  settings?: boolean
  responsive?: boolean
  /**
   * Saving a review. Off unless asked for: reviews are not kept anywhere yet but on the machine
   * they are saved from, so the Save button is not shown to everyone.
   */
  review?: boolean
}

export type ResolvedMesurerFeatures = Required<MesurerFeatures>

export const DEFAULT_MESURER_FEATURES: ResolvedMesurerFeatures = {
  screenshot: true,
  rulers: true,
  settings: true,
  responsive: true,
  review: false,
}

export const resolveMesurerFeatures = (
  features?: MesurerFeatures,
): ResolvedMesurerFeatures => ({
  ...DEFAULT_MESURER_FEATURES,
  ...features,
})
