import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: [],
    include: ['react', 'react-dom', 'lucide-react']
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    sourcemap: true,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react']
        }
      }
    }
  },
  server: {
    strictPort: true,
    host: true,
    port: 5173
  },
  preview: {
    port: 4173,
    host: true
  },
  css: {
    devSourcemap: true
  }
});
