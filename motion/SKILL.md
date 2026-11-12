---
name: motion
description: Bộ Motion, 50 thể loại motion graphic theo "Từ điển Motion Graphic" của khaontheway.com, dành cho trình chỉnh sửa video-remotion (Remotion + editor kiểu CapCut). Dùng khi người dùng muốn thêm hiệu ứng, animation, chuyển cảnh hoặc đồ hoạ động vào video, hoặc nhắc tên một kiểu: kinetic typography, text reveal, typewriter, lower third, phụ đề karaoke, số chạy, biểu đồ, bản đồ, logo reveal, nhãn khuyến mãi, end card, glitch, VHS, neon, parallax, hạt bay, before/after, chia khung, shape wipe, push, zoom, easing, overshoot, squash & stretch, motion blur… Cũng dùng khi cần cài lại hoặc cài bộ này sang một bản video-remotion khác.
---

# Motion: 50 thể loại motion graphic

Bộ này thêm vào trình chỉnh sửa `video-remotion`:
- 9 hiệu ứng chữ mới;
- 11 kiểu vào/ra mới và easing cho mọi kiểu vào/ra;
- 8 hiệu ứng lặp mới, 3 hiệu ứng hình (VFX) mới và nhoè chuyển động;
- 31 mẫu đồ hoạ dựng sẵn (clip `motion`);
- tab **Motion** liệt kê đủ 50 thể loại, mỗi mục có nút Áp dụng / Thêm mẫu.

Mọi thứ nằm trong JSON dự án nên người dùng tự chỉnh lại được trong trình chỉnh sửa. Video giao cho người dùng phải là file `video-remotion/projects/<mã>.json`, không viết JSX cố định.

## 1. Kiểm tra đã cài chưa

Trong thư mục `video-remotion`, có `src/engine/catalog.ts` và `editor/components/MotionLibrary.tsx` là đã cài. Nếu chưa biết thư mục nằm đâu, tìm thư mục có `package.json`, `src/engine/types.ts` và `editor/`, hoặc hỏi người dùng.

Chưa có, hoặc cần cài lại (sau khi engine bị sửa hỏng):

```bash
node ~/.claude/skills/motion/scripts/install.mjs "<đường dẫn video-remotion>" --dry-run
node ~/.claude/skills/motion/scripts/install.mjs "<đường dẫn video-remotion>"
```

Script chép `assets/` (đúng cấu trúc `src/engine/…`, `editor/…`) vào đích. Trước đó nó sao lưu các file bị thay vào `.motion-backup/<thời điểm>/` và báo nếu thiếu gói (`@remotion/paths`, `@remotion/media-utils`, `@remotion/media`, `lucide-react`). Sau khi cài, chạy `npx tsc --noEmit` trong `video-remotion`.

`assets/` thay nguyên file `types.ts`, `animations.ts`, `MainVideo.tsx`, `Inspector.tsx`, `MediaPanel.tsx`, `Timeline.tsx`, `styles.css`. Nếu bản đích đã sửa riêng các file đó, so sánh với bản sao lưu rồi gộp lại, đừng ghi đè mù.

## 2. Dựng video có motion

1. Tra `references/catalog.md` để chọn thể loại và các trường JSON. Công thức chính xác nằm trong `src/engine/catalog.ts`: `entry.apply(clip, ctx)` trả về phần sửa cho một clip, `entry.sample(ctx)` tạo clip mẫu (`ctx = { width, height, fps, variant? }`).
2. Tạo clip bằng chính các hàm của engine để có đủ giá trị mặc định: `makeTextClip`, `makeMotionClip(preset, ctx, patch)`, `CATALOG[i].sample(ctx)`. Từ trang trình chỉnh sửa (Vite, cổng 5180) import được bằng `await import('/@fs/<đường dẫn tuyệt đối>/video-remotion/src/engine/catalog.ts')`. Lưu bằng `PUT /api/projects/<mã>`.
3. Không ghi đè dự án đang có của người dùng; tạo mã mới hoặc sửa đúng dự án họ chỉ định.
4. Quy tắc dòng: mẫu nền (`gradient`, `parallax`, `grid`) đặt ở dòng `video`; các mẫu khác và chữ đặt ở dòng `text`. Dòng đầu danh sách nằm trên cùng.
5. Nếu người dùng đã có góp ý về phong cách (trong bộ nhớ hoặc cuộc trò chuyện), làm theo góp ý đó. Mặc định nên: các khối chữ cách nhau rõ (≥ 40px), chữ nào cũng có chút hiệu ứng, VFX nhẹ tay.

## 3. Kiểm tra hình

- Mở trình chỉnh sửa: `npm run editor` trong `video-remotion` (cổng 5180), tab **Motion**.
- Xuất ảnh tĩnh vài khung hình (giữa hiệu ứng) đúng bằng engine dùng khi xuất video:
  `node ~/.claude/skills/motion/scripts/render-stills.cjs "<video-remotion>" <mã dự án> "<thư mục ra>" 60,120,180 0.4`
- Dự án minh hoạ cả 50 mẫu: sửa 3 hằng số đầu `scripts/showcase-snippet.js`, chạy đoạn mã trong trang trình chỉnh sửa, rồi mở `/?p=tu-dien-motion`.

## 4. Thêm hoặc sửa một mẫu

1. Thêm giá trị vào union trong `src/engine/types.ts` kèm nhãn tiếng Việt (`ANIM_LABELS`, `LOOP_LABELS`, `TEXT_EFFECT_LABELS`, `VFX_LABELS`, `EASING_LABELS`). Bảng cài đặt tự hiện lựa chọn mới.
2. Viết chuyển động trong file phù hợp:
   - `animations.ts`: vào/ra, easing, hiệu ứng lặp;
   - `textEffects.tsx`: hiệu ứng chữ;
   - `fx.tsx`: VFX, hệ hạt;
   - `motionPresets.ts` + `MotionGraphic.tsx`: mẫu đồ hoạ (mặc định, ô chỉnh, phần vẽ).

   Chuyển động phải tính từ `useCurrentFrame()` và `random(seed)` của Remotion. Không dùng CSS animation, `Math.random` hay `background-image`.
3. Thêm mục vào `catalog.ts` để hiện ở tab Motion.
4. `npx tsc --noEmit`, `npx eslint src`, xuất ảnh tĩnh kiểm tra.
5. Chép các file đã sửa ngược về `~/.claude/skills/motion/assets/` để gói skill luôn là bản mới nhất.

## Thành phần của skill

| Đường dẫn | Nội dung |
| --- | --- |
| `references/catalog.md` | Bảng 50 thể loại → trường JSON, danh sách giá trị hợp lệ, gợi ý cho video món ăn |
| `assets/src/engine/*` | Engine: kiểu dữ liệu, chuyển động, hiệu ứng chữ, VFX, mẫu đồ hoạ, danh mục 50 mục |
| `assets/editor/*` | Giao diện: tab Motion, bảng cài đặt, timeline, CSS |
| `scripts/install.mjs` | Cài / cài lại vào một thư mục video-remotion (có sao lưu, có `--dry-run`) |
| `scripts/render-stills.cjs` | Xuất ảnh tĩnh để kiểm tra |
| `scripts/showcase-snippet.js` | Tạo dự án minh hoạ 50 mẫu |
