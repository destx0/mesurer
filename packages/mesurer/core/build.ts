declare global {
  // Set by the extension's build, for its content script alone: it is replaced by `true` there
  // and is absent everywhere else. What the content script never runs is left out behind it.
  var __MESURER_EXTENSION__: boolean | undefined
  // Set to `true` by a build that offers no saving of reviews (the extension's, until reviews
  // are kept on the platform), and absent everywhere else. What only a saved review needs is
  // left out behind it.
  var __MESURER_NO_REVIEW__: boolean | undefined
}

export {}
