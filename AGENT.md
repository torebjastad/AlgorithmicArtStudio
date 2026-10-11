# AGENT.md — AI Agent Operating Manual & Architecture Guide

Welcome to the **Algorithmic Art Studio** repository. This document serves as the primary guidance, architectural roadmap, and engineering standard for AI agents contributing to this codebase.

---

## 📌 Critical Rule: Mandatory Documentation Maintenance

> [!IMPORTANT]
> **All project documentation in the `doc/` directory must be kept strictly up to date.**
> Whenever you modify code, add features, change parameters, adjust shaders, or alter system behavior, you **MUST** update the corresponding documentation files in `doc/` (or create new documents if introducing a new subsystem or generative mode).

Do not leave architectural changes undocumented. Future agents rely on these documents for accurate context and system stability.

---

## 📚 Documentation Index (`doc/`)

Before making modifications, review the relevant knowledge documents in `doc/`:

| Document | Topic & Scope |
| :--- | :--- |
| **[`doc/architecture.md`](doc/architecture.md)** | Application lifecycle, dual-canvas pipeline (`#gl-canvas` vs `#art-canvas`), orchestrator (`app.js`), and input event handling. |
| **[`doc/gpgpu-particles.md`](doc/gpgpu-particles.md)** | 1M+ particle GPGPU simulation pass, `RGBA32F` ping-pong textures, ribbon quad geometry, motion blur decay, and mouse pointer painting. |
| **[`doc/generative-modes.md`](doc/generative-modes.md)** | Guide to all 6 generative disciplines: GPU Particles, Flow Fields, Domain Warping, Topography, 3D Terrain, and Harmonic Ribbons. |
| **[`doc/controls-and-ui.md`](doc/controls-and-ui.md)** | Glassmorphism HUD, logarithmic slider engine, badge formatting, conditional visibility tags, shortcuts, and randomized calibration. |
| **[`doc/noise-and-math.md`](doc/noise-and-math.md)** | Mathematical foundations: Divergence-Free Curl Noise ($\nabla \times \psi$), FBM octaves, Inigo Quilez cosine palettes, and Gaussian ribbon cross-sections. |
| **[`doc/rendering-and-export.md`](doc/rendering-and-export.md)** | Dual rendering pipelines, hardware blend modes (`lighter`, `screen`, `source-over`, etc.), and 8K / SVG export engine. |

---

## 🛠️ Core Engineering Principles

### 1. Zero Build Step / Pure Vanilla ES6
- The project runs by opening `index.html` directly in the browser or via a lightweight static server (`npx serve .`).
- **Never introduce bundlers (Webpack, Vite, Rollup), transpilers (Babel), or external NPM runtime dependencies** without explicit user consent.
- Keep JavaScript modular, modern, and clean (ES6 classes, typed arrays, WebGL2).

### 2. High-Performance WebGL2 Standards
- The GPU particle system simulates up to **1,048,576 particles** in real time. Maintain 60+ FPS performance budgets.
- **Strict GLSL ES 3.00 Typing**: GLSL does **not** allow implicit casts (e.g. `vec3 += float` is illegal and crashes compilation on ANGLE/Direct3D backends). Ensure all vector arithmetic is explicitly typed.
- **Texture Formats & Compatibility**: Use standard `RGBA8` for trail and frame buffers unless explicitly verified that `EXT_color_buffer_float` and `EXT_float_blend` are both available for hardware blending.

### 3. Dynamic UI & Slider Scaling
- Parameters spanning multiple orders of magnitude (particle counts, speeds, decay rates) must use logarithmic sliders (`data-scale="log"`).
- Always sync `<span class="val-badge">` badges with appropriate precision formatting via `ControlsManager.formatBadge()`.
- Use `data-show-for-mode` and `data-show-for-spawn-mode` for dynamic, clutter-free HUD presentation.

### 4. Automated Testing Standard
- **Implement Tests Whenever Sensible**: Automated tests in `tests/*.test.js` must be implemented whenever it is sensible to do so (e.g., when adding new generative modes or parameters, changing control logic or formatting, modifying mathematical equations, or fixing bugs).
- **Zero-Dependency Native Runner**: The test suite uses Node's native test runner (`node:test` and `node:assert/strict`) paired with lightweight DOM/WebGL mocks, strictly maintaining the project's zero external runtime/dev dependency ethos.
- **Run Tests**: Execute `npm test` or `node --test tests/*.test.js` to run all tests.

---

## 🔍 Verification Protocol

Before completing any task or committing changes:
1. **Run Syntax Check**: Verify clean syntax across all JavaScript files:
   ```powershell
   node --check js/app.js js/ui/controls.js js/modes/*.js js/core/*.js js/noise/*.js
   ```
2. **Run Automated Test Suite**: Verify that all test suites pass without regression:
   ```powershell
   node --test tests/*.test.js
   ```
3. **Implement / Update Tests**: Whenever sensible, implement new test cases in `tests/` to cover new logic, parameters, UI controls, or edge cases.
4. **Inspect Git Status**: Verify that `git status` and `git diff` contain only intentional, surgical edits.
5. **Update Documentation**: Update the corresponding markdown documents in `doc/` (and this `AGENT.md` if applicable) to reflect all changes.

