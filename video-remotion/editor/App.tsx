import React, { useCallback, useEffect, useState } from "react";
import { emptyProject } from "../src/engine/types";
import { api, ProjectInfo } from "./api";
import { Inspector } from "./components/Inspector";
import { MediaPanel } from "./components/MediaPanel";
import { Preview } from "./components/Preview";
import { Timeline } from "./components/Timeline";
import { TopBar } from "./components/TopBar";
import {
  deleteSelected,
  duplicateSelected,
  flushSave,
  loadProject,
  redo,
  seek,
  select,
  splitAtPlayhead,
  togglePlay,
  undo,
  useStore,
} from "./store";

const LAST_PROJECT = "editor:last-project";

const remember = (id: string) => {
  try {
    localStorage.setItem(LAST_PROJECT, id);
  } catch {
    /* trình duyệt chặn lưu: bỏ qua */
  }
  window.history.replaceState(null, "", `?p=${encodeURIComponent(id)}`);
};

const useShortcuts = () => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = !!target.closest("input:not([type=range]), textarea, select, [contenteditable]");
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "z" && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y" && !typing) {
        e.preventDefault();
        redo();
        return;
      }
      if (typing) return;

      const { frame, project } = useStore.getState();
      if (!project) return;
      const step = e.shiftKey ? project.fps : 1;

      if (e.code === "Space") togglePlay();
      else if (key === "delete" || key === "backspace") deleteSelected();
      else if (mod && key === "d") duplicateSelected();
      else if (key === "s" && !mod) splitAtPlayhead();
      else if (key === "arrowleft") seek(frame - step);
      else if (key === "arrowright") seek(frame + step);
      else if (key === "home") seek(0);
      else if (key === "end") seek(Infinity);
      else if (key === "escape") select(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
};

export const App: React.FC = () => {
  const ready = useStore((s) => !!s.project);
  const toast = useStore((s) => s.toast);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useShortcuts();

  const refresh = useCallback(() => {
    api.listProjects().then(setProjects).catch(() => undefined);
  }, []);

  const open = useCallback(async (id: string) => {
    if (useStore.getState().project?.id === id) {
      remember(id);
      return;
    }
    try {
      if (useStore.getState().saveState !== "saved") await flushSave();
      loadProject(await api.getProject(id));
      remember(id);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  }, []);

  useEffect(() => {
    (async () => {
      const list = await api.listProjects();
      setProjects(list);
      let wanted = new URLSearchParams(window.location.search).get("p");
      try {
        wanted ??= localStorage.getItem(LAST_PROJECT);
      } catch {
        /* bỏ qua */
      }
      const id = list.find((p) => p.id === wanted)?.id ?? list[0]?.id;
      if (id) {
        await open(id);
      } else {
        const fresh = emptyProject("video-moi", "Video mới");
        await api.saveProject(fresh);
        loadProject(fresh);
        remember(fresh.id);
        setProjects(await api.listProjects());
      }
    })().catch((err) => setError(String(err instanceof Error ? err.message : err)));
  }, [open]);

  if (error) {
    return (
      <div className="boot">
        <b>Không mở được trình chỉnh sửa</b>
        <span>{error}</span>
      </div>
    );
  }
  if (!ready) return <div className="boot">Đang mở dự án…</div>;

  return (
    <div className="app">
      <TopBar projects={projects} onOpen={open} onRefresh={refresh} />
      <div className="workspace">
        <MediaPanel />
        <Preview />
        <Inspector />
      </div>
      <Timeline />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
};
