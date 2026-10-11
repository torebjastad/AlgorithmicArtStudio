# Controls, HUD & User Interface Architecture

## Overview
The user interface (`index.html`, `css/style.css`, `js/ui/controls.js`) provides an unobtrusive glassmorphism Heads-Up Display (HUD) with three tabbed sections, fine-grained slider inputs, badges, and real-time state synchronization.

---

## 1. HUD Navigation Tabs

The HUD is partitioned into three functional tabs:
1. **Field & Noise (`#tab-noise`)**: Noise type, frequency scale, octave count, persistence, lacunarity, flow velocity, and palette selection.
2. **Dynamics & Particles (`#tab-dynamics`)**: Particle count, velocity, size, shape profile, canvas blend modes, trail decay rate, mouse forces, spawn modes, and mouse painting brush controls.
3. **Strokes, Shading & 3D (`#tab-strokes`)**: Mode-specific rendering controls (streamline streak length, glow alpha, warp depth, contour intervals, 3D terrain pitch/yaw/lighting).

---

## 2. Dynamic Slider Mapping Engine (`controls.js`)

Sliders in the studio use mathematical mappings to provide fine control across vast dynamic ranges:

### Logarithmic Sliders (`data-scale="log"`)
Standard sliders allocate 90% of their physical width to values you rarely use. The studio employs exponential/logarithmic mappings for scale-sensitive parameters:
```javascript
valueFromInput(input) {
  const min = parseFloat(input.dataset.min);
  const max = parseFloat(input.dataset.max);
  const u = (rawVal - sliderMin) / (sliderMax - sliderMin); // 0.0 to 1.0
  return min * Math.pow(max / min, u);
}
```
**Applied to**:
- Particle Count (100 to 1,000,000)
- Particle Velocity (0.05 to 15.0)
- Noise Scale (0.0001 to 0.02)
- Trail Decay Rate (0.0001 to 0.40)

### Special Mode Mappings
- **Trail Decay Rate (`fadeRate`)**: Position `0` maps specifically to `0.00` (*Never Decay / infinite trail accumulation*), while `1` to `1000` maps logarithmically from `0.0001` to `0.40`.

---

## 3. Conditional Visibility System

Control groups are selectively shown or hidden depending on the active mode and settings:
- **`data-show-for-mode="..."`**: Comma-separated list of mode keys (e.g. `gpu_particles,flow`). The `ControlsManager` toggles `display: block / none` automatically upon mode switch.
- **`data-show-for-spawn-mode="..."`**: Specifically toggles controls relevant to the selected spawn mode (e.g. `pointer` reveals the Mouse Brush Diameter and Emission Rate sliders).

---

## 4. Mouse Pointer Brush Painting Mode

When `spawnMode` is set to `pointer`:
1. The standard spawn loops cease auto-spawning across the canvas; particles wait parked off-screen.
2. Two dedicated sliders appear:
   - **`mouseSpawnDiameter`**: Circle diameter in pixels (10px to 400px, default 80px).
   - **`mouseSpawnRate`**: Number of particles emitted per frame while dragging.
3. An interactive dashed circle indicator (`#mouse-brush-cursor`) tracks the mouse pointer across the canvas, resizing in real time as the diameter slider moves, and glowing emerald green upon mouse press.

---

## 5. Keyboard Shortcuts Reference

| Shortcut | Description | Action |
| :--- | :--- | :--- |
| <kbd>Space</kbd> | Pause / Resume | Freezes the animation loop without clearing graphics |
| <kbd>P</kbd> | Toggle Particle Spawning | Pauses new particle emission; lets active particles fly out |
| <kbd>C</kbd> | Clear Canvas | Re-seeds particles and clears the screen |
| <kbd>R</kbd> | Randomize | Rolls calibrated random parameters and palette |
| <kbd>H</kbd> | Toggle HUD | Hides/shows the HUD interface for clean fullscreen viewing |
| <kbd>1</kbd>–<kbd>6</kbd> | Mode Switching | Instantly transitions between the 6 generative modes |
| <kbd>E</kbd> | Instant Snapshot | Captures high-resolution canvas snapshot |
| <kbd>S</kbd> | Export Modal | Opens modal with resolution options up to 8K & SVG |

---

## 6. Randomization Calibration (`randomizeParameters()`)

The random dice button (<kbd>R</kbd>) avoids chaotic unusable parameter combinations by utilizing calibrated aesthetic distributions:
- **Particle Velocity**: Biased heavily toward pleasant speeds ($0.08$–$0.45$), rarely selecting above $1.0$.
- **Noise Scales**: Scaled to harmonic sweet spots for the active mode.
- **Color Palettes**: Randomly selects from the curated cosine gradient palette collection.
