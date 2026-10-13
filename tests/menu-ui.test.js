const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Menu UI & HTML Parameter Architecture', async (t) => {
  const htmlPath = path.join(__dirname, '..', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  await t.test('All interactive IDs in index.html are unique', () => {
    const idRegex = /\sid=["']([^"']+)["']/g;
    const ids = [];
    let match;
    while ((match = idRegex.exec(html)) !== null) {
      ids.push(match[1]);
    }

    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    assert.deepEqual(duplicates, [], `Found duplicate IDs: ${duplicates.join(', ')}`);
  });

  await t.test('Eliminated previously duplicated parameter inputs', () => {
    // Check strokeWidth
    const strokeWidthInputs = [...html.matchAll(/data-param=["']strokeWidth["']/g)];
    assert.equal(strokeWidthInputs.length, 1, 'strokeWidth input should only appear once');

    // Check particleShape
    const particleShapeInputs = [...html.matchAll(/data-param=["']particleShape["']/g)];
    assert.equal(particleShapeInputs.length, 1, 'particleShape input should only appear once');

    // Check blendMode
    const blendModeInputs = [...html.matchAll(/data-param=["']blendMode["']/g)];
    assert.equal(blendModeInputs.length, 1, 'blendMode input should only appear once');

    // Check enableMouseDistortion
    const mouseDistortionInputs = [...html.matchAll(/data-param=["']enableMouseDistortion["']/g)];
    assert.equal(mouseDistortionInputs.length, 1, 'enableMouseDistortion input should only appear once');
  });

  await t.test('Control Drawer has 4 clearly labeled tabs', () => {
    assert.ok(html.includes('data-tab="tab-mode">Mode & Noise</button>'));
    assert.ok(html.includes('data-tab="tab-dynamics">Simulation</button>'));
    assert.ok(html.includes('data-tab="tab-strokes">Shading & Style</button>'));
    assert.ok(html.includes('data-tab="tab-palettes">Palettes</button>'));
  });

  await t.test('Every generative mode has visible controls in Tab 1, Tab 2, and Tab 3', () => {
    const modes = ['gpu_particles', 'flow', 'domain_warp'];

    // Extract tab panes
    const getPaneContent = (paneId) => {
      const startTag = `<section class="tab-pane" id="${paneId}"` || `<section class="tab-pane active" id="${paneId}"`;
      const regex = new RegExp(`<section class="tab-pane[^"]*" id="${paneId}">([\\s\\S]*?)</section>`);
      const m = html.match(regex);
      return m ? m[1] : '';
    };

    const tab1 = getPaneContent('tab-mode');
    const tab2 = getPaneContent('tab-dynamics');
    const tab3 = getPaneContent('tab-strokes');

    assert.ok(tab1.length > 0, 'Tab 1 should exist and have content');
    assert.ok(tab2.length > 0, 'Tab 2 should exist and have content');
    assert.ok(tab3.length > 0, 'Tab 3 should exist and have content');

    // Helper to test if a mode has controls in a tab
    const hasControlsForMode = (tabHtml, mode) => {
      const groupRegex = /<div class="control-group"(?:[^>]*data-show-for-mode=["']([^"']+)["'])?[^>]*>/g;
      let match;
      let count = 0;
      while ((match = groupRegex.exec(tabHtml)) !== null) {
        const allowedModes = match[1];
        if (!allowedModes) {
          // Visible for all modes
          count++;
        } else {
          const list = allowedModes.split(',').map(s => s.trim());
          if (list.includes(mode)) count++;
        }
      }
      return count;
    };

    modes.forEach(mode => {
      const c1 = hasControlsForMode(tab1, mode);
      const c2 = hasControlsForMode(tab2, mode);
      const c3 = hasControlsForMode(tab3, mode);

      assert.ok(c1 > 0, `Mode ${mode} should have visible controls in Tab 1 (found ${c1})`);
      assert.ok(c2 > 0, `Mode ${mode} should have visible controls in Tab 2 (found ${c2})`);
      assert.ok(c3 > 0, `Mode ${mode} should have visible controls in Tab 3 (found ${c3})`);
    });
  });

  await t.test('Core parameters (mouseStrength, lightIntensity, streakLength, glowAlpha) are defined in HTML', () => {
    assert.ok(html.includes('data-param="mouseStrength"'));
    assert.ok(html.includes('data-param="lightIntensity"'));
    assert.ok(html.includes('data-param="streakLength"'));
    assert.ok(html.includes('data-param="glowAlpha"'));
  });

  await t.test('Evolution / timeSpeed slider defaults to 0.0 and allows higher values than 0.2', () => {
    const inputMatch = html.match(/<input[^>]*id=["']slider-time-speed["'][^>]*>/);
    assert.ok(inputMatch, 'slider-time-speed input should exist in index.html');
    const inputTag = inputMatch[0];
    assert.ok(/value=["']0(?:\.0+)?["']/.test(inputTag), 'slider-time-speed should default to 0.0');
    const maxMatch = inputTag.match(/max=["']([\d.]+)["']/);
    assert.ok(maxMatch, 'slider-time-speed should have a max attribute');
    const maxVal = parseFloat(maxMatch[1]);
    assert.ok(maxVal > 0.2, `slider-time-speed max should be higher than 0.2 (found ${maxVal})`);
  });
});
