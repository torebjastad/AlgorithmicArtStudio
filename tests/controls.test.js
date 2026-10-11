const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Set up DOM mock for ControlsManager
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.document = {
  getElementById: (id) => ({
    id,
    classList: { add: () => {}, remove: () => {}, toggle: () => false, contains: () => false },
    addEventListener: () => {},
    style: {},
    dataset: {}
  }),
  querySelectorAll: () => [],
  addEventListener: () => {}
};

const controlsPath = path.join(__dirname, '..', 'js', 'ui', 'controls.js');
const controlsCode = fs.readFileSync(controlsPath, 'utf8');
const fn = new Function('window', 'document', `${controlsCode}\n`);
fn(global.window, global.document);
global.ControlsManager = global.window.ControlsManager;

test('ControlsManager Formatting & Logic', async (t) => {
  const dummyApp = {
    mouse: {},
    palette: { palettes: {}, current: { name: 'Test' } },
    resetCurrentMode: () => {}
  };
  const manager = new ControlsManager(dummyApp);

  await t.test('formatBadge formats custom parameters cleanly', () => {
    assert.equal(manager.formatBadge(3.0, 'mouseStrength'), '3.0x');
    assert.equal(manager.formatBadge(1.5, 'flySpeed'), '1.50x');
    assert.equal(manager.formatBadge(16, 'ribbonCount'), '16 strands');
    assert.equal(manager.formatBadge(160, 'amplitude'), '160 px');
    assert.equal(manager.formatBadge(45, 'ribbonWidth'), '45 px');
    assert.equal(manager.formatBadge(1.3, 'lightIntensity'), '1.30x');
    assert.equal(manager.formatBadge(24, 'contourLevels'), '24 levels');
    assert.equal(manager.formatBadge(80, 'mouseSpawnDiameter'), '80 px');
    assert.equal(manager.formatBadge(200, 'mouseSpawnRate'), '200 / frame');
    assert.equal(manager.formatBadge(0.003, 'timeSpeed'), '0.0030');
    assert.equal(manager.formatBadge(0.0, 'timeSpeed'), '0.0000 (Frozen)');
    assert.equal(manager.formatBadge(0.0, 'fadeRate'), '0.00 (Never Decay)');
    assert.equal(manager.formatBadge(262144, 'particleCount'), '262,144');
  });

  await t.test('valueFromInput handles checkboxes, selects, and logarithmic scales', () => {
    const chk = { type: 'checkbox', checked: true, dataset: {} };
    assert.equal(manager.valueFromInput(chk), true);

    const sel = { tagName: 'SELECT', type: 'select-one', value: 'curl', dataset: {} };
    assert.equal(manager.valueFromInput(sel), 'curl');

    const num = { type: 'range', value: '2.5', dataset: {} };
    assert.equal(manager.valueFromInput(num), 2.5);

    const fadeZero = { type: 'range', value: '0', dataset: { param: 'fadeRate' } };
    assert.equal(manager.valueFromInput(fadeZero), 0.0);
  });
});
