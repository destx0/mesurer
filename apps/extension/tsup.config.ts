import { defineConfig, type Options } from "tsup";

// The build runs in Node, whose types this project does not otherwise need.
declare const process: { env: Record<string, string | undefined> };

const production = { "process.env.NODE_ENV": JSON.stringify("production") };

// Saving a review is built in only when asked for (`MESURER_REVIEW=1`), until reviews are kept on
// the platform. Without it the Save button is not offered, and what only saving needs (in the
// library, the content script and the background) is compiled out.
const withReview = process.env.MESURER_REVIEW === "1";
const review = {
  __MESURER_REVIEW__: JSON.stringify(withReview),
  "globalThis.__MESURER_NO_REVIEW__": JSON.stringify(!withReview),
};

// dist is emptied by scripts/clean-dist.mjs before this runs: the builds below share it.
const shared: Options = {
  outDir: "dist",
  format: ["iife"],
  target: "es2020",
  platform: "browser",
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: false,
  minify: true,
  esbuildOptions: (options) => {
    options.legalComments = "none";
    options.drop = ["console"];
  },
  outExtension: () => ({
    js: ".js",
  }),
};

export default defineConfig([
  {
    ...shared,
    entry: { content: "src/content.tsx" },
    // Leaves out of the content script what only runs outside the extension, or in its other
    // pages (see packages/mesurer/core/build.ts), and the capture engine, which is loaded from
    // review-capture.js the first time a review is saved.
    define: {
      ...production,
      "globalThis.__MESURER_EXTENSION__": "true",
      __MESURER_SNAPDOM_CAPTURE__: "false",
      ...review,
    },
  },
  {
    ...shared,
    entry: {
      background: "src/background.ts",
      "keyboard-gate": "src/keyboard-gate.ts",
      "offscreen-recording": "src/offscreen-recording.ts",
      "recording-player": "src/recording-player.tsx",
    },
    define: { ...production, __MESURER_SNAPDOM_CAPTURE__: "false", ...review },
  },
  {
    ...shared,
    entry: { "review-capture": "src/review-capture.ts" },
    format: ["esm"],
    noExternal: ["mesurer", "@zumer/snapdom"],
    define: production,
  },
]);
