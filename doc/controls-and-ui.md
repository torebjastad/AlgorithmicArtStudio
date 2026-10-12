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
| <kbd>H</kbd> / <kbd>Tab</kbd> | Toggle HUD | Hides/shows the HUD interface for clean fullscreen viewing |
| <kbd>F</kbd> | Toggle Fullscreen | Enters / exits browser fullscreen mode |
| <kbd>S</kbd> | Instant Snapshot | Captures high-resolution canvas snapshot |
| <kbd>0</kbd> | Reset Viewport Zoom | Restores canvas zoom level to 100% (1.0x) |
| <kbd>Wheel</kbd> / <kbd>Pinch</kbd> | Viewport Zoom | Zooms in/out smoothly between 0.5x and 5.0x |

---

## 6. Viewport Zoom & Inspection Controls

The studio provides real-time viewport zooming to hide edge discontinuities caused by initial boundary spawning or inspect fine fractal vortices:

- **Desktop Mouse Wheel**: Rolling the mouse wheel over the canvas zooms in and out continuously with smooth exponential damping ($e^{-\Delta y \cdot 0.0015}$). Wheel events over HUD controls and modals are preserved for native scrolling.
- **Mobile Pinch-to-Zoom**: Pinching two fingers expands or shrinks the viewport smoothly. Disambiguated cleanly from two-finger tap (Play/Pause).
- **HUD Zoom Indicator (`#btn-zoom-reset`)**: Displays the active zoom percentage (`100%`, `125%`, etc.) in the top stats bar. Clicking resets zoom to `100%`.
- **Mobile Drawer Indicator (`#btn-zoom-reset-mobile`)**: Compact pill in the drawer header with one-tap reset.
- **Floating Badge (`#floating-zoom-badge`)**: Appears dynamically on screen when zooming (even in Zen Mode with HUD hidden) and fades away after 1.2s. Tapping it resets zoom to `100%`.
- **Brush Alignment**: Mouse pointer brush cursor circle automatically resizes to reflect the magnified painting area, and inverse transforms guarantee particles spawn precisely under the cursor.

---

## 6. Randomization Calibration (`randomizeParameters()`)

The random dice button (<kbd>R</kbd>) avoids chaotic unusable parameter combinations by utilizing calibrated aesthetic distributions:
- **Particle Velocity**: Biased heavily toward pleasant speeds ($0.08$–$0.45$), rarely selecting above $1.0$.
- **Noise Scales**: Scaled to harmonic sweet spots for the active mode.
- **Color Palettes**: Randomly selects from the curated cosine gradient palette collection.

---

## 7. Mobile & Tablet UI Adaptations

### Bottom Sheet Architecture (`<= 768px`)
- **Three Interaction States**:
  1. **Zen Mode (100% Canvas)**: Fullscreen contemplation. Floating mini-trigger button (`#btn-reveal-hud`) allows one-tap restoration.
  2. **Peek / Quick Bar**: Clean top bar with essential controls (Mode badge, Play/Pause, Randomize, Export, Settings).
  3. **Expanded Bottom Sheet**: Max 80vh height bottom sheet with grab handle (`#sheet-grab-bar`) and close button (`#btn-close-drawer`). Dragging or swiping down collapses the sheet.
- **Landscape Adaptation (`<= 520px` height)**: Automatically switches from a bottom sheet to a right slide-over panel (300px), preserving 70% of canvas width.
- **Touch Gestures (Replacing Desktop Shortcuts)**:
  - **Double-Tap Canvas**: Toggles HUD (Zen Mode) without keyboard.
  - **Two-Finger Tap**: Toggles Play / Pause.
  - **Touch / Pencil Drag**: Paints particles in pointer mode or exerts physics forces.
- **Ergonomics**: All buttons, selects, and checkboxes have a minimum hit area of `44px × 44px`. Slider thumbs expand to `24px` for coarse touch inputs.

