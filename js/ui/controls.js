/**
 * Interactive Control Panel & HUD Manager
 * Synchronizes DOM controls with active generative mode parameters,
 * handles preset loading, palette switching, custom color stops, and export actions.
 */

class ControlsManager {
  constructor(app) {
    this.app = app;
    this.activeTab = 'tab-mode';
    this.initUI();
    this.bindEvents();
    this.buildPaletteGrid();
  }

  initUI() {
    this.ui = {
      hud: document.getElementById('hud'),
      drawer: document.getElementById('control-drawer'),
      drawerToggle: document.getElementById('btn-toggle-drawer'),
      fullscreenBtn: document.getElementById('btn-fullscreen'),
      randomizeBtn: document.getElementById('btn-randomize'),
      playPauseBtn: document.getElementById('btn-play-pause'),
      clearBtn: document.getElementById('btn-clear'),
      exportModalBtn: document.getElementById('btn-open-export'),
      infoModalBtn: document.getElementById('btn-open-info'),
      
      modeSelect: document.getElementById('select-mode'),
      paletteGrid: document.getElementById('palette-grid'),
      
      fpsCounter: document.getElementById('val-fps'),
      particleCounter: document.getElementById('val-particle-count'),
      modeBadge: document.getElementById('val-mode-badge'),
      
      exportModal: document.getElementById('modal-export'),
      infoModal: document.getElementById('modal-info'),
      closeModalBtns: document.querySelectorAll('.btn-close-modal'),
      
      btnExportImage: document.getElementById('btn-export-image'),
      btnExportSVG: document.getElementById('btn-export-svg'),
      btnRecordVideo: document.getElementById('btn-record-video'),
      exportProgress: document.getElementById('export-progress-bar'),
      exportProgressContainer: document.getElementById('export-progress-container'),

      btnRevealHUD: document.getElementById('btn-reveal-hud'),
      hudToast: document.getElementById('hud-toast')
    };
  }

  bindEvents() {
    // Reveal HUD button
    if (this.ui.btnRevealHUD) {
      this.ui.btnRevealHUD.addEventListener('click', () => this.toggleHUD());
    }

    // Drawer Toggle
    if (this.ui.drawerToggle) {
      this.ui.drawerToggle.addEventListener('click', () => {
        this.ui.drawer.classList.toggle('collapsed');
      });
    }

    // Fullscreen Toggle
    if (this.ui.fullscreenBtn) {
      this.ui.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    }

    // Play / Pause Toggle
    if (this.ui.playPauseBtn) {
      this.ui.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    }

    // Clear / Reset Canvas
    if (this.ui.clearBtn) {
      this.ui.clearBtn.addEventListener('click', () => this.app.resetCurrentMode());
    }

    // Smart Randomize
    if (this.ui.randomizeBtn) {
      this.ui.randomizeBtn.addEventListener('click', () => this.randomizeParameters());
    }

    // Mode Selector
    if (this.ui.modeSelect) {
      this.ui.modeSelect.addEventListener('change', (e) => {
        this.app.switchMode(e.target.value);
        this.syncControlsWithMode();
      });
    }

    // Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = e.currentTarget.dataset.tab;
        this.switchTab(targetTab);
      });
    });

    // Modals
    if (this.ui.exportModalBtn) {
      this.ui.exportModalBtn.addEventListener('click', () => {
        this.ui.exportModal.classList.add('active');
      });
    }

    if (this.ui.infoModalBtn) {
      this.ui.infoModalBtn.addEventListener('click', () => {
        this.ui.infoModal.classList.add('active');
        if (window.renderMathInElement) {
          window.renderMathInElement(this.ui.infoModal);
        }
      });
    }

    this.ui.closeModalBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.ui.exportModal.classList.remove('active');
        this.ui.infoModal.classList.remove('active');
      });
    });

    // High-Res Export Buttons
    if (this.ui.btnExportImage) {
      this.ui.btnExportImage.addEventListener('click', () => this.handleExportImage());
    }

    if (this.ui.btnExportSVG) {
      this.ui.btnExportSVG.addEventListener('click', () => {
        this.app.exporter.exportSVG();
      });
    }

    if (this.ui.btnRecordVideo) {
      this.ui.btnRecordVideo.addEventListener('click', () => this.handleRecordVideo());
    }

    // Particle Spawning Toggle Button
    const btnToggleSpawn = document.getElementById('btn-toggle-spawn');
    if (btnToggleSpawn) {
      btnToggleSpawn.addEventListener('click', () => this.toggleSpawning());
    }

    // Sliders & Checkbox Auto-Binding
    this.bindDynamicInputs();

    // Global Keyboard Shortcuts (Active across all UI elements, sliders, selects, and buttons)
    const isTextEditing = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      const type = (el.type || '').toLowerCase();
      return (
        (tag === 'INPUT' && (type === 'text' || type === 'number' || type === 'password' || type === 'search' || type === 'email')) ||
        tag === 'TEXTAREA' ||
        el.isContentEditable
      );
    };

    window.addEventListener('keydown', (e) => {
      const editing = isTextEditing(e.target);

      // Escape always works to close modals or unblur active inputs
      if (e.key === 'Escape') {
        if (editing && e.target && typeof e.target.blur === 'function') {
          e.target.blur();
        }
        this.ui.exportModal.classList.remove('active');
        this.ui.infoModal.classList.remove('active');
        if (this.ui.hud && this.ui.hud.classList.contains('hidden')) {
          this.toggleHUD();
        }
        return;
      }

      // If user is actively typing in a text/numeric input box, let them type
      if (editing) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (e.target && typeof e.target.blur === 'function') {
          e.target.blur();
        }
        this.togglePlayPause();
      } else if (e.key === 'Tab' || e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        if (e.target && typeof e.target.blur === 'function') {
          e.target.blur();
        }
        this.toggleHUD();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.toggleFullscreen();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        this.randomizeParameters();
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        this.toggleSpawning();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        const mode = this.app.currentMode;
        if (mode && mode.params && mode.params.spawnEnabled === false) {
          mode.params.spawnEnabled = true;
          this.updateSpawnUI(true);
        }
        this.app.resetCurrentMode();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.app.exporter.exportImage({ width: 1920, height: 1080 });
      }
    });
  }

  valueFromInput(input) {
    if (input.type === 'checkbox') {
      return input.checked;
    }
    if (input.tagName === 'SELECT' || input.type === 'text') {
      return input.value;
    }
    const rawVal = parseFloat(input.value);
    if (Number.isNaN(rawVal)) {
      return input.value;
    }

    // Special logarithmic mapping for Trail Decay Rate (fadeRate)
    // Allows 0.00 (Never Decay) at 0, and fine steps between 0.001 and 0.40
    if (input.dataset.param === 'fadeRate') {
      if (rawVal <= 0) return 0.0;
      const min = 0.001;
      const max = 0.40;
      const u = (rawVal - 1) / 999;
      let val = min * Math.pow(max / min, Math.max(0, Math.min(1, u)));
      if (val < 0.01) {
        val = Math.round(val * 1000) / 1000;
      } else if (val < 0.1) {
        val = Math.round(val * 1000) / 1000;
      } else {
        val = Math.round(val * 100) / 100;
      }
      return val;
    }

    if (input.dataset.scale === 'log') {
      const min = parseFloat(input.dataset.min || 0.05);
      const max = parseFloat(input.dataset.max || 15.0);
      const sliderMin = parseFloat(input.min || 0);
      const sliderMax = parseFloat(input.max || 1000);
      const u = (rawVal - sliderMin) / (sliderMax - sliderMin);
      let val = min * Math.pow(max / min, Math.max(0, Math.min(1, u)));

      if (input.dataset.param === 'particleCount') {
        if (val < 1000) val = Math.round(val / 10) * 10;
        else if (val < 10000) val = Math.round(val / 50) * 50;
        else if (val < 100000) val = Math.round(val / 500) * 500;
        else val = Math.round(val / 5000) * 5000;
        val = Math.max(min, Math.min(max, val));
      }
      return val;
    }
    return rawVal;
  }

  inputFromValue(input, val) {
    if (input.type === 'checkbox') {
      input.checked = !!val;
      return;
    }

    if (input.dataset.param === 'fadeRate') {
      if (val <= 0.0001) {
        input.value = 0;
        return;
      }
      const min = 0.001;
      const max = 0.40;
      const safeVal = Math.max(min, Math.min(max, val));
      const u = Math.log(safeVal / min) / Math.log(max / min);
      input.value = Math.round(1 + u * 999);
      return;
    }

    if (input.dataset.scale === 'log') {
      const min = parseFloat(input.dataset.min || 0.05);
      const max = parseFloat(input.dataset.max || 15.0);
      const sliderMin = parseFloat(input.min || 0);
      const sliderMax = parseFloat(input.max || 1000);
      const safeVal = Math.max(min, Math.min(max, val));
      const u = Math.log(safeVal / min) / Math.log(max / min);
      input.value = sliderMin + u * (sliderMax - sliderMin);
    } else {
      input.value = val;
    }
  }

  formatBadge(val, paramKey) {
    if (typeof val !== 'number') return val;
    if (paramKey === 'fadeRate') {
      if (val <= 0.0001) return '0.00 (Never Decay)';
      if (val < 0.1) return val.toFixed(3);
      return val.toFixed(2);
    }
    if (val >= 100 && Math.abs(val - Math.round(val)) < 0.001) return Math.round(val).toLocaleString();
    if (val < 0.001) return val.toFixed(4);
    if (val < 0.01) return val.toFixed(4);
    if (val < 0.1) return val.toFixed(3);
    if (val < 10) return val.toFixed(2);
    if (val % 1 === 0) return val.toLocaleString();
    return val.toFixed(2);
  }

  bindDynamicInputs() {
    document.querySelectorAll('[data-param]').forEach(input => {
      const paramKey = input.dataset.param;

      const updateVal = () => {
        const group = input.closest('[data-show-for-mode]');
        if (group && group.style.display === 'none') return;

        const mode = this.app.currentMode;
        if (!mode || !mode.params) return;

        const badge = input.closest('.control-group')?.querySelector('.val-badge') ||
                      document.querySelector(`[data-badge="${paramKey}"]`);

        const val = this.valueFromInput(input);
        mode.params[paramKey] = val;

        // Keep all other inputs with this paramKey in sync
        document.querySelectorAll(`[data-param="${paramKey}"]`).forEach(other => {
          if (other !== input) {
            this.inputFromValue(other, val);
          }
        });

        // Keep all badges with this paramKey in sync
        document.querySelectorAll(`[data-badge="${paramKey}"]`).forEach(b => {
          b.textContent = this.formatBadge(val, paramKey);
        });

        if ((paramKey === 'particleCount' || paramKey === 'spawnMode') && typeof mode.resetAllParticles === 'function') {
          mode.resetAllParticles();
        }
      };

      input.addEventListener('input', updateVal);
      input.addEventListener('change', updateVal);
    });
  }

  switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === tabId));
    this.activeTab = tabId;
  }

  buildPaletteGrid() {
    if (!this.ui.paletteGrid) return;
    this.ui.paletteGrid.innerHTML = '';

    const palettes = this.app.palette.palettes;
    for (const [key, p] of Object.entries(palettes)) {
      const card = document.createElement('div');
      card.className = `palette-card ${key === this.app.palette.currentPaletteKey ? 'active' : ''}`;
      card.dataset.palette = key;

      const swatchRow = document.createElement('div');
      swatchRow.className = 'palette-swatches';
      p.colors.slice(0, 5).forEach(color => {
        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.style.backgroundColor = color;
        swatchRow.appendChild(swatch);
      });

      const label = document.createElement('span');
      label.className = 'palette-name';
      label.textContent = p.name;

      card.appendChild(swatchRow);
      card.appendChild(label);

      card.addEventListener('click', () => {
        this.app.palette.setPalette(key);
        document.querySelectorAll('.palette-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        if (this.app.currentMode && typeof this.app.currentMode.resetAllParticles === 'function') {
          this.app.currentMode.resetAllParticles();
        }
      });

      this.ui.paletteGrid.appendChild(card);
    }
  }

  syncControlsWithMode() {
    const mode = this.app.currentMode;
    if (!mode || !mode.params) return;

    if (this.ui.modeBadge) {
      this.ui.modeBadge.textContent = mode.name;
    }

    if (this.ui.modeSelect) {
      this.ui.modeSelect.value = this.app.currentModeKey;
    }

    // Toggle mode-specific control groups
    document.querySelectorAll('[data-show-for-mode]').forEach(el => {
      const allowedModes = el.dataset.showForMode.split(',').map(m => m.trim());
      const currentModeKey = this.app.currentModeKey;
      el.style.display = allowedModes.includes(currentModeKey) ? 'block' : 'none';
    });

    // Sync input values & badges for visible elements
    document.querySelectorAll('[data-param]').forEach(input => {
      const group = input.closest('[data-show-for-mode]');
      if (group && group.style.display === 'none') return;

      const paramKey = input.dataset.param;
      if (mode.params[paramKey] !== undefined) {
        const val = mode.params[paramKey];
        this.inputFromValue(input, val);

        document.querySelectorAll(`[data-badge="${paramKey}"]`).forEach(badge => {
          badge.textContent = this.formatBadge(val, paramKey);
        });
      }
    });

    // Sync Particle Spawning Button status
    if (mode.params && mode.params.spawnEnabled !== undefined) {
      this.updateSpawnUI(mode.params.spawnEnabled !== false);
    }
  }

  randomizeParameters() {
    const mode = this.app.currentMode;
    if (!mode || !mode.params) return;

    const p = mode.params;
    const modeKey = this.app.currentModeKey;

    // 1. Noise Scale: Tailored per mode for optimal aesthetics
    if (p.noiseScale !== undefined) {
      if (modeKey === 'gpu_particles') {
        // GPU particles thrive on ultra-wide, silky cosmic flows
        p.noiseScale = 0.0004 + Math.random() * 0.0010;
      } else if (modeKey === 'terrain3d') {
        p.noiseScale = 0.02 + Math.random() * 0.03;
      } else {
        p.noiseScale = 0.0015 + Math.random() * 0.0035;
      }
      p.noiseScale = Math.round(p.noiseScale * 100000) / 100000;
    }

    // 2. Noise Type: Explore all dynamic vector flow field topologies
    if (p.noiseType !== undefined) {
      const types = ['curl', 'perlin', 'simplex', 'vortex'];
      p.noiseType = types[Math.floor(Math.random() * types.length)];
    }

    // 3. Octaves & Fractal Persistence
    if (p.octaves !== undefined) {
      p.octaves = Math.floor(2 + Math.random() * 3); // 2, 3, or 4
    }
    if (p.persistence !== undefined) {
      p.persistence = Math.round((0.40 + Math.random() * 0.25) * 100) / 100;
    }
    if (p.lacunarity !== undefined) {
      p.lacunarity = Math.round((1.8 + Math.random() * 0.5) * 10) / 10;
    }

    // 4. Particle Flow Velocity (Calibrated to User Perception):
    // 0.05: very slow, 0.10: slow, 0.50: pleasantly fast, 1.00: very fast. Very seldom above 1.0.
    if (p.particleSpeed !== undefined) {
      const r = Math.random();
      let speed;
      if (r < 0.20) {
        // Very slow / meditative (0.04 to 0.10)
        speed = 0.04 + Math.random() * 0.06;
      } else if (r < 0.65) {
        // Slow to moderate flow (0.10 to 0.40)
        speed = 0.10 + Math.random() * 0.30;
      } else if (r < 0.93) {
        // Pleasantly fast & lively (0.40 to 0.85)
        speed = 0.40 + Math.random() * 0.45;
      } else {
        // Very fast / burst (0.85 to 1.20) - only ~3.5% chance to exceed 1.0
        speed = 0.85 + Math.random() * 0.35;
      }
      p.particleSpeed = Math.round(speed * 1000) / 1000;
    }

    // 5. Particle Size / Stroke Width
    if (p.strokeWidth !== undefined) {
      p.strokeWidth = Math.round((1.0 + Math.random() * 3.2) * 10) / 10;
    }

    // 6. Particle Shape Profile
    if (p.particleShape !== undefined) {
      const shapes = ['round', 'round_varied', 'flat'];
      p.particleShape = shapes[Math.floor(Math.random() * shapes.length)];
    }

    // 7. Canvas Blend Mode
    if (p.blendMode !== undefined) {
      const blendModes = ['lighter', 'source-over', 'screen', 'lighten', 'overlay'];
      p.blendMode = blendModes[Math.floor(Math.random() * blendModes.length)];
    }

    // 8. Trail Decay Rate (Motion Blur)
    if (p.fadeRate !== undefined) {
      const r = Math.random();
      if (r < 0.12) {
        // Permanent continuous tapestry
        p.fadeRate = 0.00;
      } else if (r < 0.35) {
        // Ultra-long lingering tapestry ribbons
        p.fadeRate = Math.round((0.00005 + Math.random() * 0.002) * 100000) / 100000;
      } else if (r < 0.75) {
        // Silky flowing trails
        p.fadeRate = Math.round((0.005 + Math.random() * 0.06) * 1000) / 1000;
      } else {
        // Shorter, crisper dynamic streaks
        p.fadeRate = Math.round((0.10 + Math.random() * 0.18) * 100) / 100;
      }
    }

    // 9. Trail Taper Style (GPU mode)
    if (p.taperMode !== undefined) {
      const tapers = ['none', 'none', 'both', 'width'];
      p.taperMode = tapers[Math.floor(Math.random() * tapers.length)];
    }
    if (p.streakLength !== undefined) {
      p.streakLength = Math.round((0.8 + Math.random() * 1.5) * 100) / 100;
    }
    if (p.glowAlpha !== undefined) {
      p.glowAlpha = Math.round((0.6 + Math.random() * 0.4) * 100) / 100;
    }

    // 10. Domain Warp & 3D Terrain specific parameters
    if (p.warpIntensity !== undefined) p.warpIntensity = Math.round((1.5 + Math.random() * 2.5) * 10) / 10;
    if (p.scale !== undefined) p.scale = Math.round((1.5 + Math.random() * 2.5) * 10) / 10;
    if (p.contourLevels !== undefined) p.contourLevels = Math.floor(12 + Math.random() * 26);
    if (p.fillBands !== undefined) p.fillBands = Math.random() > 0.35;
    if (p.renderStyle !== undefined) {
      const styles = ['wireframe', 'shaded', 'points', 'hybrid'];
      p.renderStyle = styles[Math.floor(Math.random() * styles.length)];
    }

    // Pick random palette
    const keys = Object.keys(this.app.palette.palettes);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    this.app.palette.setPalette(randomKey);
    this.buildPaletteGrid();

    // Re-seed noise
    this.app.perlin.reseed(Math.random());
    this.app.simplex.reseed(Math.random());

    this.app.resetCurrentMode();
    this.syncControlsWithMode();
    if (typeof mode.resetAllParticles === 'function') {
      mode.resetAllParticles();
    }
    this.showNotification(`🎲 Rolled: ${this.app.palette.current.name} (${p.particleSpeed !== undefined ? p.particleSpeed.toFixed(2) + ' vel' : ''})`);
  }

  togglePlayPause() {
    this.app.isRunning = !this.app.isRunning;
    if (this.ui.playPauseBtn) {
      this.ui.playPauseBtn.innerHTML = this.app.isRunning ?
        '<span class="icon">⏸</span>' :
        '<span class="icon">▶</span>';
      this.ui.playPauseBtn.title = this.app.isRunning ? 'Pause (Space)' : 'Play (Space)';
      this.ui.playPauseBtn.setAttribute('aria-label', this.app.isRunning ? 'Pause' : 'Play');
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  toggleHUD() {
    if (!this.ui.hud) return;
    const isNowHidden = this.ui.hud.classList.toggle('hidden');
    
    if (this.ui.btnRevealHUD) {
      this.ui.btnRevealHUD.classList.toggle('visible', isNowHidden);
    }

    if (this.ui.hudToast) {
      if (isNowHidden) {
        this.ui.hudToast.classList.add('active');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
          this.ui.hudToast.classList.remove('active');
        }, 2500);
      } else {
        this.ui.hudToast.classList.remove('active');
      }
    }
  }

  handleExportImage() {
    const resSelect = document.getElementById('select-export-res');
    const formatSelect = document.getElementById('select-export-format');

    let width = 3840;
    let height = 2160;

    if (resSelect) {
      const val = resSelect.value;
      if (val === '1080p') { width = 1920; height = 1080; }
      else if (val === '2k') { width = 2560; height = 1440; }
      else if (val === '4k') { width = 3840; height = 2160; }
      else if (val === '8k') { width = 7680; height = 4320; }
      else if (val === 'square4k') { width = 4096; height = 4096; }
      else if (val === 'screen') { width = window.innerWidth * (window.devicePixelRatio || 1); height = window.innerHeight * (window.devicePixelRatio || 1); }
    }

    const format = formatSelect ? formatSelect.value : 'image/png';
    this.app.exporter.exportImage({ width, height, format });
    this.ui.exportModal.classList.remove('active');
  }

  handleRecordVideo() {
    const durationInput = document.getElementById('input-video-duration');
    const duration = durationInput ? parseFloat(durationInput.value) || 5 : 5;

    if (this.ui.exportProgressContainer) {
      this.ui.exportProgressContainer.style.display = 'block';
    }

    this.app.exporter.startRecording(
      duration,
      60,
      (progress) => {
        if (this.ui.exportProgress) {
          this.ui.exportProgress.style.width = `${Math.round(progress * 100)}%`;
        }
      },
      () => {
        if (this.ui.exportProgressContainer) {
          this.ui.exportProgressContainer.style.display = 'none';
        }
        this.ui.exportModal.classList.remove('active');
      }
    );
  }

  toggleSpawning() {
    const mode = this.app.currentMode;
    if (!mode || !mode.params) return;

    const current = mode.params.spawnEnabled !== false;
    const next = !current;
    mode.params.spawnEnabled = next;

    this.updateSpawnUI(next);
    this.showNotification(next ? '🌊 Spawning: RESUMED' : '⏸️ Spawning: STOPPED (Propagating Field)');
  }

  updateSpawnUI(enabled) {
    const btn = document.getElementById('btn-toggle-spawn');
    const text = document.getElementById('spawn-status-text');
    if (btn && text) {
      if (enabled) {
        text.innerHTML = '🌊 Particle Spawning: <strong style="color: #00f0ff;">ACTIVE</strong>';
        btn.style.borderColor = 'rgba(0, 240, 255, 0.4)';
        btn.style.background = 'rgba(0, 240, 255, 0.08)';
      } else {
        text.innerHTML = '⏸️ Particle Spawning: <strong style="color: #ffaa00;">STOPPED</strong>';
        btn.style.borderColor = 'rgba(255, 170, 0, 0.6)';
        btn.style.background = 'rgba(255, 170, 0, 0.15)';
      }
    }
  }

  showNotification(message, duration = 2200) {
    if (!this.ui.hudToast) return;
    this.ui.hudToast.textContent = message;
    this.ui.hudToast.classList.add('active');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.ui.hudToast.classList.remove('active');
      this.ui.hudToast.textContent = 'HUD Hidden (Press H)';
    }, duration);
  }
}

window.ControlsManager = ControlsManager;
