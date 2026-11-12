// Vẽ các mẫu đồ hoạ chuyển động (clip loại "motion").
// Mọi chuyển động tính từ khung hình hiện tại nên xem trước và xuất file giống hệt nhau.
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { evolvePath, getLength, getPointAtLength } from "@remotion/paths";
import {
  Bell,
  Check,
  Flame,
  Gift,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  Bookmark,
  ShoppingCart,
  Soup,
  Star,
  ThumbsUp,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import React from "react";
import {
  Easing,
  Img,
  interpolate,
  interpolateColors,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Particles, ParticleKind, VhsLayer } from "./fx";
import { ensureFont } from "./fonts";
import type { MotionClip } from "./types";

// ---------- Tiện ích ----------

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = Easing.out(Easing.cubic);
const easeInOut = Easing.inOut(Easing.cubic);
/** Tiến độ 0→1 của đoạn bắt đầu ở `start` giây, dài `len` giây. */
const seg = (t: number, start: number, len: number) => clamp01((t - start) / len);
const resolveSrc = (src: string) => (/^(https?:|data:|blob:)/.test(src) ? src : staticFile(src));

const hexToRgb = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** Làm sáng (k > 1) hoặc tối (k < 1) một màu hex */
const shade = (hex: string, k: number) => {
  const [r, g, b] = hexToRgb(hex).map((c) => Math.round(Math.min(255, Math.max(0, k >= 1 ? c + (255 - c) * (k - 1) : c * k))));
  return `rgb(${r}, ${g}, ${b})`;
};
const alpha = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** Đường cong mượt (Catmull-Rom) đi qua các điểm */
const smoothPath = (pts: [number, number][], closed = false) => {
  if (pts.length < 2) return "";
  const p = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M ${p[1][0].toFixed(1)} ${p[1][1].toFixed(1)}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [x0, y0] = p[i - 1];
    const [x1, y1] = p[i];
    const [x2, y2] = p[i + 1];
    const [x3, y3] = p[i + 2];
    d += ` C ${(x1 + (x2 - x0) / 6).toFixed(1)} ${(y1 + (y2 - y0) / 6).toFixed(1)}, ${(x2 - (x3 - x1) / 6).toFixed(1)} ${(
      y2 -
      (y3 - y1) / 6
    ).toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return closed ? d + " Z" : d;
};

/** Khoảng cách từ tâm tới cạnh đa giác theo hướng góc `a` (dùng cho biến hình). */
const rayPolygon = (verts: [number, number][], a: number) => {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  let best = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const [ax, ay] = verts[i];
    const [bx, by] = verts[(i + 1) % verts.length];
    const ex = bx - ax;
    const ey = by - ay;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = (ax * ey - ay * ex) / den;
    const u = (ax * dy - ay * dx) / den;
    if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.min(best, t);
  }
  return Number.isFinite(best) ? best : 1;
};

const regular = (n: number, r: number, rot = -Math.PI / 2): [number, number][] =>
  Array.from({ length: n }, (_, i) => [r * Math.cos(rot + (i / n) * Math.PI * 2), r * Math.sin(rot + (i / n) * Math.PI * 2)]);

const starVerts = (points: number, outer: number, inner: number): [number, number][] =>
  Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    return [r * Math.cos(a), r * Math.sin(a)];
  });

const polyPoints = (verts: [number, number][], cx: number, cy: number) =>
  verts.map(([x, y]) => `${(cx + x).toFixed(1)},${(cy + y).toFixed(1)}`).join(" ");

const heartPath = (cx: number, cy: number, s: number) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    pts.push([
      cx + s * 16 * Math.pow(Math.sin(t), 3),
      cy - s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
    ]);
  }
  return smoothPath(pts, true);
};

type P = { clip: MotionClip; frame: number; t: number; fps: number };

const Box: React.FC<{ clip: MotionClip; children: React.ReactNode; style?: React.CSSProperties }> = ({ clip, children, style }) => (
  <div
    style={{
      position: "relative",
      width: clip.w,
      height: clip.h,
      fontFamily: `"${ensureFont(clip.fontFamily)}", sans-serif`,
      color: "#ffffff",
      ...style,
    }}
  >
    {children}
  </div>
);

const Svg: React.FC<{ clip: MotionClip; children: React.ReactNode; vw?: number; vh?: number }> = ({ clip, children, vw, vh }) => (
  <svg
    viewBox={`0 0 ${vw ?? clip.w} ${vh ?? clip.h}`}
    width={clip.w}
    height={clip.h}
    style={{ position: "absolute", inset: 0, overflow: "visible" }}
  >
    {children}
  </svg>
);

// ---------- Chữ ----------

const LowerThird: React.FC<P> = ({ clip, frame, fps, t }) => {
  const bar = spring({ frame, fps, config: { damping: 14 } });
  const e1 = easeOut(seg(t, 0.12, 0.45));
  const e2 = easeOut(seg(t, 0.32, 0.45));
  const e3 = easeOut(seg(t, 0.48, 0.45));
  return (
    <Box clip={clip}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 18,
          height: 236,
          background: clip.color2,
          borderRadius: 6,
          transform: `scaleY(${bar})`,
          transformOrigin: "top",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 34,
          top: 0,
          height: 140,
          padding: "0 44px",
          display: "flex",
          alignItems: "center",
          background: clip.color,
          borderRadius: 10,
          clipPath: `inset(0 ${(1 - e1) * 100}% 0 0)`,
          overflow: "hidden",
          boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
        }}
      >
        <span style={{ fontSize: 78, fontWeight: 800, whiteSpace: "nowrap", transform: `translateY(${(1 - e2) * 110}%)` }}>
          {clip.text}
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 34,
          top: 156,
          height: 80,
          padding: "0 30px",
          display: "flex",
          alignItems: "center",
          background: clip.color2,
          color: clip.color3,
          borderRadius: 8,
          clipPath: `inset(0 ${(1 - e3) * 100}% 0 0)`,
        }}
      >
        <span style={{ fontSize: 42, fontWeight: 700, whiteSpace: "nowrap", opacity: e3 }}>{clip.text2}</span>
      </div>
    </Box>
  );
};

// ---------- Hình khối 2D ----------

const Shapes: React.FC<P> = ({ clip, frame, fps, t }) => {
  const pop = (d: number) => spring({ frame: frame - d, fps, config: { damping: 10, mass: 0.6 } });
  const cx = clip.w / 2;
  const cy = clip.h / 2;
  return (
    <Box clip={clip}>
      <Svg clip={clip}>
        {Array.from({ length: 10 }).map((_, i) => {
          const a = t * 0.9 + (i / 10) * Math.PI * 2;
          return (
            <circle
              key={i}
              cx={cx + Math.cos(a) * 380}
              cy={cy + Math.sin(a) * 380}
              r={10 * pop(10 + i)}
              fill={i % 2 ? clip.color2 : clip.color3}
              opacity={0.8}
            />
          );
        })}
        <circle
          cx={cx + 200 * Math.cos(t * 1.4)}
          cy={cy + 150 * Math.sin(t * 2.8)}
          r={110 * pop(0) * (1 + 0.12 * Math.sin(t * 4))}
          fill={clip.color}
        />
        <rect
          x={-90}
          y={-90}
          width={180}
          height={180}
          rx={24}
          fill={clip.color2}
          transform={`translate(${cx + 220 * Math.sin(t * 1.1 + 2)} ${cy + 200 * Math.cos(t * 1.1 + 2)}) rotate(${t * 90}) scale(${pop(5)})`}
        />
        <polygon
          points={polyPoints(regular(3, 110), 0, 0)}
          fill={clip.color3}
          transform={`translate(${cx - 180 * Math.cos(t * 0.9)} ${cy + 230 * Math.sin(t * 1.8 + 1)}) rotate(${-t * 120}) scale(${pop(9) * (1 + 0.2 * Math.sin(t * 3))})`}
        />
      </Svg>
    </Box>
  );
};

const Morph: React.FC<P> = ({ clip, t }) => {
  const R = Math.min(clip.w, clip.h) * 0.38;
  const shapes: ((a: number) => number)[] = [
    () => 1,
    (a) => rayPolygon(regular(4, 1.25, -Math.PI / 4), a),
    (a) => rayPolygon(regular(3, 1.3), a),
    (a) => rayPolygon(starVerts(5, 1.3, 0.55), a),
  ];
  const step = 1.1;
  const k = Math.floor(t / step);
  const local = (t % step) / step;
  const m = easeInOut(seg(local, 0.35, 0.65));
  const from = shapes[k % shapes.length];
  const to = shapes[(k + 1) % shapes.length];
  const pts: [number, number][] = [];
  const N = 96;
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
    const r = R * (from(a) * (1 - m) + to(a) * m);
    pts.push([clip.w / 2 + r * Math.cos(a), clip.h / 2 + r * Math.sin(a)]);
  }
  const color = interpolateColors((k % 2) + m, [0, 1, 2], [clip.color, clip.color2, clip.color]);
  return (
    <Box clip={clip}>
      <Svg clip={clip}>
        <g transform={`rotate(${t * 25} ${clip.w / 2} ${clip.h / 2})`}>
          <polygon points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} fill={color} />
        </g>
      </Svg>
    </Box>
  );
};

const LINE_PATHS: Record<string, string> = {
  underline: "M 60 330 C 250 250, 520 390, 840 270",
  arrow: "M 80 410 C 240 120, 540 110, 770 300 M 770 300 L 680 296 M 770 300 L 748 214",
  circle: "M 470 80 C 770 70, 870 250, 760 390 C 640 510, 200 480, 110 340 C 40 220, 210 60, 500 95",
  heart: "M 450 440 C 140 290, 160 70, 320 75 C 400 78, 440 140, 450 175 C 460 140, 500 78, 580 75 C 740 70, 760 290, 450 440 Z",
  check: "M 220 270 L 390 410 L 700 100",
  wave: "M 60 300 Q 150 120 240 300 T 420 300 T 600 300 T 780 300 T 860 250",
};

const LineDraw: React.FC<P> = ({ clip, t }) => {
  const d = LINE_PATHS[clip.variant] ?? LINE_PATHS.underline;
  const evo = evolvePath(easeInOut(seg(t, 0.1, 1.1)), d);
  return (
    <Box clip={clip}>
      <Svg clip={clip} vw={900} vh={500}>
        <path
          d={d}
          fill="none"
          stroke={clip.color}
          strokeWidth={clip.value || 16}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={evo.strokeDasharray}
          strokeDashoffset={evo.strokeDashoffset}
          style={{ filter: `drop-shadow(0 0 10px ${alpha(clip.color, 0.6)})` }}
        />
      </Svg>
    </Box>
  );
};

const Liquid: React.FC<P> = ({ clip, t }) => {
  const id = `goo-${clip.id}`;
  const cx = clip.w / 2;
  const cy = clip.h / 2;
  return (
    <Box clip={clip}>
      <Svg clip={clip}>
        <defs>
          <filter id={id}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="blur" />
            <feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -11" />
          </filter>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={clip.color} />
            <stop offset="1" stopColor={clip.color2} />
          </linearGradient>
        </defs>
        <g filter={`url(#${id})`} fill={`url(#${id}-g)`}>
          <circle cx={cx} cy={cy} r={130 + 15 * Math.sin(t * 2)} />
          {Array.from({ length: 5 }).map((_, i) => {
            const a = t * 0.9 + (i / 5) * Math.PI * 2;
            const dist = 175 + 95 * Math.sin(t * 1.6 + i * 1.3);
            return <circle key={i} cx={cx + Math.cos(a) * dist} cy={cy + Math.sin(a) * dist} r={62 + 18 * Math.sin(t * 2.2 + i)} />;
          })}
        </g>
      </Svg>
    </Box>
  );
};

const Loader: React.FC<P> = ({ clip, t }) => {
  const cx = clip.w / 2;
  const cy = clip.h / 2;
  const R = Math.min(clip.w, clip.h) * 0.34;
  if (clip.variant === "ring") {
    const C = 2 * Math.PI * R;
    const dash = C * (0.15 + 0.6 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.75)));
    return (
      <Box clip={clip}>
        <Svg clip={clip}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={alpha(clip.color, 0.15)} strokeWidth={34} />
          <circle
            cx={cx}
            cy={cy}
            r={R}
            fill="none"
            stroke={clip.color}
            strokeWidth={34}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C}`}
            transform={`rotate(${(t * 360) % 360} ${cx} ${cy})`}
          />
        </Svg>
      </Box>
    );
  }
  if (clip.variant === "bars") {
    return (
      <Box clip={clip}>
        <Svg clip={clip}>
          {Array.from({ length: 5 }).map((_, i) => {
            const hgt = R * (0.5 + 0.9 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 - i * 0.7)));
            return (
              <rect
                key={i}
                x={cx - 150 + i * 65}
                y={cy - hgt / 2}
                width={40}
                height={hgt}
                rx={20}
                fill={interpolateColors(i, [0, 4], [clip.color, clip.color2])}
              />
            );
          })}
        </Svg>
      </Box>
    );
  }
  return (
    <Box clip={clip}>
      <Svg clip={clip}>
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const wave = 0.5 + 0.5 * Math.cos((i / 12) * Math.PI * 2 - t * Math.PI * 2);
          return (
            <circle
              key={i}
              cx={cx + Math.cos(a) * R}
              cy={cy + Math.sin(a) * R}
              r={10 + 18 * wave}
              fill={interpolateColors(wave, [0, 1], [clip.color2, clip.color])}
              opacity={0.35 + 0.65 * wave}
            />
          );
        })}
      </Svg>
    </Box>
  );
};

const Isometric: React.FC<P> = ({ clip, frame, fps, t }) => {
  const s = Math.min(clip.w, clip.h) * 0.15;
  const ox = clip.w / 2;
  const oy = clip.h * 0.62;
  const c30 = Math.cos(Math.PI / 6);
  const pr = (x: number, y: number, z: number) => `${(ox + (x - y) * c30 * s).toFixed(1)},${(oy + (x + y) * 0.5 * s - z * s).toFixed(1)}`;
  const cubes = [
    { x: 0, y: 0, z: 0, color: clip.color, d: 0 },
    { x: 1, y: 0, z: 0, color: clip.color, d: 6 },
    { x: 0, y: 1, z: 0, color: clip.color, d: 12 },
    { x: 0, y: 0, z: 1, color: clip.color2, d: 20 },
    { x: -1, y: -1, z: 0, color: clip.color2, d: 28 },
  ].map((c) => {
    const drop = spring({ frame: frame - c.d, fps, config: { damping: 11, mass: 0.7 } });
    const bob = c.z > 0 ? 0.1 * Math.sin(t * 3) : 0;
    return { ...c, zz: c.z + (1 - drop) * 5 + bob, vis: frame >= c.d };
  });
  const order = [...cubes].sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z));
  return (
    <Box clip={clip}>
      <Svg clip={clip}>
        {[-2, -1, 0, 1].map((x) =>
          [-2, -1, 0, 1].map((y) => (
            <polygon
              key={`${x}${y}`}
              points={`${pr(x, y, 0)} ${pr(x + 1, y, 0)} ${pr(x + 1, y + 1, 0)} ${pr(x, y + 1, 0)}`}
              fill={(x + y) % 2 ? clip.color3 : shade(clip.color3, 1.15)}
              stroke={shade(clip.color3, 0.8)}
              strokeWidth={2}
            />
          )),
        )}
        {order
          .filter((c) => c.vis)
          .map((c, i) => {
            const { x, y, zz } = c;
            return (
              <g key={i}>
                <polygon points={`${pr(x, y + 1, zz)} ${pr(x + 1, y + 1, zz)} ${pr(x + 1, y + 1, zz + 1)} ${pr(x, y + 1, zz + 1)}`} fill={shade(c.color, 0.78)} />
                <polygon points={`${pr(x + 1, y, zz)} ${pr(x + 1, y + 1, zz)} ${pr(x + 1, y + 1, zz + 1)} ${pr(x + 1, y, zz + 1)}`} fill={shade(c.color, 0.6)} />
                <polygon points={`${pr(x, y, zz + 1)} ${pr(x + 1, y, zz + 1)} ${pr(x + 1, y + 1, zz + 1)} ${pr(x, y + 1, zz + 1)}`} fill={shade(c.color, 1.18)} />
              </g>
            );
          })}
      </Svg>
    </Box>
  );
};

const Grid: React.FC<P> = ({ clip, t }) => {
  const cols = 9;
  const size = clip.w / cols;
  const rows = Math.ceil(clip.h / size);
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const d = Math.hypot(c - (cols - 1) / 2, r - (rows - 1) / 2);
      const s = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.6 - d * 0.55);
      const cx = (c + 0.5) * size;
      const cy = (r + 0.5) * size;
      const k = 0.2 + 0.65 * s;
      const fill = interpolateColors(s, [0, 1], [clip.color2, clip.color]);
      if (clip.variant === "dots") cells.push(<circle key={`${r}-${c}`} cx={cx} cy={cy} r={(size / 2) * k} fill={fill} />);
      else
        cells.push(
          <rect
            key={`${r}-${c}`}
            x={cx - (size / 2) * k}
            y={cy - (size / 2) * k}
            width={size * k}
            height={size * k}
            rx={clip.variant === "squares" ? size * 0.12 : 0}
            fill={fill}
            transform={clip.variant === "diamonds" ? `rotate(45 ${cx} ${cy})` : `rotate(${s * 90} ${cx} ${cy})`}
          />,
        );
    }
  return (
    <Box clip={clip} style={{ background: clip.color3, overflow: "hidden" }}>
      <Svg clip={clip}>{cells}</Svg>
    </Box>
  );
};

// ---------- Dữ liệu và giải thích ----------

const formatVi = (v: number) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const BarChart: React.FC<P> = ({ clip, frame, fps }) => {
  const data = lines(clip.items).map((l) => {
    const i = l.lastIndexOf(":");
    return i < 0 ? { label: l, value: 0 } : { label: l.slice(0, i).trim(), value: Number(l.slice(i + 1).replace(/[^\d.-]/g, "")) || 0 };
  });
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const left = 70;
  const right = clip.w - 70;
  const bottom = clip.h - 140;
  const top = 230;
  const slot = (right - left) / n;
  const bw = slot * 0.62;
  return (
    <Box clip={clip}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 40, textAlign: "center", fontSize: 62, fontWeight: 800 }}>{clip.text}</div>
      <Svg clip={clip}>
        <line x1={left - 20} x2={right + 20} y1={bottom} y2={bottom} stroke="rgba(255,255,255,0.45)" strokeWidth={4} />
      </Svg>
      {data.map((d, i) => {
        const e = spring({ frame: frame - 8 - i * 6, fps, config: { damping: 14, mass: 0.8 } });
        const hgt = (d.value / max) * (bottom - top) * e;
        const x = left + slot * i + (slot - bw) / 2;
        const hl = i === n - 1;
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: x,
                top: bottom - hgt,
                width: bw,
                height: hgt,
                borderRadius: "14px 14px 0 0",
                background: hl ? clip.color2 : clip.color,
                boxShadow: hl ? `0 0 40px ${alpha(clip.color2, 0.5)}` : undefined,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: x - 30,
                width: bw + 60,
                top: bottom - hgt - 66,
                textAlign: "center",
                fontSize: 44,
                fontWeight: 800,
                opacity: clamp01(e * 3),
                fontVariantNumeric: "tabular-nums",
                color: hl ? clip.color2 : "#ffffff",
              }}
            >
              {formatVi(d.value * Math.min(1, e))}
            </div>
            <div style={{ position: "absolute", left: x - 30, width: bw + 60, top: bottom + 20, textAlign: "center", fontSize: 36, fontWeight: 600, opacity: 0.85 }}>
              {d.label}
            </div>
          </React.Fragment>
        );
      })}
    </Box>
  );
};

const Counter: React.FC<P> = ({ clip, frame, fps, t }) => {
  const e = Easing.out(Easing.exp)(seg(t, 0, 1.6));
  const punch = spring({ frame: frame - Math.round(fps * 1.5), fps, config: { damping: 8, mass: 0.4 } });
  const bump = frame > fps * 1.5 ? Math.sin(Math.min(1, punch) * Math.PI) * 0.08 : 0;
  return (
    <Box clip={clip} style={{ display: "grid", placeItems: "center", alignContent: "center", gap: 10 }}>
      <div style={{ fontSize: 200, fontWeight: 900, lineHeight: 1, color: clip.color, transform: `scale(${1 + bump})`, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {formatVi(clip.value * e)}
        <span style={{ color: clip.color2 }}>{clip.text2}</span>
      </div>
      <div style={{ fontSize: 56, fontWeight: 600, opacity: easeOut(seg(t, 0.3, 0.5)), transform: `translateY(${(1 - easeOut(seg(t, 0.3, 0.5))) * 30}px)` }}>{clip.text}</div>
    </Box>
  );
};

const Donut: React.FC<P> = ({ clip, t }) => {
  const e = easeInOut(seg(t, 0.1, 1.5));
  const R = Math.min(clip.w, clip.h) * 0.36;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, clip.value));
  return (
    <Box clip={clip}>
      <Svg clip={clip}>
        <circle cx={clip.w / 2} cy={clip.h / 2} r={R} fill="none" stroke={clip.color3} strokeWidth={64} />
        <circle
          cx={clip.w / 2}
          cy={clip.h / 2}
          r={R}
          fill="none"
          stroke={clip.color}
          strokeWidth={64}
          strokeLinecap="round"
          strokeDasharray={`${(C * pct * e) / 100} ${C}`}
          transform={`rotate(-90 ${clip.w / 2} ${clip.h / 2})`}
        />
      </Svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", alignContent: "center" }}>
        <div style={{ fontSize: 150, fontWeight: 900, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{Math.round(pct * e)}%</div>
        <div style={{ fontSize: 42, fontWeight: 600, opacity: 0.85, maxWidth: R * 1.4, textAlign: "center" }}>{clip.text}</div>
      </div>
    </Box>
  );
};

const PIN = "M 0 0 C -10 -18 -34 -32 -34 -56 A 34 34 0 1 1 34 -56 C 34 -32 10 -18 0 0 Z";

const MapRoute: React.FC<P> = ({ clip, frame, fps, t }) => {
  const W = 900;
  const H = 900;
  const route = "M 170 720 C 170 540, 420 610, 450 440 S 720 340, 720 200";
  const e = easeInOut(seg(t, 0.5, 1.8));
  const len = getLength(route);
  const evo = evolvePath(e, route);
  const car = getPointAtLength(route, len * e) ?? { x: 170, y: 720 };
  const pinA = spring({ frame, fps, config: { damping: 9 } });
  const pinB = spring({ frame: frame - Math.round(fps * 2.25), fps, config: { damping: 9 } });
  const label = (x: number, y: number, text: string, show: number): React.ReactNode =>
    show > 0.01 && (
      <div
        style={{
          position: "absolute",
          left: (x / W) * clip.w,
          top: (y / H) * clip.h,
          transform: `translate(-50%, 0) scale(${show})`,
          background: "#ffffff",
          color: "#16181d",
          padding: "8px 20px",
          borderRadius: 999,
          fontSize: 34,
          fontWeight: 700,
          whiteSpace: "nowrap",
          boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
        }}
      >
        {text}
      </div>
    );
  return (
    <Box clip={clip} style={{ borderRadius: 40, overflow: "hidden", background: clip.color3 }}>
      <Svg clip={clip} vw={W} vh={H}>
        <path d="M -20 300 C 200 260, 400 380, 920 280" stroke={alpha("#4ea8de", 0.35)} strokeWidth={60} fill="none" />
        {[120, 300, 520, 700].map((x) => (
          <line key={`v${x}`} x1={x} x2={x + 40} y1={-20} y2={920} stroke="rgba(255,255,255,0.08)" strokeWidth={18} />
        ))}
        {[160, 420, 620, 820].map((y) => (
          <line key={`h${y}`} x1={-20} x2={920} y1={y} y2={y - 30} stroke="rgba(255,255,255,0.08)" strokeWidth={18} />
        ))}
        <path d={route} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={12} strokeDasharray="4 22" strokeLinecap="round" />
        <path
          d={route}
          fill="none"
          stroke={clip.color}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={evo.strokeDasharray}
          strokeDashoffset={evo.strokeDashoffset}
        />
        <g transform={`translate(170 720) scale(${pinA})`}>
          <path d={PIN} fill={clip.color2} />
          <circle cy={-56} r={13} fill="#ffffff" />
        </g>
        {e > 0 && e < 1 && <circle cx={car.x} cy={car.y} r={20} fill="#ffffff" stroke={clip.color} strokeWidth={8} />}
        <g transform={`translate(720 200) scale(${Math.max(0, pinB)})`}>
          <path d={PIN} fill={clip.color} />
          <circle cy={-56} r={13} fill="#ffffff" />
        </g>
      </Svg>
      {label(170, 745, clip.text, pinA)}
      {label(720, 225, clip.text2, Math.max(0, pinB))}
    </Box>
  );
};

const Timeline: React.FC<P> = ({ clip, frame, fps }) => {
  const steps = lines(clip.items).slice(0, 6);
  const n = Math.max(1, steps.length);
  const per = fps * 0.75;
  const total = per * (n - 1);
  const p = n === 1 ? 1 : clamp01((frame - 6) / total);
  const vertical = clip.variant !== "horizontal";
  const a = vertical ? 110 : 90;
  const b = vertical ? clip.h - 110 : clip.w - 90;
  const across = vertical ? 120 : 150;
  const posOf = (i: number) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1));
  const xy = (along: number) => (vertical ? { left: across, top: along } : { left: along, top: across });
  const lineStyle: React.CSSProperties = vertical
    ? { left: across - 6, top: a, width: 12, height: b - a }
    : { left: a, top: across - 6, width: b - a, height: 12 };
  const fillStyle: React.CSSProperties = vertical
    ? { left: across - 6, top: a, width: 12, height: (b - a) * p }
    : { left: a, top: across - 6, width: (b - a) * p, height: 12 };
  return (
    <Box clip={clip}>
      <div style={{ position: "absolute", borderRadius: 6, background: clip.color3, ...lineStyle }} />
      <div style={{ position: "absolute", borderRadius: 6, background: clip.color, boxShadow: `0 0 24px ${alpha(clip.color, 0.6)}`, ...fillStyle }} />
      {steps.map((s, i) => {
        const at = 6 + per * i;
        const on = frame >= at;
        const pop = spring({ frame: frame - at, fps, config: { damping: 9, mass: 0.5 } });
        const pos = xy(posOf(i));
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                ...pos,
                width: 84,
                height: 84,
                marginLeft: -42,
                marginTop: -42,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                fontSize: 40,
                fontWeight: 800,
                background: on ? clip.color : "#2a2733",
                color: on ? "#16181d" : "rgba(255,255,255,0.5)",
                border: `6px solid ${on ? "#ffffff" : clip.color3}`,
                transform: `scale(${on ? 0.7 + 0.3 * pop : 0.85})`,
              }}
            >
              {i + 1}
            </div>
            <div
              style={{
                position: "absolute",
                ...(vertical
                  ? { left: across + 80, top: posOf(i), transform: `translate(${on ? (1 - pop) * 40 : 20}px, -50%)` }
                  : { left: posOf(i), top: across + 70, width: (b - a) / n + 20, transform: "translateX(-50%)", textAlign: "center" as const }),
                fontSize: vertical ? 54 : 34,
                fontWeight: 700,
                opacity: on ? 0.35 + 0.65 * clamp01(pop) : 0.35,
                whiteSpace: vertical ? "nowrap" : "normal",
              }}
            >
              {s}
            </div>
          </React.Fragment>
        );
      })}
    </Box>
  );
};

const ICONS: Record<string, LucideIcon> = {
  bell: Bell,
  heart: Heart,
  star: Star,
  check: Check,
  fire: Flame,
  gift: Gift,
  cart: ShoppingCart,
  like: ThumbsUp,
  pin: MapPin,
  phone: Phone,
  food: UtensilsCrossed,
};

const IconAnim: React.FC<P> = ({ clip, frame, fps, t }) => {
  const Icon = ICONS[clip.variant] ?? Bell;
  const appear = spring({ frame, fps, config: { damping: 10, mass: 0.6 } });
  const cyc = (per: number) => (t % per) / per;
  let tf = "";
  let origin = "50% 50%";
  switch (clip.variant) {
    case "bell": {
      const u = cyc(1.6);
      tf = `rotate(${u < 0.55 ? 24 * Math.sin(u * 40) * (1 - u / 0.55) : 0}deg)`;
      origin = "50% 8%";
      break;
    }
    case "heart": {
      const u = cyc(1);
      const beat = Math.max(0, Math.sin(u * Math.PI * 4)) * (u < 0.5 ? 1 : 0);
      tf = `scale(${1 + 0.18 * beat})`;
      break;
    }
    case "star":
      tf = `rotate(${easeInOut(seg(cyc(2) * 2, 0.4, 0.6)) * 144}deg) scale(${1 + 0.1 * Math.sin(t * 6)})`;
      break;
    case "check":
      tf = "";
      break;
    case "fire":
      tf = `scale(${1 + 0.06 * Math.sin(t * 19)}, ${1 + 0.1 * Math.sin(t * 23 + 1)}) skewX(${4 * Math.sin(t * 13)}deg)`;
      origin = "50% 90%";
      break;
    case "gift": {
      const u = cyc(1.6);
      tf = u < 0.4 ? `rotate(${10 * Math.sin(u * 60)}deg)` : `translateY(${-Math.sin(seg(u, 0.4, 0.35) * Math.PI) * 40}px)`;
      break;
    }
    case "cart":
      tf = `translateX(${12 * Math.sin(t * 4)}px) translateY(${-Math.abs(Math.sin(t * 8)) * 10}px)`;
      break;
    case "like": {
      const u = cyc(1.5);
      tf = `rotate(${u < 0.25 ? -25 * Math.sin((u / 0.25) * Math.PI) : 0}deg) scale(${1 + 0.15 * Math.sin(seg(u, 0, 0.3) * Math.PI)})`;
      origin = "30% 80%";
      break;
    }
    case "pin": {
      const u = cyc(1.8);
      tf = `translateY(${-(1 - Easing.bounce(seg(u, 0, 0.6))) * 90}px)`;
      break;
    }
    case "phone":
      tf = `rotate(${cyc(1.4) < 0.5 ? 14 * Math.sin(t * 50) : 0}deg)`;
      break;
    default:
      tf = `rotate(${6 * Math.sin(t * 3)}deg)`;
  }
  const size = Math.min(clip.w, clip.h);
  const filled = clip.variant === "heart" || clip.variant === "star";
  const drawCheck = clip.variant === "check" ? easeOut(seg(t, 0.25, 0.5)) : 1;
  return (
    <Box clip={clip} style={{ display: "grid", placeItems: "center" }}>
      <div
        style={{
          width: size * 0.82,
          height: size * 0.82,
          borderRadius: "50%",
          background: clip.color2,
          display: "grid",
          placeItems: "center",
          transform: `scale(${appear})`,
          boxShadow: `0 20px 50px ${alpha(clip.color2, 0.45)}`,
        }}
      >
        <div style={{ transform: tf, transformOrigin: origin, clipPath: `inset(0 ${(1 - drawCheck) * 100}% 0 0)` }}>
          <Icon size={size * 0.44} color={clip.color} strokeWidth={2.4} fill={filled ? clip.color : "none"} />
        </div>
      </div>
    </Box>
  );
};

const EXPLAIN_ICONS: LucideIcon[] = [Soup, UtensilsCrossed, Flame, Gift];

const Explainer: React.FC<P> = ({ clip, frame, fps, t }) => {
  const steps = lines(clip.items).slice(0, 4);
  const rowH = (clip.h - 220) / Math.max(1, steps.length);
  return (
    <Box clip={clip}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 20,
          textAlign: "center",
          fontSize: 68,
          fontWeight: 900,
          opacity: easeOut(seg(t, 0, 0.4)),
          transform: `translateY(${(1 - easeOut(seg(t, 0, 0.4))) * -30}px)`,
        }}
      >
        {clip.text}
      </div>
      {steps.map((s, i) => {
        const at = 0.4 + i * 0.85;
        const pop = spring({ frame: frame - Math.round(at * fps), fps, config: { damping: 10, mass: 0.6 } });
        const slide = easeOut(seg(t, at + 0.1, 0.4));
        const Icon = EXPLAIN_ICONS[i % EXPLAIN_ICONS.length];
        const cy = 170 + rowH * i + rowH / 2;
        const arrowP = easeInOut(seg(t, at + 0.45, 0.35));
        const arrow = `M 150 ${cy + 85} L 150 ${cy + rowH - 85}`;
        const evo = evolvePath(arrowP, arrow);
        return (
          <React.Fragment key={i}>
            {i < steps.length - 1 && (
              <svg width={clip.w} height={clip.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
                <path d={arrow} stroke={clip.color2} strokeWidth={10} strokeLinecap="round" strokeDasharray={evo.strokeDasharray} strokeDashoffset={evo.strokeDashoffset} />
                {arrowP > 0.95 && (
                  <path d={`M 128 ${cy + rowH - 105} L 150 ${cy + rowH - 82} L 172 ${cy + rowH - 105}`} stroke={clip.color2} strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            )}
            <div
              style={{
                position: "absolute",
                left: 70,
                top: cy - 80,
                width: 160,
                height: 160,
                borderRadius: "50%",
                background: clip.color,
                display: "grid",
                placeItems: "center",
                transform: `scale(${pop})`,
                boxShadow: `0 14px 36px ${alpha(clip.color, 0.45)}`,
              }}
            >
              <Icon size={78} color="#ffffff" strokeWidth={2.2} />
            </div>
            <div
              style={{
                position: "absolute",
                left: 270,
                right: 20,
                top: cy,
                transform: `translate(${(1 - slide) * 60}px, -50%)`,
                opacity: slide,
                fontSize: 54,
                fontWeight: 700,
                lineHeight: 1.15,
              }}
            >
              <span style={{ color: clip.color2, marginRight: 14 }}>{i + 1}.</span>
              {s}
            </div>
          </React.Fragment>
        );
      })}
    </Box>
  );
};

// ---------- Thương hiệu và bán hàng ----------

const LogoReveal: React.FC<P> = ({ clip, frame, fps, t }) => {
  const R = Math.min(clip.w, clip.h) * 0.36;
  const cx = clip.w / 2;
  const cy = clip.h / 2 - 40;
  const ring = `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R}`;
  const evo = evolvePath(easeInOut(seg(t, 0, 0.8)), ring);
  const disc = spring({ frame: frame - Math.round(fps * 0.65), fps, config: { damping: 11, mass: 0.7 } });
  const word = easeOut(seg(t, 0.95, 0.7));
  const tag = easeOut(seg(t, 1.45, 0.5));
  const shine = seg(t, 1.7, 0.7);
  const burst = seg(t, 0.75, 0.6);
  return (
    <Box clip={clip}>
      <Svg clip={clip}>
        <path d={ring} fill="none" stroke={clip.color} strokeWidth={12} strokeLinecap="round" strokeDasharray={evo.strokeDasharray} strokeDashoffset={evo.strokeDashoffset} />
        {burst > 0 &&
          burst < 1 &&
          Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const r1 = R + 30 + burst * 80;
            const r2 = r1 + 50 * (1 - burst);
            return (
              <line key={i} x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1} x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2} stroke={clip.color} strokeWidth={10} strokeLinecap="round" opacity={1 - burst} />
            );
          })}
      </Svg>
      <div
        style={{
          position: "absolute",
          left: cx - R + 22,
          top: cy - R + 22,
          width: (R - 22) * 2,
          height: (R - 22) * 2,
          borderRadius: "50%",
          background: clip.color,
          overflow: "hidden",
          transform: `scale(${disc})`,
          display: "grid",
          placeItems: "center",
        }}
      >
        {clip.src ? (
          <Img src={resolveSrc(clip.src)} style={{ width: "78%", height: "78%", objectFit: "contain", opacity: word, transform: `scale(${0.8 + 0.2 * word})` }} />
        ) : (
          <div
            style={{
              fontSize: R * 0.34,
              fontWeight: 900,
              color: clip.color2,
              letterSpacing: `${0.5 - 0.46 * word}em`,
              opacity: word,
              textAlign: "center",
              lineHeight: 1,
              padding: "0 6%",
            }}
          >
            {clip.text}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: "-20%",
            bottom: "-20%",
            left: `${-60 + shine * 180}%`,
            width: "35%",
            transform: "skewX(-20deg)",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: cy + R + 40,
          textAlign: "center",
          fontSize: 54,
          fontWeight: 600,
          opacity: tag,
          transform: `translateY(${(1 - tag) * 30}px)`,
          letterSpacing: 2,
        }}
      >
        {clip.text2}
      </div>
    </Box>
  );
};

const Badge: React.FC<P> = ({ clip, frame, fps, t }) => {
  const pop = spring({ frame, fps, config: { damping: 7, mass: 0.6 } });
  const beat = frame > fps * 0.6 ? Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.5)), 4) : 0;
  const R = Math.min(clip.w, clip.h) * 0.46;
  return (
    <Box clip={clip} style={{ transform: `scale(${pop}) rotate(${(1 - pop) * -40}deg)` }}>
      <Svg clip={clip}>
        <polygon points={polyPoints(starVerts(18, R, R * 0.86), 0, 0)} transform={`translate(${clip.w / 2} ${clip.h / 2}) rotate(${t * 18})`} fill={clip.color} />
        <circle cx={clip.w / 2} cy={clip.h / 2} r={R * 0.72} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={5} strokeDasharray="14 12" transform={`rotate(${-t * 30} ${clip.w / 2} ${clip.h / 2})`} />
      </Svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", alignContent: "center", color: clip.color2, transform: `scale(${1 + 0.1 * beat})` }}>
        <div style={{ fontSize: R * 0.2, fontWeight: 700, letterSpacing: 3 }}>{clip.text2}</div>
        <div style={{ fontSize: R * 0.5, fontWeight: 900, lineHeight: 1 }}>{clip.text}</div>
      </div>
    </Box>
  );
};

const EndCard: React.FC<P> = ({ clip, frame, fps, t }) => {
  const title = easeOut(seg(t, 0, 0.5));
  const btn = spring({ frame: frame - Math.round(fps * 0.45), fps, config: { damping: 9, mass: 0.6 } });
  const pulse = frame > fps * 1 ? 1 + 0.05 * Math.sin(t * Math.PI * 2 * 1.4) : 1;
  const icons: LucideIcon[] = [Heart, MessageCircle, Send, Bookmark];
  const info = easeOut(seg(t, 1.3, 0.5));
  return (
    <Box clip={clip}>
      <div
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          top: 60,
          textAlign: "center",
          fontSize: 82,
          fontWeight: 900,
          lineHeight: 1.15,
          opacity: title,
          transform: `translateY(${(1 - title) * 50}px)`,
        }}
      >
        {clip.text}
      </div>
      <div style={{ position: "absolute", left: "50%", top: 520, transform: "translate(-50%, -50%)" }}>
        {[0, 1].map((k) => {
          const u = ((t - 1 - k * 0.5) % 1 + 1) % 1;
          return t > 1 ? (
            <div
              key={k}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 999,
                border: `6px solid ${clip.color}`,
                transform: `scale(${1 + u * 0.35}, ${1 + u * 0.8})`,
                opacity: 1 - u,
              }}
            />
          ) : null;
        })}
        <div
          style={{
            position: "relative",
            padding: "34px 80px",
            borderRadius: 999,
            background: clip.color,
            fontSize: 60,
            fontWeight: 900,
            whiteSpace: "nowrap",
            transform: `scale(${btn * pulse})`,
            boxShadow: `0 20px 50px ${alpha(clip.color, 0.5)}`,
          }}
        >
          {clip.text2}
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 690, display: "flex", justifyContent: "center", gap: 46 }}>
        {icons.map((Icon, i) => {
          const s = spring({ frame: frame - Math.round(fps * (0.9 + i * 0.12)), fps, config: { damping: 9, mass: 0.5 } });
          return (
            <div key={i} style={{ width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.12)", display: "grid", placeItems: "center", transform: `scale(${s})` }}>
              <Icon size={60} color={i === 0 ? clip.color2 : "#ffffff"} fill={i === 0 ? clip.color2 : "none"} strokeWidth={2.2} />
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 870, textAlign: "center", fontSize: 44, fontWeight: 600, opacity: info * 0.9 }}>{clip.items}</div>
    </Box>
  );
};

// ---------- Giao diện và sản phẩm số ----------

const PhoneUI: React.FC<P> = ({ clip, t, frame, fps }) => {
  const pad = 18;
  const screenW = clip.w - pad * 2;
  const screenH = clip.h - pad * 2;
  const scroll = easeInOut(seg(t, 0.6, Math.max(1, clip.duration / fps - 1.2)));
  const cardH = 230;
  const tapU = (t % 2.2) / 2.2;
  return (
    <Box clip={clip} style={{ borderRadius: 78, background: "#0b0b0e", border: "4px solid #3a3a44", boxShadow: "0 30px 80px rgba(0,0,0,0.55)" }}>
      <div style={{ position: "absolute", left: pad, top: pad, width: screenW, height: screenH, borderRadius: 60, overflow: "hidden", background: "#f4f1ec" }}>
        {clip.src ? (
          // Ảnh dài cuộn từ đầu đến cuối: đỉnh ảnh đi từ 0 tới (cao màn hình - cao ảnh).
          <Img
            src={resolveSrc(clip.src)}
            style={{ position: "absolute", left: 0, width: "100%", top: `${scroll * 100}%`, transform: `translateY(${-scroll * 100}%)` }}
          />
        ) : (
          <>
            <div style={{ position: "absolute", left: 0, right: 0, top: 150 - scroll * cardH * 3 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ margin: "0 26px 26px", height: cardH - 26, borderRadius: 28, background: "#ffffff", boxShadow: "0 6px 18px rgba(0,0,0,0.08)", display: "flex", gap: 20, padding: 20 }}>
                  <div style={{ width: 160, borderRadius: 20, background: i % 2 ? clip.color2 : alpha(clip.color, 0.85) }} />
                  <div style={{ flex: 1, display: "grid", alignContent: "center", gap: 14 }}>
                    <div style={{ height: 22, width: "80%", borderRadius: 11, background: "#2b2b33" }} />
                    <div style={{ height: 16, width: "95%", borderRadius: 8, background: "#c9c4bc" }} />
                    <div style={{ height: 16, width: "60%", borderRadius: 8, background: "#c9c4bc" }} />
                    <div style={{ height: 30, width: 110, borderRadius: 15, background: clip.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 140, background: clip.color, display: "flex", alignItems: "flex-end", padding: "0 34px 22px", fontSize: 44, fontWeight: 800 }}>
              {clip.text}
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 110, background: "#ffffff", display: "flex", justifyContent: "space-around", alignItems: "center", borderTop: "1px solid #e4dfd8" }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: 44, height: 44, borderRadius: 14, background: i === 0 ? clip.color : "#cfc9c0" }} />
              ))}
            </div>
          </>
        )}
        {frame > fps * 0.4 && tapU < 0.3 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "58%",
              width: 90,
              height: 90,
              marginLeft: -45,
              marginTop: -45,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.25)",
              transform: `scale(${0.4 + (tapU / 0.3) * 1.2})`,
              opacity: 1 - tapU / 0.3,
            }}
          />
        )}
      </div>
      <div style={{ position: "absolute", left: "50%", top: 34, width: 150, height: 40, marginLeft: -75, borderRadius: 20, background: "#0b0b0e" }} />
    </Box>
  );
};

const MicroInteraction: React.FC<P> = ({ clip, frame, fps, t }) => {
  const tap = Math.round(fps * 0.7);
  if (clip.variant === "toggle") {
    const flips = frame < tap ? 0 : 1 + Math.floor((frame - tap) / (fps * 1.4));
    const lastFlip = flips === 0 ? 0 : tap + (flips - 1) * fps * 1.4;
    const on = flips % 2 === 1;
    const s = flips === 0 ? 1 : spring({ frame: frame - lastFlip, fps, config: { damping: 12, mass: 0.5 } });
    const pos = on ? s : 1 - s;
    return (
      <Box clip={clip} style={{ display: "grid", placeItems: "center" }}>
        <div style={{ position: "relative", width: 380, height: 200, borderRadius: 100, background: interpolateColors(pos, [0, 1], [clip.color3, clip.color]), boxShadow: "inset 0 4px 12px rgba(0,0,0,0.3)" }}>
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 20 + pos * 180,
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: "#ffffff",
              boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
              transform: `scale(${1 + 0.12 * Math.sin(clamp01(s) * Math.PI)}, ${1 - 0.08 * Math.sin(clamp01(s) * Math.PI)})`,
            }}
          />
        </div>
      </Box>
    );
  }
  if (clip.variant === "button") {
    const press = frame >= tap && frame < tap + 6 ? 0.92 : 1;
    const done = spring({ frame: frame - tap - 6, fps, config: { damping: 10, mass: 0.5 } });
    const isDone = frame >= tap + 6;
    return (
      <Box clip={clip} style={{ display: "grid", placeItems: "center" }}>
        <div
          style={{
            padding: "40px 70px",
            borderRadius: 999,
            fontSize: 64,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            gap: 20,
            background: isDone ? "#2bb673" : clip.color,
            transform: `scale(${press * (isDone ? 0.9 + 0.1 * done : 1)})`,
            boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
            whiteSpace: "nowrap",
          }}
        >
          {isDone && <Check size={70} strokeWidth={3.5} color="#ffffff" style={{ transform: `scale(${done})` }} />}
          {isDone ? clip.text : "Xác nhận"}
        </div>
      </Box>
    );
  }
  // Nút tim: bấm vào thì co lại, bật to, đổ màu và bắn hạt.
  const pressed = frame >= tap;
  const squeeze = frame >= tap - 5 && frame < tap ? 0.82 : 1;
  const pop = spring({ frame: frame - tap, fps, config: { damping: 7, mass: 0.5 } });
  const burst = seg(t, tap / fps, 0.5);
  const count = 1204 + (pressed ? 1 : 0);
  return (
    <Box clip={clip} style={{ display: "grid", placeItems: "center", alignContent: "center", gap: 24 }}>
      <div style={{ position: "relative", width: 260, height: 260, display: "grid", placeItems: "center" }}>
        {pressed &&
          burst < 1 &&
          Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2;
            const d = 90 + burst * 90;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 130 + Math.cos(a) * d - 10,
                  top: 130 + Math.sin(a) * d - 10,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: i % 2 ? clip.color : "#ffd166",
                  transform: `scale(${1 - burst})`,
                }}
              />
            );
          })}
        <div style={{ transform: `scale(${squeeze * (pressed ? 0.8 + 0.2 * pop : 1)})` }}>
          <Heart size={210} color={pressed ? clip.color : "#ffffff"} fill={pressed ? clip.color : "none"} strokeWidth={1.8} />
        </div>
      </div>
      <div style={{ fontSize: 56, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatVi(count)}</div>
    </Box>
  );
};

const CURSOR = "M0 0 L0 38 L10 29 L17 45 L24 42 L17 26 L30 26 Z";

const CursorDemo: React.FC<P> = ({ clip, frame, fps, t }) => {
  const W = 900;
  const H = 700;
  const sx = clip.w / W;
  const sy = clip.h / H;
  const btn = { x: 450, y: 480, w: 340, h: 100 };
  const move = easeInOut(seg(t, 0.2, 1));
  const click = Math.round(fps * 1.25);
  const leave = easeInOut(seg(t, 1.8, 0.7));
  const cx = interpolate(move, [0, 1], [820, btn.x + 40]) + leave * 160;
  const cy = interpolate(move, [0, 1], [680, btn.y + 20]) + leave * 90;
  const pressing = frame >= click - 3 && frame < click + 4;
  const done = frame >= click + 4;
  const ripple = seg(t, click / fps, 0.5);
  const doneS = spring({ frame: frame - click - 4, fps, config: { damping: 10 } });
  return (
    <Box clip={clip}>
      <div style={{ position: "absolute", left: 40 * sx, top: 40 * sy, width: 820 * sx, height: 600 * sy, borderRadius: 28, background: clip.color3, boxShadow: "0 30px 70px rgba(0,0,0,0.45)", overflow: "hidden" }}>
        <div style={{ height: 56, background: "#ebe7e1", display: "flex", alignItems: "center", gap: 12, paddingLeft: 24 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div key={c} style={{ width: 18, height: 18, borderRadius: "50%", background: c }} />
          ))}
        </div>
        <div style={{ padding: 40, display: "grid", gap: 18 }}>
          <div style={{ height: 34, width: "55%", borderRadius: 10, background: "#2b2b33" }} />
          <div style={{ height: 20, width: "85%", borderRadius: 10, background: "#d4cfc7" }} />
          <div style={{ height: 20, width: "70%", borderRadius: 10, background: "#d4cfc7" }} />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: (btn.x - btn.w / 2) * sx,
          top: (btn.y - btn.h / 2) * sy,
          width: btn.w * sx,
          height: btn.h * sy,
          borderRadius: 999,
          background: done ? "#2bb673" : clip.color,
          display: "grid",
          placeItems: "center",
          fontSize: 46,
          fontWeight: 800,
          transform: `scale(${pressing ? 0.94 : done ? 0.92 + 0.08 * doneS : 1})`,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        {ripple > 0 && ripple < 1 && (
          <div style={{ position: "absolute", left: "50%", top: "50%", width: 400, height: 400, marginLeft: -200, marginTop: -200, borderRadius: "50%", background: "rgba(255,255,255,0.35)", transform: `scale(${ripple})`, opacity: 1 - ripple }} />
        )}
        <span style={{ position: "relative" }}>{done ? clip.text : clip.text2}</span>
      </div>
      <svg width={60} height={60} viewBox="-4 -4 40 52" style={{ position: "absolute", left: cx * sx, top: cy * sy, overflow: "visible", transform: `scale(${pressing ? 1.3 : 1.6})`, transformOrigin: "0 0" }}>
        <path d={CURSOR} fill="#ffffff" stroke="#111111" strokeWidth={2.5} strokeLinejoin="round" />
      </svg>
    </Box>
  );
};

// ---------- Phong cách hình ảnh ----------

const Character: React.FC<P> = ({ clip, frame, fps, t }) => {
  const u = (t / 1.1) % 1;
  const jump = Math.sin(u * Math.PI);
  const ground = jump < 0.2 ? 1 - jump / 0.2 : 0;
  const sx = 1 + 0.18 * ground - 0.06 * (1 - ground);
  const sy = 1 - 0.18 * ground + 0.08 * (1 - ground);
  const blink = t % 2.6 > 2.45;
  const look = 10 * Math.sin(t * 1.3);
  const bubble = spring({ frame: frame - Math.round(fps * 0.5), fps, config: { damping: 10 } });
  const bodyY = clip.h - 120 - jump * 140;
  return (
    <Box clip={clip}>
      <div style={{ position: "absolute", left: "50%", top: clip.h - 70, width: 240 * (1 - jump * 0.4), height: 36, marginLeft: -120 * (1 - jump * 0.4), borderRadius: "50%", background: "rgba(0,0,0,0.3)" }} />
      <div style={{ position: "absolute", left: "50%", top: bodyY, width: 300, height: 300, marginLeft: -150, marginTop: -300, transform: `scale(${sx}, ${sy})`, transformOrigin: "50% 100%" }}>
        {[-1, 1].map((side) => (
          <div
            key={side}
            style={{
              position: "absolute",
              top: 150,
              left: side < 0 ? -40 : 270,
              width: 70,
              height: 34,
              borderRadius: 20,
              background: shade(clip.color, 0.85),
              transform: `rotate(${side * (-30 + 40 * Math.sin(t * 8 + side))}deg)`,
              transformOrigin: side < 0 ? "100% 50%" : "0% 50%",
            }}
          />
        ))}
        <div style={{ position: "absolute", inset: 0, borderRadius: "50% 50% 44% 44%", background: `radial-gradient(circle at 35% 30%, ${shade(clip.color, 1.25)}, ${clip.color} 60%, ${shade(clip.color, 0.8)})` }} />
        {[-1, 1].map((side) => (
          <div key={side} style={{ position: "absolute", top: 95, left: 150 + side * 60 - 30, width: 60, height: 76, borderRadius: "50%", background: "#ffffff", transform: `scaleY(${blink ? 0.1 : 1})`, overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 24, left: 16 + look, width: 30, height: 34, borderRadius: "50%", background: "#1d1b26" }} />
          </div>
        ))}
        {[-1, 1].map((side) => (
          <div key={side} style={{ position: "absolute", top: 180, left: 150 + side * 95 - 22, width: 44, height: 26, borderRadius: "50%", background: clip.color2, opacity: 0.8 }} />
        ))}
        <div style={{ position: "absolute", top: 185, left: 115, width: 70, height: 26 + jump * 22, borderRadius: "0 0 40px 40px", background: "#5a1e2a" }} />
      </div>
      {clip.text && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 20,
            transform: `translateX(-30%) scale(${bubble})`,
            transformOrigin: "20% 100%",
            background: "#ffffff",
            color: "#1d1b26",
            padding: "20px 34px",
            borderRadius: 40,
            fontSize: 50,
            fontWeight: 800,
            whiteSpace: "nowrap",
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
          }}
        >
          {clip.text}
        </div>
      )}
    </Box>
  );
};

/** Điểm gốc cho từng kiểu nét vẽ tay, trong khung 900×600. */
const doodlePoints = (variant: string): [number, number][][] => {
  switch (variant) {
    case "underline":
      return [
        [
          [80, 420],
          [300, 405],
          [520, 425],
          [820, 400],
          [600, 440],
          [300, 450],
          [140, 455],
          [400, 470],
          [700, 462],
        ],
      ];
    case "stars":
      return [
        [200, 260, 90],
        [470, 200, 120],
        [720, 300, 80],
      ].map(([cx, cy, r]) => [...starVerts(5, r, r * 0.42), starVerts(5, r, r * 0.42)[0]].map(([x, y]) => [cx + x, cy + y] as [number, number]));
    case "arrow":
      return [
        [
          [90, 470],
          [250, 420],
          [380, 300],
          [330, 220],
          [260, 280],
          [360, 360],
          [560, 320],
          [790, 170],
        ],
        [
          [700, 160],
          [790, 170],
          [770, 255],
        ],
      ];
    case "heart":
      return [
        Array.from({ length: 30 }, (_, i) => {
          const a = (i / 29) * Math.PI * 2;
          return [450 + 15 * 16 * Math.pow(Math.sin(a), 3), 290 - 15 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))] as [number, number];
        }),
      ];
    default:
      return [
        Array.from({ length: 34 }, (_, i) => {
          const a = -0.4 + (i / 33) * (Math.PI * 2 + 0.7);
          const k = 1 + 0.05 * Math.sin(i * 1.7);
          return [450 + Math.cos(a) * 380 * k, 300 + Math.sin(a) * 220 * k] as [number, number];
        }),
      ];
  }
};

const Doodle: React.FC<P> = ({ clip, frame, t }) => {
  const k = Math.floor(frame / 4);
  const jitter = (pts: [number, number][], s: string): [number, number][] =>
    pts.map(([x, y], i) => [x + (random(`${clip.id}-${s}-x-${k}-${i}`) - 0.5) * 9, y + (random(`${clip.id}-${s}-y-${k}-${i}`) - 0.5) * 9]);
  const progress = easeOut(seg(t, 0, 0.9));
  const width = clip.value || 10;
  return (
    <Box clip={clip}>
      <Svg clip={clip} vw={900} vh={600}>
        {doodlePoints(clip.variant).map((pts, i) =>
          ["a", "b"].map((s, j) => {
            const d = smoothPath(jitter(pts, `${s}${i}`));
            const evo = evolvePath(progress, d);
            return (
              <path
                key={`${i}${s}`}
                d={d}
                fill="none"
                stroke={clip.color}
                strokeWidth={j ? width * 0.45 : width}
                opacity={j ? 0.6 : 1}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={evo.strokeDasharray}
                strokeDashoffset={evo.strokeDashoffset}
              />
            );
          }),
        )}
      </Svg>
    </Box>
  );
};

const Cube3D: React.FC<P> = ({ clip, t, frame, fps }) => {
  const S = Math.min(clip.w, clip.h) * 0.5;
  const words = clip.text.split(/\s+/).filter(Boolean);
  const appear = spring({ frame, fps, config: { damping: 12 } });
  const faces: [string, string][] = [
    [`translateZ(${S / 2}px)`, clip.color],
    [`rotateY(90deg) translateZ(${S / 2}px)`, clip.color2],
    [`rotateY(180deg) translateZ(${S / 2}px)`, shade(clip.color, 0.8)],
    [`rotateY(-90deg) translateZ(${S / 2}px)`, shade(clip.color2, 0.85)],
    [`rotateX(90deg) translateZ(${S / 2}px)`, shade(clip.color, 1.2)],
    [`rotateX(-90deg) translateZ(${S / 2}px)`, shade(clip.color, 0.6)],
  ];
  return (
    <Box clip={clip} style={{ perspective: 1600, display: "grid", placeItems: "center" }}>
      <div
        style={{
          position: "relative",
          width: S,
          height: S,
          transformStyle: "preserve-3d",
          transform: `scale(${appear}) rotateX(${-22 + 8 * Math.sin(t * 1.2)}deg) rotateY(${t * 70 + 30}deg)`,
        }}
      >
        {faces.map(([tf, bg], i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              transform: tf,
              background: bg,
              border: "4px solid rgba(255,255,255,0.35)",
              display: "grid",
              placeItems: "center",
              fontSize: S * 0.2,
              fontWeight: 900,
              backfaceVisibility: "hidden",
              textAlign: "center",
              lineHeight: 1,
              padding: 10,
            }}
          >
            {i < 4 ? words[i % Math.max(1, words.length)] ?? "" : ""}
          </div>
        ))}
      </div>
    </Box>
  );
};

const hillPath = (w: number, h: number, base: number, amp: number, len: number, off: number, seed: number) => {
  const pts: string[] = [];
  for (let x = -40; x <= w + 40; x += 30) {
    const X = x + off;
    const y = base - amp * (0.6 * Math.sin(X / len + seed) + 0.4 * Math.sin(X / (len * 0.43) + seed * 2.1));
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return `M -40 ${h + 10} L ${pts.join(" L ")} L ${w + 40} ${h + 10} Z`;
};

const Parallax: React.FC<P> = ({ clip, t }) => {
  const { w, h } = clip;
  const layers = [
    { base: h * 0.55, amp: h * 0.06, len: w * 0.35, speed: 18, k: 0 },
    { base: h * 0.66, amp: h * 0.05, len: w * 0.25, speed: 55, k: 0.33 },
    { base: h * 0.78, amp: h * 0.04, len: w * 0.18, speed: 130, k: 0.66 },
    { base: h * 0.9, amp: h * 0.03, len: w * 0.1, speed: 280, k: 1 },
  ];
  return (
    <Box clip={clip} style={{ overflow: "hidden", background: `linear-gradient(180deg, ${shade(clip.color2, 0.55)} 0%, ${clip.color} 70%)` }}>
      <Svg clip={clip}>
        <circle cx={w * 0.68 - t * 4} cy={h * 0.36} r={Math.min(w, h) * 0.13} fill="#ffe7a3" style={{ filter: "drop-shadow(0 0 60px #ffd36e)" }} />
        {[0, 1, 2].map((i) => {
          const x = ((w * (0.2 + i * 0.4) - t * (25 + i * 10)) % (w + 400) + w + 400) % (w + 400) - 200;
          return <ellipse key={i} cx={x} cy={h * (0.15 + i * 0.08)} rx={150} ry={42} fill="rgba(255,255,255,0.55)" />;
        })}
        {layers.map((l, i) => (
          <path key={i} d={hillPath(w, h, l.base, l.amp, l.len, t * l.speed, i * 1.7)} fill={interpolateColors(l.k, [0, 1], [clip.color2, clip.color3])} />
        ))}
      </Svg>
    </Box>
  );
};

const Gradient: React.FC<P> = ({ clip, t }) => {
  const p = (a: number, b: number, s: number) => 50 + a * Math.sin(t * s + b);
  const bg = [
    `radial-gradient(circle at ${p(35, 0, 0.35)}% ${p(30, 1, 0.27)}%, ${alpha(clip.color, 0.95)} 0%, transparent 52%)`,
    `radial-gradient(circle at ${p(35, 2, 0.3)}% ${p(35, 3, 0.22)}%, ${alpha(clip.color2, 0.95)} 0%, transparent 55%)`,
    `radial-gradient(circle at ${p(30, 4, 0.25)}% ${p(30, 5, 0.33)}%, ${alpha(shade(clip.color, 1.3), 0.7)} 0%, transparent 45%)`,
    clip.color3,
  ].join(", ");
  return <Box clip={clip} style={{ background: bg }}>{null}</Box>;
};

// ---------- Âm thanh ----------

const simulatedLevels = (t: number, n: number) => {
  const beat = Math.exp(-((t * 2) % 1) * 5);
  return Array.from({ length: n }, (_, i) => {
    const v = 0.25 + 0.45 * Math.abs(Math.sin(t * (3 + (i % 5)) + i * 1.3)) + 0.35 * beat * (1 - i / n);
    return clamp01(v);
  });
};

const BarsView: React.FC<{ clip: MotionClip; levels: number[] }> = ({ clip, levels }) => {
  const n = levels.length;
  const { w, h } = clip;
  if (clip.variant === "wave") {
    const pts = levels.map((v, i) => [(i / (n - 1)) * w, h / 2 - v * h * 0.42] as [number, number]);
    const bottom = levels.map((v, i) => [(i / (n - 1)) * w, h / 2 + v * h * 0.42] as [number, number]).reverse();
    return (
      <Svg clip={clip}>
        <defs>
          <linearGradient id={`aw-${clip.id}`} x1="0" x2="1">
            <stop offset="0" stopColor={clip.color} />
            <stop offset="1" stopColor={clip.color2} />
          </linearGradient>
        </defs>
        <path d={`${smoothPath(pts)} L ${smoothPath(bottom).slice(2)} Z`} fill={`url(#aw-${clip.id})`} opacity={0.9} />
      </Svg>
    );
  }
  if (clip.variant === "circle") {
    const R = Math.min(w, h) * 0.22;
    return (
      <Svg clip={clip}>
        {levels.map((v, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const L = 20 + v * Math.min(w, h) * 0.25;
          return (
            <line
              key={i}
              x1={w / 2 + Math.cos(a) * R}
              y1={h / 2 + Math.sin(a) * R}
              x2={w / 2 + Math.cos(a) * (R + L)}
              y2={h / 2 + Math.sin(a) * (R + L)}
              stroke={interpolateColors(i, [0, n - 1], [clip.color, clip.color2])}
              strokeWidth={10}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={w / 2} cy={h / 2} r={R - 14} fill={alpha(clip.color, 0.2)} />
      </Svg>
    );
  }
  const bw = w / n;
  return (
    <Svg clip={clip}>
      {levels.map((v, i) => {
        const bh = Math.max(12, v * h * 0.9);
        return <rect key={i} x={i * bw + bw * 0.18} y={h / 2 - bh / 2} width={bw * 0.64} height={bh} rx={bw * 0.32} fill={interpolateColors(i, [0, n - 1], [clip.color, clip.color2])} />;
      })}
    </Svg>
  );
};

const AudioReal: React.FC<P & { n: number }> = ({ clip, frame, fps, t, n }) => {
  const data = useAudioData(resolveSrc(clip.src));
  if (!data) return <BarsView clip={clip} levels={simulatedLevels(t, n)} />;
  const raw = visualizeAudio({ fps, frame, audioData: data, numberOfSamples: 64, optimizeFor: "speed" });
  const levels = Array.from({ length: n }, (_, i) => clamp01(Math.sqrt(raw[Math.floor((i / n) * raw.length * 0.7)] ?? 0) * 1.6));
  return <BarsView clip={clip} levels={levels} />;
};

const AudioBars: React.FC<P> = (props) => {
  const n = props.clip.variant === "circle" ? 48 : 28;
  return (
    <Box clip={props.clip}>
      {props.clip.src ? <AudioReal {...props} n={n} /> : <BarsView clip={props.clip} levels={simulatedLevels(props.t, n)} />}
    </Box>
  );
};

// ---------- Chuyển cảnh ----------

const ShapeWipe: React.FC<P> = ({ clip, frame }) => {
  const p = clamp01(frame / Math.max(1, clip.duration - 1));
  const { w, h } = clip;
  if (clip.variant === "bars") {
    return (
      <Box clip={clip} style={{ overflow: "hidden" }}>
        {Array.from({ length: 5 }).map((_, i) => {
          const inP = Easing.inOut(Easing.cubic)(seg(p, i * 0.05, 0.4));
          const outP = Easing.inOut(Easing.cubic)(seg(p, 0.52 + i * 0.05, 0.4));
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: (w / 5) * i - 1,
                width: w / 5 + 2,
                top: 0,
                height: h,
                background: i % 2 ? clip.color2 : clip.color,
                transform: `translateY(${(-1 + inP + outP) * 100}%)`,
              }}
            />
          );
        })}
      </Box>
    );
  }
  if (clip.variant === "diagonal") {
    const x = interpolate(Easing.inOut(Easing.cubic)(p), [0, 1], [-2.4 * w, 1.4 * w]);
    return (
      <Box clip={clip} style={{ overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -h * 0.2, height: h * 1.4, left: x, width: w * 0.25, background: clip.color2, transform: "skewX(-20deg)" }} />
        <div style={{ position: "absolute", top: -h * 0.2, height: h * 1.4, left: x + w * 0.22, width: w * 1.6, background: clip.color, transform: "skewX(-20deg)" }} />
      </Box>
    );
  }
  const R = Math.hypot(w, h) / 2 + 20;
  const id = `wipe-${clip.id}`;
  const grow = (d: number) => Easing.in(Easing.cubic)(seg(p, d, 0.48)) * R;
  const hole = Easing.out(Easing.cubic)(seg(p, 0.5, 0.5)) * R;
  return (
    <Box clip={clip}>
      <Svg clip={clip}>
        <defs>
          <mask id={id}>
            <rect width={w} height={h} fill="#ffffff" />
            <circle cx={w / 2} cy={h / 2} r={hole} fill="#000000" />
          </mask>
        </defs>
        <g mask={`url(#${id})`}>
          <circle cx={w / 2} cy={h / 2} r={grow(0)} fill={clip.color2} />
          <circle cx={w / 2} cy={h / 2} r={grow(0.06)} fill={clip.color} />
        </g>
      </Svg>
    </Box>
  );
};

const Dot: React.FC<P> = ({ clip }) => {
  const { w, h } = clip;
  const r = Math.min(w, h) / 2;
  const shape =
    clip.variant === "square" ? (
      <rect x={w / 2 - r * 0.9} y={h / 2 - r * 0.9} width={r * 1.8} height={r * 1.8} rx={r * 0.3} fill={clip.color} />
    ) : clip.variant === "triangle" ? (
      <polygon points={polyPoints(regular(3, r * 1.05), w / 2, h / 2 + r * 0.15)} fill={clip.color} />
    ) : clip.variant === "star" ? (
      <polygon points={polyPoints(starVerts(5, r, r * 0.45), w / 2, h / 2 + r * 0.05)} fill={clip.color} />
    ) : clip.variant === "heart" ? (
      <path d={heartPath(w / 2, h / 2 - r * 0.05, r / 17.5)} fill={clip.color} />
    ) : (
      <circle cx={w / 2} cy={h / 2} r={r * 0.95} fill={clip.color} />
    );
  return (
    <Box clip={clip}>
      <Svg clip={clip}>{shape}</Svg>
    </Box>
  );
};

const VhsOverlay: React.FC<P> = ({ clip }) => (
  <Box clip={clip}>
    <VhsLayer seed={clip.id} />
  </Box>
);

const ParticlesPreset: React.FC<P> = ({ clip }) => (
  <Box clip={clip}>
    <Particles
      kind={(clip.variant || "confetti") as ParticleKind}
      seed={clip.id}
      w={clip.w}
      h={clip.h}
      count={Math.max(5, Math.min(300, Math.round(clip.value || 80)))}
      colors={[clip.color, clip.color2, clip.color3, "#ffffff"]}
    />
  </Box>
);

const RENDERERS: Record<MotionClip["preset"], React.FC<P>> = {
  lowerThird: LowerThird,
  shapes: Shapes,
  morph: Morph,
  lineDraw: LineDraw,
  liquid: Liquid,
  loader: Loader,
  isometric: Isometric,
  grid: Grid,
  barChart: BarChart,
  counter: Counter,
  donut: Donut,
  mapRoute: MapRoute,
  timeline: Timeline,
  icon: IconAnim,
  explainer: Explainer,
  logoReveal: LogoReveal,
  badge: Badge,
  endCard: EndCard,
  phoneUI: PhoneUI,
  microInteraction: MicroInteraction,
  cursor: CursorDemo,
  character: Character,
  doodle: Doodle,
  particles: ParticlesPreset,
  cube3d: Cube3D,
  parallax: Parallax,
  vhsOverlay: VhsOverlay,
  gradient: Gradient,
  audioBars: AudioBars,
  shapeWipe: ShapeWipe,
  dot: Dot,
};

/** Nội dung bên trong khung của một clip đồ hoạ. */
export const MotionGraphic: React.FC<{ clip: MotionClip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const Renderer = RENDERERS[clip.preset] ?? Dot;
  return <Renderer clip={clip} frame={frame} t={frame / fps} fps={fps} />;
};
