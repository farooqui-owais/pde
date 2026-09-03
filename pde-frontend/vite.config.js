import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    // Keep individual chunks under Vite's 500 kB warning and make the initial
    // load lighter by splitting well-known vendor libs from app code.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          i18n: ["i18next", "react-i18next", "i18next-browser-languagedetector"],
          http: ["axios"],
        },
      },
    },
  },
});
