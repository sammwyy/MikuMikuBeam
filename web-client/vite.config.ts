import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: [],
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
  },
  server: {
    strictPort: true,
  },
});
