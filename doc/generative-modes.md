# Generative Disciplines & Art Modes

The studio focuses on three premier generative disciplines, accessible via keyboard shortcuts <kbd>1</kbd>–<kbd>3</kbd> or the Mode Selector dropdown:

---

## 1. GPU Cosmic Particles (`gpu_particles` / <kbd>1</kbd>)
- **Renderer**: WebGL2 hardware-accelerated GPGPU simulation.
- **Capacity**: 100 to 1,000,000+ simultaneous particles.
- **Key Features**:
  - Full Divergence-Free Curl Noise and FBM in GLSL.
  - Interactive mouse forces (attraction, repulsion, vortex cyclonic swirl).
  - Four spawn origins: Full Canvas, Perimeter Edges, Center Core, and Mouse Pointer Brush.
  - Motion trail alpha decay and selectable hardware blend modes.
  - Instanced Gaussian ribbon quads with camera projection zoom and pan.
- *For detailed shader architecture, see [gpgpu-particles.md](gpgpu-particles.md).*

---

## 2. Fluid Flow Fields (`flow` / <kbd>2</kbd>)
- **Renderer**: HTML5 Canvas2D with offscreen trail compositor.
- **Capacity**: 500 to 60,000 CPU particles.
- **Key Features**:
  - Agent-based particle tracking in JavaScript typed arrays (`Float32Array`).
  - Dynamic stroke tapering proportional to particle speed:
    $$\text{width} = \text{baseWidth} \cdot (0.3 + 0.7\alpha) \cdot (0.8 + 0.3 \cdot \min(v, 4.0))$$
  - Support for all spawn origins including Mouse Pointer Brush.
  - Offscreen trail buffer compositing with progressive alpha erasing (`destination-out`).
  - Native high-DPI projection zoom and camera panning.

---

## 3. Domain Warping Canvas (`domain_warp` / <kbd>3</kbd>)
- **Renderer**: WebGL2 fullscreen fragment shader.
- **Key Concept**: Recursive procedural noise domain distortion:
  $$p' = p + \alpha \cdot \text{noise}(p + \beta \cdot \text{noise}(p + \gamma))$$
- **Visual Styles (`warpStyle`)**:
  - `marble`: Multi-layer swirling procedural marble veins.
  - `nebula`: Cosmic interstellar clouds and deep space dust plumes.
  - `plasma`: High-frequency undulating energetic energy fields.
- **Parameters**: Warp Strength, Noise Frequency, Warping Depth (iterations), Flow Speed, Color Contrast, Specular Normal Shading, and Mouse Cursor Distortion.
- Infinite precision mathematical evaluation scaled by camera zoom and translated by camera pan.
