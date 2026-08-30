/**
 * Topographic Contour Mapmaker & Isoline Engine
 * Computes multi-level marching squares / height contours from 2D Perlin fields.
 * Supports elevation banding, major/minor index lines, smooth bezier smoothing, and pure vector SVG export.
 */

class TopographicMode {
  constructor(app) {
    this.app = app;
    this.name = 'Topographic Isolines';

    this.params = {
      scale: 0.004,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
      contourLevels: 24,
      strokeWidth: 1.5,
      majorIndexInterval: 5,
      majorStrokeMultiplier: 2.2,
      fillBands: true,
      glowEffect: false,
      timeSpeed: 0.003,
      gridResolution: 80 // Sampling grid resolution
    };

    this.grid = null;
    this.gridW = 0;
    this.gridH = 0;
    this.cachedContours = [];
  }

  update(dt, time) {
    // Recompute grid values
    const p = this.params;
    const w = this.app.width;
    const h = this.app.height;
    const res = p.gridResolution;

    const cols = Math.ceil(w / (w / res));
    const rows = Math.ceil(h / (w / res));
    const cellW = w / cols;
    const cellH = h / rows;

    if (!this.grid || this.gridW !== cols + 1 || this.gridH !== rows + 1) {
      this.gridW = cols + 1;
      this.gridH = rows + 1;
      this.grid = new Float32Array(this.gridW * this.gridH);
    }

    const zTime = time * p.timeSpeed;
    const noise = this.app.perlin;

    // Fill heightmap grid
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const x = i * cellW;
        const y = j * cellH;
        const val = noise.fbm3D(x * p.scale, y * p.scale, zTime, p.octaves, p.lacunarity, p.persistence);
        // Normalize to [0, 1]
        this.grid[j * this.gridW + i] = val * 0.5 + 0.5;
      }
    }

    // Extract isoline segments
    this.cachedContours = this.extractIsolines(cols, rows, cellW, cellH, p.contourLevels);
  }

  /**
   * Marching squares isoline extraction for specified contour levels
   */
  extractIsolines(cols, rows, cellW, cellH, levels) {
    const contours = [];
    for (let lvl = 0; lvl < levels; lvl++) {
      const threshold = (lvl + 0.5) / levels;
      const segments = [];

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x0 = i * cellW;
          const y0 = j * cellH;
          const x1 = (i + 1) * cellW;
          const y1 = (j + 1) * cellH;

          const v00 = this.grid[j * this.gridW + i];
          const v10 = this.grid[j * this.gridW + (i + 1)];
          const v11 = this.grid[(j + 1) * this.gridW + (i + 1)];
          const v01 = this.grid[(j + 1) * this.gridW + i];

          let caseIndex = 0;
          if (v00 >= threshold) caseIndex |= 1;
          if (v10 >= threshold) caseIndex |= 2;
          if (v11 >= threshold) caseIndex |= 4;
          if (v01 >= threshold) caseIndex |= 8;

          if (caseIndex === 0 || caseIndex === 15) continue;

          // Linear interpolation along cell edges
          const top = [x0 + (x1 - x0) * this.invLerp(v00, v10, threshold), y0];
          const right = [x1, y0 + (y1 - y0) * this.invLerp(v10, v11, threshold)];
          const bottom = [x0 + (x1 - x0) * this.invLerp(v01, v11, threshold), y1];
          const left = [x0, y0 + (y1 - y0) * this.invLerp(v00, v01, threshold)];

          switch (caseIndex) {
            case 1: segments.push([left, top]); break;
            case 2: segments.push([top, right]); break;
            case 3: segments.push([left, right]); break;
            case 4: segments.push([right, bottom]); break;
            case 5: segments.push([left, top], [right, bottom]); break;
            case 6: segments.push([top, bottom]); break;
            case 7: segments.push([left, bottom]); break;
            case 8: segments.push([bottom, left]); break;
            case 9: segments.push([top, bottom]); break;
            case 10: segments.push([top, right], [bottom, left]); break;
            case 11: segments.push([right, bottom]); break;
            case 12: segments.push([left, right]); break;
            case 13: segments.push([top, right]); break;
            case 14: segments.push([left, top]); break;
          }
        }
      }

      contours.push({
        level: lvl,
        t: lvl / levels,
        segments
      });
    }

    return contours;
  }

  invLerp(a, b, val) {
    if (Math.abs(b - a) < 0.00001) return 0.5;
    return Math.max(0, Math.min(1, (val - a) / (b - a)));
  }

  render(renderer) {
    const p = this.params;
    const palette = this.app.palette;
    const ctx = renderer.ctx;
    const w = this.app.width;
    const h = this.app.height;

    // Fill background
    ctx.save();
    ctx.fillStyle = palette.customBg;
    ctx.fillRect(0, 0, w, h);

    if (p.fillBands) {
      // Shaded elevation background
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;
      const res = p.gridResolution;
      const cols = this.gridW - 1;
      const rows = this.gridH - 1;

      // Sample grid directly for performance
      for (let y = 0; y < h; y += 4) {
        const gy = (y / h) * rows;
        const j0 = Math.floor(gy);
        const ty = gy - j0;

        for (let x = 0; x < w; x += 4) {
          const gx = (x / w) * cols;
          const i0 = Math.floor(gx);
          const tx = gx - i0;

          const v00 = this.grid[j0 * this.gridW + i0];
          const v10 = this.grid[j0 * this.gridW + Math.min(cols, i0 + 1)];
          const v01 = this.grid[Math.min(rows, j0 + 1) * this.gridW + i0];
          const v11 = this.grid[Math.min(rows, j0 + 1) * this.gridW + Math.min(cols, i0 + 1)];

          const val = (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
          const quant = Math.floor(val * p.contourLevels) / p.contourLevels;
          const rgb = palette.sampleRGB(quant);

          for (let dy = 0; dy < 4 && y + dy < h; dy++) {
            for (let dx = 0; dx < 4 && x + dx < w; dx++) {
              const idx = ((y + dy) * w + (x + dx)) * 4;
              data[idx] = rgb[0];
              data[idx + 1] = rgb[1];
              data[idx + 2] = rgb[2];
              data[idx + 3] = 40; // subtle elevation wash
            }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (p.glowEffect) {
      ctx.shadowBlur = 8;
    }

    // Render contour isoline segments
    for (const contour of this.cachedContours) {
      const isMajor = contour.level % p.majorIndexInterval === 0;
      const baseWidth = isMajor ? p.strokeWidth * p.majorStrokeMultiplier : p.strokeWidth;
      const alpha = isMajor ? 0.95 : 0.65;
      const color = palette.sample(contour.t, alpha);

      ctx.lineWidth = baseWidth;
      ctx.strokeStyle = color;
      if (p.glowEffect) ctx.shadowColor = color;

      ctx.beginPath();
      for (const seg of contour.segments) {
        ctx.moveTo(seg[0][0], seg[0][1]);
        ctx.lineTo(seg[1][0], seg[1][1]);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Export crisp resolution-independent SVG
   */
  toSVG() {
    const w = this.app.width;
    const h = this.app.height;
    const palette = this.app.palette;
    const p = this.params;

    let svg = `<?xml version="1.0" standalone="no"?>\n`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n`;
    svg += `  <rect width="${w}" height="${h}" fill="${palette.customBg}"/>\n`;

    for (const contour of this.cachedContours) {
      const isMajor = contour.level % p.majorIndexInterval === 0;
      const width = isMajor ? p.strokeWidth * p.majorStrokeMultiplier : p.strokeWidth;
      const alpha = isMajor ? 0.95 : 0.65;
      const color = palette.sample(contour.t, alpha);

      let d = '';
      for (const seg of contour.segments) {
        d += `M ${seg[0][0].toFixed(1)},${seg[0][1].toFixed(1)} L ${seg[1][0].toFixed(1)},${seg[1][1].toFixed(1)} `;
      }

      if (d) {
        svg += `  <path d="${d}" stroke="${color}" stroke-width="${width.toFixed(1)}" stroke-linecap="round" fill="none"/>\n`;
      }
    }

    svg += `</svg>`;
    return svg;
  }

  async renderToCanvas(targetCanvas, width, height) {
    const ctx = targetCanvas.getContext('2d');
    const scaleFactor = width / this.app.width;
    const palette = this.app.palette;
    const p = this.params;

    ctx.fillStyle = palette.customBg;
    ctx.fillRect(0, 0, width, height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const contour of this.cachedContours) {
      const isMajor = contour.level % p.majorIndexInterval === 0;
      const baseWidth = (isMajor ? p.strokeWidth * p.majorStrokeMultiplier : p.strokeWidth) * scaleFactor;
      const alpha = isMajor ? 0.95 : 0.65;
      const color = palette.sample(contour.t, alpha);

      ctx.lineWidth = baseWidth;
      ctx.strokeStyle = color;

      ctx.beginPath();
      for (const seg of contour.segments) {
        ctx.moveTo(seg[0][0] * scaleFactor, seg[0][1] * scaleFactor);
        ctx.lineTo(seg[1][0] * scaleFactor, seg[1][1] * scaleFactor);
      }
      ctx.stroke();
    }
  }
}

window.TopographicMode = TopographicMode;
