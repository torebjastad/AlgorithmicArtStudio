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
    this.buildPresetBar();
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
      presetList: document.getElementById('preset-bar'),
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

    // Sliders & Checkbox Auto-Binding
    this.bindDynamicInputs();

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlayPause();
      } else if (e.key === 'Tab' || e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        this.toggleHUD();
      } else if (e.key === 'f' || e.key === 'F') {
        this.toggleFullscreen();
      } else if (e.key === 'r' || e.key === 'R') {
        this.randomizeParameters();
      } else if (e.key === 'c' || e.key === 'C') {
        this.app.resetCurrentMode();
      } else if (e.key === 's' || e.key === 'S') {
        this.app.exporter.exportImage({ width: 1920, height: 1080 });
      } else if (e.key === 'Escape') {
        this.ui.exportModal.classList.remove('active');
        this.ui.infoModal.classList.remove('active');
        if (this.ui.hud && this.ui.hud.classList.contains('hidden')) {
          this.toggleHUD();
        }
      }
    });
  }

  bindDynamicInputs() {
    document.querySelectorAll('[data-param]').forEach(input => {
      const paramKey = input.dataset.param;
      const badge = document.querySelector(`[data-badge="${paramKey}"]`);

      const updateVal = (val) => {
        const mode = this.app.currentMode;
        if (!mode || !mode.params) return;

        if (input.type === 'checkbox') {
          mode.params[paramKey] = input.checked;
        } else if (input.type === 'number' || input.type === 'range') {
          const num = parseFloat(val);
          mode.params[paramKey] = num;
          if (badge) badge.textContent = num < 0.1 ? num.toFixed(4) : (num % 1 === 0 ? num : num.toFixed(2));
        } else {
          mode.params[paramKey] = val;
          if (badge) badge.textContent = val;
        }

        if (paramKey === 'particleCount' && typeof mode.resetAllParticles === 'function') {
          mode.resetAllParticles();
        }
      };

      input.addEventListener('input', (e) => updateVal(e.target.value));
      input.addEventListener('change', (e) => updateVal(e.target.value));
    });
  }

  switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === tabId));
    this.activeTab = tabId;
  }

  buildPresetBar() {
    if (!this.ui.presetList) return;
    this.ui.presetList.innerHTML = '';

    ART_PRESETS.forEach(preset => {
      const btn = document.createElement('button');
      btn.className = 'preset-chip';
      btn.textContent = preset.name;
      btn.addEventListener('click', () => this.applyPreset(preset));
      this.ui.presetList.appendChild(btn);
    });
  }

  applyPreset(preset) {
    if (this.ui.modeSelect) {
      this.ui.modeSelect.value = preset.mode;
    }
    this.app.switchMode(preset.mode);
    this.app.palette.setPalette(preset.palette);

    const mode = this.app.currentMode;
    if (mode && preset.params) {
      Object.assign(mode.params, preset.params);
      if (typeof mode.resetAllParticles === 'function') {
        mode.resetAllParticles();
      }
    }

    this.app.resetCurrentMode();
    this.syncControlsWithMode();
    this.highlightActivePreset(preset.id);
  }

  highlightActivePreset(presetId) {
    document.querySelectorAll('.preset-chip').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.includes(presetId));
    });
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

    // Toggle mode-specific control groups
    document.querySelectorAll('[data-show-for-mode]').forEach(el => {
      const allowedModes = el.dataset.showForMode.split(',');
      const currentModeKey = this.app.currentModeKey;
      el.style.display = allowedModes.includes(currentModeKey) ? 'block' : 'none';
    });

    // Sync input values & badges
    document.querySelectorAll('[data-param]').forEach(input => {
      const paramKey = input.dataset.param;
      if (mode.params[paramKey] !== undefined) {
        const val = mode.params[paramKey];
        if (input.type === 'checkbox') {
          input.checked = !!val;
        } else {
          input.value = val;
        }

        const badge = document.querySelector(`[data-badge="${paramKey}"]`);
        if (badge) {
          badge.textContent = typeof val === 'number' ? (val < 0.1 ? val.toFixed(4) : (val % 1 === 0 ? val : val.toFixed(2))) : val;
        }
      }
    });
  }

  randomizeParameters() {
    const mode = this.app.currentMode;
    if (!mode || !mode.params) return;

    const p = mode.params;
    if (p.noiseScale !== undefined) p.noiseScale = 0.001 + Math.random() * 0.006;
    if (p.octaves !== undefined) p.octaves = Math.floor(2 + Math.random() * 4);
    if (p.persistence !== undefined) p.persistence = 0.35 + Math.random() * 0.35;
    if (p.particleSpeed !== undefined) p.particleSpeed = 1.5 + Math.random() * 3.5;
    if (p.strokeWidth !== undefined) p.strokeWidth = 0.8 + Math.random() * 3.0;
    if (p.warpIntensity !== undefined) p.warpIntensity = 1.5 + Math.random() * 3.0;
    if (p.scale !== undefined) p.scale = 1.5 + Math.random() * 3.0;

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
  }

  togglePlayPause() {
    this.app.isRunning = !this.app.isRunning;
    if (this.ui.playPauseBtn) {
      this.ui.playPauseBtn.innerHTML = this.app.isRunning ?
        '<span class="icon">⏸</span><span>Pause</span>' :
        '<span class="icon">▶</span><span>Play</span>';
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
}

window.ControlsManager = ControlsManager;
