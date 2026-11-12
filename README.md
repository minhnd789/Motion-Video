# Motion Video: skill 50 thể loại motion graphic

Skill **`motion`** cho Claude Code. Nó thêm 50 thể loại motion graphic vào một trình chỉnh sửa video dựng trên [Remotion](https://www.remotion.dev/) (dự án `video-remotion`, giao diện kiểu CapCut). Danh sách 50 thể loại và 8 nhóm theo [Từ điển Motion Graphic](https://khaontheway.com/tu-dien-motion-graphic/) của Kha ontheway.

Sau khi cài, mọi hiệu ứng được lưu trong file JSON của dự án, nên vẫn chỉnh tay được: vị trí, màu, chữ, số liệu, thời gian, hiệu ứng vào/ra.

## Có gì bên trong

| Nhóm | Thể loại |
| --- | --- |
| Chữ chuyển động | Kinetic Typography, Text Reveal, Typewriter, Lower Third, Bouncy Text, Text Scramble, Animated Captions |
| Hình khối 2D | Shape Animation, Shape Morphing, Line Animation, Liquid Motion, Seamless Loop, Isometric, Pattern / Grid |
| Dữ liệu và giải thích | Infographic (biểu đồ cột), Number Counter, Donut / Pie, Map Animation, Timeline / Process, Icon Animation, Explainer |
| Thương hiệu và bán hàng | Logo Reveal, Promo Badge, End Card |
| Giao diện và sản phẩm số | UI Animation, Micro-interaction, Product Walkthrough |
| Phong cách hình ảnh | Character, Glitch, Cut-out / Stop Motion, Hand-drawn / Doodle, Particles, 3D Motion, Parallax, Retro / VHS, Gradient, Neon, Before / After, Split Screen, Audio Reactive |
| Chuyển cảnh | Shape Wipe, Slide / Push, Zoom Transition |
| Nguyên lý chuyển động | Easing, Squash & Stretch, Anticipation, Overshoot, Stagger, Follow-through, Motion Blur |

Cụ thể, bộ này thêm:
- **Hiệu ứng chữ:** 9 kiểu mới.
- **Hiệu ứng vào/ra:** 11 kiểu mới, và mọi kiểu vào/ra đều chọn được easing.
- **Hiệu ứng lặp:** 8 kiểu mới.
- **Hiệu ứng hình (VFX):** glitch, VHS, pháo giấy.
- **Nhoè chuyển động** theo tốc độ.
- **31 mẫu đồ hoạ dựng sẵn** (clip loại `motion`).
- **Tab Motion** trong trình chỉnh sửa: tìm kiếm, lọc theo nhóm, nút *Áp dụng* cho clip đang chọn và *Thêm mẫu*.

## Cấu trúc

```
motion/
├── SKILL.md                    hướng dẫn cho Claude
├── references/catalog.md       bảng 50 thể loại → trường JSON
├── assets/                     mã chép vào video-remotion
│   ├── src/engine/             kiểu dữ liệu, chuyển động, hiệu ứng chữ, VFX, mẫu đồ hoạ, danh mục
│   └── editor/                 tab Motion, bảng cài đặt, timeline, CSS
└── scripts/
    ├── install.mjs             cài vào một thư mục video-remotion (có sao lưu, có --dry-run)
    ├── render-stills.cjs       xuất ảnh tĩnh để kiểm tra
    └── showcase-snippet.js     tạo dự án minh hoạ đủ 50 mẫu
```

## Cài đặt

### 1. Cài skill cho Claude Code

Chép thư mục `motion` vào thư mục skill của bạn:

```bash
git clone https://github.com/minhnd789/Motion-Video.git
cp -r Motion-Video/motion ~/.claude/skills/motion
```

Trên Windows, thư mục skill là `C:\Users\<tên>\.claude\skills\motion`. Muốn dùng trên claude.ai thì nén thư mục `motion` thành file zip rồi tải lên mục Skills.

### 2. Cài mã vào trình chỉnh sửa video

Skill cần một thư mục `video-remotion` có sẵn `src/engine` và `editor/`. Chạy thử trước, rồi cài thật:

```bash
node ~/.claude/skills/motion/scripts/install.mjs "<đường dẫn>/video-remotion" --dry-run
node ~/.claude/skills/motion/scripts/install.mjs "<đường dẫn>/video-remotion"
```

Script sao lưu các file bị thay vào `video-remotion/.motion-backup/<thời điểm>/` và báo nếu thiếu gói cần thiết (`remotion`, `@remotion/paths`, `@remotion/media-utils`, `@remotion/media`, `lucide-react`). Sau đó:

```bash
cd "<đường dẫn>/video-remotion"
npx tsc --noEmit
npm run editor
```

Mở `http://localhost:5180`, chọn tab **Motion** ở cột trái.

## Dùng với Claude

Nhắc tên thể loại khi nhờ Claude dựng video, ví dụ: "thêm lower third tên quán", "phụ đề karaoke cho câu này", "chuyển cảnh zoom giữa hai cảnh", "nhãn giảm 30% góc trên". Claude tra `references/catalog.md` và tạo clip bằng chính các hàm của engine, nên mọi thứ vẫn chỉnh lại được trong trình chỉnh sửa.

## Ghi chú

- Mọi chuyển động tính theo khung hình (`useCurrentFrame`, `random(seed)`), nên xem trước và xuất video cho ra kết quả giống nhau.
- `assets/` thay nguyên các file `types.ts`, `animations.ts`, `MainVideo.tsx`, `Inspector.tsx`, `MediaPanel.tsx`, `Timeline.tsx`, `styles.css`. Nếu bạn đã sửa riêng các file này, hãy so với bản sao lưu rồi gộp lại.
- Tên các thể loại lấy theo bộ từ điển của Kha ontheway. Phần mô tả và toàn bộ mã trong repo này được viết riêng.
