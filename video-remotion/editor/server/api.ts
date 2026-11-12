// API cục bộ của trình chỉnh sửa, chạy chung tiến trình với Vite.
// Lưu/đọc dự án, liệt kê clip nguồn, tạo ảnh thu nhỏ, chuyển mã clip và xuất video.
import { spawn } from "node:child_process";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";

const VIDEO_EXT = new Set([".mov", ".mp4", ".m4v", ".mkv", ".webm", ".avi"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg"]);

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const kindOf = (name: string) => {
  const ext = path.extname(name).toLowerCase();
  if (VIDEO_EXT.has(ext)) return "video" as const;
  if (IMAGE_EXT.has(ext)) return "image" as const;
  if (AUDIO_EXT.has(ext)) return "audio" as const;
  return null;
};

const safeBase = (name: string) =>
  path
    .basename(name, path.extname(name))
    .normalize("NFD")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .slice(0, 80) || "clip";

const run = (cmd: string, args: string[]) =>
  new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => resolve({ code: -1, stdout, stderr: String(err) }));
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });

/** Giới hạn số tiến trình ffmpeg chạy cùng lúc. */
const limiter = (max: number) => {
  let active = 0;
  const queue: (() => void)[] = [];
  return async <T>(job: () => Promise<T>): Promise<T> => {
    if (active >= max) await new Promise<void>((r) => queue.push(r));
    active++;
    try {
      return await job();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
};

const readBody = (req: IncomingMessage) =>
  new Promise<any>((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });

const sendJson = (res: ServerResponse, body: unknown, status = 200) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

const sendFile = (req: IncomingMessage, res: ServerResponse, file: string) => {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  res.setHeader("Content-Type", MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream");
  res.setHeader("Accept-Ranges", "bytes");
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    if (start > end || start >= stat.size) {
      res.statusCode = 416;
      res.setHeader("Content-Range", `bytes */${stat.size}`);
      res.end();
      return;
    }
    res.statusCode = 206;
    res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    res.setHeader("Content-Length", end - start + 1);
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.setHeader("Content-Length", stat.size);
  fs.createReadStream(file).pipe(res);
};

type RenderState = {
  status: "idle" | "running" | "done" | "error";
  progress: number;
  stage: string;
  output: string | null;
  error: string | null;
};

export const editorApi = (root: string): Plugin => {
  const projectsDir = path.join(root, "projects");
  const mediaDir = path.join(root, "public", "media");
  const cacheDir = path.join(root, ".cache");
  const thumbsDir = path.join(cacheDir, "thumbs");
  const outDir = path.join(root, "out");
  for (const d of [projectsDir, mediaDir, thumbsDir, outDir]) fs.mkdirSync(d, { recursive: true });

  // Thư mục chứa clip gốc: mặc định là thư mục cha của dự án.
  let sourceDir = path.resolve(root, "..");
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, "editor.config.json"), "utf8"));
    if (cfg.sourceDir) sourceDir = path.resolve(root, cfg.sourceDir);
  } catch {
    /* không có file cấu hình thì dùng mặc định */
  }

  const thumbLimit = limiter(3);
  const importLimit = limiter(2);
  const importing = new Map<string, Promise<any>>();
  let render: RenderState = { status: "idle", progress: 0, stage: "", output: null, error: null };

  const validId = (id: string) => /^[A-Za-z0-9_-]{1,60}$/.test(id);
  const projectFile = (id: string) => path.join(projectsDir, `${id}.json`);

  const sourcePath = (name: unknown) => {
    if (typeof name !== "string") return null;
    const base = path.basename(name);
    if (!kindOf(base)) return null;
    const full = path.join(sourceDir, base);
    return fs.existsSync(full) ? { base, full } : null;
  };

  const probe = async (file: string) => {
    const r = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
    if (r.code !== 0) throw new Error(r.stderr || "ffprobe lỗi");
    const info = JSON.parse(r.stdout);
    const v = info.streams.find((s: any) => s.codec_type === "video");
    return {
      duration: Number(info.format?.duration ?? v?.duration ?? 0),
      width: Number(v?.width ?? 0),
      height: Number(v?.height ?? 0),
      hasAudio: info.streams.some((s: any) => s.codec_type === "audio"),
    };
  };

  const makeThumb = async (src: { base: string; full: string }) => {
    const out = path.join(thumbsDir, `${safeBase(src.base)}.jpg`);
    if (fs.existsSync(out)) return out;
    const isVideo = kindOf(src.base) === "video";
    await thumbLimit(async () => {
      if (fs.existsSync(out)) return;
      const args = ["-y", "-v", "error", ...(isVideo ? ["-ss", "0.5"] : []), "-i", src.full];
      const r = await run("ffmpeg", [...args, "-frames:v", "1", "-vf", "scale=240:-2", "-q:v", "5", out]);
      if (r.code !== 0 && isVideo) {
        // Clip ngắn hơn 0,5 giây: lấy khung hình đầu tiên.
        await run("ffmpeg", ["-y", "-v", "error", "-i", src.full, "-frames:v", "1", "-vf", "scale=240:-2", out]);
      }
    });
    return fs.existsSync(out) ? out : null;
  };

  const importMedia = async (src: { base: string; full: string }) => {
    const kind = kindOf(src.base)!;
    const base = safeBase(src.base);
    if (kind === "video") {
      const out = path.join(mediaDir, `${base}.mp4`);
      if (!fs.existsSync(out)) {
        const tmp = path.join(cacheDir, `${base}.tmp.mp4`);
        // Chuyển sang H.264 30fps, xoay sẵn theo metadata, để xem trước và xuất file đều đọc được.
        const r = await run("ffmpeg", [
          "-y", "-v", "error", "-i", src.full,
          "-map", "0:v:0", "-map", "0:a:0?",
          "-vf", "scale='if(gt(iw,ih),-2,min(1080,iw))':'if(gt(iw,ih),min(1080,ih),-2)',fps=30",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-g", "30",
          "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
          "-movflags", "+faststart", tmp,
        ]);
        if (r.code !== 0) throw new Error(r.stderr.slice(-400) || "ffmpeg lỗi");
        fs.renameSync(tmp, out);
      }
      return { kind, src: `media/${base}.mp4`, sourceName: src.base, ...(await probe(out)) };
    }
    const ext = path.extname(src.base).toLowerCase();
    const out = path.join(mediaDir, `${base}${ext}`);
    if (!fs.existsSync(out)) fs.copyFileSync(src.full, out);
    const meta = await probe(out);
    return { kind, src: `media/${base}${ext}`, sourceName: src.base, ...meta, hasAudio: kind === "audio" };
  };

  const startRender = (id: string) => {
    render = { status: "running", progress: 0, stage: "Đang chuẩn bị", output: null, error: null };
    const child = spawn(process.execPath, [path.join(root, "scripts", "render.mjs"), id], {
      cwd: root,
      windowsHide: true,
    });
    let buffer = "";
    let errors = "";
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const [tag, ...rest] = line.split(" ");
        const value = rest.join(" ");
        if (tag === "BUNDLE") render = { ...render, stage: "Đang đóng gói mã", progress: Number(value) * 0.1 };
        else if (tag === "PROGRESS") render = { ...render, stage: "Đang dựng hình", progress: 0.1 + Number(value) * 0.9 };
        else if (tag === "DONE") render = { ...render, output: value };
      }
    });
    child.stderr.on("data", (d) => (errors += d));
    child.on("close", (code) => {
      render =
        code === 0 && render.output
          ? { ...render, status: "done", progress: 1, stage: "Hoàn tất" }
          : { ...render, status: "error", error: errors.slice(-800) || `Mã lỗi ${code}` };
    });
  };

  const handle = async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    const route = `${req.method} ${url.pathname}`;

    if (route === "GET /api/projects") {
      const list = fs
        .readdirSync(projectsDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
          const id = f.slice(0, -5);
          let name = id;
          try {
            name = JSON.parse(fs.readFileSync(path.join(projectsDir, f), "utf8")).name ?? id;
          } catch {
            /* file hỏng: vẫn liệt kê theo tên file */
          }
          return { id, name, updatedAt: fs.statSync(path.join(projectsDir, f)).mtimeMs };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
      return sendJson(res, list);
    }

    const projectMatch = /^\/api\/projects\/([^/]+)$/.exec(url.pathname);
    if (projectMatch) {
      const id = decodeURIComponent(projectMatch[1]);
      if (!validId(id)) return sendJson(res, { error: "Mã dự án không hợp lệ" }, 400);
      if (req.method === "GET") {
        if (!fs.existsSync(projectFile(id))) return sendJson(res, { error: "Không tìm thấy dự án" }, 404);
        return sendJson(res, JSON.parse(fs.readFileSync(projectFile(id), "utf8")));
      }
      if (req.method === "PUT") {
        const body = await readBody(req);
        if (!body || !Array.isArray(body.tracks)) return sendJson(res, { error: "Dữ liệu không hợp lệ" }, 400);
        const tmp = `${projectFile(id)}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify({ ...body, id }, null, 2), "utf8");
        fs.renameSync(tmp, projectFile(id));
        return sendJson(res, { ok: true });
      }
    }

    if (route === "GET /api/sources") {
      const files = fs
        .readdirSync(sourceDir, { withFileTypes: true })
        .filter((e) => e.isFile() && kindOf(e.name))
        .map((e) => {
          const kind = kindOf(e.name)!;
          const ext = kind === "video" ? ".mp4" : path.extname(e.name).toLowerCase();
          return {
            name: e.name,
            kind,
            size: fs.statSync(path.join(sourceDir, e.name)).size,
            imported: fs.existsSync(path.join(mediaDir, `${safeBase(e.name)}${ext}`)),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      return sendJson(res, { dir: sourceDir, files });
    }

    if (route === "GET /api/thumb") {
      const src = sourcePath(url.searchParams.get("name"));
      if (!src || kindOf(src.base) === "audio") return sendJson(res, { error: "Không có ảnh" }, 404);
      const thumb = await makeThumb(src);
      if (!thumb) return sendJson(res, { error: "Không tạo được ảnh" }, 500);
      res.setHeader("Cache-Control", "max-age=86400");
      return sendFile(req, res, thumb);
    }

    if (route === "POST /api/import") {
      const src = sourcePath((await readBody(req)).name);
      if (!src) return sendJson(res, { error: "Không tìm thấy file nguồn" }, 404);
      let job = importing.get(src.base);
      if (!job) {
        job = importLimit(() => importMedia(src)).finally(() => importing.delete(src.base));
        importing.set(src.base, job);
      }
      return sendJson(res, await job);
    }

    if (route === "POST /api/render") {
      const { id } = await readBody(req);
      if (!validId(id) || !fs.existsSync(projectFile(id))) return sendJson(res, { error: "Không tìm thấy dự án" }, 404);
      if (render.status !== "running") startRender(id);
      return sendJson(res, render);
    }

    if (route === "GET /api/render") return sendJson(res, render);

    if (route === "POST /api/reveal") {
      // Mở Explorer tại file vừa xuất.
      if (render.output && fs.existsSync(render.output)) {
        spawn("explorer.exe", [`/select,${render.output}`], { detached: true, stdio: "ignore" }).unref();
      }
      return sendJson(res, { ok: true });
    }

    return sendJson(res, { error: "Không có API này" }, 404);
  };

  return {
    name: "editor-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname.startsWith("/media/")) {
          // Tự phục vụ clip đã chuyển mã (có hỗ trợ Range) để file mới nhập dùng được ngay.
          const file = path.join(mediaDir, path.basename(decodeURIComponent(url.pathname)));
          return sendFile(req, res, file);
        }
        if (!url.pathname.startsWith("/api/")) return next();
        handle(req, res, url).catch((err) => sendJson(res, { error: String(err?.message ?? err) }, 500));
      });
    },
  };
};
