import { Check, CloudAlert, Download, FolderOpen, Loader2, Plus, Redo2, Undo2, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { emptyProject } from "../../src/engine/types";
import { api, ProjectInfo, RenderState } from "../api";
import { flushSave, loadProject, playerRef, redo, showToast, undo, useStore } from "../store";
import { slugify } from "../util";

const SAVE_LABEL = {
  saved: "Đã lưu",
  dirty: "Chưa lưu…",
  saving: "Đang lưu…",
  error: "Lưu thất bại",
} as const;

const ExportDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const project = useStore((s) => s.project)!;
  const [state, setState] = useState<RenderState | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const s = await api.renderStatus();
        if (!alive) return;
        setState(s);
        if (s.status === "running") timer = setTimeout(poll, 600);
      } catch (err) {
        if (alive) setFailed(String(err instanceof Error ? err.message : err));
      }
    };
    (async () => {
      try {
        playerRef.current?.pause();
        await flushSave();
        const s = await api.startRender(project.id);
        if (!alive) return;
        setState(s);
        timer = setTimeout(poll, 600);
      } catch (err) {
        if (alive) setFailed(String(err instanceof Error ? err.message : err));
      }
    })();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [project.id]);

  const status = failed ? "error" : (state?.status ?? "running");
  const percent = Math.round((state?.progress ?? 0) * 100);

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head">
          <b>Xuất video</b>
          <button className="icon-btn" onClick={onClose} title="Đóng">
            <X size={16} />
          </button>
        </div>
        {status === "running" && (
          <>
            <div className="progress">
              <div style={{ width: `${percent}%` }} />
            </div>
            <div className="modal-row">
              <span>{state?.stage || "Đang chuẩn bị"}</span>
              <b>{percent}%</b>
            </div>
            <div className="muted-text">Có thể đóng hộp này, việc xuất vẫn chạy tiếp ở nền.</div>
          </>
        )}
        {status === "done" && (
          <>
            <div className="notice ok">
              <Check size={14} /> Đã xuất xong.
            </div>
            <code className="path">{state?.output}</code>
            <div className="button-row">
              <button className="primary" onClick={() => api.reveal()}>
                <FolderOpen size={14} /> Mở thư mục chứa file
              </button>
            </div>
          </>
        )}
        {status === "error" && (
          <>
            <div className="notice error">Xuất video thất bại.</div>
            <pre className="path">{failed ?? state?.error}</pre>
          </>
        )}
      </div>
    </div>
  );
};

export const TopBar: React.FC<{ projects: ProjectInfo[]; onOpen: (id: string) => void; onRefresh: () => void }> = ({
  projects,
  onOpen,
  onRefresh,
}) => {
  const project = useStore((s) => s.project)!;
  const saveState = useStore((s) => s.saveState);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const [exporting, setExporting] = useState(false);

  const createProject = async () => {
    const name = window.prompt("Tên dự án mới", "Video mới");
    if (!name?.trim()) return;
    let id = slugify(name);
    for (let n = 2; projects.some((p) => p.id === id); n++) id = `${slugify(name)}-${n}`;
    try {
      await flushSave();
      const fresh = emptyProject(id, name.trim());
      await api.saveProject(fresh);
      loadProject(fresh);
      onRefresh();
      onOpen(id);
    } catch (err) {
      showToast(`Không tạo được dự án: ${err instanceof Error ? err.message : err}`);
    }
  };

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" />
        Dựng video
      </div>
      <select className="project-select" value={project.id} onChange={(e) => onOpen(e.target.value)} title="Chọn dự án">
        {!projects.some((p) => p.id === project.id) && <option value={project.id}>{project.name}</option>}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.id === project.id ? project.name : p.name}
          </option>
        ))}
      </select>
      <button onClick={createProject} title="Tạo dự án mới">
        <Plus size={14} /> Dự án mới
      </button>
      <span className="sep" />
      <button className="icon-btn" onClick={undo} disabled={!canUndo} title="Hoàn tác (Ctrl+Z)">
        <Undo2 size={16} />
      </button>
      <button className="icon-btn" onClick={redo} disabled={!canRedo} title="Làm lại (Ctrl+Y)">
        <Redo2 size={16} />
      </button>
      <span className="grow" />
      <span className={`save-state ${saveState}`}>
        {saveState === "saving" ? (
          <Loader2 size={13} className="spin" />
        ) : saveState === "error" ? (
          <CloudAlert size={13} />
        ) : saveState === "saved" ? (
          <Check size={13} />
        ) : null}
        {SAVE_LABEL[saveState]}
      </span>
      <button className="primary" onClick={() => setExporting(true)} title="Xuất ra file MP4">
        <Download size={14} /> Xuất video
      </button>
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
    </header>
  );
};
