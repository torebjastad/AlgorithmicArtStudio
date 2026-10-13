/**
 * Master Application Coordinator & Render Loop
 * Manages canvas lifecycle, mode switching, mouse tracking, and 60+ FPS animation loop.
 */

class AlgorithmicArtStudio {
  constructor() {
    this.canvas2D = document.getElementById('canvas-2d');
    this.canvasGL = document.getElementById('canvas-gl');

    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Noise Engines
    this.perlin = new PerlinNoise();
    this.simplex = new SimplexNoise();
    this.curl = new CurlNoise(this.perlin);

    // Color Palette Studio
    this.palette = new ColorPaletteManager();

    // Render Engines
    this.renderer2D = new CanvasRenderer(this.canvas2D);
    this.webgl = new WebGLRenderer(this.canvasGL);

    // Exporter
    this.exporter = new Exporter(this);

    // Viewport Zoom State (0.5x to 5.0x)
    this.zoom = 1.0;
    this.zoomNotificationTimer = null;

    // Mouse & Touch Tracking
    this.mouse = {
      x: this.width / 2,
      y: this.height / 2,
      screenX: this.width / 2,
      screenY: this.height / 2,
      prevX: this.width / 2,
      prevY: this.height / 2,
      isDown: false,
      isHovering: false
    };

    // Modes Registry
    this.modes = {
      gpu_particles: new GPUParticlesMode(this),
      flow: new FlowFieldMode(this),
      domain_warp: new DomainWarpMode(this),
      topographic: new TopographicMode(this),
      terrain3d: new Terrain3DMode(this),
      ribbons: new RibbonsMode(this)
    };

    this.currentModeKey = 'gpu_particles';
    this.currentMode = this.modes.gpu_particles;

    // Animation Loop State
    this.isRunning = true;
    this.time = 0;
    this.lastFrameTime = performance.now();
    this.fps = 60;
    this.frameCount = 0;
    this.fpsTimer = performance.now();

    this.initEvents();
    this.controls = new ControlsManager(this);
    this.switchMode('gpu_particles');

    // Start Master Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  get activeCanvas() {
    return (this.currentModeKey === 'domain_warp' || this.currentModeKey === 'gpu_particles') ? this.canvasGL : this.canvas2D;
  }

  switchMode(modeKey) {
    if (!this.modes[modeKey]) return;

    this.currentModeKey = modeKey;
    this.currentMode = this.modes[modeKey];

    // Toggle canvas visibility based on mode engine
    if (modeKey === 'domain_warp' || modeKey === 'gpu_particles') {
      this.canvasGL.style.display = 'block';
      this.canvas2D.style.display = 'none';
      if (this.webgl) {
        this.webgl.resize(this.width, this.height);
      }
    } else {
      this.canvasGL.style.display = 'none';
      this.canvas2D.style.display = 'block';
      if (this.renderer2D) {
        this.renderer2D.resize(this.width, this.height);
      }
    }

    this.resetCurrentMode();
    if (this.controls) {
      this.controls.syncControlsWithMode();
    }
  }

  resetCurrentMode() {
    this.renderer2D.clear(this.palette.customBg);
    if (this.currentMode && typeof this.currentMode.resetAllParticles === 'function') {
      this.currentMode.resetAllParticles();
    }
  }

  setZoom(zoomLevel) {
    const clamped = Math.max(0.5, Math.min(5.0, zoomLevel));
    const prevZoom = this.zoom;
    this.zoom = Math.round(clamped * 100) / 100;

    // Keep canvas container 1:1 with screen pixels for full native resolution (no bitmap stretching)
    const container = document.getElementById('canvas-container');
    if (container && container.style.transform) {
      container.style.transform = '';
    }

    // In Never Decay mode (infinite trail persistence), clear canvas on zoom change
    // so the new camera crop accumulates cleanly without old unzoomed artifacts
    if (prevZoom !== this.zoom && this.currentMode?.params?.fadeRate <= 0.00001) {
      this.resetCurrentMode();
    }

    const percentText = `${Math.round(this.zoom * 100)}%`;
    const valZoom = document.getElementById('val-zoom');
    if (valZoom) valZoom.textContent = percentText;
    const valZoomMobile = document.getElementById('val-zoom-mobile');
    if (valZoomMobile) valZoomMobile.textContent = percentText;
    const valZoomFloating = document.getElementById('val-zoom-floating');
    if (valZoomFloating) valZoomFloating.textContent = percentText;

    this.showZoomNotification();

    if (this.updateBrushCursor) {
      this.updateBrushCursor();
    }
  }

  showZoomNotification() {
    const badge = document.getElementById('floating-zoom-badge');
    if (!badge) return;
    badge.classList.add('active');
    clearTimeout(this.zoomNotificationTimer);
    this.zoomNotificationTimer = setTimeout(() => {
      badge.classList.remove('active');
    }, 1200);
  }

  initEvents() {
    window.addEventListener('resize', () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.renderer2D.resize(this.width, this.height);
      this.webgl.resize(this.width, this.height);
      this.resetCurrentMode();
    });

    // Mouse & Touch Tracking with Zoom Transformation
    const updatePointer = (screenX, screenY) => {
      this.mouse.prevX = this.mouse.x;
      this.mouse.prevY = this.mouse.y;
      this.mouse.screenX = screenX;
      this.mouse.screenY = screenY;
      const z = this.zoom || 1.0;
      const cx = this.width / 2;
      const cy = this.height / 2;
      // Inverse zoom transformation from screen center
      this.mouse.x = cx + (screenX - cx) / z;
      this.mouse.y = cy + (screenY - cy) / z;
    };

    const brushCursor = document.getElementById('mouse-brush-cursor');
    const updateBrushCursor = () => {
      if (!brushCursor) return;
      const mode = this.currentMode;
      const isPointerMode = mode?.params?.spawnMode === 'pointer';
      if (isPointerMode && (this.mouse.isHovering || this.mouse.isDown)) {
        const diam = mode.params.mouseSpawnDiameter || 80;
        const screenDiam = diam * (this.zoom || 1.0);
        const sx = this.mouse.screenX !== undefined ? this.mouse.screenX : this.mouse.x;
        const sy = this.mouse.screenY !== undefined ? this.mouse.screenY : this.mouse.y;
        brushCursor.style.display = 'block';
        brushCursor.style.left = `${sx}px`;
        brushCursor.style.top = `${sy}px`;
        brushCursor.style.width = `${screenDiam}px`;
        brushCursor.style.height = `${screenDiam}px`;
        brushCursor.style.borderColor = this.mouse.isDown ? 'rgba(0, 255, 180, 0.9)' : 'rgba(0, 240, 255, 0.75)';
        brushCursor.style.boxShadow = this.mouse.isDown ? '0 0 16px rgba(0, 255, 180, 0.5)' : '0 0 10px rgba(0, 240, 255, 0.25)';
      } else {
        brushCursor.style.display = 'none';
      }
    };
    this.updateBrushCursor = updateBrushCursor;

    window.addEventListener('mousemove', (e) => {
      updatePointer(e.clientX, e.clientY);
      this.mouse.isHovering = true;
      updateBrushCursor();
    });

    window.addEventListener('mousedown', (e) => {
      if (e.target.closest('#hud') || e.target.closest('.modal')) return;
      this.mouse.isDown = true;
      updatePointer(e.clientX, e.clientY);
      updateBrushCursor();
    });

    window.addEventListener('mouseup', () => {
      this.mouse.isDown = false;
      updateBrushCursor();
    });

    window.addEventListener('mouseleave', () => {
      this.mouse.isHovering = false;
      this.mouse.isDown = false;
      updateBrushCursor();
    });

    // Mouse Wheel Zoom (Clamped 0.5x to 5.0x)
    window.addEventListener('wheel', (e) => {
      if (e.target.closest('#control-drawer') || e.target.closest('.modal-card') || e.target.closest('.top-bar') || e.target.closest('.modal')) {
        return;
      }
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      this.setZoom(this.zoom * factor);
    }, { passive: false });

    // Touch Gestures: Multi-Touch, Pinch-to-Zoom, Double-Tap & Painting
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;
    let twoFingerStart = 0;
    let isTouchActiveOnCanvas = false;
    let initialPinchDist = 0;
    let initialPinchZoom = 1.0;
    let isPinching = false;

    window.addEventListener('touchstart', (e) => {
      if (e.target.closest('#hud') || e.target.closest('.modal')) {
        isTouchActiveOnCanvas = false;
        return;
      }

      isTouchActiveOnCanvas = true;
      if (e.cancelable) {
        e.preventDefault(); // Prevents iOS magnifying glass, text callouts, and premature touchcancel
      }

      // Two-finger gesture start (Pinch-to-Zoom or Two-Finger Tap)
      if (e.touches.length === 2) {
        twoFingerStart = performance.now();
        initialPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialPinchZoom = this.zoom;
        isPinching = false;
        this.mouse.isDown = false;
        this.mouse.isHovering = false;
        updateBrushCursor();
        return;
      }

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const now = performance.now();
        const dist = Math.hypot(touch.clientX - lastTapX, touch.clientY - lastTapY);
        const isPointerMode = this.currentMode?.params?.spawnMode === 'pointer';

        // Double-tap on canvas (<320ms and within 35px) toggles Zen Mode ONLY when NOT in pointer painting mode!
        // In pointer mode, every tap/dab is an intentional paint stroke.
        if (!isPointerMode && now - lastTapTime < 320 && dist < 35) {
          if (this.controls) {
            this.controls.toggleHUD();
          }
          lastTapTime = 0;
          this.mouse.isDown = false;
          this.mouse.isHovering = false;
          updateBrushCursor();
          return;
        }

        lastTapTime = now;
        lastTapX = touch.clientX;
        lastTapY = touch.clientY;

        this.mouse.isDown = true;
        this.mouse.isHovering = true;
        updatePointer(touch.clientX, touch.clientY);
        updateBrushCursor();
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!isTouchActiveOnCanvas) return;
      if (e.cancelable) {
        e.preventDefault(); // Prevents mobile browser scrolling or gesture hijacking while painting/zooming
      }

      // Pinch-to-zoom with 2 fingers
      if (e.touches.length === 2 && initialPinchDist > 0) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (!isPinching && Math.abs(currentDist - initialPinchDist) > 10) {
          isPinching = true;
        }
        if (isPinching) {
          const ratio = currentDist / initialPinchDist;
          this.setZoom(initialPinchZoom * ratio);
        }
        return;
      }

      if (e.touches.length === 1 && !isPinching) {
        const touch = e.touches[0];
        this.mouse.isDown = true;
        this.mouse.isHovering = true;
        updatePointer(touch.clientX, touch.clientY);
        updateBrushCursor();
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      if (isTouchActiveOnCanvas && e.cancelable) {
        e.preventDefault();
      }

      // Check if two-finger tap just completed (<350ms) without pinching
      if (twoFingerStart > 0 && e.touches.length === 0) {
        const duration = performance.now() - twoFingerStart;
        const wasPinch = isPinching;
        twoFingerStart = 0;
        initialPinchDist = 0;
        isPinching = false;
        if (!wasPinch && duration < 350 && this.controls) {
          this.controls.togglePlayPause();
          this.mouse.isDown = false;
          this.mouse.isHovering = false;
          updateBrushCursor();
          return;
        }
      }

      if (e.touches.length === 0) {
        this.mouse.isDown = false;
        this.mouse.isHovering = false;
        isTouchActiveOnCanvas = false;
        isPinching = false;
        initialPinchDist = 0;
        updateBrushCursor();
      } else if (e.touches.length === 1) {
        if (isPinching) {
          isPinching = false;
          initialPinchDist = 0;
          this.mouse.isDown = false;
          this.mouse.isHovering = false;
          updateBrushCursor();
          return;
        }
        const touch = e.touches[0];
        this.mouse.isDown = true;
        this.mouse.isHovering = true;
        updatePointer(touch.clientX, touch.clientY);
        updateBrushCursor();
      }
    }, { passive: false });

    window.addEventListener('touchcancel', () => {
      this.mouse.isDown = false;
      this.mouse.isHovering = false;
      isTouchActiveOnCanvas = false;
      twoFingerStart = 0;
      isPinching = false;
      initialPinchDist = 0;
      updateBrushCursor();
    });
  }

  animate(now) {
    requestAnimationFrame(this.animate);

    if (!this.isRunning) return;

    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;
    this.time += dt * 60; // normalized frame units

    // FPS Meter
    this.frameCount++;
    if (now - this.fpsTimer >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = now;

      if (this.controls) {
        if (this.controls.ui.fpsCounter) this.controls.ui.fpsCounter.textContent = this.fps;
        if (this.controls.ui.fpsCounterMobile) this.controls.ui.fpsCounterMobile.textContent = this.fps;
      }
    }

    // Update Particle count stats
    if (this.controls) {
      const isParticleMode = this.currentModeKey === 'flow' || this.currentModeKey === 'gpu_particles';
      const count = isParticleMode ? (this.currentMode?.params?.particleCount || 0) : 0;
      const formatted = isParticleMode ? count.toLocaleString() : 'N/A';
      const formattedMobile = isParticleMode ? (count >= 1000 ? `${Math.round(count / 1000)}K` : count) : 'N/A';

      if (this.controls.ui.particleCounter) this.controls.ui.particleCounter.textContent = formatted;
      if (this.controls.ui.particleCounterMobile) this.controls.ui.particleCounterMobile.textContent = formattedMobile;
    }

    // Update & Render Current Mode
    if (this.currentMode) {
      this.currentMode.update(dt, this.time);
      if (this.currentModeKey === 'domain_warp' || this.currentModeKey === 'gpu_particles') {
        this.currentMode.render(this.webgl);
      } else {
        this.currentMode.render(this.renderer2D);
      }
    }
  }
}

window.AlgorithmicArtStudio = AlgorithmicArtStudio;
window.PerlinArtApp = AlgorithmicArtStudio;

// Bootstrap once DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new AlgorithmicArtStudio();
});
