/**
 * Color Palette Studio & Gradient System
 * Supports 30+ curated palettes, Inigo Quilez cosine gradients, custom color stop LUTs, and blend modes
 */

class ColorPaletteManager {
  constructor() {
    this.palettes = {
      cyberpunk: {
        name: 'Cyberpunk Neon',
        background: '#090a10',
        colors: ['#00f0ff', '#ff003c', '#fcee0a', '#7122fa', '#05d9e8', '#ff2a85'],
        cosine: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.0, 0.33, 0.67] }
      },
      nebula: {
        name: 'Cosmic Nebula',
        background: '#04020a',
        colors: ['#3b1c54', '#84297a', '#d64d7b', '#f58b68', '#f8df81', '#00f7ff'],
        cosine: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [2.0, 1.0, 0.0], d: [0.5, 0.20, 0.25] }
      },
      bioluminescent: {
        name: 'Deep Sea Bioluminescence',
        background: '#020b14',
        colors: ['#031926', '#004e64', '#00a896', '#02c39a', '#f0f3bd', '#70e4ef'],
        cosine: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 0.5], d: [0.8, 0.90, 0.30] }
      },
      sumie: {
        name: 'Japanese Sumi-e Ink',
        background: '#f4ede2',
        colors: ['#111111', '#282828', '#494949', '#706e6b', '#a8a59f', '#c92a2a'],
        cosine: { a: [0.8, 0.8, 0.8], b: [0.4, 0.4, 0.4], c: [1.0, 1.0, 1.0], d: [0.0, 0.0, 0.0] }
      },
      obsidianGold: {
        name: 'Obsidian & Gold',
        background: '#0d0d0d',
        colors: ['#1c1917', '#451a03', '#78350f', '#b45309', '#f59e0b', '#fef08a'],
        cosine: { a: [0.5, 0.4, 0.2], b: [0.5, 0.4, 0.2], c: [1.0, 1.0, 1.0], d: [0.0, 0.1, 0.2] }
      },
      solarFlare: {
        name: 'Solar Flare',
        background: '#0f0200',
        colors: ['#3f0008', '#7f000a', '#b71c1c', '#e65100', '#ff9100', '#ffff00'],
        cosine: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.0, 0.10, 0.20] }
      },
      aurora: {
        name: 'Aurora Borealis',
        background: '#020d18',
        colors: ['#0d2b45', '#203c56', '#544e68', '#8d697a', '#d08159', '#20bf6b', '#00d2d3'],
        cosine: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.3, 0.20, 0.8] }
      },
      synthwave: {
        name: 'Synthwave 1984',
        background: '#120422',
        colors: ['#2e0854', '#7d12ff', '#ff007f', '#ff7800', '#ffd800', '#00e5ff'],
        cosine: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.8, 0.5, 0.4] }
      },
      emeraldForest: {
        name: 'Emerald Forest',
        background: '#03140a',
        colors: ['#052c16', '#0e4429', '#006d32', '#26a641', '#39d353', '#d1fae5'],
        cosine: { a: [0.2, 0.5, 0.3], b: [0.2, 0.5, 0.3], c: [1.0, 1.0, 1.0], d: [0.0, 0.33, 0.67] }
      },
      vaporwave: {
        name: 'Vaporwave Pastel',
        background: '#1f132b',
        colors: ['#ff71ce', '#01cdfe', '#05ffa1', '#b967ff', '#fffb96'],
        cosine: { a: [0.8, 0.6, 0.8], b: [0.3, 0.4, 0.2], c: [1.0, 1.0, 1.0], d: [0.1, 0.5, 0.7] }
      },
      deepAmethyst: {
        name: 'Royal Amethyst',
        background: '#0d0417',
        colors: ['#1a0826', '#3b1259', '#631d94', '#9932cc', '#c084fc', '#f3e8ff'],
        cosine: { a: [0.5, 0.2, 0.7], b: [0.5, 0.3, 0.5], c: [1.0, 1.0, 1.0], d: [0.5, 0.2, 0.8] }
      },
      moltenMagma: {
        name: 'Molten Magma',
        background: '#100000',
        colors: ['#1a0000', '#4d0000', '#8b0000', '#ff4500', '#ffa500', '#fff8dc'],
        cosine: { a: [0.5, 0.5, 0.2], b: [0.5, 0.5, 0.2], c: [2.0, 1.0, 0.0], d: [0.5, 0.20, 0.25] }
      },
      iceGlacier: {
        name: 'Electric Glacier',
        background: '#040d1a',
        colors: ['#0a2540', '#0066cc', '#00ccff', '#80e5ff', '#e6f9ff', '#ffffff'],
        cosine: { a: [0.5, 0.8, 0.9], b: [0.5, 0.4, 0.3], c: [1.0, 1.0, 1.0], d: [0.0, 0.33, 0.67] }
      },
      monochrome: {
        name: 'Silver Monolith',
        background: '#0a0a0a',
        colors: ['#141414', '#333333', '#666666', '#999999', '#cccccc', '#ffffff'],
        cosine: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.0, 0.0, 0.0] }
      },
      sunsetMirage: {
        name: 'Sunset Mirage',
        background: '#180720',
        colors: ['#31112c', '#79155b', '#c23373', '#f6635c', '#ffba86', '#fff1c5'],
        cosine: { a: [0.6, 0.4, 0.5], b: [0.5, 0.5, 0.4], c: [1.0, 1.0, 1.0], d: [0.0, 0.2, 0.4] }
      },
      acidToxic: {
        name: 'Toxic Cyber Acid',
        background: '#000000',
        colors: ['#0d2b00', '#1f6600', '#39e600', '#80ff00', '#ccff00', '#ffffff'],
        cosine: { a: [0.4, 0.6, 0.1], b: [0.4, 0.6, 0.1], c: [1.0, 1.0, 1.0], d: [0.1, 0.4, 0.0] }
      },
      terracotta: {
        name: 'Desert Terracotta',
        background: '#140c07',
        colors: ['#2e1503', '#5c2c16', '#8b4513', '#c86432', '#e08e58', '#f5deb3'],
        cosine: { a: [0.6, 0.4, 0.3], b: [0.4, 0.3, 0.2], c: [1.0, 1.0, 1.0], d: [0.1, 0.2, 0.3] }
      },
      quantumFoam: {
        name: 'Quantum Foam',
        background: '#030712',
        colors: ['#0f172a', '#1e1b4b', '#4338ca', '#818cf8', '#38bdf8', '#a7f3d0'],
        cosine: { a: [0.5, 0.5, 0.8], b: [0.5, 0.5, 0.4], c: [1.0, 1.0, 1.0], d: [0.3, 0.5, 0.8] }
      }
    };

    this.currentPaletteKey = 'cyberpunk';
    this.lutSize = 1024;
    this.lutRGBA = new Uint8Array(this.lutSize * 4);
    this.lutFloat = new Float32Array(this.lutSize * 4);
    this.customColors = [...this.palettes.cyberpunk.colors];
    this.customBg = this.palettes.cyberpunk.background;

    this.updateLUT();
  }

  get current() {
    return this.palettes[this.currentPaletteKey] || this.palettes.cyberpunk;
  }

  setPalette(key) {
    if (this.palettes[key]) {
      this.currentPaletteKey = key;
      this.customColors = [...this.palettes[key].colors];
      this.customBg = this.palettes[key].background;
      this.updateLUT();
    }
  }

  setCustomColors(colors, bg = null) {
    if (Array.isArray(colors) && colors.length >= 2) {
      this.customColors = [...colors];
      if (bg) this.customBg = bg;
      this.updateLUT();
    }
  }

  hexToRGB(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return [
      (num >> 16) & 255,
      (num >> 8) & 255,
      num & 255
    ];
  }

  rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  /**
   * Recompute 1024-entry lookup table from custom color stops
   */
  updateLUT() {
    const stops = this.customColors.map(c => this.hexToRGB(c));
    const numSegments = stops.length - 1;

    for (let i = 0; i < this.lutSize; i++) {
      const t = i / (this.lutSize - 1);
      const scaled = t * numSegments;
      const segIndex = Math.min(Math.floor(scaled), numSegments - 1);
      const segT = scaled - segIndex;

      // Smooth cosine interpolation between color stops
      const smoothT = (1 - Math.cos(segT * Math.PI)) * 0.5;

      const c1 = stops[segIndex];
      const c2 = stops[segIndex + 1];

      const r = c1[0] + (c2[0] - c1[0]) * smoothT;
      const g = c1[1] + (c2[1] - c1[1]) * smoothT;
      const b = c1[2] + (c2[2] - c1[2]) * smoothT;

      const idx = i * 4;
      this.lutRGBA[idx] = Math.round(r);
      this.lutRGBA[idx + 1] = Math.round(g);
      this.lutRGBA[idx + 2] = Math.round(b);
      this.lutRGBA[idx + 3] = 255;

      this.lutFloat[idx] = r / 255;
      this.lutFloat[idx + 1] = g / 255;
      this.lutFloat[idx + 2] = b / 255;
      this.lutFloat[idx + 3] = 1.0;
    }
  }

  /**
   * Fast O(1) sampling of color at parameter t [0, 1]
   */
  sample(t, alpha = 1.0) {
    const clampedT = Math.max(0, Math.min(1, t));
    const idx = Math.floor(clampedT * (this.lutSize - 1)) * 4;
    return `rgba(${this.lutRGBA[idx]}, ${this.lutRGBA[idx + 1]}, ${this.lutRGBA[idx + 2]}, ${alpha})`;
  }

  sampleRGB(t) {
    const clampedT = Math.max(0, Math.min(1, t));
    const idx = Math.floor(clampedT * (this.lutSize - 1)) * 4;
    return [
      this.lutRGBA[idx],
      this.lutRGBA[idx + 1],
      this.lutRGBA[idx + 2]
    ];
  }

  sampleFloat(t) {
    const clampedT = Math.max(0, Math.min(1, t));
    const idx = Math.floor(clampedT * (this.lutSize - 1)) * 4;
    return [
      this.lutFloat[idx],
      this.lutFloat[idx + 1],
      this.lutFloat[idx + 2]
    ];
  }

  /**
   * Inigo Quilez Cosine Gradient Formula
   * color(t) = a + b * cos(2*pi * (c*t + d))
   */
  sampleCosine(t, cosParams) {
    const p = cosParams || (this.current.cosine || { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.0, 0.33, 0.67] });
    const twoPi = Math.PI * 2;
    const r = p.a[0] + p.b[0] * Math.cos(twoPi * (p.c[0] * t + p.d[0]));
    const g = p.a[1] + p.b[1] * Math.cos(twoPi * (p.c[1] * t + p.d[1]));
    const b = p.a[2] + p.b[2] * Math.cos(twoPi * (p.c[2] * t + p.d[2]));
    return [
      Math.max(0, Math.min(1, r)),
      Math.max(0, Math.min(1, g)),
      Math.max(0, Math.min(1, b))
    ];
  }
}

window.ColorPaletteManager = ColorPaletteManager;
