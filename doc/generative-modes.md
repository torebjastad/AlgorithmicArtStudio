# Generative Disciplines & Art Modes

The studio includes six distinct generative modes, accessible via keyboard shortcuts <kbd>1</kbd>–<kbd>6</kbd> or the Mode Selector dropdown.

---

## 1. GPU Cosmic Particles (`gpu_particles` / <kbd>1</kbd>)
- **Renderer**: WebGL2 hardware-accelerated GPGPU simulation.
- **Capacity**: 100 to 1,000,000+ simultaneous particles.
- **Key Features**:
  - Full Divergence-Free Curl Noise and FBM in GLSL.
  - Interactive mouse forces (attraction, repulsion, vortex cyclonic swirl).
  - Four spawn origins: Full Canvas, Perimeter Edges, Center Core, and Mouse Pointer Brush.
  - Motion trail alpha decay and selectable hardware blend modes.
  - Instanced Gaussian ribbon quads.
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

---

## 3. Domain Warping Canvas (`domain_warp` / <kbd>3</kbd>)
- **Renderer**: WebGL2 fullscreen fragment shader.
- **Key Concept**: Recursive procedural noise domain distortion:
  $$p' = p + \alpha \cdot \text{noise}(p + \beta \cdot \text{noise}(p + \gamma))$$
- **Visual Styles (`warpStyle`)**:
  - `marble`: Multi-layer swirling procedural marble veins.
  - `nebula`: Cosmic interstellar clouds and deep space dust plumes.
  - `plasma`: High-frequency undulating energetic energy fields.
- **Parameters**: Warp Strength, Noise Frequency, Warping Depth (iterations), Flow Speed, Color Contrast, and Mouse Cursor Distortion.

---

## 4. Topographic Cartography (`topographic` / <kbd>4</kbd>)
- **Renderer**: HTML5 Canvas2D vector renderer.
- **Key Concept**: Generates elevation contour maps from procedural heightfields.
- **Algorithms**:
  - 2D grid elevation sampling based on Multi-Octave Simplex Noise.
  - Iso-contour line extraction using Marching Squares line-segment interpolation.
  - Elevation color mapping via Cosine Gradient Palettes with elevation shading and gradient fills.
- **Parameters**: Contour Interval, Elevation Scale, Line Weight, Shading Style, Coastline Mask.

---

## 5. 3D Wireframe Terrain (`terrain3d` / <kbd>5</kbd>)
- **Renderer**: HTML5 Canvas2D with custom 3D software projection pipeline.
- **Key Concept**: Procedural mountain ranges, volcanic calderas, and desert dunes.
- **3D Features**:
  - Heightfield mesh generated via FBM Perlin noise with adjustable roughness and erosion simulation.
  - Interactive camera orbit controls (pitch, yaw, distance, field of view).
  - Depth sorting and wireframe hidden-line removal.
  - Directional Lambertian lighting with sun altitude and azimuth angles.

---

## 6. Harmonic Spline Ribbons (`ribbons` / <kbd>6</kbd>)
- **Renderer**: HTML5 Canvas2D spline curves.
- **Key Concept**: Sweeping harmonic ribbons undulating through higher-dimensional noise fields.
- **Features**:
  - Multi-strand spline curves traced with cubic Bezier / Catmull-Rom smoothing.
  - Harmonic frequency modulation creating ribbon moiré interference patterns.
  - Dynamic strand twisting and ribbon ribbon-width modulation along path length.
