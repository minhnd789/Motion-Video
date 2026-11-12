import { Player } from "@remotion/player";
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { MainVideo } from "../../src/engine/MainVideo";
import { clipEnd, findClip, isVisual, projectDuration, VisualClip } from "../../src/engine/types";
import { updateClip } from "../ops";
import { checkpoint, live, playerRef, seek, select, togglePlay, useStore } from "../store";
import { formatTime } from "../util";

type Drag =
  | { mode: "move"; clip: VisualClip; sx: number; sy: number; moved: boolean }
  | { mode: "scale"; clip: VisualClip; cx: number; cy: number; d0: number; moved: boolean }
  | { mode: "rotate"; clip: VisualClip; cx: number; cy: number; a0: number; moved: boolean };

const TimeReadout: React.FC = () => {
  const frame = useStore((s) => s.frame);
  const project = useStore((s) => s.project)!;
  return (
    <span className="time">
      <b>{formatTime(frame, project.fps)}</b>
      <span> / {formatTime(projectDuration(project), project.fps)}</span>
    </span>
  );
};

export const Preview: React.FC = () => {
  const project = useStore((s) => s.project)!;
  const playing = useStore((s) => s.playing);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [guides, setGuides] = useState({ v: false, h: false });
  const [muted, setMuted] = useState(false);

  // Co khung xem trước cho vừa vùng giữa, giữ đúng tỉ lệ video.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const aw = el.clientWidth - 32;
      const ah = el.clientHeight - 32;
      if (aw <= 0 || ah <= 0) return;
      const s = Math.min(aw / project.width, ah / project.height);
      setBox({ w: Math.floor(project.width * s), h: Math.floor(project.height * s) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [project.width, project.height]);

  const ready = box.w > 0;

  // Đồng bộ vị trí phát và trạng thái phát từ Player về kho trạng thái.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => useStore.setState({ frame: e.detail.frame });
    const onPlay = () => useStore.setState({ playing: true });
    const onPause = () => useStore.setState({ playing: false });
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onPause);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onPause);
    };
  }, [ready]);

  const elementOf = (id: string) =>
    stageRef.current?.querySelector<HTMLElement>(`[data-clip-id="${id}"]`) ?? null;

  // Khung chọn bám theo phần tử thật trong video, kể cả khi hiệu ứng đang chạy.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const sel = selRef.current;
      const stage = stageRef.current;
      if (sel && stage) {
        const { selectedId, project: p, frame } = useStore.getState();
        const found = p ? findClip(p, selectedId) : null;
        const active = found && isVisual(found.clip) && frame >= found.clip.start && frame < clipEnd(found.clip);
        const el = active ? elementOf(found.clip.id) : null;
        if (el) {
          const r = el.getBoundingClientRect();
          const s = stage.getBoundingClientRect();
          sel.style.display = "block";
          sel.style.left = `${r.left - s.left}px`;
          sel.style.top = `${r.top - s.top}px`;
          sel.style.width = `${r.width}px`;
          sel.style.height = `${r.height}px`;
        } else {
          sel.style.display = "none";
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const hitTest = (x: number, y: number): VisualClip | null => {
    const { project: p, frame } = useStore.getState();
    if (!p) return null;
    for (const track of p.tracks) {
      if (track.hidden || track.locked || track.kind === "audio") continue;
      for (const clip of track.clips) {
        if (!isVisual(clip) || frame < clip.start || frame >= clipEnd(clip)) continue;
        const r = elementOf(clip.id)?.getBoundingClientRect();
        if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return clip;
      }
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const handle = (e.target as HTMLElement).dataset.handle;
    const { project: p, selectedId } = useStore.getState();
    const selected = p ? findClip(p, selectedId) : null;

    if (handle && selected && isVisual(selected.clip) && !selected.track.locked) {
      const r = elementOf(selected.clip.id)?.getBoundingClientRect();
      if (!r) return;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      drag.current =
        handle === "rotate"
          ? { mode: "rotate", clip: selected.clip, cx, cy, a0: Math.atan2(e.clientY - cy, e.clientX - cx), moved: false }
          : {
              mode: "scale",
              clip: selected.clip,
              cx,
              cy,
              d0: Math.max(1, Math.hypot(e.clientX - cx, e.clientY - cy)),
              moved: false,
            };
    } else {
      const clip = hitTest(e.clientX, e.clientY);
      select(clip?.id ?? null);
      if (!clip) return;
      drag.current = { mode: "move", clip, sx: e.clientX, sy: e.clientY, moved: false };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    playerRef.current?.pause();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const k = box.w / project.width;
    if (!d.moved) {
      if (d.mode === "move" && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
      d.moved = true;
      checkpoint();
    }
    if (d.mode === "move") {
      let x = d.clip.x + (e.clientX - d.sx) / k;
      let y = d.clip.y + (e.clientY - d.sy) / k;
      const snapOn = useStore.getState().snap && !e.altKey;
      const threshold = 8 / k;
      const v = snapOn && Math.abs(x) < threshold;
      const h = snapOn && Math.abs(y) < threshold;
      if (v) x = 0;
      if (h) y = 0;
      setGuides({ v, h });
      live((p) => updateClip(p, d.clip.id, { x: Math.round(x), y: Math.round(y) }));
    } else if (d.mode === "scale") {
      const ratio = Math.hypot(e.clientX - d.cx, e.clientY - d.cy) / d.d0;
      const scale = Math.max(0.05, Math.round(d.clip.scale * ratio * 1000) / 1000);
      live((p) => updateClip(p, d.clip.id, { scale }));
    } else {
      const delta = ((Math.atan2(e.clientY - d.cy, e.clientX - d.cx) - d.a0) * 180) / Math.PI;
      let rotation = Math.round(d.clip.rotation + delta);
      const nearest = Math.round(rotation / 90) * 90;
      if (Math.abs(rotation - nearest) < 4) rotation = nearest;
      live((p) => updateClip(p, d.clip.id, { rotation }));
    }
  };

  const onPointerUp = () => {
    drag.current = null;
    setGuides({ v: false, h: false });
  };

  const inputProps = useMemo(() => ({ project }), [project]);
  const duration = projectDuration(project);

  const toggleMute = () => {
    const player = playerRef.current;
    if (!player) return;
    if (muted) player.unmute();
    else player.mute();
    setMuted(!muted);
  };

  return (
    <section className="preview">
      <div className="preview-wrap" ref={wrapRef}>
        {ready && (
          <div className="stage" ref={stageRef} style={{ width: box.w, height: box.h }}>
            <Player
              ref={playerRef}
              component={MainVideo}
              inputProps={inputProps}
              durationInFrames={duration}
              fps={project.fps}
              compositionWidth={project.width}
              compositionHeight={project.height}
              style={{ width: box.w, height: box.h }}
              controls={false}
              clickToPlay={false}
              doubleClickToFullscreen={false}
              spaceKeyToPlayOrPause={false}
              acknowledgeRemotionLicense
            />
            <div
              className="overlay"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {guides.v && <div className="guide guide-v" />}
              {guides.h && <div className="guide guide-h" />}
              <div className="sel" ref={selRef}>
                <span className="sel-rotate" data-handle="rotate" title="Xoay" />
                <span className="sel-handle tl" data-handle="scale" />
                <span className="sel-handle tr" data-handle="scale" />
                <span className="sel-handle bl" data-handle="scale" />
                <span className="sel-handle br" data-handle="scale" />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="transport">
        <TimeReadout />
        <div className="transport-buttons">
          <button className="icon-btn" title="Về đầu (Home)" onClick={() => seek(0)}>
            <SkipBack size={16} />
          </button>
          <button className="play-btn" title="Phát / dừng (Space)" onClick={togglePlay}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button className="icon-btn" title="Tới cuối (End)" onClick={() => seek(duration - 1)}>
            <SkipForward size={16} />
          </button>
        </div>
        <div className="transport-right">
          <span className="muted-text">
            {project.width}×{project.height} · {project.fps}fps
          </span>
          <button className="icon-btn" title={muted ? "Bật tiếng" : "Tắt tiếng xem trước"} onClick={toggleMute}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </div>
    </section>
  );
};
