import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/wa-backend": {
        target: "https://dhole-sir-coaching-classes.onrender.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/wa-backend/, ""),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
    minify: "esbuild",
    sourcemap: false,
    target: "esnext",
    rollupOptions: {
      output: {
        chunkFileNames: "chunks/[name]-[hash].js",
        entryFileNames: "[name]-[hash].js",
        // Split heavy vendor libs into their own cached chunks
        manualChunks(id) {
          // Firebase — large, changes rarely
          if (id.includes("node_modules/firebase")) return "vendor-firebase";
          // Framer Motion
          if (id.includes("node_modules/framer-motion")) return "vendor-framer";
          // Three.js / R3F — only used on LeaderAnimationPage (already lazy)
          if (
            id.includes("node_modules/three") ||
            id.includes("node_modules/@react-three")
          )
            return "vendor-three";
          // PDF / OCR — only used in OMRScanner (now lazy)
          if (
            id.includes("node_modules/pdfjs-dist") ||
            id.includes("node_modules/tesseract")
          )
            return "vendor-pdf-ocr";
          // React core
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router-dom/")
          )
            return "vendor-react";
          // Radix UI components
          if (id.includes("node_modules/@radix-ui")) return "vendor-radix";
          // Recharts / charts
          if (id.includes("node_modules/recharts")) return "vendor-charts";
          // AI SDKs
          if (
            id.includes("node_modules/@google/generative-ai") ||
            id.includes("node_modules/openai")
          )
            return "vendor-ai";
        },
      },
    },
    // Drop console.log and debugger statements in production builds
    esbuildOptions: {
      drop: mode === "production" ? ["console", "debugger"] : [],
    },
  },
  plugins: [react({ swcMinify: true })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Pre-bundle heavy CJS deps so dev server doesn't convert them on-the-fly
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "firebase/app",
      "firebase/auth",
      "firebase/database",
      "framer-motion",
      "lucide-react",
    ],
    // Exclude backend-only packages from pre-bundling
    exclude: [
      "firebase-admin",
      "firebase-tools",
      "express",
      "nodemailer",
      "pdf-parse",
    ],
  },
}));
