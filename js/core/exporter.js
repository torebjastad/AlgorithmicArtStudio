/**
 * High-Resolution Exporter & Video Recorder
 * Supports 4K/8K offscreen renders, PNG, JPEG, SVG vector output, and WebM video recording
 */

class Exporter {
  constructor(app) {
    this.app = app;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
  }

  /**
   * Export high-resolution image
   */
  async exportImage(options = {}) {
    const {
      width = 3840,
      height = 2160,
      format = 'image/png',
      quality = 0.95,
      filename = `algorithmic_art_${Date.now()}`
    } = options;

    // Create offscreen canvas for high-res render
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;

    const currentMode = this.app.currentMode;
    if (!currentMode) return;

    // Render snapshot at target resolution
    if (typeof currentMode.renderToCanvas === 'function') {
      await currentMode.renderToCanvas(offCanvas, width, height);
    } else {
      // Fallback: draw current active canvas scaled up with bicubic smoothing
      const ctx = offCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.app.activeCanvas, 0, 0, width, height);
    }

    // Trigger download
    const ext = format === 'image/jpeg' ? 'jpg' : 'png';
    const dataUrl = offCanvas.toDataURL(format, quality);
    this.downloadDataUrl(dataUrl, `${filename}.${ext}`);
  }

  /**
   * Export vector SVG (for Topographic and Ribbon modes)
   */
  exportSVG(filename = `algorithmic_vector_${Date.now()}`) {
    const currentMode = this.app.currentMode;
    if (currentMode && typeof currentMode.toSVG === 'function') {
      const svgString = currentMode.toSVG();
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      this.downloadDataUrl(url, `${filename}.svg`);
      URL.revokeObjectURL(url);
    } else {
      console.warn('SVG export not supported in current mode, exporting PNG instead.');
      this.exportImage({ width: 3840, height: 2160, filename });
    }
  }

  /**
   * Record WebM Animation Loop
   */
  startRecording(durationSeconds = 5, fps = 60, onProgress = null, onComplete = null) {
    if (this.isRecording) return;

    const stream = this.app.activeCanvas.captureStream(fps);
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];

    let selectedMime = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
    
    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: selectedMime,
      videoBitsPerSecond: 12000000 // 12 Mbps for crisp video
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: selectedMime });
      const url = URL.createObjectURL(blob);
      this.downloadDataUrl(url, `algorithmic_animation_${Date.now()}.webm`);
      this.isRecording = false;
      if (onComplete) onComplete();
    };

    this.isRecording = true;
    this.mediaRecorder.start();

    let elapsed = 0;
    const interval = 200;
    const timer = setInterval(() => {
      elapsed += interval / 1000;
      if (onProgress) onProgress(Math.min(1.0, elapsed / durationSeconds));
      if (elapsed >= durationSeconds) {
        clearInterval(timer);
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      }
    }, interval);
  }

  downloadDataUrl(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

window.Exporter = Exporter;
