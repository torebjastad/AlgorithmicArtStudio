/**
 * Master Application Coordinator & Render Loop
 * Manages canvas lifecycle, mode switching, mouse tracking, and 60+ FPS animation loop.
 */

class PerlinArtApp {
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

    // Mouse & Touch Tracking
    this.mouse = {
      x: this.width / 2,
      y: this.height / 2,
      prevX: this.width / 2,
      prevY: this.height / 2,
      isDown: false,
      isHovering: false
    };

    // Modes Registry
    this.modes = {
      flow: new FlowFieldMode(this),
      domain_warp: new DomainWarpMode(this),
      topographic: new TopographicMode(this),
      terrain3d: new Terrain3DMode(this),
      ribbons: new RibbonsMode(this)
    };

    this.currentModeKey = 'flow';
    this.currentMode = this.modes.flow;

    // Animation Loop State
    this.isRunning = true;
    this.time = 0;
    this.lastFrameTime = performance.now();
    this.fps = 60;
    this.frameCount = 0;
    this.fpsTimer = performance.now();

    this.initEvents();
    this.controls = new ControlsManager(this);
    this.switchMode('flow');

    // Start Master Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  get activeCanvas() {
    return this.currentModeKey === 'domain_warp' ? this.canvasGL : this.canvas2D;
  }

  switchMode(modeKey) {
    if (!this.modes[modeKey]) return;

    this.currentModeKey = modeKey;
    this.currentMode = this.modes[modeKey];

    // Toggle canvas visibility based on mode engine
    if (modeKey === 'domain_warp') {
      this.canvasGL.style.display = 'block';
      this.canvas2D.style.display = 'none';
    } else {
      this.canvasGL.style.display = 'none';
      this.canvas2D.style.display = 'block';
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

  initEvents() {
    window.addEventListener('resize', () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.renderer2D.resize(this.width, this.height);
      this.webgl.resize(this.width, this.height);
      this.resetCurrentMode();
    });

    // Mouse & Touch Tracking
    const updatePointer = (x, y) => {
      this.mouse.prevX = this.mouse.x;
      this.mouse.prevY = this.mouse.y;
      this.mouse.x = x;
      this.mouse.y = y;
    };

    window.addEventListener('mousemove', (e) => {
      updatePointer(e.clientX, e.clientY);
      this.mouse.isHovering = true;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.target.closest('#hud') || e.target.closest('.modal')) return;
      this.mouse.isDown = true;
      updatePointer(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      this.mouse.isDown = false;
    });

    window.addEventListener('mouseleave', () => {
      this.mouse.isHovering = false;
      this.mouse.isDown = false;
    });

    // Touch events
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        if (e.touches[0].target.closest('#hud') || e.touches[0].target.closest('.modal')) return;
        this.mouse.isDown = true;
        updatePointer(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        updatePointer(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.mouse.isDown = false;
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

      if (this.controls && this.controls.ui.fpsCounter) {
        this.controls.ui.fpsCounter.textContent = this.fps;
      }
    }

    // Update Particle count stats
    if (this.controls && this.controls.ui.particleCounter) {
      if (this.currentModeKey === 'flow') {
        this.controls.ui.particleCounter.textContent = this.currentMode.params.particleCount.toLocaleString();
      } else {
        this.controls.ui.particleCounter.textContent = 'N/A';
      }
    }

    // Update & Render Current Mode
    if (this.currentMode) {
      this.currentMode.update(dt, this.time);
      if (this.currentModeKey === 'domain_warp') {
        this.currentMode.render(this.webgl);
      } else {
        this.currentMode.render(this.renderer2D);
      }
    }
  }
}

// Bootstrap once DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new PerlinArtApp();
});
