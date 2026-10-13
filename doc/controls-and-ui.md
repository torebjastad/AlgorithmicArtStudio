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
| <kbd>0</kbd> | Reset Viewport Zoom & Pan | Restores canvas camera position to center and zoom to 100% (1.0x) |
| <kbd>Wheel</kbd> / <kbd>Pinch</kbd> | Focal Viewport Zoom | Zooms in/out anchored at mouse cursor or pinch midpoint (0.5x to 5.0x) |
| <kbd>Middle Drag</kbd> / <kbd>Two-Finger Drag</kbd> | Camera Pan | Smoothly pans the camera across the generative world space |

---

## 6. Viewport Zoom, Focal Anchoring & Camera Panning

The studio provides real-time **native camera zoom and panning** to explore intricate fractal details and hide boundary discontinuities **without losing resolution**:

- **Native Resolution Rasterization**: Instead of scaling the rendered canvas bitmap via CSS (which causes pixel blur and fat strokes), zoom and pan adjust the camera projection directly in shaders and renderers. The canvas remains 1:1 with device pixels, keeping anti-aliasing razor-sharp and line widths delicate.
- **Focal Cursor Zoom**: Rolling the mouse wheel zooms towards the exact cursor position `(e.clientX, e.clientY)`. The world coordinates directly under the cursor remain perfectly stationary during zoom.
- **Middle Mouse Button Pan**: Holding down the middle mouse button and dragging moves the camera smoothly across the artwork, with direct 1:1 manipulation at any zoom level.
- **Mobile Multi-Touch (Two-Finger Pan & Pinch)**: Pinching with two fingers zooms towards the touch midpoint, while dragging with two fingers smoothly pans the view. Both gestures work simultaneously and naturally.
- **Gesture Disambiguation**: Two-finger tap (<350ms without drag or pinch) toggles Play/Pause cleanly.
- **HUD & Mobile Reset Indicators (`#btn-zoom-reset`, `#btn-zoom-reset-mobile`, `#floating-zoom-badge`)**: Displays active zoom percentage. Clicking any indicator or pressing <kbd>0</kbd> instantly resets both camera pan and zoom back to 100% center view.
- **Brush Alignment**: Mouse pointer brush cursor circle automatically resizes to reflect the magnified painting area, and inverse camera projection guarantees particles spawn precisely under the cursor or finger regardless of pan offset or zoom level.

---

## 7. Randomization Calibration (`randomizeParameters()`)

The random dice button (<kbd>R</kbd>) avoids chaotic unusable parameter combinations by utilizing calibrated aesthetic distributions:
- **Particle Velocity**: Biased heavily toward pleasant speeds ($0.08$–$0.45$), rarely selecting above $1.0$.
- **Noise Scales**: Scaled to harmonic sweet spots for the active mode.
- **Color Palettes**: Randomly selects from the curated cosine gradient palette collection.

---

## 8. Mobile & Tablet UI Adaptations

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

