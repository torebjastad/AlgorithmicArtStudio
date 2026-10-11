# GPGPU Particle System

## Overview
The **GPU Cosmic Particles** engine (`js/modes/gpu-particles.js`) simulates and renders between **100 and 1,000,000+ simultaneous particles** at 60–144 FPS entirely on the GPU using WebGL2.

---

## 1. Texture Ping-Pong Simulation Architecture

Instead of CPU loops, particle states are stored in high-precision `RGBA32F` floating-point data textures of dimension $1024 \times 1024$ ($1,048,576$ texels):

| Texture Slot | Format | Channel Data |
| :--- | :--- | :--- |
| **`posLifeTex`** | `gl.RGBA32F` | `R`: Position X, `G`: Position Y, `B`: Current Age, `A`: Max Lifetime |
| **`velSeedTex`** | `gl.RGBA32F` | `R`: Previous X, `G`: Previous Y, `B`: Random Seed X, `A`: Random Seed Y |

Simulation uses a ping-pong Double-Framebuffer (FBO) technique:
- `readIdx` textures are sampled by the vertex/fragment simulation shader (`simProgram`).
- `writeIdx` FBO receives the computed new positions and states via Multiple Render Targets (`gl.drawBuffers([COLOR_ATTACHMENT0, COLOR_ATTACHMENT1])`).
- At the end of each frame, indices swap (`readIdx <-> writeIdx`).

---

## 2. Simulation Shaders (`simVsSource` / `simFsSource`)

The simulation pass renders a fullscreen quad (`simQuadVao`) into the write FBO:
- **Velocity Evaluation**:
  - Procedural noise fields are evaluated directly in GLSL:
    - `0: Curl Noise` (incompressible, divergence-free fluid swirls via central differences of 3D Simplex FBM).
    - `1: Perlin Noise` (trigonometric angle flow field).
    - `2: Simplex Noise` (smooth continuous topological flow).
    - `3: Vortex Noise` (spiral rotational flow around canvas center).
- **Interactive Mouse Forces**:
  - Distance between particle and cursor position is calculated.
  - Supports Gravity Attraction (`0`), Magnetic Repulsion (`1`), and Vortex Cyclone Swirl (`2`).
- **Smooth Inertia**:
  - Particle velocity smoothly blends with target velocity: `vel = mix(vel, targetVel, 0.15)`.

---

## 3. Spawn Origins & Lifecycle

Four distinct spawn modes are supported (`u_spawnMode`):
1. **Full Canvas (`0: random`)**: Uniform distribution across `[0, width] x [0, height]`.
2. **Perimeter Edges (`1: edges`)**: Spawns along the outer boundary (-2.5px margin), propagating inward.
3. **Center Core (`2: center`)**: Spawns in a compact radial burst at the screen center.
4. **Mouse Pointer Brush (`3: pointer`)**:
   - Spawns exclusively when the mouse is pressed and hovering over the canvas (`u_mouseSpawnActive == 1`).
   - Particles spawn randomly within a circular disk of diameter `u_mouseSpawnDiameter` centered at `u_mouse`:
     $$\theta = 2\pi \cdot \text{rnd}_x, \quad r = \sqrt{\text{rnd}_y} \cdot \frac{D}{2}$$
   - When not actively painting, dead and off-screen particles retire off-screen (`pos = (-9999, -9999)`), waiting for the next paint stroke.
   - Emission rate is calibrated via `u_mouseSpawnProb` ($R / N_{\text{particles}}$).

### Staggered & Pre-Spawn Inflow
- In `edges` and `center` modes, particles are assigned negative initial ages ($-\text{delay}$) so they trickle into the scene steadily without bursting all at once.
- The Spawning Toggle (`P` key) can pause spawning without freezing particle physics; existing particles continue their natural flight until they expire or leave bounds.

---

## 4. Anti-Aliased Ribbon Quad Rendering (`renderProgram`)

Rather than jagged 1-pixel `gl.POINTS` or `gl.LINES`:
- **Instanced Extruded Quads**: Each active particle draws an instanced quad (`gl.TRIANGLE_STRIP`, 4 vertices) stretched between its previous position (`prevPos`) and current position (`pos`).
- **Analytic Gaussian Cross-Section**:
  - Quad width is expanded by `strokeWidth` perpendicular to velocity direction (`vDir = (-dir.y, dir.x)`).
  - Fragment shader calculates cross-distance $v \in [-1, 1]$ and applies analytic Gaussian falloff:
    $$\alpha = \exp(-v^2 \cdot 2.5)$$
- **Streamline Streak Length (`streakLength`)**: Extends the trail segment backward along the motion vector to produce continuous ribbons even at high velocities.
- **Taper Modes (`taperMode`)**:
  - `both`: Tapers stroke width and alpha near the end of life.
  - `intensity`: Constant width, feathered opacity.
  - `width`: Solid opacity, razor needle width taper.
  - `none`: Crisp uniform ribbon width.

---

## 5. Motion Trails & Blending

Rendering happens in 3 sequential passes:
1. **Simulation Pass**: Updates particle positions in GPGPU FBOs.
2. **Motion Trail Decay Pass (`fadeProgram`)**:
   - If `fadeRate >= 0.35`: Canvas is cleared instantly each frame (no motion blur).
   - If `fadeRate <= 0.00001`: "Never Decay" mode — fade pass is skipped completely for permanent trail accumulation.
   - Otherwise: A fullscreen quad with color `(bg.r, bg.g, bg.b, fadeRate)` is alpha-blended over the canvas (`SRC_ALPHA, ONE_MINUS_SRC_ALPHA`), progressively erasing old trails.
3. **Ribbon Render Pass**: Draws instanced particle quads using the selected canvas blend mode (`lighter`, `source-over`, `screen`, `lighten`, `overlay`, `multiply`, `difference`).
