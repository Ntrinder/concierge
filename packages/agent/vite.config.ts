import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    lib: { entry: "src/loader.ts", name: "Concierge", formats: ["iife"], fileName: () => "agent.js" },
    outDir: "../../apps/platform/public",
    emptyOutDir: false,
    sourcemap: false,
  },
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
