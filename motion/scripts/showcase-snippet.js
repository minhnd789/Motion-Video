// Tạo dự án mẫu chạy lần lượt cả 50 thể loại (mỗi mẫu 3,5 giây, có nhãn tên).
// Chạy trong trang trình chỉnh sửa (http://localhost:5180) bằng công cụ chạy JavaScript của trình duyệt.
// Sửa 3 hằng số bên dưới trước khi chạy:
//   ENGINE  : đường dẫn tuyệt đối tới video-remotion/src/engine, dạng /@fs/<ổ đĩa>:/.../src/engine/
//   SOURCE  : mã một dự án có sẵn clip video (để lấy cảnh minh hoạ before/after, chia khung, push, zoom). Để "" nếu không có.
//   OUT_ID  : mã dự án mới sẽ tạo (không trùng dự án của người dùng).
const ENGINE = "/@fs/C:/duong-dan/toi/video-remotion/src/engine/";
const SOURCE = "";
const OUT_ID = "tu-dien-motion";

const cat = await import(ENGINE + "catalog.ts");
const T = await import(ENGINE + "types.ts");
const src = SOURCE ? await (await fetch(`/api/projects/${SOURCE}`)).json() : { tracks: [] };
const vids = src.tracks.flatMap((t) => t.clips).filter((c) => c.type === "video");
const W = 1080, H = 1920, fps = 30, SLOT = 105;
const ctx = { width: W, height: H, fps };
const label = T.makeTrack("text", "Nhãn");
const samples = T.makeTrack("text", "Mẫu");
const vA = T.makeTrack("video", "Video trên");
const vB = T.makeTrack("video", "Video dưới");
const bg = T.makeTrack("video", "Nền");
const media = (i, start, dur, patch = {}) => {
  if (!vids.length) return null;
  const v = vids[i % vids.length];
  return {
    ...v, id: T.uid(), start, duration: Math.min(dur, v.sourceDuration), trimStart: 0,
    animIn: { type: "none", duration: 12 }, animOut: { type: "none", duration: 12 },
    loop: "none", vfx: "none", x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, ...patch,
  };
};
const push = (track, clip) => clip && track.clips.push(clip);

cat.CATALOG.forEach((e, k) => {
  const s = k * SLOT;
  label.clips.push(T.makeTextClip({
    name: `#${e.n}`, start: s, duration: SLOT, text: `${e.n}. ${e.en}\n${e.vi}`, fontSize: 46, fontWeight: 800, y: -820,
    bgEnabled: true, bgOpacity: 0.55, bgPadding: 22, shadow: false,
    animIn: { type: "fade", duration: 6 }, animOut: { type: "fade", duration: 6 },
  }));
  if (e.sample) {
    const c = e.sample(ctx);
    // Chuyển cảnh phủ hình giữ thời lượng thật, đặt giữa ô.
    const placed = c.preset === "shapeWipe" ? { ...c, start: s + 40 } : { ...c, start: s, duration: SLOT };
    (T.trackKindOf(placed) === "video" ? bg : samples).clips.push(placed);
    if (["particles", "vhsOverlay", "shapeWipe", "lowerThird", "badge", "audioBars"].includes(placed.preset)) push(vB, media(k, s, SLOT));
  } else if (e.id === "before-after") {
    push(vB, media(5, s, SLOT, { brightness: 0.7, saturate: 0.2, contrast: 0.9 }));
    const after = media(5, s, SLOT);
    if (after) push(vA, { ...after, ...e.apply(after, ctx), saturate: 1.35 });
  } else if (e.id === "slide-push" || e.id === "zoom-transition") {
    const a = media(7, s, 60);
    const b = media(8, s + 48, SLOT - 48);
    if (a && b) {
      vB.clips.push({ ...a, ...e.apply(a, ctx), animIn: { type: "none", duration: 12 } });
      vA.clips.push({ ...b, ...e.apply(b, ctx), animOut: { type: "none", duration: 12 } });
    }
  }
  if (e.id === "split-screen") {
    const top = media(9, s, SLOT);
    const bottom = media(10, s, SLOT);
    if (top && bottom) {
      vA.clips.push({ ...top, ...e.apply(top, { ...ctx, variant: "top" }) });
      vB.clips.push({ ...bottom, ...e.apply(bottom, { ...ctx, variant: "bottom" }) });
    }
  }
});

const project = {
  version: 1, id: OUT_ID, name: "Từ điển Motion Graphic (50 mẫu)", width: W, height: H, fps,
  background: "#14121a", tracks: [label, samples, vA, vB, bg],
};
const r = await fetch(`/api/projects/${OUT_ID}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(project) });
({ status: r.status, open: `/?p=${OUT_ID}`, clips: project.tracks.map((t) => [t.name, t.clips.length]) });
