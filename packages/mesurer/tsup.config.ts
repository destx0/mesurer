import { defineConfig } from "tsup";
import type { Options } from "tsup";

// Saving a review is left out of the published package until reviews are kept on the platform:
// the Save button cannot be switched on, and what only saving needs is compiled out. Builds
// made from source (the site's dev server, the extension with `MESURER_REVIEW=1`) still have it.
const noReview = { "globalThis.__MESURER_NO_REVIEW__": "true" };

const shared: Options = {
  format: ["cjs", "esm"],
  dts: true,
  target: "es2020",
  bundle: true,
  clean: true,
  external: ["@zumer/snapdom"],
};

export default defineConfig([{
  ...shared,
  entry: {
    index: "index.ts",
    "review-capture": "review-capture.ts",
  },
  define: { __MESURER_SNAPDOM_CAPTURE__: "true", ...noReview },
}, {
  ...shared,
  entry: { "extension-runtime": "extension-runtime.ts" },
  clean: false,
  define: { __MESURER_SNAPDOM_CAPTURE__: "false", ...noReview },
}]);
