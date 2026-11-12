import { Check, Film, Image as ImageIcon, Loader2, Music, Plus, Search, Sparkles, Type } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { makeTextClip, TextClip } from "../../src/engine/types";
import { api, SourceFile, thumbUrl } from "../api";
import { addSource, insertClip, useStore } from "../store";
import { formatSize } from "../util";
import { MotionLibrary } from "./MotionLibrary";

type TextPreset = { label: string; hint: string; sample: React.CSSProperties; patch: Partial<TextClip> };

const TEXT_PRESETS: TextPreset[] = [
  {
    label: "TIÊU ĐỀ LỚN",
    hint: "Chữ to, bật nảy",
    sample: { fontWeight: 900, fontSize: 20, letterSpacing: 1 },
    patch: {
      name: "Tiêu đề",
      text: "TIÊU ĐỀ LỚN",
      fontFamily: "Anton",
      fontWeight: 400,
      fontSize: 150,
      uppercase: true,
      y: -560,
      animIn: { type: "pop", duration: 18 },
    },
  },
  {
    label: "Tiêu đề từng từ",
    hint: "Mỗi từ bật lên lần lượt",
    sample: { fontWeight: 800, fontSize: 17 },
    patch: {
      name: "Tiêu đề từng từ",
      text: "Mỗi từ bật lên lần lượt",
      fontWeight: 900,
      fontSize: 104,
      y: -480,
      animIn: { type: "none", duration: 12 },
      textEffect: "words",
    },
  },
  {
    label: "Phụ đề có nền",
    hint: "Nền mờ, đặt phía dưới",
    sample: { fontWeight: 600, fontSize: 14, background: "rgba(0,0,0,.6)", padding: "3px 8px", borderRadius: 6 },
    patch: {
      name: "Phụ đề",
      text: "Phụ đề mô tả món ăn",
      fontWeight: 600,
      fontSize: 58,
      y: 640,
      shadow: false,
      bgEnabled: true,
    },
  },
  {
    label: "Nhãn món",
    hint: "Viên thuốc trắng, trượt lên",
    sample: {
      fontWeight: 800,
      fontSize: 14,
      background: "#fff",
      color: "#16181d",
      padding: "3px 12px",
      borderRadius: 999,
    },
    patch: {
      name: "Nhãn món",
      text: "Tên món",
      fontFamily: "Montserrat",
      fontWeight: 800,
      fontSize: 64,
      color: "#16181d",
      shadow: false,
      bgEnabled: true,
      bgColor: "#ffffff",
      bgOpacity: 1,
      bgPadding: 40,
      bgRadius: 999,
      y: 420,
      animIn: { type: "slideUp", duration: 14 },
    },
  },
  {
    label: "Chữ viết tay",
    hint: "Từng chữ hiện dần",
    sample: { fontStyle: "italic", fontSize: 18, color: "#ffd166" },
    patch: {
      name: "Chữ viết tay",
      text: "Ngon khó cưỡng",
      fontFamily: "Pacifico",
      fontWeight: 400,
      fontSize: 110,
      color: "#ffd166",
      animIn: { type: "none", duration: 12 },
      textEffect: "letters",
    },
  },
  {
    label: "Đánh máy_",
    hint: "Chữ gõ ra từng ký tự",
    sample: { fontFamily: "monospace", fontSize: 14 },
    patch: {
      name: "Đánh máy",
      text: "Chữ gõ ra từng ký tự",
      fontFamily: "Roboto",
      fontWeight: 700,
      fontSize: 62,
      animIn: { type: "none", duration: 12 },
      textEffect: "typewriter",
    },
  },
];

const KIND_ICON = { video: Film, image: ImageIcon, audio: Music };

const SourceCard: React.FC<{ file: SourceFile; busy: boolean; used: boolean }> = ({ file, busy, used }) => {
  const Icon = KIND_ICON[file.kind];
  return (
    <div
      className={`source-card${busy ? " busy" : ""}`}
      draggable={!busy}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/x-source", file.name);
        e.dataTransfer.setData("text/x-kind", file.kind);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDoubleClick={() => addSource(file.name)}
      title={`${file.name} · ${formatSize(file.size)}\nBấm + hoặc kéo xuống timeline`}
    >
      <div className="source-thumb">
        {file.kind === "audio" ? (
          <Music size={28} />
        ) : (
          <img src={thumbUrl(file.name)} loading="lazy" alt="" draggable={false} />
        )}
        <button className="source-add" disabled={busy} onClick={() => addSource(file.name)} title="Thêm vào timeline">
          {busy ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
        </button>
        {used && (
          <span className="source-used" title="Đang dùng trong dự án">
            <Check size={11} />
          </span>
        )}
      </div>
      <div className="source-name">
        <Icon size={11} />
        <span>{file.name}</span>
      </div>
    </div>
  );
};

export const MediaPanel: React.FC = () => {
  const [tab, setTab] = useState<"media" | "text" | "motion">("media");
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [dir, setDir] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const importing = useStore((s) => s.importing);
  const project = useStore((s) => s.project)!;

  useEffect(() => {
    api
      .listSources()
      .then((r) => {
        setFiles(r.files);
        setDir(r.dir);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const usedNames = useMemo(() => {
    const names = new Set<string>();
    for (const t of project.tracks) for (const c of t.clips) if (c.type !== "text" && c.type !== "motion") names.add(c.sourceName);
    return names;
  }, [project]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? files.filter((f) => f.name.toLowerCase().includes(q)) : files;
  }, [files, query]);

  return (
    <aside className="panel media-panel">
      <div className="tabs">
        <button className={tab === "media" ? "active" : ""} onClick={() => setTab("media")}>
          <Film size={14} /> Media
        </button>
        <button className={tab === "text" ? "active" : ""} onClick={() => setTab("text")}>
          <Type size={14} /> Chữ
        </button>
        <button className={tab === "motion" ? "active" : ""} onClick={() => setTab("motion")} title="Từ điển Motion Graphic: 50 thể loại">
          <Sparkles size={14} /> Motion
        </button>
      </div>

      {tab === "media" ? (
        <>
          <div className="panel-head">
            <label className="search">
              <Search size={13} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên file" />
            </label>
            <div className="muted-text ellipsis" title={dir}>
              {shown.length} file · {dir}
            </div>
          </div>
          <div className="panel-body">
            {error && <div className="notice error">{error}</div>}
            {!error && !files.length && <div className="notice">Thư mục nguồn chưa có video, ảnh hay âm thanh.</div>}
            <div className="source-grid">
              {shown.map((f) => (
                <SourceCard key={f.name} file={f} busy={!!importing[f.name]} used={usedNames.has(f.name)} />
              ))}
            </div>
          </div>
        </>
      ) : tab === "motion" ? (
        <MotionLibrary />
      ) : (
        <div className="panel-body">
          <div className="muted-text" style={{ marginBottom: 10 }}>
            Bấm một mẫu để thêm chữ tại vị trí đầu phát.
          </div>
          <div className="preset-list">
            {TEXT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                className="preset"
                onClick={() => insertClip(makeTextClip({ duration: project.fps * 3, ...preset.patch }))}
              >
                <span className="preset-sample" style={preset.sample}>
                  {preset.label}
                </span>
                <span className="muted-text">{preset.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
