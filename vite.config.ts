import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./", // ✅ iOS Safari 대응을 위한 상대 경로 설정
  plugins: [react()],
  build: {
    outDir: "dist",
  },
});
