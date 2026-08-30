/**
 * 3D Procedural Perlin Landscape Engine
 * Perspective projection, retro wireframe & faceted shading, forward flying motion,
 * dynamic sunlight, depth fog, and interactive pitch/orbit.
 */

class Terrain3DMode {
  constructor(app) {
    this.app = app;
    this.name = '3D Cyber Terrain';

    this.params = {
      gridCols: 70,
      gridRows: 50,
      noiseScale: 0.035,
      octaves: 4,
      persistence: 0.48,
      lacunarity: 2.0,
      heightMultiplier: 220,
      flySpeed: 1.5,
      cameraPitch: 0.42,
      cameraFov: 520,
      renderStyle: 'wireframe', // 'wireframe', 'shaded', 'points', 'hybrid'
      strokeWidth: 1.2,
      fogDensity: 0.85,
      glowEffect: true,
      ridgedPeaks: false
    };

    this.offsetZ = 0;
    this.yaw = 0;
  }

  update(dt, time) {
    const p = this.params;
    // Flying forward speed
    this.offsetZ += dt * p.flySpeed * 35.0;

    // Mouse interactive pitch / yaw
    const mouse = this.app.mouse;
    if (mouse.isDown) {
      const dx = mouse.x - mouse.prevX;
      const dy = mouse.y - mouse.prevY;
      this.yaw += dx * 0.005;
      this.params.cameraPitch = Math.max(0.1, Math.min(1.2, this.params.cameraPitch + dy * 0.003));
    }
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

    const cols = p.gridCols;
    const rows = p.gridRows;
    const noise = this.app.perlin;

    const cellSpacing = 32;
    const totalD = rows * cellSpacing;

    const fov = p.cameraFov;
    const pitch = p.cameraPitch;
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);

    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);

    const camY = -160;
    const camZ = -220;

    // Projected 2D screen coordinates grid
    const screenGrid = [];
    const heightGrid = [];

    for (let r = 0; r < rows; r++) {
      const rowPoints = [];
      const rowHeights = [];
      const worldZ = r * cellSpacing + (this.offsetZ % cellSpacing);

      for (let c = 0; c < cols; c++) {
        const rawX = (c - cols / 2) * cellSpacing;

        // Sample Perlin Height
        const nx = (c * cellSpacing) * p.noiseScale * 0.05;
        const nz = (worldZ + Math.floor(this.offsetZ)) * p.noiseScale * 0.05;
        
        let heightVal = p.ridgedPeaks ?
          noise.ridged2D(nx, nz, p.octaves, p.lacunarity, p.persistence) :
          noise.fbm2D(nx, nz, p.octaves, p.lacunarity, p.persistence);

        const worldY = -heightVal * p.heightMultiplier;

        // Yaw Rotation
        const worldX = rawX * cosYaw - worldZ * sinYaw;
        const rotatedZ = rawX * sinYaw + worldZ * cosYaw;

        // 3D Camera Pitch & Perspective Projection
        const rx = worldX;
        const ry = (worldY - camY) * cosPitch - (rotatedZ - camZ) * sinPitch;
        const rz = (worldY - camY) * sinPitch + (rotatedZ - camZ) * cosPitch;

        if (rz > 15) {
          const screenX = w / 2 + (rx * fov) / rz;
          const screenY = h / 2 + (ry * fov) / rz + 60;
          const depthRatio = Math.max(0, Math.min(1, rz / (totalD * 1.5)));

          rowPoints.push({ x: screenX, y: screenY, z: rz, depth: depthRatio });
          rowHeights.push(heightVal * 0.5 + 0.5);
        } else {
          rowPoints.push(null);
          rowHeights.push(0);
        }
      }
      screenGrid.push(rowPoints);
      heightGrid.push(rowHeights);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Render from Back to Front for correct depth occlusion
    for (let r = rows - 2; r >= 0; r--) {
      for (let c = 0; c < cols - 1; c++) {
        const p00 = screenGrid[r][c];
        const p10 = screenGrid[r][c + 1];
        const p11 = screenGrid[r + 1][c + 1];
        const p01 = screenGrid[r + 1][c];

        if (!p00 || !p10 || !p11 || !p01) continue;

        const avgDepth = (p00.depth + p10.depth + p11.depth + p01.depth) * 0.25;
        const fogAlpha = Math.max(0, 1.0 - avgDepth * p.fogDensity);
        if (fogAlpha <= 0.01) continue;

        const hVal = (heightGrid[r][c] + heightGrid[r][c + 1] + heightGrid[r + 1][c + 1] + heightGrid[r + 1][c]) * 0.25;
        const color = palette.sample(hVal, fogAlpha);

        if (p.renderStyle === 'shaded' || p.renderStyle === 'hybrid') {
          ctx.fillStyle = palette.sample(hVal, fogAlpha * 0.45);
          ctx.beginPath();
          ctx.moveTo(p00.x, p00.y);
          ctx.lineTo(p10.x, p10.y);
          ctx.lineTo(p11.x, p11.y);
          ctx.lineTo(p01.x, p01.y);
          ctx.closePath();
          ctx.fill();
        }

        if (p.renderStyle === 'wireframe' || p.renderStyle === 'hybrid') {
          ctx.lineWidth = Math.max(0.5, p.strokeWidth * (1.0 - avgDepth * 0.6));
          ctx.strokeStyle = color;

          ctx.beginPath();
          ctx.moveTo(p00.x, p00.y);
          ctx.lineTo(p10.x, p10.y);
          ctx.lineTo(p11.x, p11.y);
          ctx.stroke();
        } else if (p.renderStyle === 'points') {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p00.x, p00.y, Math.max(1, 2.5 * (1.0 - avgDepth)), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  async renderToCanvas(targetCanvas, width, height) {
    const targetCtx = targetCanvas.getContext('2d');
    targetCtx.drawImage(this.app.activeCanvas, 0, 0, width, height);
  }
}

window.Terrain3DMode = Terrain3DMode;
