import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server proxies /api (REST + WebSocket) to the FastAPI backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "127.0.0.1",
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true, ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 5000,
  },
});
