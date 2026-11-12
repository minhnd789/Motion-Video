import { Easing, random, spring } from "remotion";
import type { Anim, AnimType, EasingType, LoopType, VisualClip } from "./types";

export type Xf = {
  opacity: number;
  tx: number;
  ty: number;
  scale: number;
  /** Co giãn riêng theo trục (squash & stretch) */
  sx: number;
  sy: number;
  rotate: number;
  /** Xoay 3D */
  rotateX: number;
  rotateY: number;
  skewX: number;
  blur: number;
  /** CSS clip-path (lộ dần, hình tròn mở ra) */
  clip?: string;
  /** Vị trí vạch chia so sánh trước/sau, 0–100 (%) */
  divider?: number;
};

const IDENTITY: Xf = {
  opacity: 1,
  tx: 0,
  ty: 0,
  scale: 1,
  sx: 1,
  sy: 1,
  rotate: 0,
  rotateX: 0,
  rotateY: 0,
  skewX: 0,
  blur: 0,
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

type EaseFn = (t: number) => number;

/** Mỗi kiểu easing có một đường cho lúc vào và một đường cho lúc ra. */
const EASINGS: Record<EasingType, { enter: EaseFn; exit: EaseFn }> = {
  smooth: { enter: Easing.out(Easing.cubic), exit: Easing.in(Easing.cubic) },
  linear: { enter: Easing.linear, exit: Easing.linear },
  inOut: { enter: Easing.inOut(Easing.cubic), exit: Easing.inOut(Easing.cubic) },
  back: { enter: Easing.out(Easing.back(1.9)), exit: Easing.in(Easing.back(1.9)) },
  elastic: { enter: Easing.out(Easing.elastic(1.1)), exit: Easing.in(Easing.elastic(1.1)) },
  bounce: { enter: Easing.bounce, exit: (t) => 1 - Easing.bounce(1 - t) },
  anticipate: {
    enter: Easing.bezier(0.6, -0.55, 0.3, 1.25),
    exit: Easing.bezier(0.6, -0.6, 0.6, 1),
  },
};

const pct = (v: number) => `${(clamp01(v) * 100).toFixed(3)}%`;

/**
 * e: 0 = ẩn hoàn toàn, 1 = hiển thị bình thường (đã qua easing).
 * p: tiến độ thô 0→1 theo thời gian (không easing), dùng cho hiệu ứng có kịch bản riêng.
 * dir: 1 khi đi vào, -1 khi đi ra (đảo chiều chuyển động).
 */
const phase = (
  type: AnimType,
  e: number,
  p: number,
  dir: 1 | -1,
  dist: { x: number; y: number },
  fadeWithSlide: boolean,
  seed: string,
): Xf => {
  const h = 1 - e;
  const slideOpacity = fadeWithSlide ? clamp01(e) : 1;
  switch (type) {
    case "none":
      return IDENTITY;
    case "fade":
      return { ...IDENTITY, opacity: clamp01(e) };
    case "slideUp":
      return { ...IDENTITY, ty: h * dist.y * dir, opacity: slideOpacity };
    case "slideDown":
      return { ...IDENTITY, ty: -h * dist.y * dir, opacity: slideOpacity };
    case "slideLeft":
      return { ...IDENTITY, tx: h * dist.x * dir, opacity: slideOpacity };
    case "slideRight":
      return { ...IDENTITY, tx: -h * dist.x * dir, opacity: slideOpacity };
    case "zoomIn":
      return { ...IDENTITY, scale: dir === 1 ? 0.5 + 0.5 * e : 1 + 0.5 * h, opacity: clamp01(e) };
    case "zoomOut":
      return { ...IDENTITY, scale: dir === 1 ? 1.5 - 0.5 * e : 1 - 0.5 * h, opacity: clamp01(e) };
    case "pop":
      return { ...IDENTITY, scale: Math.max(0, e), opacity: clamp01(e * 3) };
    case "blur":
      return { ...IDENTITY, blur: Math.max(0, h) * 24, opacity: clamp01(e) };
    case "spin":
      return { ...IDENTITY, rotate: -h * 180 * dir, scale: Math.max(0, e), opacity: clamp01(e) };
    case "wipeRight":
      return { ...IDENTITY, clip: `inset(0 ${pct(h)} 0 0)` };
    case "wipeLeft":
      return { ...IDENTITY, clip: `inset(0 0 0 ${pct(h)})` };
    case "wipeUp":
      return { ...IDENTITY, clip: `inset(${pct(h)} 0 0 0)` };
    case "wipeDown":
      return { ...IDENTITY, clip: `inset(0 0 ${pct(h)} 0)` };
    case "circle":
      return { ...IDENTITY, clip: `circle(${(Math.max(0, e) * 72).toFixed(3)}% at 50% 50%)` };
    case "compare":
      return { ...IDENTITY, clip: `inset(0 ${pct(h)} 0 0)`, divider: e < 0.999 ? clamp01(e) * 100 : undefined };
    case "zoomThrough":
      return dir === 1
        ? { ...IDENTITY, scale: 1 + h * 0.9, blur: h * 22, opacity: clamp01(e * 2.5) }
        : { ...IDENTITY, scale: 1 + h * 3.2, blur: h * 26, opacity: clamp01(e * 1.6) };
    case "flip":
      return { ...IDENTITY, rotateY: -h * 90 * dir, opacity: e > 0.02 ? 1 : 0 };
    case "drop": {
      // Rơi xuống (kéo dài), chạm đất bẹp ra, nảy nhẹ một nhịp rồi đứng yên.
      const D = dist.y * 2.2;
      if (p < 0.5) {
        const f = p / 0.5;
        return { ...IDENTITY, ty: -(1 - f * f) * D * dir, sx: 1 - 0.14 * f, sy: 1 + 0.22 * f };
      }
      if (p < 0.66) {
        const s = Math.sin(((p - 0.5) / 0.16) * Math.PI);
        return { ...IDENTITY, sx: 1 + 0.28 * s, sy: 1 - 0.3 * s };
      }
      if (p < 0.88) {
        const s = Math.sin(((p - 0.66) / 0.22) * Math.PI);
        return { ...IDENTITY, ty: -s * D * 0.12 * dir, sx: 1 - 0.05 * s, sy: 1 + 0.07 * s };
      }
      const s = Math.sin(((p - 0.88) / 0.12) * Math.PI);
      return { ...IDENTITY, sx: 1 + 0.08 * s, sy: 1 - 0.08 * s };
    }
    case "settle": {
      // Thân trượt vào rồi dừng, phần "đuôi" còn lắc thêm vài nhịp mới yên.
      const wag = Math.exp(-4.5 * p) * Math.sin(p * Math.PI * 5);
      return {
        ...IDENTITY,
        tx: -h * dist.x * dir,
        opacity: slideOpacity,
        skewX: -18 * wag * dir,
        rotate: 5 * wag * dir,
      };
    }
    case "glitch": {
      const k = Math.floor(p * 18);
      const r1 = random(`${seed}-g1-${k}`) - 0.5;
      const r2 = random(`${seed}-g2-${k}`) - 0.5;
      const on = p > 0.75 || random(`${seed}-g3-${k}`) > 0.35;
      const amp = 1 - p;
      return {
        ...IDENTITY,
        tx: r1 * 70 * amp,
        ty: r2 * 16 * amp,
        skewX: r2 * 30 * amp,
        opacity: on ? 1 : 0.15,
        clip: amp > 0.1 ? `inset(${pct(Math.abs(r1) * 0.5 * amp)} 0 ${pct(Math.abs(r2) * 0.5 * amp)} 0)` : undefined,
      };
    }
  }
};

const loopXf = (loop: LoopType, frame: number, fps: number, duration: number, isText: boolean, seed: string): Xf => {
  const t = frame / fps;
  switch (loop) {
    case "none":
      return IDENTITY;
    case "kenburns":
      return { ...IDENTITY, scale: 1 + 0.12 * clamp01(frame / Math.max(1, duration)) };
    case "pulse":
      return { ...IDENTITY, scale: 1 + 0.045 * Math.sin(t * Math.PI * 2 * 1.2) };
    case "float":
      return { ...IDENTITY, ty: 14 * Math.sin(t * Math.PI * 2 * 0.6) };
    case "shake":
      return {
        ...IDENTITY,
        tx: 7 * Math.sin(t * 31),
        ty: 5 * Math.sin(t * 27 + 1),
        rotate: 1.2 * Math.sin(t * 23),
      };
    case "swing":
      return { ...IDENTITY, rotate: 4 * Math.sin(t * Math.PI * 2 * 0.7) };
    case "bounce": {
      // Nảy tại chỗ: kéo dài khi bay nhanh, bẹp lại khi chạm đất.
      const u = (t / 0.8) % 1;
      const hgt = Math.sin(u * Math.PI);
      const ground = hgt < 0.2 ? 1 - hgt / 0.2 : 0;
      const speed = Math.abs(Math.cos(u * Math.PI));
      return {
        ...IDENTITY,
        ty: -hgt * (isText ? 60 : 90),
        sx: 1 + 0.2 * ground - 0.08 * speed * (1 - ground),
        sy: 1 - 0.2 * ground + 0.1 * speed * (1 - ground),
      };
    }
    case "spin":
      return { ...IDENTITY, rotate: (t * 120) % 360 };
    case "stopmotion": {
      const k = Math.floor(frame / 3);
      return {
        ...IDENTITY,
        tx: (random(`${seed}-sm-x-${k}`) - 0.5) * 10,
        ty: (random(`${seed}-sm-y-${k}`) - 0.5) * 10,
        rotate: (random(`${seed}-sm-r-${k}`) - 0.5) * 3,
      };
    }
    case "boil": {
      const k = Math.floor(frame / 4);
      return {
        ...IDENTITY,
        tx: (random(`${seed}-b-x-${k}`) - 0.5) * 4,
        ty: (random(`${seed}-b-y-${k}`) - 0.5) * 4,
        rotate: (random(`${seed}-b-r-${k}`) - 0.5) * 1.6,
        skewX: (random(`${seed}-b-s-${k}`) - 0.5) * 2,
      };
    }
    case "glitch": {
      const cycle = Math.floor(frame / 40);
      const local = frame % 40;
      if (local > 6 || random(`${seed}-gl-${cycle}`) < 0.25) return IDENTITY;
      const r = random(`${seed}-gl-${frame}`) - 0.5;
      const r2 = random(`${seed}-gl2-${frame}`) - 0.5;
      return {
        ...IDENTITY,
        tx: r * 50,
        skewX: r2 * 18,
        opacity: local % 3 === 1 ? 0.55 : 1,
        clip: `inset(${(Math.abs(r2) * 30).toFixed(1)}% 0 ${(Math.abs(r) * 30).toFixed(1)}% 0)`,
      };
    }
    case "flicker": {
      // Bật lên chập chờn ở đầu, sau đó thỉnh thoảng chớp nhẹ.
      if (frame < 24) {
        const on = [0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0.4, 1, 1, 1, 1, 1, 1, 1][Math.max(0, frame)];
        return { ...IDENTITY, opacity: 0.15 + 0.85 * on };
      }
      const k = Math.floor(frame / 2);
      return { ...IDENTITY, opacity: random(`${seed}-fl-${k}`) < 0.06 ? 0.45 : 1 };
    }
    case "panSlow":
    case "panFast": {
      const span = loop === "panSlow" ? 80 : 260;
      const pr = clamp01(frame / Math.max(1, duration));
      return { ...IDENTITY, tx: span / 2 - span * pr, scale: isText ? 1 : 1 + (span * 1.2) / 1080 };
    }
  }
};

const animLength = (anim: Anim, clipDuration: number) =>
  Math.max(1, Math.min(anim.duration, Math.floor(clipDuration / 2)));

/** Hiệu ứng có kịch bản riêng, không dùng đường easing chung */
const SCRIPTED: AnimType[] = ["drop", "settle", "glitch"];

const rawXf = (clip: VisualClip, frame: number, fps: number, width: number, height: number): Xf => {
  const isText = clip.type === "text" || clip.type === "motion";
  const dist = isText ? { x: width * 0.18, y: height * 0.1 } : { x: width, y: height };
  // Stop motion: hiệu ứng vào/ra cũng chạy giật theo bước 3 khung hình.
  const f = clip.loop === "stopmotion" ? Math.floor(frame / 3) * 3 : frame;

  let enter = IDENTITY;
  if (clip.animIn.type !== "none") {
    const d = animLength(clip.animIn, clip.duration);
    const p = clamp01(f / d);
    let e: number;
    if (SCRIPTED.includes(clip.animIn.type)) e = Easing.out(Easing.cubic)(p);
    else if (clip.animIn.type === "pop" && !clip.animIn.easing)
      e = spring({ frame: f, fps, durationInFrames: d, config: { damping: 11, mass: 0.6 } });
    else e = EASINGS[clip.animIn.easing ?? "smooth"].enter(p);
    enter = phase(clip.animIn.type, e, p, 1, dist, isText, `${clip.id}-in`);
  }

  let exit = IDENTITY;
  if (clip.animOut.type !== "none") {
    const d = animLength(clip.animOut, clip.duration);
    const remaining = clamp01((clip.duration - f) / d);
    const q = 1 - remaining;
    const e = SCRIPTED.includes(clip.animOut.type)
      ? 1 - Easing.in(Easing.cubic)(q)
      : 1 - EASINGS[clip.animOut.easing ?? "smooth"].exit(q);
    exit = phase(clip.animOut.type, e, remaining, -1, dist, isText, `${clip.id}-out`);
  }

  const loop = loopXf(clip.loop, frame, fps, clip.duration, isText, clip.id);
  const clipPath = [enter.clip, exit.clip, loop.clip].filter(Boolean);

  return {
    opacity: clip.opacity * enter.opacity * exit.opacity * loop.opacity,
    tx: enter.tx + exit.tx + loop.tx,
    ty: enter.ty + exit.ty + loop.ty,
    scale: clip.scale * enter.scale * exit.scale * loop.scale,
    sx: enter.sx * exit.sx * loop.sx,
    sy: enter.sy * exit.sy * loop.sy,
    rotate: clip.rotation + enter.rotate + exit.rotate + loop.rotate,
    rotateX: enter.rotateX + exit.rotateX,
    rotateY: enter.rotateY + exit.rotateY,
    skewX: enter.skewX + exit.skewX + loop.skewX,
    blur: enter.blur + exit.blur,
    // Chỉ dùng được một clip-path: ưu tiên lúc vào, rồi lúc ra, rồi hiệu ứng lặp.
    clip: clipPath[0],
    divider: enter.divider ?? exit.divider,
  };
};

/** Tính biến đổi (vị trí, tỉ lệ, độ mờ…) của một clip tại khung hình `frame` kể từ đầu clip. */
export const computeXf = (clip: VisualClip, frame: number, fps: number, width: number, height: number): Xf => {
  const now = rawXf(clip, frame, fps, width, height);
  if (!clip.motionBlur || frame < 1) return now;
  // Nhoè theo tốc độ: so với khung hình trước.
  const prev = rawXf(clip, frame - 1, fps, width, height);
  const speed =
    Math.hypot(now.tx - prev.tx, now.ty - prev.ty) +
    Math.abs(now.scale - prev.scale) * 600 +
    Math.abs(now.rotate - prev.rotate) * 4;
  return { ...now, blur: now.blur + Math.min(36, speed * 0.22) };
};

/** Chuỗi CSS transform từ Xf (dùng cho khung bao clip). */
export const xfTransform = (xf: Xf) => {
  const parts = [`translate(-50%, -50%) translate(${xf.tx}px, ${xf.ty}px)`];
  if (xf.rotateX || xf.rotateY) parts.push(`perspective(1400px) rotateX(${xf.rotateX}deg) rotateY(${xf.rotateY}deg)`);
  parts.push(`rotate(${xf.rotate}deg)`);
  if (xf.skewX) parts.push(`skewX(${xf.skewX}deg)`);
  parts.push(`scale(${xf.scale})`);
  if (xf.sx !== 1 || xf.sy !== 1) parts.push(`scale(${xf.sx}, ${xf.sy})`);
  return parts.join(" ");
};
