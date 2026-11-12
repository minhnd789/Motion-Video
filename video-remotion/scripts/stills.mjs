// Chụp nhanh vài khung hình của một dự án để kiểm tra bố cục mà không cần xuất cả video.
// Cách dùng: node scripts/stills.mjs <mã-dự-án> 45,135,240 [tỉ-lệ]
// Ảnh ghi vào .cache/stills/<mã>-<khung>.jpg
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [id, frameList, scaleArg] = process.argv.slice(2);

if (!id || !/^[A-Za-z0-9_-]+$/.test(id) || !frameList) {
  console.error("Cách dùng: node scripts/stills.mjs <mã-dự-án> 45,135,240 [tỉ-lệ]");
  process.exit(1);
}

const project = JSON.parse(fs.readFileSync(path.join(root, "projects", `${id}.json`), "utf8"));
const inputProps = { project };
const outDir = path.join(root, ".cache", "stills");
fs.mkdirSync(outDir, { recursive: true });

try {
  const serveUrl = await bundle({
    entryPoint: path.join(root, "src", "index.ts"),
    publicDir: path.join(root, "public"),
  });
  const composition = await selectComposition({ serveUrl, id: "Main", inputProps });
  for (const frame of frameList.split(",").map(Number)) {
    const output = path.join(outDir, `${id}-${String(frame).padStart(5, "0")}.jpg`);
    await renderStill({
      composition,
      serveUrl,
      output,
      frame: Math.min(frame, composition.durationInFrames - 1),
      inputProps,
      imageFormat: "jpeg",
      scale: Number(scaleArg) || 0.25,
    });
    console.log(output);
  }
  process.exit(0);
} catch (err) {
  console.error(err?.stack ?? String(err));
  process.exit(1);
}
