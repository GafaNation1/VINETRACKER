import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // We register manually with a guard for previews
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // Do NOT activate the SW in dev — it interferes with the Lovable preview iframe
      devOptions: { enabled: false },
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "Vine Tracker",
        short_name: "Vine",
        description:
          "Track prayer, Bible reading, fasting, and spiritual goals while growing through groups, programs, and faith communities.",
        theme_color: "#15803d",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/favicon.ico", sizes: "64x64", type: "image/x-icon" },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
