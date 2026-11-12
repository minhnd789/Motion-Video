// Lớp hiệu ứng phủ (VFX) dùng chung cho clip video/ảnh và các mẫu đồ hoạ.
import React from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import type { ImageClip, VideoClip } from "./types";

export const STAR = "M12 0C12.6 7 17 11.4 24 12C17 12.6 12.6 17 12 24C11.4 17 7 12.6 0 12C7 11.4 11.4 7 12 0Z";
export const cover: React.CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" };
const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Lấp lánh: vài ngôi sao nhỏ hiện rồi tắt ở vùng món ăn (tránh phần trên nơi đặt chữ). */
export const Sparkles: React.FC<{ seed: string }> = ({ seed }) => {
  const frame = useCurrentFrame();
  return (
    <div style={cover}>
      {Array.from({ length: 6 }).map((_, i) => {
        const period = 34 + Math.floor(random(`${seed}-period-${i}`) * 22);
        const t = frame + Math.floor(random(`${seed}-offset-${i}`) * period);
        const cycle = Math.floor(t / period);
        const local = t % period;
        const life = 18;
        if (local >= life) return null;
        const p = Math.sin((local / life) * Math.PI);
        const size = 46 + random(`${seed}-size-${i}-${cycle}`) * 60;
        return (
          <svg
            key={i}
            viewBox="0 0 24 24"
            style={{
              position: "absolute",
              left: `${8 + random(`${seed}-x-${i}-${cycle}`) * 84}%`,
              top: `${36 + random(`${seed}-y-${i}-${cycle}`) * 50}%`,
              width: size,
              height: size,
              transform: `translate(-50%, -50%) scale(${p}) rotate(${local * 3}deg)`,
              opacity: p * 0.9,
              filter: "drop-shadow(0 0 8px rgba(255, 255, 255, 0.9))",
            }}
          >
            <path d={STAR} fill="#ffffff" />
          </svg>
        );
      })}
    </div>
  );
};

export type ParticleKind = "confetti" | "sparkle" | "bubbles" | "firework";

/**
 * Hệ hạt vẽ trong khung w×h (pixel). Mọi giá trị ngẫu nhiên đều có hạt giống cố định
 * nên xem trước và xuất file ra giống hệt nhau.
 */
export const Particles: React.FC<{
  kind: ParticleKind;
  seed: string;
  w: number;
  h: number;
  count: number;
  colors: string[];
}> = ({ kind, seed, w, h, count, colors }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const r = (k: string) => random(`${seed}-${k}`);
  const items: React.ReactNode[] = [];

  for (let i = 0; i < count; i++) {
    const color = colors[i % colors.length];
    if (kind === "confetti") {
      // Bắn lên từ đáy giữa rồi rơi xuống theo trọng lực, xoay lật.
      const angle = -Math.PI / 2 + (r(`a${i}`) - 0.5) * 1.6;
      const speed = h * (0.9 + r(`s${i}`) * 0.9);
      const delay = r(`d${i}`) * 0.25;
      const tt = Math.max(0, t - delay);
      const g = h * 1.25;
      const x = w / 2 + Math.cos(angle) * speed * tt * 0.75 + Math.sin(tt * 3 + i) * 30;
      const y = h * 1.02 + Math.sin(angle) * speed * tt + 0.5 * g * tt * tt;
      if (t < delay || y > h * 1.1) continue;
      const size = 14 + r(`z${i}`) * 16;
      items.push(
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: size,
            height: size * 0.55,
            background: color,
            borderRadius: 3,
            transform: `translate(-50%, -50%) rotate(${tt * 400 * (r(`r${i}`) - 0.5)}deg) scaleY(${Math.cos(tt * 9 + i)})`,
          }}
        />,
      );
    } else if (kind === "sparkle") {
      const period = 1.2 + r(`p${i}`) * 1.4;
      const local = (t + r(`o${i}`) * period) % period;
      const cycle = Math.floor((t + r(`o${i}`) * period) / period);
      const life = local / period;
      const x = r(`x${i}-${cycle}`) * w;
      const y = h * (0.15 + r(`y${i}-${cycle}`) * 0.85) - life * h * 0.12;
      const s = Math.sin(life * Math.PI);
      const size = 16 + r(`z${i}-${cycle}`) * 34;
      items.push(
        <svg
          key={i}
          viewBox="0 0 24 24"
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: size,
            height: size,
            transform: `translate(-50%, -50%) scale(${s}) rotate(${life * 180}deg)`,
            opacity: s,
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        >
          <path d={STAR} fill={color} />
        </svg>,
      );
    } else if (kind === "bubbles") {
      const period = 3 + r(`p${i}`) * 3;
      const local = ((t + r(`o${i}`) * period) % period) / period;
      const x = r(`x${i}`) * w + Math.sin(local * Math.PI * 4 + i) * 24;
      const y = h * (1.05 - local * 1.15);
      const size = 18 + r(`z${i}`) * 50;
      items.push(
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: size,
            height: size,
            borderRadius: "50%",
            border: `3px solid ${color}`,
            background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.55), transparent 45%)",
            transform: "translate(-50%, -50%)",
            opacity: Math.sin(local * Math.PI) * 0.9,
          }}
        />,
      );
    } else {
      // Pháo hoa: mỗi 1,6 giây nổ một chùm ở vị trí khác nhau.
      const per = 1.6;
      const burst = Math.floor(t / per);
      const local = (t % per) / per;
      const cx = w * (0.2 + r(`bx${burst}`) * 0.6);
      const cy = h * (0.2 + r(`by${burst}`) * 0.4);
      const ang = (i / count) * Math.PI * 2;
      const dist = Math.min(w, h) * 0.32 * (1 - Math.pow(1 - local, 3));
      const x = cx + Math.cos(ang) * dist;
      const y = cy + Math.sin(ang) * dist + local * local * 80;
      items.push(
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: colors[burst % colors.length],
            boxShadow: `0 0 14px ${colors[burst % colors.length]}`,
            transform: "translate(-50%, -50%)",
            opacity: 1 - local,
          }}
        />,
      );
    }
  }
  return <div style={{ ...cover, width: w, height: h }}>{items}</div>;
};

/** Sọc quét, dải nhiễu chạy dọc, chữ PLAY và giờ như băng video thập niên 90. */
export const VhsLayer: React.FC<{ seed: string; label?: boolean }> = ({ seed, label = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const band = ((frame * 7) % 2600) / 2600;
  const jitter = random(`${seed}-vhs-${Math.floor(frame / 2)}`) - 0.5;
  const secs = Math.floor(frame / fps);
  const stamp = `00:${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  const font: React.CSSProperties = {
    position: "absolute",
    fontFamily: "'Courier New', monospace",
    fontWeight: 700,
    fontSize: 54,
    color: "#ffffff",
    textShadow: "3px 0 rgba(255,0,60,0.8), -3px 0 rgba(0,220,255,0.8)",
    letterSpacing: 4,
  };
  return (
    <div style={cover}>
      <div style={{ ...cover, background: "rgba(40, 10, 60, 0.12)", mixBlendMode: "screen" }} />
      <div
        style={{
          ...cover,
          background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0px, rgba(0,0,0,0.28) 2px, transparent 2px, transparent 5px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `${band * 120 - 10}%`,
          height: "6%",
          background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.18), transparent)",
          transform: `translateX(${jitter * 30}px)`,
        }}
      />
      <div style={{ ...cover, boxShadow: "inset 0 0 220px rgba(0,0,0,0.65)" }} />
      {label && (
        <>
          <div style={{ ...font, left: 60, top: 70 }}>PLAY ▶</div>
          <div style={{ ...font, right: 60, bottom: 90, fontSize: 44 }}>{stamp}</div>
        </>
      )}
    </div>
  );
};

/** Dải lệch màu và nhiễu cắt ngang xuất hiện từng đợt ngắn. */
export const GlitchLayer: React.FC<{ seed: string }> = ({ seed }) => {
  const frame = useCurrentFrame();
  const cycle = Math.floor(frame / 36);
  const local = frame % 36;
  if (local > 7 || random(`${seed}-glc-${cycle}`) < 0.2) return null;
  return (
    <div style={cover}>
      {Array.from({ length: 5 }).map((_, i) => {
        const r = (k: string) => random(`${seed}-gb-${frame}-${i}-${k}`);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${r("t") * 95}%`,
              height: `${1 + r("h") * 7}%`,
              transform: `translateX(${(r("x") - 0.5) * 120}px)`,
              background: ["rgba(255,0,80,0.45)", "rgba(0,230,255,0.45)", "rgba(255,255,255,0.35)"][i % 3],
              mixBlendMode: "screen",
            }}
          />
        );
      })}
      <div
        style={{
          ...cover,
          background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 3px)",
        }}
      />
    </div>
  );
};

export const Vfx: React.FC<{ clip: VideoClip | ImageClip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  switch (clip.vfx) {
    case "sparkle":
      return <Sparkles seed={clip.id} />;
    case "shine": {
      // Một vệt sáng chéo lướt từ trái sang phải ngay đầu cảnh.
      const left = interpolate(frame, [6, 30], [-50, 130], clampOpts);
      return (
        <div style={cover}>
          <div
            style={{
              position: "absolute",
              top: "-10%",
              bottom: "-10%",
              left: `${left}%`,
              width: "32%",
              transform: "skewX(-18deg)",
              background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.34), transparent)",
            }}
          />
        </div>
      );
    }
    case "vignette":
      return (
        <div
          style={{
            ...cover,
            background: "radial-gradient(ellipse at center, transparent 42%, rgba(0, 0, 0, 0.55) 100%)",
          }}
        />
      );
    case "flash":
      return (
        <div
          style={{ ...cover, backgroundColor: "#ffffff", opacity: interpolate(frame, [0, 8], [0.4, 0], clampOpts) }}
        />
      );
    case "glitch":
      return <GlitchLayer seed={clip.id} />;
    case "vhs":
      return <VhsLayer seed={clip.id} />;
    case "confetti":
      return (
        <Particles
          kind="confetti"
          seed={clip.id}
          w={clip.boxWidth || width}
          h={clip.boxHeight || height}
          count={70}
          colors={["#ffd166", "#ef476f", "#06d6a0", "#118ab2", "#ffffff"]}
        />
      );
    default:
      return null;
  }
};
