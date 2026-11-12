// Hiệu ứng chữ: mỗi hiệu ứng tách chữ thành từ / ký tự rồi tạo chuyển động riêng.
import React from "react";
import { Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { TextClip } from "./types";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.out(Easing.cubic);

type Props = { text: string; clip: TextClip };

/** Tách chữ thành từ và khoảng trắng (giữ nguyên xuống dòng). */
const tokens = (text: string) => text.split(/(\s+)/);

/** Gọi `render(ch, index)` cho từng ký tự, giữ mỗi từ không bị ngắt dòng giữa chừng. */
const perChar = (text: string, render: (ch: string, index: number) => React.ReactNode) => {
  let index = 0;
  return tokens(text).map((token, i) => {
    if (!token.trim()) return <React.Fragment key={i}>{token}</React.Fragment>;
    return (
      <span key={i} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
        {Array.from(token).map((ch, j) => (
          <React.Fragment key={j}>{render(ch, index++)}</React.Fragment>
        ))}
      </span>
    );
  });
};

/** Gọi `render(word, index)` cho từng từ. */
const perWord = (text: string, render: (word: string, index: number) => React.ReactNode) => {
  let index = 0;
  return tokens(text).map((token, i) =>
    token.trim() ? <React.Fragment key={i}>{render(token, index++)}</React.Fragment> : <React.Fragment key={i}>{token}</React.Fragment>,
  );
};

const wordCount = (text: string) => tokens(text).filter((t) => t.trim()).length;

const speedOf = (clip: TextClip) => Math.max(0.1, clip.effectSpeed ?? 1);

// ---------- Hiệu ứng có từ trước ----------

const WaveLetters: React.FC<Props> = ({ text, clip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = speedOf(clip);
  return (
    <>
      {perChar(text, (ch, index) => {
        const lift = Math.sin((frame / fps) * Math.PI * 2 * 1.2 * sp - index * 0.55) * 0.07;
        return <span style={{ display: "inline-block", transform: `translateY(${lift}em)` }}>{ch}</span>;
      })}
    </>
  );
};

const AnimatedWords: React.FC<Props> = ({ text, clip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = speedOf(clip);
  return (
    <>
      {perWord(text, (word, index) => {
        const s = spring({ frame: frame - (index * 4) / sp, fps, config: { damping: 12, mass: 0.5 } });
        return (
          <span
            style={{
              display: "inline-block",
              transform: `translateY(${(1 - s) * 40}px) scale(${0.6 + 0.4 * s})`,
              opacity: clamp01(s * 2),
            }}
          >
            {word}
          </span>
        );
      })}
    </>
  );
};

const AnimatedLetters: React.FC<Props> = ({ text, clip }) => {
  const frame = useCurrentFrame();
  const sp = speedOf(clip);
  return (
    <>
      {perChar(text, (ch, index) => {
        const p = interpolate(frame - (index * 1.4) / sp, [0, 8], [0, 1], clampOpts);
        return <span style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>{ch}</span>;
      })}
    </>
  );
};

const Typewriter: React.FC<Props & { cursor?: boolean }> = ({ text, clip, cursor }) => {
  const frame = useCurrentFrame();
  const sp = speedOf(clip);
  const chars = Array.from(text);
  const shown = Math.min(chars.length, Math.floor((frame * sp) / 1.5));
  const typing = shown < chars.length;
  const blinkOn = typing || Math.floor(frame / 15) % 2 === 0;
  return (
    <>
      {chars.slice(0, shown).join("")}
      {cursor && (
        <span
          style={{
            display: "inline-block",
            width: "0.09em",
            height: "1.05em",
            marginLeft: "0.04em",
            marginRight: "-0.13em",
            verticalAlign: "-0.15em",
            background: clip.highlightColor ?? clip.color,
            opacity: blinkOn ? 1 : 0,
          }}
        />
      )}
      <span style={{ opacity: 0 }}>{chars.slice(shown).join("")}</span>
    </>
  );
};

// ---------- Hiệu ứng mới (Từ điển Motion Graphic) ----------

/** Kinetic Typography: từng từ to đùng đập vào màn hình, nghiêng xen kẽ. */
const Kinetic: React.FC<Props> = ({ text, clip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = speedOf(clip);
  const n = wordCount(text);
  return (
    <>
      {perWord(text, (word, index) => {
        const delay = (index * 7) / sp;
        const s = spring({ frame: frame - delay, fps, config: { damping: 9, mass: 0.45, stiffness: 180 } });
        const dir = index % 2 ? 1 : -1;
        return (
          <span
            style={{
              display: "inline-block",
              transform: `scale(${2.4 - 1.4 * s}) rotate(${dir * 14 * (1 - s)}deg)`,
              opacity: frame >= delay ? clamp01((frame - delay) / 2) : 0,
              color: index === n - 1 && clip.highlightColor ? clip.highlightColor : undefined,
            }}
          >
            {word}
          </span>
        );
      })}
    </>
  );
};

/** Text Reveal: vạch kẻ chạy ra trước, từng từ trồi lên từ sau vạch che. */
const Reveal: React.FC<Props> = ({ text, clip }) => {
  const frame = useCurrentFrame();
  const sp = speedOf(clip);
  const bar = easeOut(clamp01((frame * sp) / 10));
  const origin = clip.align === "left" ? "left" : clip.align === "right" ? "right" : "center";
  return (
    <>
      {perWord(text, (word, index) => {
        const e = easeOut(clamp01((frame - (8 + index * 3) / sp) / (14 / sp)));
        return (
          <span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", paddingBottom: "0.08em" }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - e) * 115}%)` }}>{word}</span>
          </span>
        );
      })}
      <span
        style={{
          position: "absolute",
          left: "8%",
          right: "8%",
          bottom: "-0.04em",
          height: "0.07em",
          borderRadius: 99,
          background: clip.highlightColor ?? clip.color,
          transform: `scaleX(${bar})`,
          transformOrigin: origin,
        }}
      />
    </>
  );
};

/** Bouncy Text: từng chữ cái rơi xuống, nảy lên rồi đứng yên. */
const Bounce: React.FC<Props> = ({ text, clip }) => {
  const frame = useCurrentFrame();
  const sp = speedOf(clip);
  return (
    <>
      {perChar(text, (ch, index) => {
        const local = frame - (index * 2.2) / sp;
        const p = clamp01(local / (20 / sp));
        const y = -(1 - Easing.bounce(p)) * 1.6;
        const squash = p > 0.3 && p < 0.42 ? 0.85 : 1;
        return (
          <span
            style={{
              display: "inline-block",
              transform: `translateY(${y}em) scale(${2 - squash}, ${squash})`,
              transformOrigin: "bottom",
              opacity: local >= 0 ? 1 : 0,
            }}
          >
            {ch}
          </span>
        );
      })}
    </>
  );
};

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$*?<>/";

/** Text Scramble: ký tự ngẫu nhiên chạy loạn rồi dần ra đúng chữ. */
const Scramble: React.FC<Props> = ({ text, clip }) => {
  const frame = useCurrentFrame();
  const sp = speedOf(clip);
  return (
    <>
      {perChar(text, (ch, index) => {
        const revealAt = (6 + index * 1.6) / sp;
        if (frame >= revealAt) return ch;
        const g = GLYPHS[Math.floor(random(`${clip.id}-sc-${index}-${Math.floor(frame / 2)}`) * GLYPHS.length)];
        return <span style={{ color: clip.highlightColor, opacity: frame < (index * 0.5) / sp ? 0 : 0.85 }}>{g}</span>;
      })}
    </>
  );
};

/** Animated Captions: phụ đề hiện đủ, từ đang đọc được tô màu và phóng nhẹ. */
const Karaoke: React.FC<Props> = ({ text, clip }) => {
  const frame = useCurrentFrame();
  const sp = speedOf(clip);
  const n = Math.max(1, wordCount(text));
  const per = Math.max(3, (clip.duration - 6) / n) / sp;
  const active = Math.floor(frame / per);
  const hl = clip.highlightColor ?? "#ffd400";
  return (
    <>
      {perWord(text, (word, index) => {
        const on = index === active;
        const pop = on ? spring({ frame: frame - index * per, fps: 30, config: { damping: 12, mass: 0.4 } }) : 0;
        return (
          <span
            style={{
              display: "inline-block",
              // Chừa chỗ hai bên để từ phóng to không dính vào từ bên cạnh.
              margin: "0 0.07em",
              color: on ? hl : undefined,
              opacity: index > active ? 0.55 : 1,
              transform: `scale(${1 + 0.12 * pop}) translateY(${-0.04 * pop}em)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </>
  );
};

/** Đọc số kiểu Việt Nam: "1.250" = một nghìn hai trăm năm mươi, "4,5" = bốn phẩy năm. */
const parseViNumber = (raw: string) => {
  // "1.250" hoặc "1.250.000" (dấu chấm ngăn nghìn), "1,250,000" (dấu phẩy ngăn nghìn, từ 2 nhóm trở lên)
  if (/^\d{1,3}(\.\d{3})+$/.test(raw) || /^\d{1,3}(,\d{3}){2,}$/.test(raw))
    return { value: Number(raw.replace(/[.,]/g, "")), decimals: 0, grouped: true };
  const norm = raw.replace(",", ".");
  const decimals = norm.includes(".") ? norm.split(".")[1].length : 0;
  return { value: Number(norm), decimals, grouped: false };
};

const formatVi = (v: number, decimals: number, grouped: boolean) => {
  const fixed = v.toFixed(decimals);
  const [int, dec] = fixed.split(".");
  const intPart = grouped || int.length > 4 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : int;
  return dec ? `${intPart},${dec}` : intPart;
};

/** Number Counter: mọi con số trong chữ chạy từ 0 lên giá trị thật. */
const Counter: React.FC<Props> = ({ text, clip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = Easing.out(Easing.exp)(clamp01((frame * speedOf(clip)) / (fps * 1.6)));
  const out = text.replace(/\d[\d.,]*\d|\d/g, (raw) => {
    const n = parseViNumber(raw);
    if (Number.isNaN(n.value)) return raw;
    return formatVi(n.value * e, n.decimals, n.grouped);
  });
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{out}</span>;
};

/** Neon: chữ phát sáng, bật lên chập chờn, thỉnh thoảng một chữ chớp tắt. */
const Neon: React.FC<Props> = ({ text, clip }) => {
  const frame = useCurrentFrame();
  const glow = clip.highlightColor ?? "#ff2bd6";
  const shadow = `0 0 4px #ffffff, 0 0 12px ${glow}, 0 0 26px ${glow}, 0 0 48px ${glow}, 0 0 90px ${glow}`;
  const startup = [0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0.5, 1];
  const master = frame < startup.length ? startup[frame] : 1;
  const chars = Array.from(text).filter((c) => c.trim()).length;
  const weak = Math.floor(random(`${clip.id}-neon`) * Math.max(1, chars));
  return (
    <span style={{ textShadow: shadow, opacity: 0.2 + 0.8 * master }}>
      {perChar(text, (ch, index) => {
        const dim = index === weak && random(`${clip.id}-nf-${Math.floor(frame / 3)}`) < 0.18;
        return <span style={{ opacity: dim ? 0.25 : 1 }}>{ch}</span>;
      })}
    </span>
  );
};

/** Glitch: chữ tách lớp đỏ / xanh lệch nhau, từng đợt giật cắt ngang. */
const GlitchText: React.FC<Props> = ({ text, clip }) => {
  const frame = useCurrentFrame();
  const local = frame % 30;
  const burst = local < 6 && random(`${clip.id}-gt-${Math.floor(frame / 30)}`) > 0.2;
  const r = (k: string) => random(`${clip.id}-gt-${frame}-${k}`) - 0.5;
  const off = burst ? 10 + Math.abs(r("o")) * 24 : 3;
  const layer = (color: string, dx: number, k: string): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    color,
    mixBlendMode: "screen",
    transform: `translateX(${dx}px)`,
    clipPath: burst ? `inset(${(Math.abs(r(k + "t")) * 80).toFixed(0)}% 0 ${(Math.abs(r(k + "b")) * 60).toFixed(0)}% 0)` : undefined,
    pointerEvents: "none",
  });
  return (
    <span style={{ position: "relative", display: "inline-block", transform: burst ? `translateX(${r("x") * 14}px) skewX(${r("s") * 12}deg)` : undefined }}>
      {text}
      <span style={layer("#ff1f5a", -off, "a")} aria-hidden>
        {text}
      </span>
      <span style={layer("#1fe5ff", off, "b")} aria-hidden>
        {text}
      </span>
    </span>
  );
};

/** Hiển thị nội dung chữ theo hiệu ứng đã chọn. */
export const TextEffectView: React.FC<Props> = ({ text, clip }) => {
  switch (clip.textEffect) {
    case "words":
      return <AnimatedWords text={text} clip={clip} />;
    case "letters":
      return <AnimatedLetters text={text} clip={clip} />;
    case "typewriter":
      return <Typewriter text={text} clip={clip} />;
    case "typecursor":
      return <Typewriter text={text} clip={clip} cursor />;
    case "wave":
      return <WaveLetters text={text} clip={clip} />;
    case "kinetic":
      return <Kinetic text={text} clip={clip} />;
    case "reveal":
      return <Reveal text={text} clip={clip} />;
    case "bounce":
      return <Bounce text={text} clip={clip} />;
    case "scramble":
      return <Scramble text={text} clip={clip} />;
    case "karaoke":
      return <Karaoke text={text} clip={clip} />;
    case "counter":
      return <Counter text={text} clip={clip} />;
    case "neon":
      return <Neon text={text} clip={clip} />;
    case "glitch":
      return <GlitchText text={text} clip={clip} />;
    default:
      return <>{text}</>;
  }
};
