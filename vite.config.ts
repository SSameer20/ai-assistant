import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src/ui") } },
  base: "./",
  build: {
    outDir: "dist-react",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("react") || id.includes("react-dom")) return "vendor_react";
          if (id.includes("react-router-dom")) return "vendor_router";
          if (id.includes("mermaid")) return "vendor_mermaid";
          if (id.includes("shiki") || id.includes("react-syntax-highlighter"))
            return "vendor_syntax";
          if (id.includes("@elevenlabs") || id.includes("@deepgram")) return "vendor_ai_sdks";
          if (id.includes("tailwindcss") || id.includes("@tailwindcss")) return "vendor_tailwind";

          const pkgMatch = id.match(/node_modules\/(?:@[^/]+\/[^/]+|[^/]+)/);
          if (pkgMatch) {
            const pkg = pkgMatch[0].replace("node_modules/", "").replace("/", "_");
            return `vendor_${pkg}`;
          }

          return "vendor_other";
        },
      },
    },
  },
});
