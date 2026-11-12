import { AlignCenter, AlignLeft, AlignRight, Crosshair, Maximize, Minimize } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { FONT_NAMES } from "../../src/engine/fonts";
import {
  Anim,
  ANIM_LABELS,
  AnimType,
  AudioClip,
  Clip,
  clipEnd,
  EASING_LABELS,
  EasingType,
  findClip,
  ImageClip,
  LOOP_LABELS,
  LoopType,
  MotionClip,
  Project,
  TEXT_EFFECT_LABELS,
  TextClip,
  TextEffect,
  Track,
  VFX_LABELS,
  VfxType,
  VideoClip,
  VisualClip,
} from "../../src/engine/types";
import { MOTION_PRESETS, MotionField } from "../../src/engine/motionPresets";
import { freeStart, updateClip } from "../ops";
import { update, useStore } from "../store";
import { clamp } from "../util";

// ---------- Các ô nhập dùng chung ----------

const Num: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  digits?: number;
  suffix?: string;
  slider?: boolean;
}> = ({ label, value, onChange, min = -Infinity, max = Infinity, step = 1, digits = 0, suffix, slider }) => {
  const fmt = (v: number) => String(Number(v.toFixed(digits)));
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(fmt(value));
  useEffect(() => {
    if (document.activeElement !== ref.current) setText(fmt(value));
  }, [value]);
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {slider && (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={clamp(value, min, max)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      )}
      <span className="num">
        <input
          ref={ref}
          type="number"
          value={text}
          step={step}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseFloat(e.target.value);
            if (!Number.isNaN(n)) onChange(clamp(n, min, max));
          }}
          onBlur={() => setText(fmt(value))}
        />
        {suffix && <i>{suffix}</i>}
      </span>
    </label>
  );
};

const Select = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Record<T, string> | readonly T[];
  onChange: (v: T) => void;
}) => {
  const entries: [T, string][] = Array.isArray(options)
    ? (options as readonly T[]).map((o) => [o, o])
    : (Object.entries(options) as [T, string][]);
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {entries.map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
};

const Color: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <label className="field">
    <span className="field-label">{label}</span>
    <span className="color">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <input
        type="text"
        value={value}
        onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && onChange(e.target.value)}
      />
    </span>
  </label>
);

const Toggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <label className="field toggle">
    <span className="field-label">{label}</span>
    <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
  </label>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="section">
    <h3>{title}</h3>
    {children}
  </section>
);

// ---------- Từng nhóm cài đặt ----------

type Setter<C> = (patch: Partial<C>, key: string) => void;

const neighbourLimit = (track: Track, clip: Clip) => {
  const next = track.clips
    .filter((c) => c.id !== clip.id && c.start >= clipEnd(clip))
    .reduce((m, c) => Math.min(m, c.start), Infinity);
  return next - clip.start;
};

const mediaLimit = (clip: Clip) =>
  clip.type === "video" || clip.type === "audio"
    ? Math.floor((clip.sourceDuration - clip.trimStart) / clip.playbackRate)
    : Infinity;

const Timing: React.FC<{ clip: Clip; track: Track; fps: number; set: Setter<Clip> }> = ({
  clip,
  track,
  fps,
  set,
}) => {
  const maxDuration = Math.max(1, Math.min(mediaLimit(clip), neighbourLimit(track, clip)));
  return (
    <Section title="Thời gian">
      <div className="grid2">
        <Num
          label="Bắt đầu"
          suffix="s"
          digits={2}
          step={0.1}
          min={0}
          value={clip.start / fps}
          onChange={(v) => set({ start: freeStart(track.clips, v * fps, clip.duration, clip.id) }, "start")}
        />
        <Num
          label="Thời lượng"
          suffix="s"
          digits={2}
          step={0.1}
          min={1 / fps}
          value={clip.duration / fps}
          onChange={(v) => set({ duration: clamp(Math.round(v * fps), 1, maxDuration) }, "duration")}
        />
      </div>
    </Section>
  );
};

const Transform: React.FC<{ clip: VisualClip; project: Project; set: Setter<VisualClip> }> = ({
  clip,
  project,
  set,
}) => (
  <Section title="Vị trí & kích thước">
    <div className="grid2">
      <Num label="X" suffix="px" value={clip.x} onChange={(v) => set({ x: Math.round(v) }, "x")} />
      <Num label="Y" suffix="px" value={clip.y} onChange={(v) => set({ y: Math.round(v) }, "y")} />
    </div>
    <Num
      label="Tỉ lệ"
      suffix="%"
      slider
      min={5}
      max={400}
      value={clip.scale * 100}
      onChange={(v) => set({ scale: v / 100 }, "scale")}
    />
    <Num
      label="Xoay"
      suffix="°"
      slider
      min={-180}
      max={180}
      value={clip.rotation}
      onChange={(v) => set({ rotation: v }, "rotation")}
    />
    <Num
      label="Độ đậm"
      suffix="%"
      slider
      min={0}
      max={100}
      value={clip.opacity * 100}
      onChange={(v) => set({ opacity: v / 100 }, "opacity")}
    />
    <div className="button-row">
      <button onClick={() => set({ x: 0, y: 0 }, "center")} title="Đưa về giữa khung hình">
        <Crosshair size={13} /> Căn giữa
      </button>
      {(clip.type === "video" || clip.type === "image") && (
        <>
          <button
            className={clip.fit === "cover" ? "on" : ""}
            onClick={() => set({ fit: "cover", scale: 1, x: 0, y: 0 } as Partial<VisualClip>, "fit")}
            title="Phủ kín khung hình, phần thừa bị cắt"
          >
            <Maximize size={13} /> Phủ kín
          </button>
          <button
            className={clip.fit === "contain" ? "on" : ""}
            onClick={() => set({ fit: "contain", scale: 1, x: 0, y: 0 } as Partial<VisualClip>, "fit")}
            title="Hiện trọn hình, có thể dư viền"
          >
            <Minimize size={13} /> Vừa khung
          </button>
        </>
      )}
    </div>
    <div className="muted-text">
      Khung hình {project.width}×{project.height}. Kéo trực tiếp trên màn xem trước để đổi vị trí, kéo góc để đổi kích
      thước.
    </div>
  </Section>
);

/** Hiệu ứng có kịch bản riêng, không chọn easing */
const SCRIPTED_ANIMS: AnimType[] = ["drop", "settle", "glitch"];

const AnimRow: React.FC<{ label: string; anim: Anim; fps: number; onChange: (a: Anim) => void }> = ({
  label,
  anim,
  fps,
  onChange,
}) => (
  <>
    <div className="grid2">
      <Select<AnimType> label={label} value={anim.type} options={ANIM_LABELS} onChange={(type) => onChange({ ...anim, type })} />
      <Num
        label="Kéo dài"
        suffix="s"
        digits={2}
        step={0.05}
        min={0.05}
        max={5}
        value={anim.duration / fps}
        onChange={(v) => onChange({ ...anim, duration: Math.max(1, Math.round(v * fps)) })}
      />
    </div>
    {anim.type !== "none" && !SCRIPTED_ANIMS.includes(anim.type) && (
      <Select<EasingType>
        label="Easing"
        value={anim.easing ?? "smooth"}
        options={EASING_LABELS}
        onChange={(easing) => onChange({ ...anim, easing })}
      />
    )}
  </>
);

const Animation: React.FC<{ clip: VisualClip; fps: number; set: Setter<VisualClip> }> = ({ clip, fps, set }) => (
  <Section title="Hiệu ứng chuyển động">
    <AnimRow label="Lúc vào" anim={clip.animIn} fps={fps} onChange={(animIn) => set({ animIn }, "animIn")} />
    <AnimRow label="Lúc ra" anim={clip.animOut} fps={fps} onChange={(animOut) => set({ animOut }, "animOut")} />
    <Select<LoopType>
      label="Trong lúc hiện"
      value={clip.loop}
      options={LOOP_LABELS}
      onChange={(loop) => set({ loop }, "loop")}
    />
    <Toggle label="Nhoè khi chạy nhanh" value={!!clip.motionBlur} onChange={(motionBlur) => set({ motionBlur }, "motionBlur")} />
  </Section>
);

const Look: React.FC<{ clip: VideoClip | ImageClip; set: Setter<VideoClip | ImageClip> }> = ({ clip, set }) => (
  <Section title="Hình ảnh">
    <Select<VfxType>
      label="Hiệu ứng hình"
      value={clip.vfx ?? "none"}
      options={VFX_LABELS}
      onChange={(vfx) => set({ vfx }, "vfx")}
    />
    <Num label="Bo góc" suffix="px" slider min={0} max={300} value={clip.radius} onChange={(v) => set({ radius: v }, "radius")} />
    <Num
      label="Độ sáng"
      suffix="%"
      slider
      min={50}
      max={150}
      value={clip.brightness * 100}
      onChange={(v) => set({ brightness: v / 100 }, "brightness")}
    />
    <Num
      label="Tương phản"
      suffix="%"
      slider
      min={50}
      max={150}
      value={clip.contrast * 100}
      onChange={(v) => set({ contrast: v / 100 }, "contrast")}
    />
    <Num
      label="Độ rực màu"
      suffix="%"
      slider
      min={0}
      max={200}
      value={clip.saturate * 100}
      onChange={(v) => set({ saturate: v / 100 }, "saturate")}
    />
    <div className="button-row">
      <button onClick={() => set({ brightness: 1, contrast: 1, saturate: 1 }, "look-reset")}>Đặt lại màu</button>
    </div>
    <div className="grid2">
      <Num label="Khung rộng" suffix="px" min={0} max={4000} value={clip.boxWidth ?? 0} onChange={(v) => set({ boxWidth: Math.round(v) }, "boxWidth")} />
      <Num label="Khung cao" suffix="px" min={0} max={4000} value={clip.boxHeight ?? 0} onChange={(v) => set({ boxHeight: Math.round(v) }, "boxHeight")} />
    </div>
    <div className="muted-text">Khung riêng dùng cho chia khung, so sánh trước/sau. Để 0 là cả khung hình.</div>
  </Section>
);

const Playback: React.FC<{ clip: VideoClip | AudioClip; track: Track; set: Setter<VideoClip | AudioClip> }> = ({
  clip,
  track,
  set,
}) => (
  <Section title="Âm thanh & tốc độ">
    <Num
      label="Âm lượng"
      suffix="%"
      slider
      min={0}
      max={100}
      value={clip.volume * 100}
      onChange={(v) => set({ volume: v / 100 }, "volume")}
    />
    <Num
      label="Tốc độ"
      suffix="x"
      slider
      digits={2}
      min={0.25}
      max={4}
      step={0.05}
      value={clip.playbackRate}
      onChange={(rate) => {
        // Giữ nguyên đoạn nguồn đang dùng: nhanh hơn thì clip ngắn lại.
        const sourceSpan = clip.duration * clip.playbackRate;
        const limit = Math.min(neighbourLimit(track, clip), Math.floor((clip.sourceDuration - clip.trimStart) / rate));
        set({ playbackRate: rate, duration: clamp(Math.round(sourceSpan / rate), 1, Math.max(1, limit)) }, "rate");
      }}
    />
    {clip.type === "video" && !clip.hasAudio && <div className="muted-text">Clip này không có tiếng.</div>}
  </Section>
);

/** Hiệu ứng chữ có dùng màu nhấn */
const HIGHLIGHT_EFFECTS: TextEffect[] = ["kinetic", "reveal", "scramble", "karaoke", "neon", "typecursor"];

const TextSettings: React.FC<{ clip: TextClip; set: Setter<TextClip> }> = ({ clip, set }) => (
  <>
    <Section title="Nội dung">
      <textarea
        className="text-input"
        rows={3}
        value={clip.text}
        onChange={(e) => set({ text: e.target.value, name: e.target.value.split("\n")[0].slice(0, 40) || "Chữ" }, "text")}
      />
      <Select<TextEffect>
        label="Hiệu ứng chữ"
        value={clip.textEffect}
        options={TEXT_EFFECT_LABELS}
        onChange={(textEffect) => set({ textEffect }, "textEffect")}
      />
      {clip.textEffect !== "none" && (
        <Num
          label="Tốc độ hiệu ứng"
          suffix="x"
          slider
          digits={2}
          step={0.05}
          min={0.25}
          max={4}
          value={clip.effectSpeed ?? 1}
          onChange={(v) => set({ effectSpeed: v }, "effectSpeed")}
        />
      )}
      {HIGHLIGHT_EFFECTS.includes(clip.textEffect) && (
        <Color
          label="Màu nhấn"
          value={clip.highlightColor ?? (clip.textEffect === "neon" ? "#ff2bd6" : "#ffd400")}
          onChange={(highlightColor) => set({ highlightColor }, "highlightColor")}
        />
      )}
    </Section>
    <Section title="Kiểu chữ">
      <Select<string> label="Phông" value={clip.fontFamily} options={FONT_NAMES} onChange={(fontFamily) => set({ fontFamily }, "font")} />
      <div className="grid2">
        <Num label="Cỡ chữ" suffix="px" min={8} max={600} value={clip.fontSize} onChange={(v) => set({ fontSize: v }, "fontSize")} />
        <Select<string>
          label="Độ đậm"
          value={String(clip.fontWeight)}
          options={{ "400": "Thường", "600": "Hơi đậm", "700": "Đậm", "800": "Rất đậm", "900": "Đậm nhất" }}
          onChange={(v) => set({ fontWeight: Number(v) }, "weight")}
        />
      </div>
      <Color label="Màu chữ" value={clip.color} onChange={(color) => set({ color }, "color")} />
      <div className="field">
        <span className="field-label">Căn lề</span>
        <span className="segmented">
          {(
            [
              ["left", AlignLeft],
              ["center", AlignCenter],
              ["right", AlignRight],
            ] as const
          ).map(([align, Icon]) => (
            <button key={align} className={clip.align === align ? "on" : ""} onClick={() => set({ align }, "align")}>
              <Icon size={14} />
            </button>
          ))}
        </span>
      </div>
      <div className="grid2">
        <Toggle label="IN HOA" value={clip.uppercase} onChange={(uppercase) => set({ uppercase }, "upper")} />
        <Toggle label="Nghiêng" value={clip.italic} onChange={(italic) => set({ italic }, "italic")} />
      </div>
      <div className="grid2">
        <Num
          label="Giãn dòng"
          digits={2}
          step={0.05}
          min={0.7}
          max={3}
          value={clip.lineHeight}
          onChange={(v) => set({ lineHeight: v }, "lineHeight")}
        />
        <Num
          label="Giãn chữ"
          suffix="px"
          min={-10}
          max={60}
          value={clip.letterSpacing}
          onChange={(v) => set({ letterSpacing: v }, "letterSpacing")}
        />
      </div>
      <Num
        label="Rộng tối đa"
        suffix="px"
        slider
        min={100}
        max={2000}
        step={10}
        value={clip.maxWidth}
        onChange={(v) => set({ maxWidth: v }, "maxWidth")}
      />
    </Section>
    <Section title="Viền, bóng, nền">
      <Num
        label="Viền chữ"
        suffix="px"
        slider
        min={0}
        max={30}
        value={clip.strokeWidth}
        onChange={(v) => set({ strokeWidth: v }, "strokeWidth")}
      />
      {clip.strokeWidth > 0 && (
        <Color label="Màu viền" value={clip.strokeColor} onChange={(strokeColor) => set({ strokeColor }, "strokeColor")} />
      )}
      <Toggle label="Đổ bóng" value={clip.shadow} onChange={(shadow) => set({ shadow }, "shadow")} />
      {clip.shadow && (
        <>
          <Num
            label="Độ nhoè bóng"
            suffix="px"
            slider
            min={0}
            max={80}
            value={clip.shadowBlur}
            onChange={(v) => set({ shadowBlur: v }, "shadowBlur")}
          />
          <Color label="Màu bóng" value={clip.shadowColor} onChange={(shadowColor) => set({ shadowColor }, "shadowColor")} />
        </>
      )}
      <Toggle label="Nền chữ" value={clip.bgEnabled} onChange={(bgEnabled) => set({ bgEnabled }, "bg")} />
      {clip.bgEnabled && (
        <>
          <Color label="Màu nền" value={clip.bgColor} onChange={(bgColor) => set({ bgColor }, "bgColor")} />
          <Num
            label="Độ đậm nền"
            suffix="%"
            slider
            min={0}
            max={100}
            value={clip.bgOpacity * 100}
            onChange={(v) => set({ bgOpacity: v / 100 }, "bgOpacity")}
          />
          <div className="grid2">
            <Num label="Đệm" suffix="px" min={0} max={200} value={clip.bgPadding} onChange={(v) => set({ bgPadding: v }, "bgPadding")} />
            <Num label="Bo góc" suffix="px" min={0} max={999} value={clip.bgRadius} onChange={(v) => set({ bgRadius: v }, "bgRadius")} />
          </div>
        </>
      )}
    </Section>
  </>
);

const MotionSettings: React.FC<{ clip: MotionClip; set: Setter<MotionClip> }> = ({ clip, set }) => {
  const meta = MOTION_PRESETS[clip.preset];
  const f = meta.fields;
  const has = (k: MotionField) => f[k] !== undefined;
  return (
    <Section title={meta.label}>
      {meta.variants && (
        <Select<string> label="Kiểu" value={clip.variant} options={meta.variants} onChange={(variant) => set({ variant }, "variant")} />
      )}
      {has("text") && (
        <label className="field">
          <span className="field-label">{f.text}</span>
          <input type="text" value={clip.text} onChange={(e) => set({ text: e.target.value }, "m-text")} />
        </label>
      )}
      {has("text2") && (
        <label className="field">
          <span className="field-label">{f.text2}</span>
          <input type="text" value={clip.text2} onChange={(e) => set({ text2: e.target.value }, "m-text2")} />
        </label>
      )}
      {has("items") && (
        <label className="field field-block">
          <span className="field-label">{f.items}</span>
          <textarea className="text-input" rows={4} value={clip.items} onChange={(e) => set({ items: e.target.value }, "m-items")} />
        </label>
      )}
      {has("value") && <Num label={f.value!} value={clip.value} min={0} onChange={(value) => set({ value }, "m-value")} />}
      {has("src") && (
        <label className="field">
          <span className="field-label">{f.src}</span>
          <input type="text" value={clip.src} placeholder="media/ten-file" onChange={(e) => set({ src: e.target.value.trim() }, "m-src")} />
        </label>
      )}
      {has("color") && <Color label={f.color!} value={clip.color} onChange={(color) => set({ color }, "m-color")} />}
      {has("color2") && <Color label={f.color2!} value={clip.color2} onChange={(color2) => set({ color2 }, "m-color2")} />}
      {has("color3") && <Color label={f.color3!} value={clip.color3} onChange={(color3) => set({ color3 }, "m-color3")} />}
      {has("font") && (
        <Select<string> label={f.font!} value={clip.fontFamily} options={FONT_NAMES} onChange={(fontFamily) => set({ fontFamily }, "m-font")} />
      )}
      <div className="grid2">
        <Num label="Rộng" suffix="px" min={50} max={4000} value={clip.w} onChange={(w) => set({ w: Math.round(w) }, "m-w")} />
        <Num label="Cao" suffix="px" min={50} max={4000} value={clip.h} onChange={(h) => set({ h: Math.round(h) }, "m-h")} />
      </div>
    </Section>
  );
};

const AudioFades: React.FC<{ clip: AudioClip; fps: number; set: Setter<AudioClip> }> = ({ clip, fps, set }) => (
  <Section title="Chuyển tiếng">
    <div className="grid2">
      <Num
        label="To dần"
        suffix="s"
        digits={1}
        step={0.1}
        min={0}
        max={10}
        value={clip.fadeIn / fps}
        onChange={(v) => set({ fadeIn: Math.round(v * fps) }, "fadeIn")}
      />
      <Num
        label="Nhỏ dần"
        suffix="s"
        digits={1}
        step={0.1}
        min={0}
        max={10}
        value={clip.fadeOut / fps}
        onChange={(v) => set({ fadeOut: Math.round(v * fps) }, "fadeOut")}
      />
    </div>
  </Section>
);

const FORMATS = [
  { label: "9:16 dọc", w: 1080, h: 1920 },
  { label: "16:9 ngang", w: 1920, h: 1080 },
  { label: "1:1 vuông", w: 1080, h: 1080 },
  { label: "4:5 feed", w: 1080, h: 1350 },
];

const ProjectSettings: React.FC<{ project: Project }> = ({ project }) => (
  <>
    <div className="inspector-title">
      <span className="chip">Dự án</span>
      <b>{project.name}</b>
    </div>
    <Section title="Thông tin">
      <label className="field">
        <span className="field-label">Tên</span>
        <input
          type="text"
          value={project.name}
          onChange={(e) => update((p) => ({ ...p, name: e.target.value }), "project-name")}
        />
      </label>
    </Section>
    <Section title="Khung hình">
      <div className="format-grid">
        {FORMATS.map((f) => (
          <button
            key={f.label}
            className={project.width === f.w && project.height === f.h ? "on" : ""}
            onClick={() => update((p) => ({ ...p, width: f.w, height: f.h }))}
          >
            <span className="format-shape" style={{ aspectRatio: `${f.w} / ${f.h}` }} />
            {f.label}
          </button>
        ))}
      </div>
      <Color label="Màu nền" value={project.background} onChange={(background) => update((p) => ({ ...p, background }), "bg")} />
      <div className="muted-text">
        {project.width}×{project.height} · {project.fps} khung hình/giây
      </div>
    </Section>
    <div className="notice">Chọn một clip trên timeline hoặc trên màn xem trước để chỉnh vị trí, kích thước, chữ và hiệu ứng.</div>
  </>
);

const TYPE_LABEL = { video: "Video", image: "Ảnh", text: "Chữ", motion: "Đồ hoạ", audio: "Âm thanh" } as const;

export const Inspector: React.FC = () => {
  const project = useStore((s) => s.project)!;
  const selectedId = useStore((s) => s.selectedId);
  const found = findClip(project, selectedId);

  if (!found) {
    return (
      <aside className="panel inspector">
        <div className="panel-body">
          <ProjectSettings project={project} />
        </div>
      </aside>
    );
  }

  const { clip, track } = found;
  const fps = project.fps;
  const set = (patch: Partial<Clip>, key: string) =>
    update((p) => updateClip(p, clip.id, patch), `${clip.id}:${key}`);

  return (
    <aside className="panel inspector">
      <div className="panel-body">
        <div className="inspector-title">
          <span className={`chip chip-${clip.type}`}>{TYPE_LABEL[clip.type]}</span>
          <b className="ellipsis">{clip.name}</b>
        </div>
        {track.locked && <div className="notice">Dòng này đang khoá. Mở khoá ở timeline để kéo thả; các ô bên dưới vẫn sửa được.</div>}
        {clip.type === "text" && <TextSettings clip={clip} set={set as Setter<TextClip>} />}
        {clip.type === "motion" && <MotionSettings clip={clip} set={set as Setter<MotionClip>} />}
        {clip.type !== "audio" && <Transform clip={clip} project={project} set={set as Setter<VisualClip>} />}
        {clip.type !== "audio" && <Animation clip={clip} fps={fps} set={set as Setter<VisualClip>} />}
        {(clip.type === "video" || clip.type === "audio") && (
          <Playback clip={clip} track={track} set={set as Setter<VideoClip | AudioClip>} />
        )}
        {clip.type === "audio" && <AudioFades clip={clip} fps={fps} set={set as Setter<AudioClip>} />}
        {(clip.type === "video" || clip.type === "image") && <Look clip={clip} set={set as Setter<VideoClip | ImageClip>} />}
        <Timing clip={clip} track={track} fps={fps} set={set} />
      </div>
    </aside>
  );
};
