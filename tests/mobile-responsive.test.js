const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Minimal browser mocks for Node.js
global.window = {
  innerWidth: 390, // Mobile viewport width
  innerHeight: 844,
  devicePixelRatio: 3.0, // High-DPI Retina screen
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.navigator = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
  maxTouchPoints: 5
};
global.document = {
  createElement: () => ({
    getContext: () => ({
      imageSmoothingEnabled: true,
      drawImage: () => {}
    }),
    toDataURL: () => 'data:image/png;base64,mock',
    width: 0,
    height: 0,
    style: {}
  }),
  getElementById: (id) => ({
    id,
    classList: { add: () => {}, remove: () => {}, toggle: () => false, contains: () => false },
    addEventListener: () => {},
    style: {},
    dataset: {}
  }),
  querySelector: () => ({ textContent: '', value: '' }),
  querySelectorAll: () => [],
  addEventListener: () => {}
};

// Load CanvasRenderer, WebGLRenderer, and Exporter
function loadScript(relPath) {
  const fullPath = path.join(__dirname, '..', relPath);
  const code = fs.readFileSync(fullPath, 'utf8');
  const fn = new Function('window', 'document', 'navigator', `${code}\n`);
  fn(global.window, global.document, global.navigator);
}

loadScript('js/core/canvas-renderer.js');
loadScript('js/core/webgl-renderer.js');
loadScript('js/core/exporter.js');

test('Mobile & Tablet Responsive Adaptations', async (t) => {
  const htmlPath = path.join(__dirname, '..', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const cssPath = path.join(__dirname, '..', 'css', 'style.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  await t.test('Viewport and Safe Area architecture in HTML & CSS', () => {
    // Check viewport-fit=cover
    assert.ok(html.includes('viewport-fit=cover'), 'HTML meta viewport must include viewport-fit=cover for notch support');

    // Check safe area insets in CSS
    assert.ok(css.includes('--safe-top: env(safe-area-inset-top'), 'CSS must define --safe-top');
    assert.ok(css.includes('--safe-bottom: env(safe-area-inset-bottom'), 'CSS must define --safe-bottom');
    assert.ok(css.includes('--safe-left: env(safe-area-inset-left'), 'CSS must define --safe-left');
    assert.ok(css.includes('--safe-right: env(safe-area-inset-right'), 'CSS must define --safe-right');

    // Canvas touch isolation
    assert.ok(css.includes('touch-action: none'), 'CSS must isolate canvas touch-action');
  });

  await t.test('Mobile Bottom Sheet & Grab Bar DOM elements exist', () => {
    assert.ok(html.includes('id="sheet-grab-bar"'), 'Must have sheet-grab-bar in DOM');
    assert.ok(html.includes('class="sheet-grab-handle"'), 'Must have sheet-grab-handle in DOM');
    assert.ok(html.includes('id="btn-close-drawer"'), 'Must have btn-close-drawer in DOM');
    assert.ok(html.includes('id="val-fps-mobile"'), 'Must have val-fps-mobile in DOM');
    assert.ok(html.includes('id="val-particles-mobile"'), 'Must have val-particles-mobile in DOM');
  });

  await t.test('CSS defines mobile bottom sheet and landscape slide-over rules', () => {
    assert.ok(css.includes('@media (max-width: 768px)'), 'Must have mobile breakpoint');
    assert.ok(css.includes('transform: translateY(100%)'), 'Mobile drawer must collapse with translateY(100%)');
    assert.ok(css.includes('@media (max-height: 520px) and (orientation: landscape)'), 'Must have mobile landscape breakpoint');
    assert.ok(css.includes('@media (pointer: coarse)'), 'Must have coarse pointer ergonomics for touchscreens');
  });

  await t.test('DPR clamping protects mobile GPUs from fill-rate exhaustion', () => {
    const CanvasRenderer = global.window.CanvasRenderer;
    const WebGLRenderer = global.window.WebGLRenderer;

    assert.ok(CanvasRenderer && typeof CanvasRenderer.getSafeDPR === 'function', 'CanvasRenderer.getSafeDPR should exist');
    assert.ok(WebGLRenderer && typeof WebGLRenderer.getSafeDPR === 'function', 'WebGLRenderer.getSafeDPR should exist');

    // On simulated iPhone (3.0 DPR), DPR is safely clamped to 1.5
    const canvasMobileDpr = CanvasRenderer.getSafeDPR(3.0);
    assert.equal(canvasMobileDpr, 1.5, 'Mobile DPR should be clamped to 1.5x on 3x Retina screens');

    const glMobileDpr = WebGLRenderer.getSafeDPR(3.0);
    assert.equal(glMobileDpr, 1.5, 'WebGL mobile DPR should be clamped to 1.5x on 3x Retina screens');
  });

  await t.test('Exporter clamps resolution on mobile to protect browser tab memory', async () => {
    const Exporter = global.window.Exporter;
    assert.ok(Exporter, 'Exporter class should be loaded');

    let exportedWidth = 0;
    let exportedHeight = 0;
    const dummyApp = {
      activeCanvas: { width: 1920, height: 1080 },
      currentMode: {
        renderToCanvas: async (canvas, w, h) => {
          exportedWidth = w;
          exportedHeight = h;
        }
      }
    };

    const exp = new Exporter(dummyApp);
    // Stub downloadDataUrl so test doesn't try to click DOM links
    exp.downloadDataUrl = () => {};

    // Request 8K (7680x4320) on simulated mobile
    await exp.exportImage({ width: 7680, height: 4320 });
    assert.equal(exportedWidth, 3840, 'Mobile export width must be clamped to 4K max');
    assert.equal(exportedHeight, 2160, 'Mobile export height must maintain aspect ratio');
  });

  await t.test('Exporter detects video MIME types for iOS Safari (mp4) vs Chrome (webm)', () => {
    const Exporter = global.window.Exporter;
    const exp = new Exporter({ activeCanvas: null });

    // Simulate iOS Safari where MediaRecorder only supports mp4
    global.MediaRecorder = {
      isTypeSupported: (type) => type.includes('mp4')
    };

    const iosType = exp.getSupportedVideoMimeType();
    assert.equal(iosType.ext, 'mp4', 'iOS Safari must select MP4 video format');

    // Simulate Chrome where MediaRecorder supports webm
    global.MediaRecorder = {
      isTypeSupported: (type) => type.includes('webm')
    };

    const chromeType = exp.getSupportedVideoMimeType();
    assert.equal(chromeType.ext, 'webm', 'Chrome must select WebM video format');
  });

  await t.test('GPU Particles sim shader defines u_frameSeed for continuous pointer spawning', () => {
    const gpuPath = path.join(__dirname, '..', 'js', 'modes', 'gpu-particles.js');
    const gpuCode = fs.readFileSync(gpuPath, 'utf8');

    assert.ok(gpuCode.includes('uniform float u_frameSeed;'), 'sim shader must declare u_frameSeed');
    assert.ok(gpuCode.includes('hash12(seed + vec2(u_frameSeed * 0.17'), 'pointer mode wake check must use u_frameSeed');
    assert.ok(gpuCode.includes('u_frameSeed'), 'must pass u_frameSeed to simProgram');
    assert.ok(gpuCode.includes('(p.spawnMode === \'pointer\' && mouse.isDown)'), 'isMousePainting should check mouse.isDown directly');
  });

  await t.test('app.js protects touch painting: preventDefault and pointer mode double-tap immunity', () => {
    const appPath = path.join(__dirname, '..', 'js', 'app.js');
    const appCode = fs.readFileSync(appPath, 'utf8');

    assert.ok(appCode.includes('!isPointerMode && now - lastTapTime < 320'), 'Double-tap HUD toggle must be disabled during pointer painting mode');
    assert.ok(appCode.includes('if (e.cancelable) {') && appCode.includes('e.preventDefault();'), 'Touch handlers must call preventDefault on canvas touches');
  });
});

