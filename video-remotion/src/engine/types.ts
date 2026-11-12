// Mô hình dữ liệu của một dự án video.
// Toàn bộ video được mô tả bằng JSON này: trình chỉnh sửa sửa JSON, Remotion dựng hình từ JSON.

export type AnimType =
  | "none"
  | "fade"
  | "slideUp"
  | "slideDown"
  | "slideLeft"
  | "slideRight"
  | "zoomIn"
  | "zoomOut"
  | "pop"
  | "blur"
  | "spin"
  // Bổ sung theo Từ điển Motion Graphic
  | "wipeRight"
  | "wipeLeft"
  | "wipeUp"
  | "wipeDown"
  | "circle"
  | "compare"
  | "zoomThrough"
  | "flip"
  | "drop"
  | "settle"
  | "glitch";

/** Độ nhanh chậm (easing) của hiệu ứng vào/ra */
export type EasingType = "smooth" | "linear" | "inOut" | "back" | "elastic" | "bounce" | "anticipate";

export type LoopType =
  | "none"
  | "kenburns"
  | "pulse"
  | "float"
  | "shake"
  | "swing"
  | "bounce"
  | "spin"
  | "stopmotion"
  | "boil"
  | "glitch"
  | "flicker"
  | "panSlow"
  | "panFast";

export type TextEffect =
  | "none"
  | "typewriter"
  | "words"
  | "letters"
  | "wave"
  | "typecursor"
  | "kinetic"
  | "reveal"
  | "bounce"
  | "scramble"
  | "karaoke"
  | "counter"
  | "neon"
  | "glitch";

/** Hiệu ứng phủ nhẹ lên hình của clip video / ảnh */
export type VfxType = "none" | "sparkle" | "shine" | "vignette" | "flash" | "glitch" | "vhs" | "confetti";

export type Anim = { type: AnimType; duration: number; easing?: EasingType };

export type TrackKind = "video" | "text" | "audio";

type Timed = {
  id: string;
  name: string;
  /** Khung hình bắt đầu trên timeline */
  start: number;
  /** Số khung hình hiển thị */
  duration: number;
};

type Visual = Timed & {
  /** Lệch tâm so với tâm khung hình, tính bằng pixel */
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  animIn: Anim;
  animOut: Anim;
  loop: LoopType;
  /** Nhoè theo hướng chạy khi clip chuyển động nhanh */
  motionBlur?: boolean;
};

/** Khung chứa riêng cho video/ảnh (chia khung, so sánh). 0 hoặc bỏ trống = cả khung hình. */
type Boxed = { boxWidth?: number; boxHeight?: number };

export type VideoClip = Visual & {
  type: "video";
  src: string;
  sourceName: string;
  /** Số khung hình của nguồn bị cắt bỏ ở đầu (tính theo fps dự án) */
  trimStart: number;
  /** Tổng số khung hình của nguồn (tính theo fps dự án) */
  sourceDuration: number;
  naturalWidth: number;
  naturalHeight: number;
  fit: "cover" | "contain";
  volume: number;
  playbackRate: number;
  radius: number;
  brightness: number;
  contrast: number;
  saturate: number;
  hasAudio: boolean;
  vfx?: VfxType;
} & Boxed;

export type ImageClip = Visual & {
  type: "image";
  src: string;
  sourceName: string;
  naturalWidth: number;
  naturalHeight: number;
  fit: "cover" | "contain";
  radius: number;
  brightness: number;
  contrast: number;
  saturate: number;
  vfx?: VfxType;
} & Boxed;

export type TextClip = Visual & {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  uppercase: boolean;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  maxWidth: number;
  strokeColor: string;
  strokeWidth: number;
  shadow: boolean;
  shadowColor: string;
  shadowBlur: number;
  bgEnabled: boolean;
  bgColor: string;
  bgOpacity: number;
  bgPadding: number;
  bgRadius: number;
  textEffect: TextEffect;
  /** Màu nhấn: từ đang đọc (phụ đề), ánh sáng neon, vạch che */
  highlightColor?: string;
  /** Tốc độ hiệu ứng chữ, 1 = bình thường, 2 = nhanh gấp đôi */
  effectSpeed?: number;
};

export type MotionPreset =
  | "lowerThird"
  | "shapes"
  | "morph"
  | "lineDraw"
  | "liquid"
  | "loader"
  | "isometric"
  | "grid"
  | "barChart"
  | "counter"
  | "donut"
  | "mapRoute"
  | "timeline"
  | "icon"
  | "explainer"
  | "logoReveal"
  | "badge"
  | "endCard"
  | "phoneUI"
  | "microInteraction"
  | "cursor"
  | "character"
  | "doodle"
  | "particles"
  | "cube3d"
  | "parallax"
  | "vhsOverlay"
  | "gradient"
  | "audioBars"
  | "shapeWipe"
  | "dot";

/** Clip đồ hoạ chuyển động dựng sẵn (biểu đồ, logo, nhãn, nền…), chỉnh được chữ, số, màu. */
export type MotionClip = Visual & {
  type: "motion";
  preset: MotionPreset;
  variant: string;
  /** Kích thước khung vẽ, pixel */
  w: number;
  h: number;
  text: string;
  text2: string;
  /** Danh sách, mỗi dòng một mục (biểu đồ: "Nhãn: số") */
  items: string;
  value: number;
  color: string;
  color2: string;
  color3: string;
  fontFamily: string;
  /** Ảnh / âm thanh trong public (tuỳ mẫu) */
  src: string;
};

/** Mẫu đồ hoạ làm nền phủ kín khung: đặt ở dòng video thay vì dòng chữ */
export const MOTION_BG_PRESETS: readonly MotionPreset[] = ["gradient", "parallax", "grid"];

export type AudioClip = Timed & {
  type: "audio";
  src: string;
  sourceName: string;
  trimStart: number;
  sourceDuration: number;
  volume: number;
  playbackRate: number;
  fadeIn: number;
  fadeOut: number;
};

export type Clip = VideoClip | ImageClip | TextClip | MotionClip | AudioClip;
export type VisualClip = VideoClip | ImageClip | TextClip | MotionClip;

export type Track = {
  id: string;
  name: string;
  kind: TrackKind;
  hidden: boolean;
  muted: boolean;
  locked: boolean;
  clips: Clip[];
};

export type Project = {
  version: 1;
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  background: string;
  /** Dòng đầu tiên nằm trên cùng (che các dòng bên dưới) */
  tracks: Track[];
};

export const ANIM_LABELS: Record<AnimType, string> = {
  none: "Không",
  fade: "Mờ dần",
  slideUp: "Trượt lên",
  slideDown: "Trượt xuống",
  slideLeft: "Trượt sang trái",
  slideRight: "Trượt sang phải",
  zoomIn: "Phóng to",
  zoomOut: "Thu nhỏ",
  pop: "Bật nảy",
  blur: "Nhoè",
  spin: "Xoay",
  wipeRight: "Lộ dần trái → phải",
  wipeLeft: "Lộ dần phải → trái",
  wipeUp: "Lộ dần từ dưới lên",
  wipeDown: "Lộ dần từ trên xuống",
  circle: "Hình tròn mở ra",
  compare: "So sánh trước/sau (vạch chia)",
  zoomThrough: "Phóng xuyên qua",
  flip: "Lật 3D",
  drop: "Rơi bẹp nảy (squash)",
  settle: "Lắc rồi dừng (follow-through)",
  glitch: "Nhiễu glitch",
};

export const EASING_LABELS: Record<EasingType, string> = {
  smooth: "Mượt (chậm dần)",
  linear: "Đều (linear)",
  inOut: "Nhanh giữa, chậm 2 đầu",
  back: "Vượt rồi bật về (overshoot)",
  elastic: "Đàn hồi",
  bounce: "Nảy",
  anticipate: "Lấy đà (anticipation)",
};

export const LOOP_LABELS: Record<LoopType, string> = {
  none: "Không",
  kenburns: "Zoom chậm",
  pulse: "Nhịp đập",
  float: "Bồng bềnh",
  shake: "Rung",
  swing: "Lắc lư",
  bounce: "Nảy co bẹp (squash & stretch)",
  spin: "Xoay tròn liền mạch",
  stopmotion: "Giật khung stop motion",
  boil: "Rung nét vẽ tay",
  glitch: "Giật nhiễu glitch",
  flicker: "Chớp như đèn neon",
  panSlow: "Lia chậm (lớp xa)",
  panFast: "Lia nhanh (lớp gần)",
};

export const TEXT_EFFECT_LABELS: Record<TextEffect, string> = {
  none: "Không",
  typewriter: "Đánh máy",
  words: "Từng từ bật lên",
  letters: "Từng chữ hiện dần",
  wave: "Nhún nhảy",
  typecursor: "Đánh máy có con trỏ",
  kinetic: "Kinetic: từng từ đập vào",
  reveal: "Trồi lên sau vạch che",
  bounce: "Từng chữ rơi nảy",
  scramble: "Giải mã ký tự",
  karaoke: "Phụ đề tô màu từng từ",
  counter: "Số chạy (đếm lên)",
  neon: "Đèn neon",
  glitch: "Glitch lệch màu",
};

export const VFX_LABELS: Record<VfxType, string> = {
  none: "Không",
  sparkle: "Lấp lánh",
  shine: "Vệt sáng lướt qua",
  vignette: "Tối viền",
  flash: "Chớp sáng đầu cảnh",
  glitch: "Nhiễu glitch",
  vhs: "Băng VHS cũ",
  confetti: "Pháo giấy",
};

export const TRACK_KIND_LABELS: Record<TrackKind, string> = {
  video: "Video",
  text: "Chữ",
  audio: "Âm thanh",
};

let uidCounter = 0;

/** Mã định danh duy nhất cho clip và dòng. Chỉ gọi lúc soạn dự án, không gọi trong lúc dựng hình. */
export const uid = () => `${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

export const clipEnd = (c: Clip) => c.start + c.duration;

export const isVisual = (c: Clip): c is VisualClip => c.type !== "audio";

export const trackKindOf = (c: Clip): TrackKind =>
  c.type === "text"
    ? "text"
    : c.type === "audio"
      ? "audio"
      : c.type === "motion"
        ? MOTION_BG_PRESETS.includes(c.preset)
          ? "video"
          : "text"
        : "video";

/** Tổng số khung hình của dự án */
export const projectDuration = (p: Project) => {
  let end = 0;
  for (const t of p.tracks) for (const c of t.clips) end = Math.max(end, clipEnd(c));
  return Math.max(1, Math.round(end));
};

export const findClip = (p: Project, id: string | null) => {
  if (!id) return null;
  for (const track of p.tracks) {
    const clip = track.clips.find((c) => c.id === id);
    if (clip) return { clip, track };
  }
  return null;
};

export const visualDefaults = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
  animIn: { type: "none", duration: 12 } as Anim,
  animOut: { type: "none", duration: 12 } as Anim,
  loop: "none" as LoopType,
};

export const makeTextClip = (patch: Partial<TextClip> = {}): TextClip => ({
  id: uid(),
  name: "Chữ",
  type: "text",
  start: 0,
  duration: 90,
  ...visualDefaults,
  animIn: { type: "fade", duration: 12 },
  animOut: { type: "fade", duration: 10 },
  text: "Nhập nội dung",
  fontFamily: "Be Vietnam Pro",
  fontSize: 90,
  fontWeight: 800,
  italic: false,
  uppercase: false,
  color: "#ffffff",
  align: "center",
  lineHeight: 1.15,
  letterSpacing: 0,
  maxWidth: 900,
  strokeColor: "#000000",
  strokeWidth: 0,
  shadow: true,
  shadowColor: "#000000",
  shadowBlur: 18,
  bgEnabled: false,
  bgColor: "#000000",
  bgOpacity: 0.6,
  bgPadding: 24,
  bgRadius: 20,
  textEffect: "none",
  ...patch,
});

export type MediaMeta = {
  kind: "video" | "image" | "audio";
  src: string;
  sourceName: string;
  /** giây */
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
};

export const makeMediaClip = (meta: MediaMeta, fps: number): Clip => {
  const base = { id: uid(), name: meta.sourceName, start: 0 };
  const frames = Math.max(1, Math.floor(meta.duration * fps));
  if (meta.kind === "audio") {
    return {
      ...base,
      type: "audio",
      duration: frames,
      src: meta.src,
      sourceName: meta.sourceName,
      trimStart: 0,
      sourceDuration: frames,
      volume: 1,
      playbackRate: 1,
      fadeIn: 0,
      fadeOut: 0,
    };
  }
  const look = { fit: "cover" as const, radius: 0, brightness: 1, contrast: 1, saturate: 1 };
  if (meta.kind === "image") {
    return {
      ...base,
      ...visualDefaults,
      ...look,
      type: "image",
      duration: fps * 3,
      src: meta.src,
      sourceName: meta.sourceName,
      naturalWidth: meta.width,
      naturalHeight: meta.height,
    };
  }
  return {
    ...base,
    ...visualDefaults,
    ...look,
    type: "video",
    duration: frames,
    src: meta.src,
    sourceName: meta.sourceName,
    trimStart: 0,
    sourceDuration: frames,
    naturalWidth: meta.width,
    naturalHeight: meta.height,
    volume: 1,
    playbackRate: 1,
    hasAudio: meta.hasAudio,
  };
};

export const makeTrack = (kind: TrackKind, name?: string): Track => ({
  id: uid(),
  name: name ?? TRACK_KIND_LABELS[kind],
  kind,
  hidden: false,
  muted: false,
  locked: false,
  clips: [],
});

export const emptyProject = (id = "moi", name = "Dự án mới"): Project => ({
  version: 1,
  id,
  name,
  width: 1080,
  height: 1920,
  fps: 30,
  background: "#000000",
  tracks: [makeTrack("text", "Chữ"), makeTrack("video", "Video chính"), makeTrack("audio", "Nhạc")],
});
