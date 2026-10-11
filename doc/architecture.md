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

## Input & Event Management

`app.initEvents()` tracks mouse and touch inputs:
- Tracks `mouse.x`, `mouse.y`, `mouse.prevX`, `mouse.prevY`, `mouse.isDown`, and `mouse.isHovering`.
- Ignores mouse down events originating inside HUD panels (`#hud`) or modals (`.modal`).
- Supports touch devices (`touchstart`, `touchmove`, `touchend`).
- Drives the visual brush cursor `#mouse-brush-cursor` for the Mouse Pointer Painting mode.
