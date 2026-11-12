// Thư viện "Từ điển Motion Graphic": 50 thể loại, áp lên clip đang chọn hoặc thêm mẫu mới.
import { Copy, Plus, Search, Wand2 } from "lucide-react";
import React, { useMemo, useState } from "react";
import { CATALOG, CATALOG_GROUPS, CatalogEntry, CatalogGroupId, STATUS_LABELS } from "../../src/engine/catalog";
import { findClip, isVisual } from "../../src/engine/types";
import { updateClip } from "../ops";
import { insertClip, showToast, update, useStore } from "../store";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");

const EntryCard: React.FC<{ entry: CatalogEntry }> = ({ entry }) => {
  const project = useStore((s) => s.project)!;
  const selectedId = useStore((s) => s.selectedId);
  const [variant, setVariant] = useState<string | undefined>(entry.variants ? Object.keys(entry.variants)[0] : undefined);
  const ctx = { width: project.width, height: project.height, fps: project.fps, variant };

  const found = findClip(project, selectedId);
  const target = found && isVisual(found.clip) ? found.clip : null;
  const patch = target && entry.apply ? entry.apply(target, ctx) : null;

  const apply = () => {
    if (!target || !patch) return;
    update((p) => updateClip(p, target.id, patch));
    showToast(`Đã áp dụng ${entry.en} cho "${target.name}"`);
  };

  const add = () => {
    if (!entry.sample) return;
    insertClip(entry.sample(ctx));
    showToast(`Đã thêm mẫu ${entry.en} tại đầu phát`);
  };

  const copyKeywords = () => {
    const text = [entry.en, ...entry.keywords].join(", ");
    navigator.clipboard?.writeText(text).then(
      () => showToast("Đã chép từ khoá"),
      () => showToast(text),
    );
  };

  const applyHint = !entry.apply
    ? ""
    : patch
      ? `Áp cho clip đang chọn: ${target!.name}`
      : `Chọn một clip (${entry.applyTo ?? "phù hợp"}) trên timeline rồi bấm`;

  return (
    <div className={`mg-card status-${entry.status}`}>
      <div className="mg-head">
        <span className="mg-num">{entry.n}</span>
        <div className="mg-title">
          <b>{entry.en}</b>
          <span>{entry.vi}</span>
        </div>
        <span className={`mg-badge ${entry.status}`}>{STATUS_LABELS[entry.status]}</span>
      </div>
      <div className="mg-desc">{entry.desc}</div>
      <div className="mg-how" title="Cách chỉnh lại trong trình chỉnh sửa">
        {entry.how}
      </div>
      {entry.variants && (
        <select className="mg-variant" value={variant} onChange={(e) => setVariant(e.target.value)}>
          {Object.entries(entry.variants).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      )}
      <div className="mg-actions">
        {entry.apply && (
          <button className={patch ? "primary" : ""} disabled={!patch} onClick={apply} title={applyHint}>
            <Wand2 size={13} /> Áp dụng
          </button>
        )}
        {entry.sample && (
          <button onClick={add} title="Thêm một clip mẫu tại vị trí đầu phát">
            <Plus size={13} /> Thêm mẫu
          </button>
        )}
        <button className="ghost" onClick={copyKeywords} title={[entry.en, ...entry.keywords].join(", ")}>
          <Copy size={13} />
        </button>
      </div>
      {entry.apply && !patch && <div className="mg-hint">{applyHint}</div>}
    </div>
  );
};

export const MotionLibrary: React.FC = () => {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<CatalogGroupId | "all">("all");

  const shown = useMemo(() => {
    const q = norm(query.trim());
    return CATALOG.filter(
      (e) =>
        (group === "all" || e.group === group) &&
        (!q || norm([e.en, e.vi, e.desc, ...e.keywords].join(" ")).includes(q)),
    );
  }, [query, group]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of CATALOG) m[e.status] = (m[e.status] ?? 0) + 1;
    return m;
  }, []);

  return (
    <>
      <div className="panel-head">
        <label className="search">
          <Search size={13} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm: glitch, số chạy, logo…" />
        </label>
        <div className="mg-groups">
          <button className={group === "all" ? "on" : ""} onClick={() => setGroup("all")}>
            Tất cả {CATALOG.length}
          </button>
          {CATALOG_GROUPS.map((g) => (
            <button key={g.id} className={group === g.id ? "on" : ""} onClick={() => setGroup(g.id)} title={g.desc}>
              {g.label} {CATALOG.filter((e) => e.group === g.id).length}
            </button>
          ))}
        </div>
        <div className="muted-text">
          {counts.moi ?? 0} mới · {counts["nang-cap"] ?? 0} nâng cấp · {counts["co-san"] ?? 0} có sẵn. Chọn clip rồi bấm Áp dụng, hoặc Thêm mẫu.
        </div>
      </div>
      <div className="panel-body">
        {CATALOG_GROUPS.filter((g) => shown.some((e) => e.group === g.id)).map((g) => (
          <section key={g.id} className="mg-group">
            <h4>{g.label}</h4>
            {shown
              .filter((e) => e.group === g.id)
              .map((e) => (
                <EntryCard key={e.id} entry={e} />
              ))}
          </section>
        ))}
        {!shown.length && <div className="notice">Không có mẫu nào khớp "{query}".</div>}
      </div>
    </>
  );
};
