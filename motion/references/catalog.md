# 50 thể loại → cách dựng bằng JSON

Nguồn chuẩn là `src/engine/catalog.ts` (có hàm `apply` và `sample` cho từng mục). Bảng này để tra nhanh.

## Trường dữ liệu dùng chung

- **Clip chữ** (`type: "text"`): `textEffect`, `highlightColor` (màu nhấn), `effectSpeed` (1 = thường).
  Hiệu ứng chữ: `typewriter`, `words`, `letters`, `wave` (có từ trước); `typecursor`, `kinetic`, `reveal`, `bounce`, `scramble`, `karaoke`, `counter`, `neon`, `glitch` (mới).
- **Mọi clip hình**: `animIn` / `animOut` = `{ type, duration (khung hình), easing? }`.
  - `type`: `fade`, `slideUp/Down/Left/Right`, `zoomIn/Out`, `pop`, `blur`, `spin` (có từ trước); `wipeRight/Left/Up/Down`, `circle`, `compare`, `zoomThrough`, `flip`, `drop`, `settle`, `glitch` (mới).
  - `easing`: `smooth` (mặc định), `linear`, `inOut`, `back`, `elastic`, `bounce`, `anticipate`. `drop`, `settle`, `glitch` bỏ qua easing.
  - `loop`: `kenburns`, `pulse`, `float`, `shake`, `swing` (có từ trước); `bounce`, `spin`, `stopmotion`, `boil`, `glitch`, `flicker`, `panSlow`, `panFast` (mới).
  - `motionBlur: true`: nhoè theo tốc độ.
- **Video/ảnh**: `vfx` thêm `glitch`, `vhs`, `confetti`; `boxWidth`/`boxHeight` (pixel, 0 = cả khung) cho chia khung.
- **Clip đồ hoạ** (`type: "motion"`): `preset`, `variant`, `w`, `h`, `text`, `text2`, `items` (mỗi dòng một mục), `value`, `color`, `color2`, `color3`, `fontFamily`, `src`.
  Tạo bằng `makeMotionClip(preset, { width, height, fps }, patch)`. Mẫu nền `gradient`, `parallax`, `grid` nằm ở dòng `video`; mẫu khác ở dòng `text`.

## Bảng tra

| # | Thể loại | Nhóm | Cách dựng |
| --- | --- | --- | --- |
| 1 | Kinetic Typography | Chữ | text `textEffect: "kinetic"`, `highlightColor` tô từ cuối |
| 2 | Text Reveal | Chữ | text `textEffect: "reveal"` (`highlightColor` = vạch che) |
| 3 | Typewriter | Chữ | text `textEffect: "typecursor"` |
| 4 | Lower Third | Chữ | motion `lowerThird` (text = tên, text2 = chức danh) |
| 5 | Bouncy Text | Chữ | text `textEffect: "bounce"` |
| 6 | Text Scramble | Chữ | text `textEffect: "scramble"` |
| 7 | Animated Captions | Chữ | text `textEffect: "karaoke"`; từ chia đều theo thời lượng clip, `effectSpeed` để khớp lời |
| 8 | Shape Animation | Hình khối | motion `shapes` |
| 9 | Shape Morphing | Hình khối | motion `morph` |
| 10 | Line Animation | Hình khối | motion `lineDraw`, variant `underline/arrow/circle/heart/check/wave`, `value` = độ dày |
| 11 | Liquid Motion | Hình khối | motion `liquid` |
| 12 | Seamless Loop | Hình khối | motion `loader` (`dots/ring/bars`) hoặc `loop: "spin"` |
| 13 | Isometric | Hình khối | motion `isometric` |
| 14 | Pattern / Grid | Hình khối | motion `grid` (nền), `dots/squares/diamonds` |
| 15 | Infographic | Dữ liệu | motion `barChart`, `items` dạng `Nhãn: số` |
| 16 | Number Counter | Dữ liệu | motion `counter` (`value`, `text2` = đuôi) hoặc text `textEffect: "counter"` |
| 17 | Donut / Pie | Dữ liệu | motion `donut` (`value` = %) |
| 18 | Map Animation | Dữ liệu | motion `mapRoute` (text = điểm đi, text2 = điểm đến) |
| 19 | Timeline / Process | Dữ liệu | motion `timeline`, `items` mỗi dòng một bước, `vertical/horizontal` |
| 20 | Icon Animation | Dữ liệu | motion `icon`, `bell/heart/star/check/fire/gift/cart/like/pin/phone/food` |
| 21 | Explainer | Dữ liệu | motion `explainer` (text = tiêu đề, `items` ≤ 4 bước) |
| 22 | Logo Reveal | Thương hiệu | motion `logoReveal` (text, hoặc `src` = ảnh logo trong `public/`) |
| 23 | Promo Badge | Thương hiệu | motion `badge`; clip khác: `animIn pop` + `loop: "pulse"` |
| 24 | End Card | Thương hiệu | motion `endCard` (text, text2 = nút, items = dòng thông tin) |
| 25 | UI Animation | Giao diện | motion `phoneUI` (`src` = ảnh chụp màn hình dài để cuộn) |
| 26 | Micro-interaction | Giao diện | motion `microInteraction`, `like/toggle/button` |
| 27 | Product Walkthrough | Giao diện | motion `cursor` (text2 = chữ nút, text = sau khi bấm) |
| 28 | Character Animation | Phong cách | motion `character` (text = lời thoại) |
| 29 | Glitch | Phong cách | text `textEffect: "glitch"`; video/ảnh `vfx: "glitch"` + `loop: "glitch"`; vào/ra `glitch` |
| 30 | Cut-out / Stop Motion | Phong cách | `loop: "stopmotion"` (vào/ra cũng giật 3 khung) |
| 31 | Hand-drawn / Doodle | Phong cách | motion `doodle` (`circle/underline/stars/arrow/heart`); clip khác `loop: "boil"` |
| 32 | Particles | Phong cách | motion `particles` (`confetti/sparkle/bubbles/firework`, `value` = số hạt); video/ảnh `vfx: "confetti"` |
| 33 | 3D Motion | Phong cách | motion `cube3d`; clip khác `animIn/animOut flip` |
| 34 | Parallax / 2.5D | Phong cách | motion `parallax` (nền); lớp ảnh xa `loop: "panSlow"`, gần `loop: "panFast"` |
| 35 | Retro / VHS | Phong cách | video/ảnh `vfx: "vhs"`; hoặc motion `vhsOverlay` ở dòng trên cùng |
| 36 | Gradient Animation | Phong cách | motion `gradient` (nền) |
| 37 | Neon | Phong cách | text `textEffect: "neon"`, `highlightColor` = màu sáng; clip khác `loop: "flicker"` |
| 38 | Before / After | Phong cách | clip TRƯỚC dòng dưới, clip SAU dòng trên cùng lúc; clip SAU `animIn: { type: "compare", duration: 48, easing: "inOut" }` |
| 39 | Split Screen | Phong cách | mỗi clip đặt `boxWidth`/`boxHeight` + `x`/`y` (nửa trên 1080×1920: `boxWidth 1080, boxHeight 960, y -480`), mỗi clip một dòng video |
| 40 | Audio Reactive | Phong cách | motion `audioBars` (`bars/wave/circle`; `src` = file nhạc trong `public/`, để trống thì nhịp mô phỏng) |
| 41 | Shape Wipe | Chuyển cảnh | motion `shapeWipe` (~0,9 s, dòng trên cùng, giữa điểm cắt; `circle/bars/diagonal`); clip đơn `animIn circle` |
| 42 | Slide / Push | Chuyển cảnh | cảnh cũ `animOut slideLeft`, cảnh mới chồng ~12 khung ở dòng khác `animIn slideLeft`, easing `inOut` |
| 43 | Zoom Transition | Chuyển cảnh | cảnh cũ `animOut zoomThrough`, cảnh mới `animIn zoomThrough` (~10 khung) |
| 44 | Easing | Nguyên lý | `animIn.easing` / `animOut.easing` |
| 45 | Squash & Stretch | Nguyên lý | `animIn drop` + `loop: "bounce"` |
| 46 | Anticipation | Nguyên lý | `easing: "anticipate"` (rõ nhất ở `animOut`) |
| 47 | Overshoot | Nguyên lý | `easing: "back"` hoặc `"elastic"` |
| 48 | Stagger | Nguyên lý | text `letters` / `words` + `effectSpeed`; nhiều clip thì lệch `start` vài khung |
| 49 | Follow-through | Nguyên lý | `animIn: { type: "settle", duration: 33 }` |
| 50 | Motion Blur | Nguyên lý | `motionBlur: true` |

Trước khi cài bộ này, trình chỉnh sửa đã có #42 Slide/Push và #48 Stagger; có một phần #3 Typewriter (không con trỏ), #32 Particles (chỉ lấp lánh), #47 Overshoot (chỉ ở Bật nảy). 45 mục còn lại là mới.

## Gợi ý cho video món ăn ngắn

- Tiêu đề: Kinetic, Text Reveal hoặc Bouncy Text. Phụ đề: Animated Captions.
- Con số (khách, giảm giá): Number Counter, Promo Badge.
- Chuyển cảnh: Shape Wipe, Push, Zoom. Cuối video: End Card hoặc Logo Reveal.
- Giữ VFX nhẹ (lấp lánh, vệt sáng, tối viền) và chữ cách nhau rõ.
