import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative base so the same build works in the Android app and on GitHub Pages (…/ward-jobs-web/).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
