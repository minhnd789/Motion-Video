import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Film,
  Lock,
  Magnet,
  Music,
  Plus,
  Scissors,
  Trash2,
  Type,
  Unlock,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Clip, clipEnd, findClip, Project, projectDuration, Track, TrackKind } from "../../src/engine/types";
import { thumbUrl } from "../api";
import { addTrack, moveClip, moveTrack, removeTrack, settleClip, updateClip, updateTrack } from "../ops";
import {
  addSource,
  checkpoint,
  deleteSelected,
  duplicateSelected,
  live,
  seek,
  select,
  splitAtPlayhead,
  update,
  useStore,
} from "../store";
import { clamp, formatTime } from "../util";

const HEADER_W = 172;
const RULER_H = 28;
const ROW_H: Record<TrackKind, number> = { video: 62, text: 40, audio: 44 };
const KIND_ICON = { video: Film, text: Type, audio: Music };
const MIN_PPF = 0.2;
const MAX_PPF = 24;

const laneKindFor = (sourceKind: string): TrackKind => (sourceKind === "audio" ? "audio" : "video");

/** Các mốc để hút dính: đầu timeline, đầu phát, mép của mọi clip khác. */
const snapPoints = (project: Project, ignoreId: string, playhead: number) => {
  const points = [0, playhead];
  for (const t of project.tracks) for (const c of t.clips) if (c.id !== ignoreId) points.push(c.start, clipEnd(c));
  return points;
};

const nearest = (value: number, points: number[], threshold: number) => {
  let best: number | null = null;
  for (const p of points) {
    if (Math.abs(p - value) <= threshold && (best === null || Math.abs(p - value) < Math.abs(best - value))) best = p;
  }
  return best;
};

// ---------- Thước thời gian ----------

const Ruler: React.FC<{ frames: number; ppf: number; fps: number }> = ({ frames, ppf, fps }) => {
  const steps = [1 / fps, 5 / fps, 0.5, 1, 2, 5, 10, 30, 60, 120, 300];
  const step = steps.find((s) => s * fps * ppf >= 72) ?? 600;
  const stepFrames = Math.max(1, Math.round(step * fps));
  const labels: number[] = [];
  for (let f = 0; f <= frames; f += stepFrames) labels.push(f);
  const minor = (stepFrames * ppf) / 5;

  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const left = e.currentTarget.getBoundingClientRect().left;
    const at = (x: number) => seek((x - left) / ppf);
    at(e.clientX);
    const move = (ev: PointerEvent) => at(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      className="tl-ruler"
      style={{
        width: frames * ppf,
        height: RULER_H,
        backgroundSize: `${minor}px 6px, ${stepFrames * ppf}px 12px`,
      }}
      onPointerDown={scrub}
    >
      {labels.map((f) => (
        <span key={f} style={{ left: f * ppf }}>
          {step < 1 ? formatTime(f, fps) : formatTime(f, fps).slice(0, 5)}
        </span>
      ))}
    </div>
  );
};

// ---------- Đầu phát ----------

const Playhead: React.FC<{ ppf: number; scroller: React.RefObject<HTMLDivElement | null> }> = ({ ppf, scroller }) => {
  const frame = useStore((s) => s.frame);
  const playing = useStore((s) => s.playing);
  const x = HEADER_W + frame * ppf;

  // Khi đang phát, cuộn timeline theo đầu phát.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !playing) return;
    if (x > el.scrollLeft + el.clientWidth - 40 || x < el.scrollLeft + HEADER_W) {
      el.scrollLeft = Math.max(0, x - HEADER_W - 80);
    }
  }, [x, playing, scroller]);

  return (
    <div className="tl-playhead" style={{ transform: `translateX(${x}px)` }}>
      <span />
    </div>
  );
};

// ---------- Clip ----------

type DragMode = "move" | "trimL" | "trimR";

const ClipBlock: React.FC<{ clip: Clip; track: Track; ppf: number; selected: boolean }> = ({
  clip,
  track,
  ppf,
  selected,
}) => {
  const start = (e: React.PointerEvent, mode: DragMode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    select(clip.id);
    if (track.locked) return;

    const sx = e.clientX;
    const sy = e.clientY;
    const orig = clip;
    const state = useStore.getState();
    const project = state.project!;
    const points = snapPoints(project, clip.id, state.frame);
    const rate = orig.type === "video" || orig.type === "audio" ? orig.playbackRate : 1;
    const others = track.clips.filter((c) => c.id !== orig.id);
    const prevEnd = others.filter((c) => clipEnd(c) <= orig.start).reduce((m, c) => Math.max(m, clipEnd(c)), 0);
    const nextStart = others.filter((c) => c.start >= clipEnd(orig)).reduce((m, c) => Math.min(m, c.start), Infinity);
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      if (!moved) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
        moved = true;
        checkpoint();
      }
      const { snap } = useStore.getState();
      const threshold = snap && !ev.altKey ? 8 / ppf : -1;
      const df = (ev.clientX - sx) / ppf;

      if (mode === "move") {
        let s = Math.max(0, Math.round(orig.start + df));
        const byStart = nearest(s, points, threshold);
        const byEnd = nearest(s + orig.duration, points, threshold);
        if (byStart !== null) s = byStart;
        else if (byEnd !== null) s = Math.max(0, byEnd - orig.duration);

        const lane = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-track-id]");
        const current = findClip(useStore.getState().project!, orig.id)?.track;
        let target = current?.id ?? track.id;
        if (lane && lane.dataset.kind === track.kind && lane.dataset.locked !== "1") target = lane.dataset.trackId!;
        live((p) => moveClip(p, orig.id, target, s));
      } else if (mode === "trimL") {
        const hasSource = orig.type === "video" || orig.type === "audio";
        const minStart = Math.max(prevEnd, hasSource ? orig.start - Math.floor(orig.trimStart / rate) : 0);
        let s = Math.round(orig.start + df);
        const snapped = nearest(s, points, threshold);
        if (snapped !== null) s = snapped;
        s = clamp(s, minStart, clipEnd(orig) - 1);
        const delta = s - orig.start;
        const patch: Partial<Clip> = { start: s, duration: orig.duration - delta };
        if (hasSource) (patch as { trimStart: number }).trimStart = Math.max(0, Math.round(orig.trimStart + delta * rate));
        live((p) => updateClip(p, orig.id, patch));
      } else {
        const hasSource = orig.type === "video" || orig.type === "audio";
        const maxDur = Math.min(
          nextStart - orig.start,
          hasSource ? Math.floor((orig.sourceDuration - orig.trimStart) / rate) : Infinity,
        );
        let end = Math.round(clipEnd(orig) + df);
        const snapped = nearest(end, points, threshold);
        if (snapped !== null) end = snapped;
        live((p) => updateClip(p, orig.id, { duration: clamp(end - orig.start, 1, Math.max(1, maxDur)) }));
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (moved && mode === "move") live((p) => settleClip(p, orig.id));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const width = Math.max(4, clip.duration * ppf);
  const animIn = clip.type !== "audio" && clip.animIn.type !== "none" ? Math.min(clip.animIn.duration, clip.duration / 2) : 0;
  const animOut = clip.type !== "audio" && clip.animOut.type !== "none" ? Math.min(clip.animOut.duration, clip.duration / 2) : 0;
  const label = clip.type === "text" ? clip.text.replace(/\s+/g, " ") : clip.type === "motion" ? `✦ ${clip.text || clip.name}` : clip.name;
  const showThumb = clip.type === "video" || clip.type === "image";

  return (
    <div
      className={`clip clip-${clip.type}${selected ? " selected" : ""}`}
      style={{ left: clip.start * ppf, width }}
      onPointerDown={(e) => start(e, "move")}
      title={label}
    >
      {showThumb && <div className="clip-thumbs" style={{ backgroundImage: `url("${thumbUrl(clip.sourceName)}")` }} />}
      {animIn > 0 && <i className="clip-anim in" style={{ width: animIn * ppf }} />}
      {animOut > 0 && <i className="clip-anim out" style={{ width: animOut * ppf }} />}
      <span className="clip-label">{label}</span>
      <div className="clip-handle l" onPointerDown={(e) => start(e, "trimL")} />
      <div className="clip-handle r" onPointerDown={(e) => start(e, "trimR")} />
    </div>
  );
};

// ---------- Tiêu đề dòng ----------

const TrackHeader: React.FC<{ track: Track; index: number; count: number }> = ({ track, index, count }) => {
  const Icon = KIND_ICON[track.kind];
  const toggle = (patch: Partial<Track>) => update((p) => updateTrack(p, track.id, patch));
  const rename = () => {
    const name = window.prompt("Tên dòng", track.name);
    if (name?.trim()) toggle({ name: name.trim() });
  };
  const remove = () => {
    if (track.clips.length && !window.confirm(`Xoá dòng "${track.name}" cùng ${track.clips.length} clip trong đó?`)) return;
    update((p) => removeTrack(p, track.id));
  };
  return (
    <div className={`tl-header kind-${track.kind}`}>
      <div className="tl-header-name" onDoubleClick={rename} title="Bấm đúp để đổi tên">
        <Icon size={13} />
        <span className="ellipsis">{track.name}</span>
      </div>
      <div className="tl-header-actions">
        {track.kind !== "audio" && (
          <button className={track.hidden ? "off" : ""} onClick={() => toggle({ hidden: !track.hidden })} title={track.hidden ? "Hiện dòng" : "Ẩn dòng"}>
            {track.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
        {track.kind !== "text" && (
          <button className={track.muted ? "off" : ""} onClick={() => toggle({ muted: !track.muted })} title={track.muted ? "Bật tiếng" : "Tắt tiếng"}>
            {track.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        )}
        <button className={track.locked ? "off" : ""} onClick={() => toggle({ locked: !track.locked })} title={track.locked ? "Mở khoá" : "Khoá dòng"}>
          {track.locked ? <Lock size={13} /> : <Unlock size={13} />}
        </button>
        <button disabled={index === 0} onClick={() => update((p) => moveTrack(p, track.id, -1))} title="Đưa lên trên (che dòng dưới)">
          <ArrowUp size={13} />
        </button>
        <button disabled={index === count - 1} onClick={() => update((p) => moveTrack(p, track.id, 1))} title="Đưa xuống dưới">
          <ArrowDown size={13} />
        </button>
        <button onClick={remove} title="Xoá dòng">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

// ---------- Timeline ----------

export const Timeline: React.FC = () => {
  const project = useStore((s) => s.project)!;
  const ppf = useStore((s) => s.ppf);
  const snap = useStore((s) => s.snap);
  const selectedId = useStore((s) => s.selectedId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(1000);
  const [addOpen, setAddOpen] = useState(false);

  const fps = project.fps;
  const total = projectDuration(project);
  const frames = Math.max(total + fps * 8, Math.ceil((viewW - HEADER_W) / ppf));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const setZoom = (next: number, anchorX?: number) => {
    const el = scrollRef.current;
    const value = clamp(next, MIN_PPF, MAX_PPF);
    if (el) {
      // Giữ nguyên khung hình đang nằm dưới con trỏ (hoặc đầu phát) khi phóng/thu.
      const anchor = anchorX ?? HEADER_W + useStore.getState().frame * ppf - el.scrollLeft;
      const frameAt = (el.scrollLeft + anchor - HEADER_W) / ppf;
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, frameAt * value + HEADER_W - anchor);
      });
    }
    useStore.setState({ ppf: value });
  };

  // Ctrl + lăn chuột để phóng/thu timeline.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const current = useStore.getState().ppf;
      setZoom(current * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX - el.getBoundingClientRect().left);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const fitAll = () => {
    setZoom((viewW - HEADER_W - 48) / Math.max(1, total));
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  };

  const frameFromEvent = (e: { clientX: number; currentTarget: HTMLElement }) =>
    Math.max(0, Math.round((e.clientX - e.currentTarget.getBoundingClientRect().left) / ppf));

  const onLaneDrop = (e: React.DragEvent<HTMLDivElement>, track: Track) => {
    const name = e.dataTransfer.getData("text/x-source");
    if (!name) return;
    e.preventDefault();
    const matches = laneKindFor(e.dataTransfer.getData("text/x-kind")) === track.kind && !track.locked;
    addSource(name, matches ? track.id : null, frameFromEvent(e));
  };

  const add = (kind: TrackKind) => {
    update((p) => addTrack(p, kind).project);
    setAddOpen(false);
  };

  const hasSelection = !!findClip(project, selectedId);

  return (
    <section className="timeline">
      <div className="tl-toolbar">
        <button onClick={splitAtPlayhead} title="Tách clip tại đầu phát (S)">
          <Scissors size={14} /> Tách
        </button>
        <button onClick={duplicateSelected} disabled={!hasSelection} title="Nhân bản clip (Ctrl+D)">
          <Copy size={14} /> Nhân bản
        </button>
        <button onClick={deleteSelected} disabled={!hasSelection} title="Xoá clip (Delete)">
          <Trash2 size={14} /> Xoá
        </button>
        <span className="sep" />
        <div className="menu-wrap">
          <button onClick={() => setAddOpen((o) => !o)} title="Thêm một dòng mới vào timeline">
            <Plus size={14} /> Thêm dòng
          </button>
          {addOpen && (
            <div className="menu" onMouseLeave={() => setAddOpen(false)}>
              <button onClick={() => add("video")}>
                <Film size={13} /> Dòng video / ảnh
              </button>
              <button onClick={() => add("text")}>
                <Type size={13} /> Dòng chữ
              </button>
              <button onClick={() => add("audio")}>
                <Music size={13} /> Dòng âm thanh
              </button>
            </div>
          )}
        </div>
        <span className="grow" />
        <button className={snap ? "on" : ""} onClick={() => useStore.setState({ snap: !snap })} title="Hút dính vào mép clip và đầu phát (giữ Alt để tạm tắt)">
          <Magnet size={14} /> Hút dính
        </button>
        <span className="sep" />
        <button className="icon-btn" onClick={() => setZoom(ppf / 1.4)} title="Thu nhỏ timeline">
          <ZoomOut size={15} />
        </button>
        <input
          className="zoom"
          type="range"
          min={Math.log(MIN_PPF)}
          max={Math.log(MAX_PPF)}
          step={0.01}
          value={Math.log(ppf)}
          onChange={(e) => setZoom(Math.exp(Number(e.target.value)))}
          title="Ctrl + lăn chuột cũng phóng/thu được"
        />
        <button className="icon-btn" onClick={() => setZoom(ppf * 1.4)} title="Phóng to timeline">
          <ZoomIn size={15} />
        </button>
        <button onClick={fitAll} title="Hiện toàn bộ video trong khung nhìn">
          Vừa khung
        </button>
      </div>

      <div className="tl-scroll" ref={scrollRef}>
        <div className="tl-content" style={{ width: HEADER_W + frames * ppf }}>
          <div className="tl-ruler-row">
            <div className="tl-corner" style={{ width: HEADER_W, height: RULER_H }}>
              {project.tracks.length} dòng
            </div>
            <Ruler frames={frames} ppf={ppf} fps={fps} />
          </div>

          {project.tracks.map((track, index) => (
            <div className="tl-row" key={track.id} style={{ height: ROW_H[track.kind] }}>
              <TrackHeader track={track} index={index} count={project.tracks.length} />
              <div
                className={`tl-lane kind-${track.kind}${track.locked ? " locked" : ""}${track.hidden ? " hidden" : ""}`}
                data-track-id={track.id}
                data-kind={track.kind}
                data-locked={track.locked ? "1" : "0"}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  select(null);
                  seek(frameFromEvent(e));
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onLaneDrop(e, track)}
              >
                {track.clips.map((clip) => (
                  <ClipBlock key={clip.id} clip={clip} track={track} ppf={ppf} selected={clip.id === selectedId} />
                ))}
              </div>
            </div>
          ))}

          {!project.tracks.length && <div className="tl-empty">Chưa có dòng nào. Bấm “Thêm dòng” để bắt đầu.</div>}

          <div className="tl-end" style={{ left: HEADER_W + total * ppf }} title="Hết video" />
          <Playhead ppf={ppf} scroller={scrollRef} />
        </div>
      </div>
    </section>
  );
};
