# Motion Video

Trình chỉnh sửa video chạy trên trình duyệt, dựng bằng [Remotion](https://www.remotion.dev/), có sẵn 50 thể loại motion graphic. Kèm theo là skill **`motion`** để Claude Code dựng video bằng các mẫu đó.

Danh sách 50 thể loại và 8 nhóm theo [Từ điển Motion Graphic](https://khaontheway.com/tu-dien-motion-graphic/) của Kha ontheway.

| Thư mục | Nội dung |
| --- | --- |
| `video-remotion/` | Trình chỉnh sửa (giao diện kiểu CapCut) và engine dựng video. Đã cài sẵn 50 mẫu. |
| `motion/` | Skill cho Claude Code: hướng dẫn, bảng tra 50 mẫu, mã engine và script cài vào một bản `video-remotion` khác. |

## Trình chỉnh sửa video

Giao diện có 4 phần:
- **Bên trái:** thư viện Media, Chữ và **Motion** (50 mẫu).
- **Giữa:** khung xem trước; kéo trực tiếp để đổi vị trí và kích thước.
- **Bên phải:** bảng cài đặt cho clip đang chọn.
- **Dưới:** timeline nhiều dòng (video, chữ & đồ hoạ, âm thanh).

Mỗi video là một file JSON trong `video-remotion/projects/`. Bấm **Xuất video** để ra file MP4 1080×1920 (đổi được sang 16:9, 1:1, 4:5).

### Cần có

- [Node.js](https://nodejs.org/) 20.19 trở lên (hoặc 22.13+).
- `ffmpeg` và `ffprobe` trong PATH, dùng để nhập clip (đổi HEVC/.MOV sang H.264) và tạo ảnh thu nhỏ. Trên Windows: `winget install Gyan.FFmpeg`.

### Chạy

```bash
git clone https://github.com/minhnd789/Motion-Video.git
cd Motion-Video/video-remotion
npm install
npm run editor
```

Mở http://localhost:5180. Trên Windows có thể bấm đúp `Mo-trinh-chinh-sua.bat` thay cho lệnh `npm run editor`.

- **Clip gốc:** mặc định trình chỉnh sửa đọc video, ảnh, nhạc ở **thư mục cha** của `video-remotion` (tức thư mục `Motion-Video/`). Muốn đọc chỗ khác thì tạo `video-remotion/editor.config.json`:
  ```json
  { "sourceDir": "D:/Clip-quay/thang-11" }
  ```
- **Dự án mẫu:** `tu-dien-motion` chạy lần lượt cả 50 mẫu, mỗi mẫu 3,5 giây, có tên ở trên. Các mục cần cảnh quay thật (Before/After, Split Screen, Push, Zoom) dùng nền màu thay thế.
- **Xuất video từ dòng lệnh:**
  ```bash
  npm run render -- tu-dien-motion
  ```
  File ra nằm trong `video-remotion/out/`.
- **Xem nhanh vài khung hình** mà không xuất cả video:
  ```bash
  node scripts/stills.mjs tu-dien-motion 60,165,270
  ```

### 50 thể loại

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

Trong tab **Motion**, mỗi mẫu có ba nút:
- **Áp dụng:** gắn hiệu ứng vào clip đang chọn.
- **Thêm mẫu:** chèn một clip mẫu tại vị trí đầu phát.
- **Chép từ khoá:** chép tên tiếng Anh và các từ đồng nghĩa.

Mọi thứ thêm vào đều chỉnh lại được trong bảng cài đặt bên phải.

Cụ thể, bộ mẫu gồm:
- **Hiệu ứng chữ:** 9 kiểu mới.
- **Hiệu ứng vào/ra:** 11 kiểu mới; mọi kiểu vào/ra chọn được easing.
- **Hiệu ứng lặp:** 8 kiểu mới.
- **Hiệu ứng hình (VFX):** glitch, VHS, pháo giấy.
- **Nhoè chuyển động** theo tốc độ.
- **31 mẫu đồ hoạ dựng sẵn** (biểu đồ, bản đồ, logo, nhãn khuyến mãi, màn kết, mô phỏng app, nhân vật, khối 3D, cảnh nhiều lớp, sóng nhạc…).

### Cấu trúc mã

```
video-remotion/
├── editor/                 giao diện (React + Vite) và API cục bộ (editor/server/api.ts)
│   └── components/         MediaPanel, MotionLibrary, Preview, Inspector, Timeline, TopBar
├── src/engine/             engine dựng hình dùng chung cho xem trước và xuất file
│   ├── types.ts            mô hình dữ liệu của dự án
│   ├── MainVideo.tsx       dựng toàn bộ video từ JSON
│   ├── animations.ts       hiệu ứng vào/ra, easing, hiệu ứng lặp, nhoè
│   ├── textEffects.tsx     hiệu ứng chữ
│   ├── fx.tsx              VFX phủ lên video/ảnh, hệ hạt
│   ├── motionPresets.ts    31 mẫu đồ hoạ: mặc định và ô chỉnh
│   ├── MotionGraphic.tsx   phần vẽ 31 mẫu đồ hoạ
│   └── catalog.ts          danh mục 50 thể loại (Áp dụng / Thêm mẫu)
├── scripts/                render.mjs (xuất MP4), stills.mjs (ảnh tĩnh)
└── projects/               file JSON của từng video
```

Mọi chuyển động tính theo khung hình (`useCurrentFrame`, `random(seed)`), nên xem trước và xuất file cho ra kết quả giống nhau.

## Skill `motion` cho Claude Code

Chép thư mục `motion` vào thư mục skill:

```bash
cp -r Motion-Video/motion ~/.claude/skills/motion
```

Trên Windows, thư mục skill là `C:\Users\<tên>\.claude\skills\motion`. Muốn dùng trên claude.ai thì nén thư mục `motion` thành zip rồi tải lên mục Skills.

Sau đó, khi nhờ Claude dựng video, chỉ cần nhắc tên thể loại, ví dụ:
- "thêm lower third tên quán";
- "phụ đề karaoke cho câu này";
- "chuyển cảnh zoom giữa hai cảnh";
- "nhãn giảm 30% góc trên".

Claude tra `motion/references/catalog.md` rồi tạo clip bằng chính các hàm của engine, nên kết quả vẫn mở và chỉnh được trong trình chỉnh sửa.

Đã có sẵn một bản `video-remotion` khác, chưa có 50 mẫu? Cài vào bằng lệnh dưới. Script sao lưu file cũ vào `.motion-backup/`; thêm `--dry-run` để xem trước.

```bash
node ~/.claude/skills/motion/scripts/install.mjs "<đường dẫn>/video-remotion"
```

## Ghi chú

- Tên các thể loại lấy theo bộ từ điển của Kha ontheway. Phần mô tả và toàn bộ mã trong repo này được viết riêng.
- Phông chữ tải từ Google Fonts qua `@remotion/google-fonts`, phông nào cũng có dấu tiếng Việt.
- Remotion có [điều khoản giấy phép riêng](https://www.remotion.dev/license): công ty từ một số quy mô trở lên cần mua giấy phép.
