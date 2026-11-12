// Các phép biến đổi thuần trên JSON dự án. Không sửa trực tiếp, luôn trả về bản mới.
import {
  Clip,
  clipEnd,
  findClip,
  makeTrack,
  Project,
  Track,
  TrackKind,
  trackKindOf,
  uid,
} from "../src/engine/types";

const mapTracks = (p: Project, fn: (t: Track) => Track): Project => ({ ...p, tracks: p.tracks.map(fn) });

export const updateClip = (p: Project, id: string, patch: Partial<Clip>): Project =>
  mapTracks(p, (t) =>
    t.clips.some((c) => c.id === id)
      ? { ...t, clips: t.clips.map((c) => (c.id === id ? ({ ...c, ...patch } as Clip) : c)) }
      : t,
  );

export const removeClip = (p: Project, id: string): Project =>
  mapTracks(p, (t) => (t.clips.some((c) => c.id === id) ? { ...t, clips: t.clips.filter((c) => c.id !== id) } : t));

export const updateTrack = (p: Project, id: string, patch: Partial<Track>): Project =>
  mapTracks(p, (t) => (t.id === id ? { ...t, ...patch } : t));

export const removeTrack = (p: Project, id: string): Project => ({
  ...p,
  tracks: p.tracks.filter((t) => t.id !== id),
});

export const moveTrack = (p: Project, id: string, dir: -1 | 1): Project => {
  const i = p.tracks.findIndex((t) => t.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= p.tracks.length) return p;
  const tracks = [...p.tracks];
  [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
  return { ...p, tracks };
};

/** Thêm dòng mới: chữ lên trên cùng, video ngay trên các dòng video, âm thanh xuống dưới cùng. */
export const addTrack = (p: Project, kind: TrackKind): { project: Project; track: Track } => {
  const count = p.tracks.filter((t) => t.kind === kind).length;
  const track = makeTrack(kind, `${kind === "video" ? "Video" : kind === "text" ? "Chữ" : "Âm thanh"} ${count + 1}`);
  const tracks = [...p.tracks];
  if (kind === "audio") tracks.push(track);
  else if (kind === "text") tracks.unshift(track);
  else {
    const firstVideo = tracks.findIndex((t) => t.kind === "video");
    const firstAudio = tracks.findIndex((t) => t.kind === "audio");
    const at = firstVideo >= 0 ? firstVideo : firstAudio >= 0 ? firstAudio : tracks.length;
    tracks.splice(at, 0, track);
  }
  return { project: { ...p, tracks }, track };
};

const overlaps = (clips: Clip[], start: number, duration: number, ignoreId?: string) =>
  clips.some((c) => c.id !== ignoreId && start < clipEnd(c) && start + duration > c.start);

/** Tìm vị trí gần `desired` nhất mà clip không đè lên clip khác trong cùng dòng. */
export const freeStart = (clips: Clip[], desired: number, duration: number, ignoreId?: string): number => {
  desired = Math.max(0, Math.round(desired));
  if (!overlaps(clips, desired, duration, ignoreId)) return desired;
  const candidates: number[] = [];
  for (const c of clips) {
    if (c.id === ignoreId) continue;
    candidates.push(clipEnd(c));
    if (c.start - duration >= 0) candidates.push(c.start - duration);
  }
  const ok = candidates
    .filter((s) => !overlaps(clips, s, duration, ignoreId))
    .sort((a, b) => Math.abs(a - desired) - Math.abs(b - desired));
  return ok.length ? ok[0] : Math.max(0, ...clips.filter((c) => c.id !== ignoreId).map(clipEnd));
};

export const addClip = (p: Project, trackId: string, clip: Clip): Project =>
  mapTracks(p, (t) =>
    t.id === trackId
      ? { ...t, clips: [...t.clips, { ...clip, start: freeStart(t.clips, clip.start, clip.duration) }] }
      : t,
  );

/** Chuyển clip sang dòng/vị trí khác (chưa xử lý chồng lấn, dùng trong lúc đang kéo). */
export const moveClip = (p: Project, id: string, trackId: string, start: number): Project => {
  const found = findClip(p, id);
  if (!found) return p;
  const moved = { ...found.clip, start: Math.max(0, Math.round(start)) } as Clip;
  if (found.track.id === trackId) return updateClip(p, id, { start: moved.start });
  return mapTracks(p, (t) => {
    if (t.id === found.track.id) return { ...t, clips: t.clips.filter((c) => c.id !== id) };
    if (t.id === trackId) return { ...t, clips: [...t.clips, moved] };
    return t;
  });
};

/** Sau khi thả clip: đẩy tới chỗ trống gần nhất nếu đang đè lên clip khác. */
export const settleClip = (p: Project, id: string): Project => {
  const found = findClip(p, id);
  if (!found) return p;
  const start = freeStart(found.track.clips, found.clip.start, found.clip.duration, id);
  return start === found.clip.start ? p : updateClip(p, id, { start });
};

export const duplicateClip = (p: Project, id: string): { project: Project; newId: string | null } => {
  const found = findClip(p, id);
  if (!found) return { project: p, newId: null };
  const copy = { ...found.clip, id: uid(), start: clipEnd(found.clip) } as Clip;
  return { project: addClip(p, found.track.id, copy), newId: copy.id };
};

const splitOne = (clip: Clip, frame: number): [Clip, Clip] | null => {
  if (frame <= clip.start || frame >= clipEnd(clip)) return null;
  const firstLen = frame - clip.start;
  const first = { ...clip, duration: firstLen } as Clip;
  const second = { ...clip, id: uid(), start: frame, duration: clip.duration - firstLen } as Clip;
  if (second.type === "video" || second.type === "audio") {
    second.trimStart = Math.round(second.trimStart + firstLen * second.playbackRate);
  }
  // Điểm cắt nối liền nhau nên bỏ hiệu ứng ra của nửa đầu và hiệu ứng vào của nửa sau.
  if (first.type !== "audio") first.animOut = { ...first.animOut, type: "none" };
  if (second.type !== "audio") second.animIn = { ...second.animIn, type: "none" };
  if (first.type === "audio") first.fadeOut = 0;
  if (second.type === "audio") second.fadeIn = 0;
  return [first, second];
};

/** Tách clip đang chọn tại `frame`; nếu không chọn clip nào thì tách mọi clip nằm dưới đầu phát. */
export const splitAt = (p: Project, frame: number, selectedId: string | null): Project => {
  const selected = findClip(p, selectedId);
  const onlySelected = selected && frame > selected.clip.start && frame < clipEnd(selected.clip);
  return mapTracks(p, (t) => {
    if (t.locked) return t;
    let changed = false;
    const clips = t.clips.flatMap((c) => {
      if (onlySelected && c.id !== selectedId) return [c];
      const parts = splitOne(c, frame);
      if (!parts) return [c];
      changed = true;
      return parts;
    });
    return changed ? { ...t, clips } : t;
  });
};

/** Dòng phù hợp để thả clip mới vào: dòng cùng loại, chưa khoá, ưu tiên dòng đang chọn. */
export const pickTrack = (p: Project, clip: Clip, preferId?: string | null): Track | null => {
  const kind = trackKindOf(clip);
  const usable = p.tracks.filter((t) => t.kind === kind && !t.locked);
  return usable.find((t) => t.id === preferId) ?? usable[0] ?? null;
};
