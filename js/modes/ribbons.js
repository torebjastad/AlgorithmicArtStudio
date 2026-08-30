/**
 * Harmonic Ribbon Waves & Streamline Engine
 * Generates continuous multi-strand geometric curves and silk-like ribbon meshes
 * deformed by multi-octave Perlin fields.
 */

class RibbonsMode {
  constructor(app) {
    this.app = app;
    this.name = 'Harmonic Ribbons';

    this.params = {
      ribbonCount: 16,
      segments: 100,
      scale: 0.003,
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2.0,
      strokeWidth: 2.0,
      ribbonWidth: 45,
      amplitude: 160,
      timeSpeed: 0.008,
      blendMode: 'screen',
      wireframe: false
    };

    this.cachedRibbons = [];
  }

  update(dt, time) {
    const p = this.params;
    const w = this.app.width;
    const h = this.app.height;
    const noise = this.app.perlin;
    const zTime = time * p.timeSpeed;

    this.cachedRibbons = [];

    for (let r = 0; r < p.ribbonCount; r++) {
      const ribbonT = r / Math.max(1, p.ribbonCount - 1);
      const baseY = (ribbonT * 0.7 + 0.15) * h;
      const leftPoints = [];
      const rightPoints = [];

      for (let s = 0; s <= p.segments; s++) {
        const segT = s / p.segments;
        const x = segT * (w + 100) - 50;

        const nx = x * p.scale;
        const ny = (baseY + r * 10) * p.scale;

        const displacement = noise.fbm3D(nx, ny, zTime + r * 0.1, p.octaves, p.lacunarity, p.persistence) * p.amplitude;
        const widthMod = Math.sin(segT * Math.PI) * p.ribbonWidth * (0.5 + 0.5 * Math.sin(segT * 10 + time * 0.005));

        const yCenter = baseY + displacement;
        leftPoints.push({ x, y: yCenter - widthMod * 0.5 });
        rightPoints.push({ x, y: yCenter + widthMod * 0.5 });
      }

      this.cachedRibbons.push({
        index: r,
        t: ribbonT,
        left: leftPoints,
        right: rightPoints
      });
    }
  }

  render(renderer) {
    const p = this.params;
    const palette = this.app.palette;
    const ctx = renderer.ctx;
    const w = this.app.width;
    const h = this.app.height;

    // Background
    ctx.save();
    ctx.fillStyle = palette.customBg;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = p.blendMode;

    for (const ribbon of this.cachedRibbons) {
      const color1 = palette.sample(ribbon.t, 0.45);
      const color2 = palette.sample((ribbon.t + 0.3) % 1.0, 0.75);

      if (!p.wireframe) {
        // Gradient fill ribbon mesh
        ctx.beginPath();
        ctx.moveTo(ribbon.left[0].x, ribbon.left[0].y);

        for (let i = 1; i < ribbon.left.length; i++) {
          ctx.lineTo(ribbon.left[i].x, ribbon.left[i].y);
        }
        for (let i = ribbon.right.length - 1; i >= 0; i--) {
          ctx.lineTo(ribbon.right[i].x, ribbon.right[i].y);
        }
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, ribbon.left[0].y, w, ribbon.right[ribbon.right.length - 1].y);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Contour strokes
      ctx.lineWidth = p.strokeWidth;
      ctx.strokeStyle = color2;
      ctx.beginPath();
      for (let i = 0; i < ribbon.left.length; i++) {
        if (i === 0) ctx.moveTo(ribbon.left[i].x, ribbon.left[i].y);
        else ctx.lineTo(ribbon.left[i].x, ribbon.left[i].y);
      }
      ctx.stroke();

      ctx.beginPath();
      for (let i = 0; i < ribbon.right.length; i++) {
        if (i === 0) ctx.moveTo(ribbon.right[i].x, ribbon.right[i].y);
        else ctx.lineTo(ribbon.right[i].x, ribbon.right[i].y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  toSVG() {
    const w = this.app.width;
    const h = this.app.height;
    const palette = this.app.palette;
    const p = this.params;

    let svg = `<?xml version="1.0" standalone="no"?>\n`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n`;
    svg += `  <rect width="${w}" height="${h}" fill="${palette.customBg}"/>\n`;

    for (const ribbon of this.cachedRibbons) {
      const color = palette.sample(ribbon.t, 0.8);
      let d = `M ${ribbon.left[0].x.toFixed(1)},${ribbon.left[0].y.toFixed(1)} `;
      for (let i = 1; i < ribbon.left.length; i++) {
        d += `L ${ribbon.left[i].x.toFixed(1)},${ribbon.left[i].y.toFixed(1)} `;
      }
      for (let i = ribbon.right.length - 1; i >= 0; i--) {
        d += `L ${ribbon.right[i].x.toFixed(1)},${ribbon.right[i].y.toFixed(1)} `;
      }
      d += 'Z';
      svg += `  <path d="${d}" fill="${color}" opacity="0.6" stroke="${color}" stroke-width="${p.strokeWidth}"/>\n`;
    }
    svg += `</svg>`;
    return svg;
  }

  async renderToCanvas(targetCanvas, width, height) {
    const targetCtx = targetCanvas.getContext('2d');
    targetCtx.drawImage(this.app.activeCanvas, 0, 0, width, height);
  }
}

window.RibbonsMode = RibbonsMode;
