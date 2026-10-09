import { defineConfig } from "tsup";
import type { Options } from "tsup";

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
  define: { __MESURER_SNAPDOM_CAPTURE__: "true" },
}, {
  ...shared,
  entry: { "extension-runtime": "extension-runtime.ts" },
  clean: false,
  define: { __MESURER_SNAPDOM_CAPTURE__: "false" },
}]);
