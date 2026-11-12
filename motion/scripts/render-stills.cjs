// Xuất ảnh tĩnh nhiều khung hình của một dự án để kiểm tra (không thuộc dự án).
// node stills.cjs <thư mục video-remotion> <mã dự án> <thư mục ra> <frame,frame,...> [scale]
const path = require("node:path");
const fs = require("node:fs");
const { createRequire } = require("node:module");

const [root, id, outDir, framesArg, scaleArg] = process.argv.slice(2);
const req = createRequire(path.join(root, "package.json"));
const { bundle } = req("@remotion/bundler");
const { renderStill, selectComposition } = req("@remotion/renderer");

(async () => {
  const project = JSON.parse(fs.readFileSync(path.join(root, "projects", `${id}.json`), "utf8"));
  const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts"), publicDir: path.join(root, "public") });
  const inputProps = { project };
  const composition = await selectComposition({ serveUrl, id: "Main", inputProps });
  fs.mkdirSync(outDir, { recursive: true });
  const frames = framesArg.split(",").map(Number);
  for (const frame of frames) {
    const output = path.join(outDir, `f${String(frame).padStart(5, "0")}.png`);
    await renderStill({ composition, serveUrl, inputProps, frame, output, scale: Number(scaleArg || 0.4) });
    console.log("ok", frame);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
