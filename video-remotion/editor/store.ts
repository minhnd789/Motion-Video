import type { PlayerRef } from "@remotion/player";
import { createRef } from "react";
import { create } from "zustand";
import { Clip, makeMediaClip, MediaMeta, Project, projectDuration, trackKindOf } from "../src/engine/types";
import { api } from "./api";
import { addClip, addTrack, duplicateClip, pickTrack, removeClip, splitAt } from "./ops";

export type SaveState = "saved" | "dirty" | "saving" | "error";

type State = {
  project: Project | null;
  selectedId: string | null;
  frame: number;
  playing: boolean;
  /** Số pixel trên mỗi khung hình của timeline */
  ppf: number;
  snap: boolean;
  past: Project[];
  future: Project[];
  saveState: SaveState;
  importing: Record<string, boolean>;
  toast: string | null;
};

export const useStore = create<State>(() => ({
  project: null,
  selectedId: null,
  frame: 0,
  playing: false,
  ppf: 4,
  snap: true,
  past: [],
  future: [],
  saveState: "saved",
  importing: {},
  toast: null,
}));

const set = useStore.setState;
const get = useStore.getState;

export const playerRef = createRef<PlayerRef>();

const HISTORY_LIMIT = 100;
let lastKey: string | null = null;
let lastTime = 0;

const pushHistory = (project: Project) => {
  set((s) => ({ past: [...s.past.slice(-HISTORY_LIMIT + 1), project], future: [] }));
};

export const loadProject = (project: Project) => {
  lastKey = null;
  set({ project, selectedId: null, frame: 0, past: [], future: [], saveState: "saved" });
};

/**
 * Sửa dự án và ghi vào lịch sử hoàn tác.
 * `key`: các lần sửa liên tiếp cùng khoá (gõ chữ, kéo thanh trượt) gộp thành một bước hoàn tác.
 */
export const update = (fn: (p: Project) => Project, key?: string) => {
  const { project } = get();
  if (!project) return;
  const next = fn(project);
  if (next === project) return;
  const now = Date.now();
  const coalesce = key && key === lastKey && now - lastTime < 1200;
  if (!coalesce) pushHistory(project);
  lastKey = key ?? null;
  lastTime = now;
  set({ project: next, saveState: "dirty" });
};

/** Lưu mốc hoàn tác trước khi bắt đầu một thao tác kéo. */
export const checkpoint = () => {
  const { project } = get();
  if (project) pushHistory(project);
  lastKey = null;
};

/** Sửa dự án trong lúc đang kéo, không ghi thêm lịch sử. */
export const live = (fn: (p: Project) => Project) => {
  const { project } = get();
  if (!project) return;
  const next = fn(project);
  if (next !== project) set({ project: next, saveState: "dirty" });
};

export const undo = () => {
  const { past, future, project } = get();
  if (!project || !past.length) return;
  lastKey = null;
  set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future], saveState: "dirty" });
};

export const redo = () => {
  const { past, future, project } = get();
  if (!project || !future.length) return;
  lastKey = null;
  set({ project: future[0], past: [...past, project], future: future.slice(1), saveState: "dirty" });
};

export const select = (id: string | null) => set({ selectedId: id });

export const seek = (frame: number) => {
  const { project } = get();
  if (!project) return;
  const f = Math.min(projectDuration(project) - 1, Math.max(0, Math.round(frame)));
  playerRef.current?.seekTo(f);
  set({ frame: f });
};

export const togglePlay = () => {
  const player = playerRef.current;
  if (!player) return;
  if (player.isPlaying()) player.pause();
  else {
    const { project, frame } = get();
    if (project && frame >= projectDuration(project) - 1) player.seekTo(0);
    player.play();
  }
};

export const showToast = (message: string) => {
  set({ toast: message });
  setTimeout(() => {
    if (get().toast === message) set({ toast: null });
  }, 3500);
};

export const deleteSelected = () => {
  const { selectedId } = get();
  if (!selectedId) return;
  update((p) => removeClip(p, selectedId));
  set({ selectedId: null });
};

export const duplicateSelected = () => {
  const { selectedId, project } = get();
  if (!selectedId || !project) return;
  const { project: next, newId } = duplicateClip(project, selectedId);
  if (!newId) return;
  update(() => next);
  set({ selectedId: newId });
};

export const splitAtPlayhead = () => {
  const { frame, selectedId } = get();
  update((p) => splitAt(p, frame, selectedId));
};

/** Thêm clip vào dòng phù hợp; tự tạo dòng mới nếu chưa có dòng cùng loại. */
export const insertClip = (clip: Clip, trackId?: string | null, start?: number) => {
  const { project, frame } = get();
  if (!project) return;
  let base = project;
  let track = pickTrack(base, clip, trackId);
  if (!track) {
    const added = addTrack(base, trackKindOf(clip));
    base = added.project;
    track = added.track;
  }
  const placed = { ...clip, start: start ?? frame } as Clip;
  const target = track.id;
  update(() => addClip(base, target, placed));
  set({ selectedId: clip.id });
};

/** Nhập một file nguồn (chuyển mã nếu cần) rồi thêm vào timeline. */
export const addSource = async (name: string, trackId?: string | null, start?: number) => {
  if (get().importing[name]) return;
  set((s) => ({ importing: { ...s.importing, [name]: true } }));
  try {
    const meta: MediaMeta = await api.importMedia(name);
    const { project } = get();
    if (project) insertClip(makeMediaClip(meta, project.fps), trackId, start);
  } catch (err) {
    showToast(`Không nhập được ${name}: ${err instanceof Error ? err.message : err}`);
  } finally {
    set((s) => {
      const importing = { ...s.importing };
      delete importing[name];
      return { importing };
    });
  }
};

// Tự lưu: ghi dự án xuống đĩa sau khi ngừng sửa một lúc.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
useStore.subscribe((state, prev) => {
  if (state.project === prev.project || !state.project || state.saveState !== "dirty") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const project = get().project;
    if (!project) return;
    set({ saveState: "saving" });
    try {
      await api.saveProject(project);
      if (get().project === project) set({ saveState: "saved" });
    } catch {
      set({ saveState: "error" });
    }
  }, 500);
});

/** Ghi ngay các thay đổi đang chờ (dùng trước khi xuất video). */
export const flushSave = async () => {
  if (saveTimer) clearTimeout(saveTimer);
  const { project } = get();
  if (!project) return;
  await api.saveProject(project);
  if (get().project === project) set({ saveState: "saved" });
};
