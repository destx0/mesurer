import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  define: {
    __MESURER_SNAPDOM_CAPTURE__: "true",
  },
  resolve: {
    alias: {
      "mesurer/extension-runtime": fileURLToPath(
        new URL("../../packages/mesurer/extension-runtime.ts", import.meta.url),
      ),
      mesurer: fileURLToPath(
        new URL("../../packages/mesurer/index.ts", import.meta.url),
      ),
    },
  },
  optimizeDeps: {
    exclude: ["mesurer"],
  },
  server: {
    strictPort: true,
  },
});
