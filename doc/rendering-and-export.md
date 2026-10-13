# Rendering Pipelines & Export Subsystem

## Overview
The studio provides dual rendering pipelines (WebGL2 and Canvas2D) alongside a high-fidelity export subsystem capable of capturing up to 8K raster images and vector SVG files.

---

## 1. Hardware Blend Modes

Both WebGL2 and Canvas2D support seven artistic blend modes (`blendMode`):

| Blend Mode | WebGL2 Equation & Function | Visual Effect |
| :--- | :--- | :--- |
| **`lighter`** | `FUNC_ADD`, `SRC_ALPHA, ONE` | Additive radiance; brilliant luminous cores where strands intersect |
| **`source-over`** | `FUNC_ADD`, `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` | Solid opaque ribbons with uniform continuous density |
| **`screen`** | `FUNC_ADD`, `SRC_ALPHA, ONE_MINUS_SRC_COLOR` | Soft, ethereal glow without harsh white-out clamping |
| **`lighten`** | `MAX`, `ONE, ONE` | Preserves maximum channel luminance; razor-sharp strand definition |
| **`overlay`** | `FUNC_ADD`, separate alpha/color blending | High dynamic contrast with luminous cores and colored rims |
| **`multiply`** | `FUNC_ADD`, `DST_COLOR, ONE_MINUS_SRC_ALPHA` | Subtractive pigment; watercolor / ink wash on light backgrounds |
| **`difference`** | `FUNC_SUBTRACT`, `SRC_ALPHA, ONE` | Psychedelic chromatic inversions and high-contrast interference |

---

## 2. High-Resolution & Vector Export Engine (`js/core/exporter.js`)

The export modal (<kbd>S</kbd> or Export button in HUD) supports multiple output formats:

### Raster Image Export (PNG / JPEG)
- **Selectable Resolutions**: 1080p Full HD, 2K QHD, 4K UHD, Square Master (4096×4096), Current Screen, and 8K Ultra HD.
- **Mobile Memory Protection**: On mobile browsers, 8K canvas allocations (~132MB buffer) trigger uncatchable WebKit tab crashes. The exporter automatically safeguards mobile devices by capping export resolution at 4K UHD while preserving the original aspect ratio.
- **Offscreen Super-Resolution**:
  - Allocates an offscreen render target scaled to the requested resolution.
  - Re-executes the mode's render routine with scaled line widths and dimension coordinates.
  - Automatically triggers a browser download using a generated object URL (`a.download`).

### Vector Path Export (SVG)
- Available for vector-based modes (`flow`).
- Transcribes active path segments into native SVG `<path d="...">` elements with embedded stroke styling.
- Produces infinitely scalable vector artwork suitable for pen plotters, printing, and laser cutting.

### Video Animation Capture (WebM & MP4)
- Streams canvas frame buffers into the browser's `MediaRecorder` API.
- **Cross-Platform Codec Selection**:
  - Probes browser MIME support: selects `video/mp4;codecs=avc1` or `video/mp4` on iOS Safari, and `video/webm;codecs=vp9/vp8` on Chrome, Firefox, and Android.
  - Outputs properly formatted `.mp4` or `.webm` files with user-selected recording durations.

---

## 3. High-DPI & Mobile Hardware Tiering

- **DPR Clamping (`getSafeDPR()`)**: High-density smartphone displays often report `devicePixelRatio` of 3.0 or 3.5. Rendering 1,000,000 transparent anti-aliased ribbon quads across 10 megapixels tanks GPU fill rate.
- `CanvasRenderer` and `WebGLRenderer` clamp DPR to **1.5× on mobile screens** and **2.0× on desktop screens**. This eliminates thermal throttling and maintains 60+ FPS while remaining razor-sharp.
- **Particle Tiering**: Mobile devices automatically default to 65,536 GPU particles (or 4,000 CPU particles), while desktop retains 262,144 / 8,000 defaults with full slider access up to 1,048,576.

