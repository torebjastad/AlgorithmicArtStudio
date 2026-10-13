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
    let {
      width = 3840,
      height = 2160,
      format = 'image/png',
      quality = 0.95,
      filename = `algorithmic_art_${Date.now()}`
    } = options;

    // Mobile resolution safeguard: prevent browser tab memory exhaustion
    const isMobile = typeof navigator !== 'undefined' && (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (typeof window !== 'undefined' && window.innerWidth <= 768));
    if (isMobile && (width > 4096 || height > 4096)) {
      const aspect = width / height;
      if (width >= height) {
        width = 3840;
        height = Math.round(3840 / aspect);
      } else {
        height = 3840;
        width = Math.round(3840 * aspect);
      }
    }

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
      // Fallback: draw current active canvas (which is rendered at full native resolution with camera zoom)
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
   * Query supported recording MIME types across desktop and mobile (iOS Safari mp4 vs Chrome webm)
   */
  getSupportedVideoMimeType() {
    if (typeof MediaRecorder === 'undefined') return { mime: 'video/webm', ext: 'webm' };
    const isSupported = (t) => {
      try {
        return typeof MediaRecorder.isTypeSupported === 'function' ? MediaRecorder.isTypeSupported(t) : false;
      } catch (err) {
        return false;
      }
    };

    const candidates = [
      { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
      { mime: 'video/mp4', ext: 'mp4' },
      { mime: 'video/webm;codecs=vp9', ext: 'webm' },
      { mime: 'video/webm;codecs=vp8', ext: 'webm' },
      { mime: 'video/webm', ext: 'webm' }
    ];

    return candidates.find(c => isSupported(c.mime)) || { mime: 'video/webm', ext: 'webm' };
  }

  /**
   * Record Animation Loop (Supports WebM on Desktop/Android and MP4 on iOS Safari)
   */
  startRecording(durationSeconds = 5, fps = 60, onProgress = null, onComplete = null) {
    if (this.isRecording) return;

    const stream = this.app.activeCanvas.captureStream(fps);
    const targetType = this.getSupportedVideoMimeType();
    let selectedMime = targetType.mime;
    let selectedExt = targetType.ext;

    this.recordedChunks = [];
    const options = { videoBitsPerSecond: 12000000 };
    if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(selectedMime)) {
      options.mimeType = selectedMime;
    }

    try {
      this.mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
      console.warn('Fallback to default MediaRecorder options:', e);
      this.mediaRecorder = new MediaRecorder(stream);
      if (this.mediaRecorder.mimeType) {
        selectedMime = this.mediaRecorder.mimeType;
        selectedExt = selectedMime.includes('mp4') ? 'mp4' : 'webm';
      }
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: selectedMime });
      const url = URL.createObjectURL(blob);
      this.downloadDataUrl(url, `algorithmic_animation_${Date.now()}.${selectedExt}`);
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
