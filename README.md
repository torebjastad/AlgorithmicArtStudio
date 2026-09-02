# 🎨 Algorithmic Art Studio

> A high-performance WebGL2 & GPGPU Generative Visual Synthesizer & Algorithmic Physics Studio.

---

## 🌟 Highlights & Capabilities

* **⚡ GPGPU Texture Ping-Pong Simulation**:
  Simulates from **100 to over 1,000,000+ particles** in real time at **60–144 FPS** entirely on the GPU via MRT `RGBA32F` data textures.
* **🌊 Divergence-Free Curl Noise**:
  Implements analytic and finite-difference curl noise ($\nabla \times \psi$) for realistic, turbulent, incompressible fluid dynamics with zero source/sink clumpiness.
* **✨ Analytic Gaussian Anti-Aliased Ribbon Quads**:
  Replaces 1-pixel Bresenham aliased lines with true instanced extruded ribbon quads (`gl.TRIANGLE_STRIP`) and Gaussian cross-sectional edge falloff (`exp(-dist² * 2.5)`).
* **🌀 6 Generative Disciplines**:
  1. **GPU Cosmic Particles (1M+)**: Hardware-accelerated fluid velocity streamlines, motion decay blur, and interactive force fields.
  2. **Fluid Flow Fields**: Agent-based CPU particle simulation with dynamic velocity stroke tapering.
  3. **Domain Warping Canvas**: Deep procedural marble, cosmic nebula plumes, and plasma distortion.
  4. **Topographic Cartography**: Vector isoline elevation contour maps with adaptive marching heights.
  5. **3D Interactive Wireframe Terrain**: Elevation heightfield meshes with Lambertian directional lighting and orbital controls.
  6. **Harmonic Ribbons**: Sweeping 3D spline ribbons through multi-octave noise space.
* **🎛️ Dynamic Controls & Studio Presets**:
  Logarithmic slider engines, customizable cosine gradient palettes, edge-inflow spawning, and instant preset switching.
* **📸 4K / 8K & Vector Export**:
  Export high-resolution PNG/JPEG images up to 8K, vector SVG paths, and WebM video animations.

---

## 🚀 Getting Started

Simply open `index.html` in any modern web browser with WebGL2 support (Chrome, Edge, Firefox, Safari).

No build step or dependencies required — written in pure, ultra-fast modern ES6 JavaScript and GLSL 300 es shaders.

```bash
# Optional local web server
npx serve .
```

---

## ⌨️ Studio Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Pause / Resume Real-Time Simulation |
| <kbd>C</kbd> | Clear Canvas / Re-seed Particles |
| <kbd>R</kbd> | Randomize Palette & Parameters |
| <kbd>H</kbd> | Toggle Studio HUD Controls |
| <kbd>1</kbd> – <kbd>6</kbd> | Quick Switch Between Generative Modes |
| <kbd>E</kbd> | Quick 4K PNG Snapshot Export |

---

## 📜 License
MIT License. Created with mathematical passion for generative art & procedural aesthetics.
