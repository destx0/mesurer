import { defineConfig, type Options } from "tsup";

const production = { "process.env.NODE_ENV": JSON.stringify("production") };

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
      // Saving a review is built in only when asked for (`MESURER_REVIEW=1`), until reviews are
      // kept on the platform.
      __MESURER_REVIEW__: JSON.stringify(process.env.MESURER_REVIEW === "1"),
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
    define: { ...production, __MESURER_SNAPDOM_CAPTURE__: "false" },
  },
  {
    ...shared,
    entry: { "review-capture": "src/review-capture.ts" },
    format: ["esm"],
    noExternal: ["mesurer", "@zumer/snapdom"],
    define: production,
  },
]);
