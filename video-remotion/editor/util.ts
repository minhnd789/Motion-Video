export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** 00:03.12 — phút:giây.khung */
export const formatTime = (frame: number, fps: number) => {
  const f = Math.max(0, Math.round(frame));
  const totalSeconds = Math.floor(f / fps);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  const ff = String(f % fps).padStart(2, "0");
  return `${mm}:${ss}.${ff}`;
};

export const formatSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

/** Đổi tên dự án thành mã chỉ gồm chữ không dấu, số và gạch nối. */
export const slugify = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "du-an";
