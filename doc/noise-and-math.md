# Procedural Noise & Mathematical Foundations

## Overview
Procedural mathematical functions form the backbone of all movement, terrain generation, and color synthesis across the Algorithmic Art Studio.

---

## 1. Divergence-Free Curl Noise (`js/noise/curl.js`)

Standard gradient noise fields often exhibit sinks and sources where particle flow collapses or clumps into unnatural pinch points. **Curl noise** guarantees volume preservation (incompressibility) by taking the mathematical curl of a procedural vector potential $\psi$:

$$\mathbf{v}(x, y) = \nabla \times \psi = \left( \frac{\partial \psi}{\partial y}, -\frac{\partial \psi}{\partial x} \right)$$

Because the divergence of any curl is identically zero ($\nabla \cdot (\nabla \times \psi) \equiv 0$), particles flowing under curl noise never clump, overlap unnaturally, or create artificial focal sinks.

### Implementation:
- **CPU (`curl.js`)**: Evaluated via central finite differences over 3D Simplex FBM:
  $$\frac{\partial \psi}{\partial x} \approx \frac{\psi(x + \epsilon, y, z) - \psi(x - \epsilon, y, z)}{2\epsilon}$$
- **GPU (`gpu-particles.js`)**: Evaluated inside the simulation vertex shader directly in GLSL for 1M+ particles in real time.

---

## 2. Fractional Brownian Motion (FBM) & Octaves

Multi-scale organic complexity is synthesized by summing successive octaves of noise with increasing frequencies and decreasing amplitudes:

$$\text{FBM}(p) = \sum_{i=0}^{N-1} A \cdot \text{persistence}^i \cdot \text{noise}\left(p \cdot \text{lacunarity}^i\right)$$

- **Octaves (`octaves`)**: Number of noise layers (typically 2 to 5).
- **Persistence (`persistence`)**: Amplitude reduction per octave (typically 0.45 to 0.55).
- **Lacunarity (`lacunarity`)**: Frequency multiplier per octave (typically 2.0).

---

## 3. Cosine Gradient Palettes (`js/core/color-palette.js`)

Color gradients are computed via Inigo Quilez's cosine parametric palette formula:

$$\mathbf{c}(t) = \mathbf{a} + \mathbf{b} \cdot \cos\left(2\pi (\mathbf{c} \cdot t + \mathbf{d})\right)$$

Where:
- $\mathbf{a} \in [0, 1]^3$: Base DC offset (brightness).
- $\mathbf{b} \in [0, 1]^3$: Amplitude oscillation range.
- $\mathbf{c} \in \mathbb{R}^3$: Frequency of color cycling.
- $\mathbf{d} \in [0, 1]^3$: Phase shift per RGB channel.

### Advantages:
1. **Zero Texture Memory**: Computable with a single trigonometric evaluation on CPU and GPU.
2. **Periodic & Smooth**: Perfectly continuous color cycling without seams or banding.
3. **Curated Presets**: Includes Cyberpunk Neon, Electric Twilight, Golden Amber, Deep Ocean Abyss, Acid Emerald, Pastel Dream, Infrared Magma, and Solarized Monochrome.

---

## 4. Anti-Aliased Ribbon Geometry Mathematics

To render fluid streamlines of variable width without pixelation:
1. Two consecutive particle positions are fetched: $\mathbf{p}_0$ (previous) and $\mathbf{p}_1$ (current).
2. Segment direction is normalized:
   $$\mathbf{u} = \frac{\mathbf{p}_1 - \mathbf{p}_0}{\|\mathbf{p}_1 - \mathbf{p}_0\|}$$
3. Normal orthogonal vector is computed:
   $$\mathbf{v} = (-u_y, u_x)$$
4. A 4-vertex quad (`TRIANGLE_STRIP`) is extruded:
   $$\mathbf{v}_{\text{quad}} = \mathbf{p} \pm \mathbf{v} \cdot \frac{\text{width}}{2}$$
5. An analytic Gaussian curve renders the cross-section:
   $$\alpha(d) = \exp(-d^2 \cdot 2.5)$$
   yielding smooth, bloom-like luminous strokes.
