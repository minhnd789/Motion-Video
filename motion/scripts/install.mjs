#!/usr/bin/env node
// Cài bộ Motion (50 thể loại motion graphic) vào một thư mục video-remotion.
// Cách dùng: node install.mjs <thư mục video-remotion> [--dry-run]
// - Sao lưu các file sẽ bị thay vào <đích>/.motion-backup/<thời điểm>/ trước khi chép.
// - Kiểm tra các gói cần có trong package.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.resolve(here, "..", "assets");
const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const target = args.find((a) => !a.startsWith("--"));

if (!target) {
  console.error("Thiếu đường dẫn. Ví dụ: node install.mjs \"G:/du-an/video-remotion\"");
  process.exit(1);
}
const root = path.resolve(target);
const pkgFile = path.join(root, "package.json");
if (!fs.existsSync(pkgFile) || !fs.existsSync(path.join(root, "src", "engine")) || !fs.existsSync(path.join(root, "editor"))) {
  console.error(`${root} không giống thư mục video-remotion (cần package.json, src/engine, editor).`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const needed = ["remotion", "@remotion/paths", "@remotion/media-utils", "@remotion/media", "lucide-react"];
const missing = needed.filter((d) => !deps[d]);

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(path.relative(assets, p));
  }
};
walk(assets);

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const backup = path.join(root, ".motion-backup", stamp);
let replaced = 0;
let added = 0;

for (const rel of files) {
  const from = path.join(assets, rel);
  const to = path.join(root, rel);
  const exists = fs.existsSync(to);
  if (exists && fs.readFileSync(to).equals(fs.readFileSync(from))) {
    console.log(`  giống nhau  ${rel}`);
    continue;
  }
  console.log(`  ${exists ? "thay" : "thêm"}       ${rel}`);
  if (dry) continue;
  if (exists) {
    fs.mkdirSync(path.dirname(path.join(backup, rel)), { recursive: true });
    fs.copyFileSync(to, path.join(backup, rel));
    replaced++;
  } else added++;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

console.log("");
if (dry) console.log("Chạy thử, chưa chép file nào.");
else console.log(`Xong: thêm ${added}, thay ${replaced} file.${replaced ? ` Bản cũ ở ${backup}` : ""}`);
if (missing.length) {
  console.log(`Thiếu gói: ${missing.join(", ")}. Chạy trong ${root}:`);
  console.log(`  npm i ${missing.map((m) => (m.startsWith("@remotion/") || m === "remotion" ? `${m}@${deps.remotion ?? "latest"}` : m)).join(" ")}`);
}
console.log("Kiểm tra: npx tsc --noEmit (trong thư mục video-remotion), rồi npm run editor và mở tab Motion.");
