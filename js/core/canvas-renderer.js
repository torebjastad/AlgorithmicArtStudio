/**
 * High-Performance 2D Canvas Renderer
 * Double-buffered trail accumulation, subpixel strokes, Hi-DPI support, blend modes
 */

class CanvasRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d', { alpha: false, desynchronized: true });
    
    // Trail accumulation buffer
    this.trailCanvas = document.createElement('canvas');
    this.trailCtx = this.trailCanvas.getContext('2d', { alpha: true });

    this.dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.blendMode = 'source-over';
    this.fadeAlpha = 0.05;
    this.preserveTrails = true;

    this.resize(this.width, this.height);
  }

  resize(width, height, dpr = (window.devicePixelRatio || 1)) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;

    const displayWidth = Math.floor(width * this.dpr);
    const displayHeight = Math.floor(height * this.dpr);

    // Resize main canvas
    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }

    // Resize trail buffer
    if (this.trailCanvas.width !== displayWidth || this.trailCanvas.height !== displayHeight) {
      // Save current trail buffer before resizing
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.trailCanvas.width;
      tempCanvas.height = this.trailCanvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (this.trailCanvas.width > 0 && this.trailCanvas.height > 0) {
        tempCtx.drawImage(this.trailCanvas, 0, 0);
      }

      this.trailCanvas.width = displayWidth;
      this.trailCanvas.height = displayHeight;

      if (tempCanvas.width > 0 && tempCanvas.height > 0) {
        this.trailCtx.drawImage(tempCanvas, 0, 0, displayWidth, displayHeight);
      }
    }

    // Reset scales
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.trailCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  clear(backgroundColor = '#0a0a0f') {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();

    this.trailCtx.save();
    this.trailCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.trailCtx.clearRect(0, 0, this.trailCanvas.width, this.trailCanvas.height);
    this.trailCtx.restore();
  }

  /**
   * Apply progressive alpha decay for motion trails
   */
  applyFade(backgroundColor = '#0a0a0f', decayRate = 0.05) {
    if (decayRate <= 0.00001) return; // 0.00: Never decay / infinite persistence

    this.trailCtx.save();
    this.trailCtx.globalCompositeOperation = 'destination-out';
    this.trailCtx.fillStyle = `rgba(0, 0, 0, ${decayRate})`;
    this.trailCtx.fillRect(0, 0, this.width, this.height);
    this.trailCtx.restore();
  }

  /**
   * Composite trails onto screen with background color
   */
  present(backgroundColor = '#0a0a0f') {
    this.ctx.save();
    // Fill background
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw trail buffer
    this.ctx.globalCompositeOperation = this.blendMode;
    this.ctx.drawImage(this.trailCanvas, 0, 0, this.width, this.height);
    this.ctx.restore();
  }

  setBlendMode(mode) {
    this.blendMode = mode || 'source-over';
    this.trailCtx.globalCompositeOperation = this.blendMode;
  }
}

window.CanvasRenderer = CanvasRenderer;
