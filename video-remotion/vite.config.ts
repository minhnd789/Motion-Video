import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { editorApi } from "./editor/server/api";

const root = path.dirname(fileURLToPath(import.meta.url));

// Trình chỉnh sửa video: giao diện nằm trong editor/, API cục bộ gắn vào cùng máy chủ.
export default defineConfig({
  root: path.join(root, "editor"),
  publicDir: false,
  plugins: [editorApi(root)],
  server: {
    port: 5180,
    strictPort: false,
    fs: { allow: [root] },
    watch: { ignored: ["**/projects/**", "**/public/media/**", "**/.cache/**", "**/out/**"] },
  },
});
