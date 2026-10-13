# Architecture & System Design

## Overview
**Algorithmic Art Studio** is a standalone, client-side procedural art synthesizer built using vanilla ES6 JavaScript and WebGL2 / Canvas2D. It requires **no build step, bundler, or external runtime dependencies**; opening `index.html` directly in any modern browser runs the entire application.

---

## High-Level System Structure

```
AlgorithmicArtStudio/
├── index.html              # Single-page UI, controls HUD, canvas mount points
├── css/style.css           # Glassmorphism dark HUD design & responsive styles
├── js/
│   ├── app.js              # Central orchestrator (AlgorithmicArtApp)
│   ├── core/
│   │   ├── webgl-renderer.js  # WebGL2 context, program caching, quad buffers
│   │   ├── canvas-renderer.js # 2D Canvas rendering & trail compositor
│   │   ├── color-palette.js   # Cosine gradient palettes & color utilities
│   │   └── exporter.js        # Hi-res image, video, and SVG export engine
│   ├── modes/                 # Generative mode implementations
│   │   ├── gpu-particles.js   # 1M+ particle GPGPU simulation & ribbon renderer
│   │   ├── flow-fields.js     # CPU agent particle simulation with velocity tapering
│   │   ├── domain-warp.js     # WebGL procedural marble & plasma shader
│   │   ├── topographic.js     # 2D contour vector isoline marching
│   │   ├── terrain3d.js       # 3D interactive heightfield wireframe & mesh
│   │   └── ribbons.js         # 3D parametric harmonic spline ribbons
│   ├── noise/                 # Procedural noise mathematical libraries
│   │   ├── perlin.js          # Classic Perlin noise 2D / 3D with octaves
│   │   ├── simplex.js         # Simplex noise 2D / 3D
│   │   └── curl.js            # Analytic & finite-difference curl noise
│   └── ui/
│       └── controls.js        # HUD controls, slider binding, presets, shortcuts
├── tests/                     # Automated unit and integration test suite (Node test runner)
└── doc/                       # Comprehensive project documentation
```

---

## Dual-Canvas Rendering Pipeline

The studio uses two HTML5 canvas elements positioned absolutely over the full viewport:

1. **`#gl-canvas`**: Dedicated WebGL2 canvas context (`webgl-renderer.js`).
   - Active during GPU-accelerated modes: `gpu_particles` and `domain_warp`.
   - Utilizes hardware acceleration, GPGPU transform/texture simulation passes, and fragment shaders.
2. **`#art-canvas`**: Dedicated HTML5 Canvas2D context (`canvas-renderer.js`).
   - Active during CPU canvas modes: `flow`, `topographic`, `terrain3d`, `ribbons`.
   - Employs an offscreen trail canvas buffer for smooth alpha fading, compositing, and vector stroke rendering.

### Mode Switching (`app.setMode(modeKey)`)
When switching modes, `AlgorithmicArtApp` handles canvas toggling:
- Toggles CSS `display: block` / `display: none` between `#gl-canvas` and `#art-canvas`.
- Resizes the active context to match viewport resolution multiplied by `window.devicePixelRatio`.
- Clears the canvases and triggers `resetAllParticles()` or equivalent reset on the newly selected mode.
- Synchronizes HUD controls and conditional parameter visibility via `controls.syncControlsWithMode()`.

---

## Main Animation Loop (`app.animate(now)`)

The animation loop is driven by `requestAnimationFrame`:
```javascript
animate(now) {
  requestAnimationFrame(this.animate);
  if (!this.isRunning) return;

  const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
  this.lastFrameTime = now;
  this.time += dt * 60; // Normalized frame units (60 FPS = 1.0 unit per second)

  if (this.currentMode) {
    this.currentMode.update(dt, this.time);
    this.currentMode.render(this.renderer2D);
  }
}
```
- In **GPU modes** (`gpu_particles`), simulation and rendering happen inside `render()` on the GPU.
- In **CPU modes**, `update(dt, time)` updates particle arrays and physics on the CPU, and `render(renderer)` draws strokes into `renderer.trailCtx`.

---

## Input, Touch & Gesture Management

`app.initEvents()` tracks mouse and multi-touch inputs:
- Tracks `mouse.x`, `mouse.y`, `mouse.prevX`, `mouse.prevY`, `mouse.isDown`, and `mouse.isHovering`.
- Ignores interactions originating inside HUD panels (`#hud`) or modals (`.modal`).
- **Touch & Gesture Engine**:
  - **Single Finger Drag**: Updates active pointer for physics forces or painting particles (`spawnMode: 'pointer'`).
  - **Double-Tap on Canvas**: Toggles Zen Mode (hides/reveals HUD) without needing a physical keyboard (disabled during pointer brush mode).
  - **Two-Finger Tap (<350ms)**: Instantly toggles simulation Play/Pause.
  - **Two-Finger Pinch**: Real-time zoom in and out across all generative modes without interrupting simulation loop.
  - **Touch Brush Indicator**: Displays visual brush ring `#mouse-brush-cursor` directly under finger while dragging on touchscreens, scaled by `zoom`.

---

## Native Camera Zoom & Coordinate Transformation Engine

To eliminate boundary discontinuities and inspect fine fractal vortices **without losing resolution**, the studio features a true **camera projection zoom pipeline** instead of post-render CSS bitmap scaling:

1. **Zero Resolution Loss (Native Framebuffer Rasterization)**:
   - Canvases remain 1:1 with screen pixels (`transform: none`). No CSS canvas magnification is applied, eliminating blurriness, pixelation, or fat stroke artifacts.
   - **GPU Particles (`gpu-particles.js`)**: The instanced ribbon quad vertex shader applies a camera projection from the viewport center:
     $$\text{projPos} = \text{center} + (\text{pos} - \text{center}) \times u\_zoom$$
     Particles are rasterized directly onto the native framebuffer at physical display resolution with analytic Gaussian sub-pixel anti-aliasing.
   - **Domain Warp (`domain-warp.js`)**: Evaluates the procedural multi-tier fBm equations per-fragment at `(u_scale / u_zoom)` with infinite mathematical precision.
   - **Flow Fields (`flow-fields.js`)**: Batch-draws particle vectors projected by camera zoom onto the native high-DPI canvas buffer with crisp 1:1 line widths.
   - **Topography, 3D Terrain & Ribbons**: Heightmaps and 3D camera FOV scale smoothly with camera zoom.
   - **Never Decay Protection**: When `fadeRate <= 0.00001`, changing zoom refreshes the canvas buffer so the new cropped camera view accumulates cleanly.

2. **Inverse Coordinate Mapping**:
   When the camera zoom is $Z$, screen coordinates $(s_x, s_y)$ relative to screen center $(c_x, c_y)$ map to simulation space coordinates $(p_x, p_y)$:
   $$p_x = c_x + \frac{s_x - c_x}{Z}, \quad p_y = c_y + \frac{s_y - c_y}{Z}$$
   - Applied inside `updatePointer()` so all generative physics forces, hover tracking, and particle brush painting spawn precisely underneath the user's cursor or finger.
   - Brush cursor ring diameter scales by $D \times Z$ in screen space to perfectly match the painted area.

3. **Input Modalities**:
   - **Desktop Mouse Wheel**: Smooth exponential damping: $\text{factor} = e^{-\Delta y \cdot 0.0015}$. Ignored when scrolling over HUD drawers or modal dialogs.
   - **Touch Pinch**: Tracks two-touch distance $\sqrt{(x_1 - x_2)^2 + (y_1 - y_2)^2}$ and applies the scale ratio directly to `initialPinchZoom`. Disambiguates cleanly from two-finger tap (Play/Pause).
   - **Instant Reset**: Press <kbd>0</kbd> on desktop, click the top HUD `ZOOM` pill, click mobile drawer stats pill, or tap the floating badge `#floating-zoom-badge` to reset to `100%` (1.0x).
   - **Native Art Export**: Exporter captures the active cropped view directly at full master resolution.

---

## Mobile & Tablet Responsive Architecture

1. **Mobile Bottom Sheet Engine (`@media (max-width: 768px)`)**:
   - In portrait mode, `#control-drawer` transforms into a swipeable/draggable bottom sheet (`bottom: 0`, max-height: `80vh`).
   - Equipped with a top grab handle (`#sheet-grab-bar`) allowing tap or drag-down gestures to dismiss.
   - Preserves top 20–25% of the screen so user can observe real-time generative changes while scrubbing sliders.
2. **Mobile Landscape Panel (`@media (max-height: 520px) and (orientation: landscape)`)**:
   - In landscape orientation, bottom sheets would occlude the entire vertical screen. The drawer dynamically switches to a narrow right slide-over panel (300px), preserving 70% of widescreen canvas visibility.
3. **Safe Area Insets**:
   - Implements CSS `env(safe-area-inset-*)` variables (`--safe-top`, `--safe-bottom`, etc.) and `viewport-fit=cover` to render edge-to-edge behind notches and navigation bars.
4. **Hardware Adaptation & DPR Clamping**:
   - High-DPI smartphones (Retina 3.0x) clamp canvas DPR to 1.5x, slashing pixel fill-rate load by ~75% and preventing thermal throttling during 1M particle simulation.
5. **Memory Safety & iOS Safari Support**:
   - Export resolution is safely capped at 4K UHD on mobile browsers to prevent WebKit memory allocation crashes.
   - Automatic `MediaRecorder` MIME detection selects `video/mp4` for iOS Safari and `video/webm` for Chrome/Firefox.

---

## Testing & Quality Assurance

Automated unit and integration testing is implemented using Node.js's built-in test runner (`node:test` and `node:assert/strict`) requiring no external npm dependencies:
- **`tests/controls.test.js`**: Validates slider log-scaling, formatting, and DOM badge rendering.
- **`tests/menu-ui.test.js`**: Checks DOM interactive ID uniqueness, tab integrity, and parameter existence.
- **`tests/mode-params.test.js`**: Tests parameter dictionaries, default values, and time integration across generative modes.
- **`tests/mobile-responsive.test.js`**: Tests mobile DPR clamping, mobile export resolution safeguards, iOS MP4 video detection, and safe-area DOM/CSS structures.

Tests are run via `node --test tests/*.test.js` or `npm test`.

