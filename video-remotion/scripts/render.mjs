// Xuất một dự án ra file MP4.
// Cách dùng: node scripts/render.mjs <mã-dự-án>
// In tiến độ ra stdout theo dạng "BUNDLE 0.5", "PROGRESS 0.42", "DONE <đường dẫn>".
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const id = process.argv[2];

if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
  console.error("Thiếu mã dự án. Ví dụ: node scripts/render.mjs demo");
  process.exit(1);
}

const projectFile = path.join(root, "projects", `${id}.json`);
if (!fs.existsSync(projectFile)) {
  console.error(`Không tìm thấy ${projectFile}`);
  process.exit(1);
}

const project = JSON.parse(fs.readFileSync(projectFile, "utf8"));
const inputProps = { project };
const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
const outputLocation = path.join(root, "out", `${id}-${stamp}.mp4`);
fs.mkdirSync(path.dirname(outputLocation), { recursive: true });

try {
  const serveUrl = await bundle({
    entryPoint: path.join(root, "src", "index.ts"),
    publicDir: path.join(root, "public"),
    onProgress: (p) => console.log(`BUNDLE ${(p / 100).toFixed(2)}`),
  });

  const composition = await selectComposition({ serveUrl, id: "Main", inputProps });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 18,
    imageFormat: "jpeg",
    outputLocation,
    inputProps,
    onProgress: ({ progress }) => console.log(`PROGRESS ${progress.toFixed(3)}`),
  });

  console.log(`DONE ${outputLocation}`);
  process.exit(0);
} catch (err) {
  console.error(err?.stack ?? String(err));
  process.exit(1);
}
