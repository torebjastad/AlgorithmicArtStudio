const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Set up minimal browser environment mock for Node.js
global.window = global;
global.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};

// Load mode files
function loadScript(relPath) {
  const fullPath = path.join(__dirname, '..', relPath);
  const code = fs.readFileSync(fullPath, 'utf8');
  const fn = new Function('window', 'document', `${code}\n`);
  fn(global.window, global.document);
}

loadScript('js/modes/gpu-particles.js');
loadScript('js/modes/flow-fields.js');
loadScript('js/modes/domain-warp.js');
loadScript('js/modes/topographic.js');
loadScript('js/modes/terrain3d.js');
loadScript('js/modes/ribbons.js');

function createMockApp() {
  return {
    width: 1920,
    height: 1080,
    time: 0,
    mouse: { x: 960, y: 540, prevX: 960, prevY: 540, isDown: false, isHovering: false },
    webgl: { gl: null, isWebGL2: false, supported: false },
    perlin: {
      fbm3D: () => 0.5,
      noise3D: () => 0.5,
      reseed: () => {}
    },
    simplex: {
      noise3D: () => 0.5,
      reseed: () => {}
    },
    palette: {
      palettes: {
        cyberpunk: { name: 'Cyberpunk Neon', colors: ['#00f0ff', '#ff007f'] }
      },
      current: { name: 'Cyberpunk Neon', colors: ['#00f0ff', '#ff007f'] },
      setPalette: () => {}
    },
    resetCurrentMode: () => {}
  };
}

test('Mode Parameter Integrity & Normalization', async (t) => {
  const mockApp = createMockApp();

  await t.test('All modes instantiate with valid params dictionary', () => {
    const topo = new TopographicMode(mockApp);
    const ribbons = new RibbonsMode(mockApp);
    const terrain = new Terrain3DMode(mockApp);
    const domainWarp = new DomainWarpMode(mockApp);
    const flow = new FlowFieldMode(mockApp);
    const gpu = new GPUParticlesMode(mockApp);

    assert.ok(topo.params && typeof topo.params === 'object');
    assert.ok(ribbons.params && typeof ribbons.params === 'object');
    assert.ok(terrain.params && typeof terrain.params === 'object');
    assert.ok(domainWarp.params && typeof domainWarp.params === 'object');
    assert.ok(flow.params && typeof flow.params === 'object');
    assert.ok(gpu.params && typeof gpu.params === 'object');
  });

  await t.test('Topographic and Ribbons support noiseScale parameter', () => {
    const topo = new TopographicMode(mockApp);
    const ribbons = new RibbonsMode(mockApp);

    assert.equal(typeof topo.params.noiseScale, 'number');
    assert.equal(topo.params.noiseScale, 0.004);
    assert.equal(topo.params.scale, 0.004);

    assert.equal(typeof ribbons.params.noiseScale, 'number');
    assert.equal(ribbons.params.noiseScale, 0.003);
    assert.equal(ribbons.params.scale, 0.003);
  });

  await t.test('Domain Warp has active default mouse influence', () => {
    const domainWarp = new DomainWarpMode(mockApp);
    assert.ok(domainWarp.params.mouseInfluence > 0, 'mouseInfluence should be > 0 so distortion can take effect');
    assert.equal(typeof domainWarp.params.lightIntensity, 'number');
  });

  await t.test('Terrain 3D has flySpeed parameter', () => {
    const terrain = new Terrain3DMode(mockApp);
    assert.equal(typeof terrain.params.flySpeed, 'number');
    assert.ok(terrain.params.flySpeed > 0);
  });

  await t.test('Ribbons has ribbonCount, amplitude, and ribbonWidth parameters', () => {
    const ribbons = new RibbonsMode(mockApp);
    assert.equal(typeof ribbons.params.ribbonCount, 'number');
    assert.equal(typeof ribbons.params.amplitude, 'number');
    assert.equal(typeof ribbons.params.ribbonWidth, 'number');
  });

  await t.test('Flow and GPU particles have mouseStrength parameter', () => {
    const flow = new FlowFieldMode(mockApp);
    const gpu = new GPUParticlesMode(mockApp);
    assert.equal(typeof flow.params.mouseStrength, 'number');
    assert.equal(typeof gpu.params.mouseStrength, 'number');
  });
});
