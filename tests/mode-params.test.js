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
      fbm3D: () => 0.5,
      reseed: () => {}
    },
    curl: {
      curl2D: () => ({ x: 0.5, y: 0.5 })
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
    const domainWarp = new DomainWarpMode(mockApp);
    const flow = new FlowFieldMode(mockApp);
    const gpu = new GPUParticlesMode(mockApp);

    assert.ok(domainWarp.params && typeof domainWarp.params === 'object');
    assert.ok(flow.params && typeof flow.params === 'object');
    assert.ok(gpu.params && typeof gpu.params === 'object');
  });

  await t.test('Flow and GPU particles support noiseScale parameter', () => {
    const flow = new FlowFieldMode(mockApp);
    const gpu = new GPUParticlesMode(mockApp);

    assert.equal(typeof flow.params.noiseScale, 'number');
    assert.equal(typeof gpu.params.noiseScale, 'number');
  });

  await t.test('Domain Warp has active default mouse influence', () => {
    const domainWarp = new DomainWarpMode(mockApp);
    assert.ok(domainWarp.params.mouseInfluence > 0, 'mouseInfluence should be > 0 so distortion can take effect');
    assert.equal(typeof domainWarp.params.lightIntensity, 'number');
  });

  await t.test('Flow and GPU particles have mouseStrength parameter', () => {
    const flow = new FlowFieldMode(mockApp);
    const gpu = new GPUParticlesMode(mockApp);
    assert.equal(typeof flow.params.mouseStrength, 'number');
    assert.equal(typeof gpu.params.mouseStrength, 'number');
  });

  await t.test('Modes default timeSpeed to 0.0 (frozen) and continuously integrate fieldTime', () => {
    const gpu = new GPUParticlesMode(mockApp);
    const flow = new FlowFieldMode(mockApp);
    const domainWarp = new DomainWarpMode(mockApp);

    assert.equal(gpu.params.timeSpeed, 0.0, 'gpu_particles timeSpeed should default to 0.0');
    assert.equal(flow.params.timeSpeed, 0.0, 'flow timeSpeed should default to 0.0');
    assert.equal(domainWarp.params.timeSpeed, 0.0, 'domainWarp timeSpeed should default to 0.0');

    assert.equal(gpu.fieldTime || 0, 0);
    // At default 0.0, fieldTime stays 0
    gpu.update(0.1, 100);
    assert.equal(gpu.fieldTime, 0);

    // When activated, fieldTime accumulates smoothly
    gpu.params.timeSpeed = 0.01;
    gpu.update(0.1, 100);
    const t1 = gpu.fieldTime;
    assert.ok(t1 > 0, 'fieldTime should accumulate forward when timeSpeed > 0');

    // Changing timeSpeed should NOT jump fieldTime instantaneously
    gpu.params.timeSpeed = 0.25;
    assert.equal(gpu.fieldTime, t1, 'Changing timeSpeed slider must not jump fieldTime instantaneously');

    // Setting timeSpeed back to 0 freezes fieldTime evolution
    gpu.params.timeSpeed = 0.0;
    gpu.update(0.1, 200);
    assert.equal(gpu.fieldTime, t1, 'Setting timeSpeed to 0 must freeze fieldTime');

    // Verify flow fields behaves identically
    flow.params.timeSpeed = 0.01;
    flow.update(0.1, 100);
    const ft1 = flow.fieldTime;
    assert.ok(ft1 > 0);
    flow.params.timeSpeed = 0.0;
    flow.update(0.1, 200);
    assert.equal(flow.fieldTime, ft1);
  });
});
