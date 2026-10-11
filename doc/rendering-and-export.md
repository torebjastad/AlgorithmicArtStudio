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
- **Selectable Multipliers**: $1\times$ (Viewport), $2\times$ (High-DPI 4K), and $4\times$ (Ultra-HD 8K).
- **Offscreen Super-Resolution**:
  - Allocates an offscreen render target scaled to the requested resolution.
  - Re-executes the mode's render routine with scaled line widths and dimension coordinates.
  - Automatically triggers a browser download using a generated object URL (`a.download`).

### Vector Path Export (SVG)
- Available for vector-based modes (`flow`, `topographic`, `ribbons`).
- Transcribes active path segments into native SVG `<path d="...">` elements with embedded stroke styling.
- Produces infinitely scalable vector artwork suitable for pen plotters, printing, and laser cutting.

### Video Animation Capture (WebM)
- Streams canvas frame buffers into the browser's `MediaRecorder` API.
- Encodes real-time WebM video clips (up to 60 FPS) with user-selected recording durations.
