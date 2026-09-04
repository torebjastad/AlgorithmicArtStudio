/**
 * Particle Flow Field Engine (Lightning Fast with Float32 TypedArrays)
 * Supports up to 200,000 particles, Curl & Perlin noise vector fields,
 * dynamic stroke tapering, alpha decay trails, and interactive mouse forces.
 */

class FlowFieldMode {
  constructor(app) {
    this.app = app;
    this.name = 'Flow Fields';
    
    // Core parameters with responsive defaults
    this.params = {
      particleCount: 8000,
      noiseType: 'curl',     // 'curl', 'perlin', 'simplex', 'vortex'
      noiseScale: 0.003,
      octaves: 3,
      persistence: 0.5,
      lacunarity: 2.0,
      timeSpeed: 0.002,
      particleSpeed: 2.5,
      stepLength: 1.5,
      strokeWidth: 1.5,
      particleShape: 'round', // 'round', 'round_varied', 'flat'
      taperWidth: true,
      fadeRate: 0.04,
      blendMode: 'lighter',
      jitter: 0.05,
      colorCycleSpeed: 0.2,
      spawnMode: 'random',   // 'random', 'edges', 'center'
      spawnEnabled: true,    // Whether new particles spawn or current ones propagate
      mouseForce: 'none',    // 'none', 'attract', 'repel', 'swirl'
      mouseRadius: 180,
      mouseStrength: 2.0
    };

    this.maxParticles = 200000;
    this.initParticleArrays();
  }

  initParticleArrays() {
    const n = this.maxParticles;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.prevX = new Float32Array(n);
    this.prevY = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.colorT = new Float32Array(n);
    this.strokeW = new Float32Array(n);

    this.resetAllParticles();
  }

  resetParticle(i, w, h) {
    if (this.params.spawnMode === 'edges') {
      const margin = 2.5;
      const totalW = w + 2 * margin;
      const totalH = h + 2 * margin;
      const perimeter = 2 * (totalW + totalH);
      const d = Math.random() * perimeter;
      if (d < totalW) { this.x[i] = -margin + d; this.y[i] = -margin; }
      else if (d < totalW + totalH) { this.x[i] = w + margin; this.y[i] = -margin + (d - totalW); }
      else if (d < 2 * totalW + totalH) { this.x[i] = w + margin - (d - (totalW + totalH)); this.y[i] = h + margin; }
      else { this.x[i] = -margin; this.y[i] = h + margin - (d - (2 * totalW + totalH)); }
    } else if (this.params.spawnMode === 'center') {
      this.x[i] = w * 0.5 + (Math.random() - 0.5) * Math.min(w, h) * 0.18;
      this.y[i] = h * 0.5 + (Math.random() - 0.5) * Math.min(w, h) * 0.18;
    } else {
      this.x[i] = Math.random() * w;
      this.y[i] = Math.random() * h;
    }
    this.prevX[i] = this.x[i];
    this.prevY[i] = this.y[i];
    this.vx[i] = 0;
    this.vy[i] = 0;
    const speedScale = Math.max(1.0, 1.6 / Math.max(0.01, this.params.particleSpeed));
    this.maxLife[i] = (180 + Math.random() * 360) * speedScale;
    this.life[i] = 0;
    this.colorT[i] = Math.random();
    if (this.params.particleShape === 'round_varied') {
      this.strokeW[i] = 0.5 + Math.random() * this.params.strokeWidth;
    } else {
      this.strokeW[i] = this.params.strokeWidth;
    }
  }

  resetAllParticles() {
    const w = this.app.width || window.innerWidth;
    const h = this.app.height || window.innerHeight;
    const count = this.params.particleCount;
    const isEdgeOrCenter = (this.params.spawnMode === 'edges' || this.params.spawnMode === 'center');
    const speedScale = Math.max(1.0, 1.6 / Math.max(0.01, this.params.particleSpeed));
    const spawnSpan = 400 * speedScale;

    for (let i = 0; i < count; i++) {
      if (isEdgeOrCenter) {
        this.x[i] = -9999;
        this.y[i] = -9999;
        this.prevX[i] = -9999;
        this.prevY[i] = -9999;
        this.vx[i] = 0;
        this.vy[i] = 0;
        this.maxLife[i] = (180 + Math.random() * 360) * speedScale;
        this.life[i] = - (i / count) * spawnSpan;
        this.colorT[i] = Math.random();
        this.strokeW[i] = (this.params.particleShape === 'round_varied')
          ? (0.5 + Math.random() * this.params.strokeWidth)
          : this.params.strokeWidth;
      } else {
        this.resetParticle(i, w, h);
        this.life[i] = Math.random() * this.maxLife[i];
      }
    }
  }

  update(dt, time) {
    const p = this.params;
    const count = Math.min(p.particleCount, this.maxParticles);
    const w = this.app.width;
    const h = this.app.height;
    const zTime = time * p.timeSpeed;
    const mouse = this.app.mouse;
    const noise = this.app.perlin;
    const simplex = this.app.simplex;
    const curl = this.app.curl;

    const noiseScale = p.noiseScale;
    const speed = p.particleSpeed;
    const jitter = p.jitter;
    const mouseRadiusSq = p.mouseRadius * p.mouseRadius;

    for (let i = 0; i < count; i++) {
      // Stratified pre-spawn delay queue for steady continuous edge/center inflow
      if (this.life[i] < 0) {
        this.life[i]++;
        if (this.life[i] >= 0) {
          if (p.spawnEnabled !== false) {
            this.resetParticle(i, w, h);
          }
        }
        continue;
      }

      // If retired off-screen while spawning is stopped
      if (this.x[i] < -100) {
        if (p.spawnEnabled !== false) {
          // Stagger resumption smoothly
          const speedScale = Math.max(1.0, 1.6 / Math.max(0.01, p.particleSpeed));
          if (Math.random() < 1.0 / (400 * speedScale)) {
            this.resetParticle(i, w, h);
          }
        }
        continue;
      }

      this.prevX[i] = this.x[i];
      this.prevY[i] = this.y[i];

      const px = this.x[i] * noiseScale;
      const py = this.y[i] * noiseScale;

      let targetVx = 0;
      let targetVy = 0;

      if (p.noiseType === 'curl') {
        const c = curl.curl2D(px, py, zTime, p.octaves, p.lacunarity, p.persistence);
        targetVx = c.x * speed * 2.0;
        targetVy = c.y * speed * 2.0;
      } else if (p.noiseType === 'simplex') {
        const angle = simplex.fbm3D(px, py, zTime, p.octaves, p.lacunarity, p.persistence) * Math.PI * 4;
        targetVx = Math.cos(angle) * speed;
        targetVy = Math.sin(angle) * speed;
      } else if (p.noiseType === 'vortex') {
        const n = noise.fbm3D(px, py, zTime, p.octaves, p.lacunarity, p.persistence);
        const distFromCenter = Math.hypot(this.x[i] - w / 2, this.y[i] - h / 2);
        const angle = n * Math.PI * 3 + distFromCenter * 0.005;
        targetVx = Math.cos(angle) * speed;
        targetVy = Math.sin(angle) * speed;
      } else {
        // Standard Perlin
        const angle = noise.fbm3D(px, py, zTime, p.octaves, p.lacunarity, p.persistence) * Math.PI * 4;
        targetVx = Math.cos(angle) * speed;
        targetVy = Math.sin(angle) * speed;
      }

      // Mouse interactive forces
      if (mouse.isDown || mouse.isHovering) {
        if (p.mouseForce !== 'none') {
          const dx = mouse.x - this.x[i];
          const dy = mouse.y - this.y[i];
          const distSq = dx * dx + dy * dy;

          if (distSq < mouseRadiusSq && distSq > 1) {
            const dist = Math.sqrt(distSq);
            const factor = (1.0 - dist / p.mouseRadius) * p.mouseStrength;

            if (p.mouseForce === 'attract') {
              targetVx += (dx / dist) * factor * 5.0;
              targetVy += (dy / dist) * factor * 5.0;
            } else if (p.mouseForce === 'repel') {
              targetVx -= (dx / dist) * factor * 8.0;
              targetVy -= (dy / dist) * factor * 8.0;
            } else if (p.mouseForce === 'swirl') {
              targetVx += (-dy / dist) * factor * 8.0;
              targetVy += (dx / dist) * factor * 8.0;
            }
          }
        }
      }

      // Smooth inertia blending
      this.vx[i] += (targetVx - this.vx[i]) * 0.15 + (Math.random() - 0.5) * jitter;
      this.vy[i] += (targetVy - this.vy[i]) * 0.15 + (Math.random() - 0.5) * jitter;

      this.x[i] += this.vx[i];
      this.y[i] += this.vy[i];

      // Update particle lifecycle & color
      this.life[i]++;
      this.colorT[i] = (this.colorT[i] + p.colorCycleSpeed * 0.002) % 1.0;

      // Respawn or retire when dead or out of canvas bounds
      const isOutOfBounds = (this.x[i] < -20 || this.x[i] > w + 20 || this.y[i] < -20 || this.y[i] > h + 20);
      const isDead = (p.fadeRate <= 0.00001) ? isOutOfBounds : (this.life[i] >= this.maxLife[i] || isOutOfBounds);

      if (isDead) {
        if (p.spawnEnabled !== false) {
          this.resetParticle(i, w, h);
        } else {
          this.x[i] = -9999;
          this.y[i] = -9999;
          this.prevX[i] = -9999;
          this.prevY[i] = -9999;
          this.life[i] = 99999;
        }
      }
    }
  }

  render(renderer) {
    const p = this.params;
    const count = Math.min(p.particleCount, this.maxParticles);
    const palette = this.app.palette;
    const ctx = renderer.trailCtx;

    // Apply alpha decay to trails (skip if 0.00 Never Decay)
    if (p.fadeRate > 0.00001) {
      renderer.applyFade(palette.customBg, p.fadeRate);
    }
    renderer.setBlendMode(p.blendMode);

    ctx.save();
    ctx.lineCap = (p.particleShape === 'flat') ? 'butt' : 'round';
    ctx.lineJoin = (p.particleShape === 'flat') ? 'miter' : 'round';

    // Batch draw particle strokes
    for (let i = 0; i < count; i++) {
      if (this.x[i] < -100 || this.prevX[i] < -100) continue;

      let alpha = 1.0;
      if (p.fadeRate > 0.00001) {
        const lifeRatio = this.life[i] / this.maxLife[i];
        alpha = Math.sin(lifeRatio * Math.PI);
        if (alpha <= 0.01) continue;
      }

      const speedVal = Math.hypot(this.vx[i], this.vy[i]);
      let width = this.strokeW[i];
      if (p.taperWidth && p.fadeRate > 0.00001) {
        width *= (0.3 + 0.7 * alpha) * (0.8 + Math.min(speedVal, 4.0) * 0.3);
      }

      ctx.lineWidth = Math.max(0.5, width);
      ctx.strokeStyle = palette.sample(this.colorT[i], alpha * 0.85);

      ctx.beginPath();
      ctx.moveTo(this.prevX[i], this.prevY[i]);
      ctx.lineTo(this.x[i], this.y[i]);
      ctx.stroke();
    }

    ctx.restore();

    // Composite trails onto main canvas
    renderer.present(palette.customBg);
  }

  /**
   * High-Resolution Offscreen Render for Exporter
   */
  async renderToCanvas(targetCanvas, width, height) {
    const targetCtx = targetCanvas.getContext('2d');
    const palette = this.app.palette;
    const p = this.params;

    // Fill background
    targetCtx.fillStyle = palette.customBg;
    targetCtx.fillRect(0, 0, width, height);
    targetCtx.globalCompositeOperation = p.blendMode;
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';

    const scaleX = width / this.app.width;
    const scaleY = height / this.app.height;
    const avgScale = (scaleX + scaleY) * 0.5;

    // Simulate several accumulation passes to produce a crisp master high-res artwork
    const simSteps = 120;
    const count = Math.min(p.particleCount * 2, this.maxParticles);

    // Temporary particle simulation coordinates for high-res
    const hx = new Float32Array(count);
    const hy = new Float32Array(count);
    const hvx = new Float32Array(count);
    const hvy = new Float32Array(count);
    const hLife = new Float32Array(count);
    const hMaxLife = new Float32Array(count);
    const hColorT = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      hx[i] = Math.random() * width;
      hy[i] = Math.random() * height;
      hMaxLife[i] = 40 + Math.random() * 150;
      hLife[i] = Math.random() * hMaxLife[i];
      hColorT[i] = Math.random();
    }

    for (let step = 0; step < simSteps; step++) {
      const zTime = step * p.timeSpeed;
      for (let i = 0; i < count; i++) {
        const prevX = hx[i];
        const prevY = hy[i];

        const px = (hx[i] / width) * this.app.width * p.noiseScale;
        const py = (hy[i] / height) * this.app.height * p.noiseScale;

        let tvx = 0, tvy = 0;
        if (p.noiseType === 'curl') {
          const c = this.app.curl.curl2D(px, py, zTime, p.octaves, p.lacunarity, p.persistence);
          tvx = c.x * p.particleSpeed * 2.0 * avgScale;
          tvy = c.y * p.particleSpeed * 2.0 * avgScale;
        } else {
          const angle = this.app.perlin.fbm3D(px, py, zTime, p.octaves, p.lacunarity, p.persistence) * Math.PI * 4;
          tvx = Math.cos(angle) * p.particleSpeed * avgScale;
          tvy = Math.sin(angle) * p.particleSpeed * avgScale;
        }

        hvx[i] += (tvx - hvx[i]) * 0.15;
        hvy[i] += (tvy - hvy[i]) * 0.15;

        hx[i] += hvx[i];
        hy[i] += hvy[i];
        hLife[i]++;
        hColorT[i] = (hColorT[i] + p.colorCycleSpeed * 0.002) % 1.0;

        const lifeRatio = hLife[i] / hMaxLife[i];
        const alpha = Math.sin(lifeRatio * Math.PI);
        if (alpha > 0.01) {
          const widthVal = Math.max(1.0, p.strokeWidth * avgScale * alpha);
          targetCtx.lineWidth = widthVal;
          targetCtx.strokeStyle = palette.sample(hColorT[i], alpha * 0.7);

          targetCtx.beginPath();
          targetCtx.moveTo(prevX, prevY);
          targetCtx.lineTo(hx[i], hy[i]);
          targetCtx.stroke();
        }

        if (hLife[i] >= hMaxLife[i] || hx[i] < 0 || hx[i] > width || hy[i] < 0 || hy[i] > height) {
          hx[i] = Math.random() * width;
          hy[i] = Math.random() * height;
          hLife[i] = 0;
        }
      }
    }
  }
}

window.FlowFieldMode = FlowFieldMode;
