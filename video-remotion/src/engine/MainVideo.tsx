import { Audio, Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { computeXf, xfTransform } from "./animations";
import { ensureFont } from "./fonts";
import { Vfx } from "./fx";
import { MotionGraphic } from "./MotionGraphic";
import { TextEffectView } from "./textEffects";
import type { AudioClip, ImageClip, MotionClip, Project, TextClip, Track, VideoClip, VisualClip } from "./types";

const resolveSrc = (src: string) => (/^(https?:|data:|blob:)/.test(src) ? src : staticFile(src));

const hexToRgba = (hex: string, alpha: number) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/** Khung bao một clip: đặt vị trí, tỉ lệ, xoay, độ mờ và hiệu ứng vào/ra. */
const Positioned: React.FC<{
  clip: VisualClip;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ clip, style, children }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const xf = computeXf(clip, frame, fps, width, height);
  return (
    <div
      data-clip-id={clip.id}
      style={{
        position: "absolute",
        left: width / 2 + clip.x,
        top: height / 2 + clip.y,
        transform: xfTransform(xf),
        opacity: xf.opacity,
        filter: xf.blur > 0.01 ? `blur(${xf.blur}px)` : undefined,
        clipPath: xf.clip,
        ...style,
      }}
    >
      {children}
      {xf.divider !== undefined && (
        // Vạch chia so sánh trước/sau, nằm ngay mép phần đã lộ.
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `calc(${xf.divider}% - 10px)`,
            width: 10,
            background: "#ffffff",
            boxShadow: "0 0 18px rgba(0,0,0,0.5)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};

const fitSize = (clip: VideoClip | ImageClip, width: number, height: number) => {
  const nw = clip.naturalWidth || width;
  const nh = clip.naturalHeight || height;
  // Có khung riêng (chia khung): hình phủ kín khung đó, phần thừa bị cắt.
  if (clip.boxWidth || clip.boxHeight) {
    return { width: clip.boxWidth || width, height: clip.boxHeight || height };
  }
  const s = clip.fit === "cover" ? Math.max(width / nw, height / nh) : Math.min(width / nw, height / nh);
  return { width: nw * s, height: nh * s };
};

const boxed = (clip: VideoClip | ImageClip) => !!(clip.boxWidth || clip.boxHeight);

const lookFilter = (clip: VideoClip | ImageClip) =>
  clip.brightness === 1 && clip.contrast === 1 && clip.saturate === 1
    ? undefined
    : `brightness(${clip.brightness}) contrast(${clip.contrast}) saturate(${clip.saturate})`;

const VideoView: React.FC<{ clip: VideoClip; muted: boolean }> = ({ clip, muted }) => {
  const { width, height } = useVideoConfig();
  const size = fitSize(clip, width, height);
  return (
    <Positioned clip={clip} style={{ ...size, borderRadius: clip.radius, overflow: "hidden" }}>
      <Video
        src={resolveSrc(clip.src)}
        trimBefore={clip.trimStart}
        playbackRate={clip.playbackRate}
        volume={clip.volume}
        muted={muted || clip.volume === 0 || !clip.hasAudio}
        objectFit={boxed(clip) ? clip.fit : "fill"}
        style={{ width: "100%", height: "100%", display: "block", filter: lookFilter(clip) }}
      />
      <Vfx clip={clip} />
    </Positioned>
  );
};

const ImageView: React.FC<{ clip: ImageClip }> = ({ clip }) => {
  const { width, height } = useVideoConfig();
  const size = fitSize(clip, width, height);
  return (
    <Positioned clip={clip} style={{ ...size, borderRadius: clip.radius, overflow: "hidden" }}>
      <Img
        src={resolveSrc(clip.src)}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: boxed(clip) ? clip.fit : undefined,
          filter: lookFilter(clip),
        }}
      />
      <Vfx clip={clip} />
    </Positioned>
  );
};

const TextView: React.FC<{ clip: TextClip }> = ({ clip }) => {
  const text = clip.uppercase ? clip.text.toLocaleUpperCase("vi") : clip.text;
  // Neon tự có ánh sáng riêng nên bỏ bóng đổ thường.
  const shadow =
    clip.shadow && clip.textEffect !== "neon"
      ? `0 ${Math.round(clip.shadowBlur / 4)}px ${clip.shadowBlur}px ${hexToRgba(clip.shadowColor, 0.75)}`
      : undefined;
  return (
    <Positioned
      clip={clip}
      style={{
        width: "max-content",
        maxWidth: clip.maxWidth,
        fontFamily: `"${ensureFont(clip.fontFamily)}", sans-serif`,
        fontSize: clip.fontSize,
        fontWeight: clip.fontWeight,
        fontStyle: clip.italic ? "italic" : "normal",
        color: clip.color,
        textAlign: clip.align,
        lineHeight: clip.lineHeight,
        letterSpacing: clip.letterSpacing,
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
        WebkitTextStroke: clip.strokeWidth > 0 ? `${clip.strokeWidth * 2}px ${clip.strokeColor}` : undefined,
        paintOrder: "stroke fill",
        textShadow: shadow,
        backgroundColor: clip.bgEnabled ? hexToRgba(clip.bgColor, clip.bgOpacity) : undefined,
        padding: clip.bgEnabled ? `${clip.bgPadding * 0.6}px ${clip.bgPadding}px` : undefined,
        borderRadius: clip.bgEnabled ? clip.bgRadius : undefined,
      }}
    >
      <TextEffectView text={text} clip={clip} />
    </Positioned>
  );
};

const MotionView: React.FC<{ clip: MotionClip }> = ({ clip }) => (
  <Positioned clip={clip} style={{ width: clip.w, height: clip.h }}>
    <MotionGraphic clip={clip} />
  </Positioned>
);

const AudioView: React.FC<{ clip: AudioClip }> = ({ clip }) => {
  const { duration, fadeIn, fadeOut, volume } = clip;
  return (
    <Audio
      src={resolveSrc(clip.src)}
      trimBefore={clip.trimStart}
      playbackRate={clip.playbackRate}
      volume={(f) => {
        let v = volume;
        if (fadeIn > 0) v *= Math.min(1, Math.max(0, f / fadeIn));
        if (fadeOut > 0) v *= Math.min(1, Math.max(0, (duration - f) / fadeOut));
        return v;
      }}
    />
  );
};

const TrackView: React.FC<{ track: Track; fps: number }> = ({ track, fps }) => {
  if (track.hidden) return null;
  return (
    <>
      {track.clips.map((clip) => {
        if (clip.duration < 1) return null;
        if (clip.type === "audio") {
          if (track.muted) return null;
          return (
            <Sequence key={clip.id} from={clip.start} durationInFrames={clip.duration} layout="none" name={clip.name}>
              <AudioView clip={clip} />
            </Sequence>
          );
        }
        return (
          <Sequence
            key={clip.id}
            from={clip.start}
            durationInFrames={clip.duration}
            premountFor={fps}
            name={clip.name}
          >
            {clip.type === "video" ? (
              <VideoView clip={clip} muted={track.muted} />
            ) : clip.type === "image" ? (
              <ImageView clip={clip} />
            ) : clip.type === "motion" ? (
              <MotionView clip={clip} />
            ) : (
              <TextView clip={clip} />
            )}
          </Sequence>
        );
      })}
    </>
  );
};

export type MainVideoProps = { project: Project };

/** Dựng toàn bộ video từ JSON dự án. Dùng chung cho xem trước lẫn xuất file. */
export const MainVideo: React.FC<MainVideoProps> = ({ project }) => {
  // Dòng đầu tiên trong danh sách nằm trên cùng, nên vẽ từ dưới lên.
  const bottomUp = [...project.tracks].reverse();
  return (
    <AbsoluteFill style={{ backgroundColor: project.background, overflow: "hidden" }}>
      {bottomUp.map((track) => (
        <TrackView key={track.id} track={track} fps={project.fps} />
      ))}
    </AbsoluteFill>
  );
};
