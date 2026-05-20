const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

// ── Test framework ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('  FAIL:', msg);
    failed++;
  } else {
    passed++;
  }
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    console.error(`  FAIL: ${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  } else {
    passed++;
  }
}

function assertApprox(actual, expected, eps, msg) {
  if (Math.abs(actual - expected) > eps) {
    console.error(`  FAIL: ${msg} — expected ≈${expected}, got ${actual}`);
    failed++;
  } else {
    passed++;
  }
}

function suite(name, fn) {
  console.log(`\n> ${name}`);
  fn();
}

function normalize(value, modulus) {
  value %= modulus;
  return value < 0 ? value + modulus : value;
}

function countMatches(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

// ── Sandbox setup ───────────────────────────────────────────────────────────────
function loadIntoSandbox(path, sandbox) {
  const code = fs.readFileSync(path, 'utf8');
  vm.runInContext(code, sandbox, { filename: path });
}

const sandbox = vm.createContext({
  console, Math, Set, Map, Number, Array, String, parseInt, parseFloat,
  RegExp, Object, Boolean, Error, clearTimeout, setTimeout, JSON,
  'Number.isFinite': Number.isFinite
});

loadIntoSandbox('helpers.js', sandbox);
loadIntoSandbox('geometry.js', sandbox);

// ── helpers.js tests ────────────────────────────────────────────────────────────

suite('clamp', () => {
  assertEq(sandbox.clamp(5, 0, 10, 0), 5, 'value within range');
  assertEq(sandbox.clamp(-3, 0, 10, 0), 0, 'clamp below min');
  assertEq(sandbox.clamp(15, 0, 10, 0), 10, 'clamp above max');
  assertEq(sandbox.clamp(NaN, 0, 10, 7), 7, 'NaN uses fallback');
  assertEq(sandbox.clamp(undefined, 0, 10, 3), 3, 'undefined uses fallback');
  assertEq(sandbox.clamp(Infinity, 0, 10, 5), 5, 'Infinity uses fallback (not finite)');
  assertEq(sandbox.clamp(-Infinity, 0, 10, 5), 5, '-Infinity uses fallback (not finite)');
});

suite('sanitizeInt', () => {
  assertEq(sandbox.sanitizeInt('42', 0), 42, 'parses integer string');
  assertEq(sandbox.sanitizeInt('3.7', 0), 3, 'truncates float string');
  assertEq(sandbox.sanitizeInt('abc', 99), 99, 'non-numeric returns fallback');
  assertEq(sandbox.sanitizeInt('', 5), 5, 'empty string returns fallback');
  assertEq(sandbox.sanitizeInt(null, 10), 10, 'null returns fallback');
});

suite('directional axis helpers', () => {
  assertEq(sandbox.coerceEdoValue('22'), 22, 'EDO parses valid integer');
  assertEq(sandbox.coerceEdoValue('0'), 1, 'EDO is clamped to minimum');
  assertEq(sandbox.coerceEdoValue('99'), 72, 'EDO is clamped to maximum');
  assertEq(sandbox.clampAxisDirectionValue('-3', 12, 0), 0, 'direction rejects negative values');
  assertEq(sandbox.clampAxisDirectionValue('18', 12, 0), 11, 'direction is bounded by EDO');

  const upDerived = sandbox.deriveDirectionalAxes({ right: 7, upRight: 0, downRight: 4 }, 12, 'upRight');
  assertEq(upDerived.upRight, 3, 'up-right derives from right minus down-right');

  const rightDerived = sandbox.deriveDirectionalAxes({ right: 0, upRight: 5, downRight: 4 }, 12, 'right');
  assertEq(rightDerived.right, 9, 'right derives from up-right plus down-right');

  const downDerived = sandbox.deriveDirectionalAxes({ right: 2, upRight: 5, downRight: 0 }, 12, 'downRight');
  assertEq(downDerived.downRight, 9, 'down-right derives modulo EDO from right minus up-right');

  assertEq(sandbox.approximateRatioInEdo(3 / 2, 12), 7, '12-EDO fifth approximates 3/2');
  assertEq(sandbox.approximateRatioInEdo(5 / 4, 12), 4, '12-EDO major third approximates 5/4');

  const tuned12 = sandbox.getDirectionalAxesForTuning(12);
  assertEq(tuned12.right, 7, '12-EDO tuned right axis is fifth');
  assertEq(tuned12.upRight, 4, '12-EDO tuned up-right axis is major third');
  assertEq(tuned12.downRight, 3, '12-EDO tuned down-right axis derives minor third');

  const tuned19 = sandbox.getDirectionalAxesForTuning(19);
  assertEq(tuned19.right, 11, '19-EDO tuned right axis is nearest fifth');
  assertEq(tuned19.upRight, 6, '19-EDO tuned up-right axis is nearest major third');
  assertEq(tuned19.downRight, 5, '19-EDO tuned down-right axis derives from fifth and third');

  const tuned1 = sandbox.getDirectionalAxesForTuning(1);
  assertEq(tuned1.right, 0, '1-EDO tuned right normalizes to zero');
  assertEq(tuned1.upRight, 0, '1-EDO tuned up-right normalizes to zero');
  assertEq(tuned1.downRight, 0, '1-EDO tuned down-right normalizes to zero');
});

suite('default overlay triangle roles', () => {
  function createElementStub(tagName) {
    return {
      tagName,
      children: [],
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      setAttribute(name, value) {
        this[name] = String(value);
      }
    };
  }

  const overlayList = createElementStub('div');
  const overlaySandbox = vm.createContext({
    console, Math, Set, Map, Number, Array, String, parseInt, parseFloat,
    RegExp, Object, Boolean, Error, clearTimeout, setTimeout, JSON,
    document: {
      getElementById(id) {
        if (id === 'overlayList') return overlayList;
        const values = {
          edo: '12',
          axisRight: '7',
          axisUpRight: '4',
          axisDownRight: '3'
        };
        return Object.prototype.hasOwnProperty.call(values, id) ? { value: values[id] } : null;
      },
      createElement: createElementStub
    }
  });
  loadIntoSandbox('helpers.js', overlaySandbox);
  loadIntoSandbox('overlays.js', overlaySandbox);

  vm.runInContext("addOverlay({ color: 'rgb(255 0 0)' }); addOverlay({ color: 'rgb(0 0 255)' });", overlaySandbox);

  assertEq(vm.runInContext('upOverlayId', overlaySandbox), 1, 'first default overlay is mapped to up-triangle clicks');
  assertEq(vm.runInContext('downOverlayId', overlaySandbox), 2, 'second default overlay is mapped to down-triangle clicks');
  assertEq(vm.runInContext('overlays[0].color', overlaySandbox), 'rgb(255 0 0)', 'first default overlay stays red');
  assertEq(vm.runInContext('overlays[1].color', overlaySandbox), 'rgb(0 0 255)', 'second default overlay stays blue');
  assertEq(vm.runInContext('overlays[0].steps.join(",")', overlaySandbox), '0,4,7', 'first default overlay uses upward steps');
  assertEq(vm.runInContext('overlays[1].steps.join(",")', overlaySandbox), '0,3,7', 'second default overlay uses downward steps');

  vm.runInContext('synchronizeDefaultOverlaySteps(9, 4, 12)', overlaySandbox);
  assertEq(vm.runInContext('overlays[0].steps.join(",")', overlaySandbox), '0,5,9', 'first auto-sync overlay remains upward after axis changes');
  assertEq(vm.runInContext('overlays[1].steps.join(",")', overlaySandbox), '0,4,9', 'second auto-sync overlay remains downward after axis changes');

  vm.runInContext('renderOverlayListPanel()', overlaySandbox);
  assertEq(overlayList.children[0].children[1].children[1].checked, true, 'first overlay up radio is checked by default');
  assertEq(overlayList.children[0].children[1].children[3].checked, false, 'first overlay down radio is unchecked by default');
  assertEq(overlayList.children[1].children[1].children[1].checked, false, 'second overlay up radio is unchecked by default');
  assertEq(overlayList.children[1].children[1].children[3].checked, true, 'second overlay down radio is checked by default');
});

suite('default overlay role migration', () => {
  function createElementStub(tagName) {
    return {
      tagName,
      children: [],
      classList: {
        add() {},
        remove() {},
        toggle() {},
        contains() { return false; }
      },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      setAttribute(name, value) {
        this[name] = String(value);
      }
    };
  }

  function createInputStub(value) {
    return {
      value,
      checked: false,
      addEventListener() {},
      classList: {
        add() {},
        remove() {},
        toggle() {},
        contains() { return false; }
      }
    };
  }

  const overlayList = createElementStub('div');
  const elementMap = {
    overlayList,
    edo: createInputStub('12'),
    axisRight: createInputStub('7'),
    axisUpRight: createInputStub('3'),
    axisDownRight: createInputStub('4')
  };
  const oldDefaultState = {
    version: 2,
    edo: 12,
    axisRight: 7,
    axisUpRight: 3,
    axisDownRight: 4,
    axisEditOrder: ['right', 'downRight'],
    canvasSize: 'A4',
    orientation: 'portrait',
    canvasWidth: 1000,
    canvasHeight: 1000,
    triangleSize: 75,
    colorX: '#FFFF00',
    colorY: '#FF0000',
    colorZ: '#0000FF',
    backgroundColor: '#FFFFFF',
    labelColor: '#000000',
    highlightZero: false,
    highlightZeroColor: '#FFFF00',
    overlays: [
      { steps: [0, 4, 7], color: 'rgb(255 0 0)', opacity: 0.35, anchors: [], repeatAll: false, nonTriangleMode: false, visible: true, autoSync: true },
      { steps: [0, 3, 7], color: 'rgb(0 0 255)', opacity: 0.35, anchors: [], repeatAll: false, nonTriangleMode: false, visible: true, autoSync: true }
    ],
    activeOverlayIdx: 1,
    upOverlayIdx: 1,
    downOverlayIdx: 0,
    sidebarCollapsed: false,
    controlsCollapsed: false
  };
  const storage = new Map([['tonnetz-state', JSON.stringify(oldDefaultState)]]);
  const migrationSandbox = vm.createContext({
    console, Math, Set, Map, Number, Array, String, parseInt, parseFloat,
    RegExp, Object, Boolean, Error, clearTimeout, setTimeout, JSON,
    window: { innerWidth: 1024 },
    location: { hash: '', pathname: '/' },
    history: { replaceState() {} },
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    },
    document: {
      getElementById(id) {
        return elementMap[id] || null;
      },
      createElement: createElementStub,
      body: {
        appendChild() {},
        removeChild() {}
      }
    },
    navigator: {}
  });
  loadIntoSandbox('helpers.js', migrationSandbox);
  loadIntoSandbox('overlays.js', migrationSandbox);
  loadIntoSandbox('app-persistence.js', migrationSandbox);

  vm.runInContext(`
    const stub = function (value) {
      return {
        value: value || '',
        checked: false,
        addEventListener: function () {},
        classList: {
          add: function () {},
          remove: function () {},
          toggle: function () {},
          contains: function () { return false; }
        }
      };
    };
    function runPersistenceRestore() {
      const controller = createTonnetzPersistenceController({
        canvas: stub(),
        controlsBackdrop: stub(),
        controlsContent: stub(),
        overlaySidebar: stub(),
        canvasSizeSelect: stub('A4'),
        orientationSelect: stub('portrait'),
        canvasWidthInput: stub('1000'),
        canvasHeightInput: stub('1000'),
        triangleSizeInput: stub('75'),
        colorXInput: stub('#FFFF00'),
        colorYInput: stub('#FF0000'),
        colorZInput: stub('#0000FF'),
        backgroundColorInput: stub('#FFFFFF'),
        labelColorInput: stub('#000000'),
        highlightZeroInput: stub(),
        highlightZeroColorInput: stub('#FFFF00'),
        scaleDegreesInput: stub(''),
        scaleSizeInput: stub('1.5'),
        scaleDotsInput: stub(),
        scaleDotColorInput: stub('#000000'),
        scaleDotSizeInput: stub('6'),
        edoInput: document.getElementById('edo'),
        axisRightInput: document.getElementById('axisRight'),
        axisUpRightInput: document.getElementById('axisUpRight'),
        axisDownRightInput: document.getElementById('axisDownRight'),
        syncDirectionalAxes: function () {},
        getAxisEditOrder: function () { return ['right', 'downRight']; },
        setAxisEditOrder: function () {},
        copyLinkBtn: null,
        resetBtn: null,
        DEFAULT_COLORS: {
          x: 'rgb(255 255 0)',
          y: 'rgb(255 0 0)',
          z: 'rgb(0 0 255)',
          bg: 'rgb(255 255 255)',
          label: 'rgb(0 0 0)',
          highlightZero: 'rgb(255 255 0)'
        },
        handleCanvasSizeChange: function () {},
        getDrawTonnetz: function () { return function () {}; },
        getLastOffscreenCanvas: function () { return null; },
        setControlsDesktopCollapsedState: function () {},
        setSidebarDesktopCollapsedState: function () {}
      });
      controller.initializePersistence();
    }
    runPersistenceRestore();
  `, migrationSandbox);

  assertEq(vm.runInContext('upOverlayId', migrationSandbox), 1, 'old saved default maps first overlay to up on restore');
  assertEq(vm.runInContext('downOverlayId', migrationSandbox), 2, 'old saved default maps second overlay to down on restore');
  assertEq(elementMap.axisRight.value, 7, 'old saved default migrates right axis to tuned fifth');
  assertEq(elementMap.axisUpRight.value, 4, 'old saved default migrates up-right axis to tuned major third');
  assertEq(elementMap.axisDownRight.value, 3, 'old saved default migrates down-right axis to derived minor third');
  assertEq(vm.runInContext('overlays[0].steps.join(",")', migrationSandbox), '0,4,7', 'old saved first default is re-synced to upward steps');
  assertEq(vm.runInContext('overlays[1].steps.join(",")', migrationSandbox), '0,3,7', 'old saved second default is re-synced to downward steps');
  assertEq(overlayList.children[0].children[1].children[1].checked, true, 'restored first overlay up radio is checked');
  assertEq(overlayList.children[1].children[1].children[3].checked, true, 'restored second overlay down radio is checked');

  const staleVersion3State = {
    ...oldDefaultState,
    version: 3,
    axisRight: 8,
    axisUpRight: 4,
    axisDownRight: 4,
    axisEditOrder: ['upRight', 'downRight'],
    upOverlayIdx: 0,
    downOverlayIdx: 1,
    overlays: [
      { steps: [0, 4, 8], color: 'rgb(255 0 0)', opacity: 0.35, anchors: [], repeatAll: false, nonTriangleMode: false, visible: true, autoSync: true },
      { steps: [0, 4, 8], color: 'rgb(0 0 255)', opacity: 0.35, anchors: [], repeatAll: false, nonTriangleMode: false, visible: true, autoSync: true }
    ]
  };
  storage.set('tonnetz-state', JSON.stringify(staleVersion3State));
  elementMap.axisRight.value = '8';
  elementMap.axisUpRight.value = '4';
  elementMap.axisDownRight.value = '4';
  overlayList.children = [];
  vm.runInContext(`
    overlays.length = 0;
    overlayIdCounter = 1;
    activeOverlayId = null;
    upOverlayId = null;
    downOverlayId = null;
    runPersistenceRestore();
  `, migrationSandbox);

  assertEq(elementMap.axisRight.value, 7, 'stale v3 default migrates right axis to tuned fifth');
  assertEq(elementMap.axisUpRight.value, 4, 'stale v3 default keeps tuned up-right major third');
  assertEq(elementMap.axisDownRight.value, 3, 'stale v3 default migrates down-right to derived minor third');
  assertEq(vm.runInContext('overlays[0].steps.join(",")', migrationSandbox), '0,4,7', 'stale v3 first default overlay uses tuned upward steps');
  assertEq(vm.runInContext('overlays[1].steps.join(",")', migrationSandbox), '0,3,7', 'stale v3 second default overlay uses tuned downward steps');
});

suite('parseChordSteps', () => {
  const pcs = sandbox.parseChordSteps;
  assert(Array.isArray(pcs('0,4,7')), 'returns array');
  assertEq(pcs('0,4,7').join(','), '0,4,7', 'comma-separated');
  assertEq(pcs('0 4 7').join(','), '0,4,7', 'space-separated');
  assertEq(pcs('0, 4, 7').join(','), '0,4,7', 'comma-space separated');
  assertEq(pcs('0,\n4\t7').join(','), '0,4,7', 'mixed whitespace separated');
  assertEq(pcs('-1,14').join(','), '-1,14', 'preserves signed and out-of-range integers for later normalization');
  assertEq(pcs('').join(','), '0', 'empty string returns [0]');
  assertEq(pcs(null).join(','), '0', 'null returns [0]');
  assertEq(pcs(undefined).join(','), '0', 'undefined returns [0]');
  assertEq(pcs('3').join(','), '3', 'single value');
});

suite('hexToRgbString', () => {
  assertEq(sandbox.hexToRgbString('#FF0000'), 'rgb(255 0 0)', 'red without alpha');
  assertEq(sandbox.hexToRgbString('#00ff00', 0.5), 'rgb(0 255 0 / 0.5)', 'green with alpha');
  assertEq(sandbox.hexToRgbString('#0000FF'), 'rgb(0 0 255)', 'blue');
  assertEq(sandbox.hexToRgbString('invalid'), 'rgb(0 0 0)', 'invalid hex falls back to black');
  assertEq(sandbox.hexToRgbString(''), 'rgb(0 0 0)', 'empty string falls back to black');
  assertEq(sandbox.hexToRgbString('#000000'), 'rgb(0 0 0)', 'black');
  assertEq(sandbox.hexToRgbString('invalid', 0.3), 'rgb(0 0 0 / 0.3)', 'invalid with alpha');
});

suite('rgbStringToHex', () => {
  assertEq(sandbox.rgbStringToHex('rgb(255 0 0)'), '#FF0000', 'red');
  assertEq(sandbox.rgbStringToHex('rgb(0, 128, 0)'), '#008000', 'green comma syntax');
  assertEq(sandbox.rgbStringToHex('rgb(0 0 255 / 0.5)'), '#0000FF', 'blue with alpha');
  assertEq(sandbox.rgbStringToHex(''), '#000000', 'empty string returns black');
  assertEq(sandbox.rgbStringToHex(null), '#000000', 'null returns black');
  assertEq(sandbox.rgbStringToHex('not-a-color'), '#000000', 'invalid returns black');
});

suite('hexToRgbString <-> rgbStringToHex round-trip', () => {
  const hexes = ['#AA33FF', '#000000', '#FFFFFF', '#12AB9F'];
  for (const hex of hexes) {
    const rgb = sandbox.hexToRgbString(hex);
    const back = sandbox.rgbStringToHex(rgb);
    assertEq(back, hex.toUpperCase(), `round-trip ${hex}`);
  }
});

suite('normalizeColorToRgb', () => {
  assertEq(sandbox.normalizeColorToRgb('#FF0000'), 'rgb(255 0 0)', 'hex normalizes via hexToRgbString');
  assertEq(sandbox.normalizeColorToRgb('rgb(1 2 3)'), 'rgb(1 2 3)', 'rgb string is preserved');
  assertEq(sandbox.normalizeColorToRgb('blue'), 'rgb(0 0 255)', 'named color is expanded');
  assertEq(sandbox.normalizeColorToRgb('mystery'), 'mystery', 'unknown value is passed through');
  assertEq(sandbox.normalizeColorToRgb(null), 'rgb(0 0 0)', 'null falls back to black');
});

// ── geometry.js tests ───────────────────────────────────────────────────────────

suite('SQRT3_HALF constant', () => {
  assertApprox(sandbox.SQRT3_HALF, Math.sqrt(3) / 2, 1e-12, 'matches Math.sqrt(3)/2');
});

suite('qrToPixel basics', () => {
  const size = 40;
  const p00 = sandbox.qrToPixel(0, 0, size);
  assertEq(p00.x, 0, 'origin x');
  assertEq(p00.y, 0, 'origin y');

  const p10 = sandbox.qrToPixel(1, 0, size);
  assertEq(p10.x, size, 'q=1,r=0 x = size');
  assertEq(p10.y, 0, 'q=1,r=0 y = 0');

  // Row 1: col = q + floor(1/2) = q, xOffset = (1%2)*size/2 = size/2
  const p01 = sandbox.qrToPixel(0, 1, size);
  assertEq(p01.x, size / 2, 'q=0,r=1 x = size/2');
  assertApprox(p01.y, size * Math.sqrt(3) / 2, 1e-10, 'q=0,r=1 y = h');
});

suite('qrToPixel negative rows (mod fix)', () => {
  const size = 40;
  // For r=-1: col = q + floor(-1/2) = q + (-1) = q-1; xOffset = ((-1%2+2)%2)*(size/2) = 1*(size/2)
  const pn1 = sandbox.qrToPixel(0, -1, size);
  assertEq(pn1.x, -1 * size + size / 2, 'q=0,r=-1 x');
  assertApprox(pn1.y, -1 * size * Math.sqrt(3) / 2, 1e-10, 'q=0,r=-1 y');

  // For r=-2: col = q + floor(-2/2) = q + (-1) = q-1; xOffset = ((-2%2+2)%2)*(size/2) = 0
  const pn2 = sandbox.qrToPixel(0, -2, size);
  assertEq(pn2.x, -1 * size, 'q=0,r=-2 x');
});

suite('qrToPixel <-> pixelToQR round-trip', () => {
  const size = 40;
  const testCoords = [
    { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }, { q: 2, r: 3 },
    { q: -1, r: 2 }, { q: 3, r: 4 }, { q: 5, r: 5 }, { q: 0, r: 2 }
  ];
  for (const { q, r } of testCoords) {
    const pt = sandbox.qrToPixel(q, r, size);
    // Nudge slightly toward triangle interior (downward from apex)
    const result = sandbox.pixelToQR(pt.x + 0.01, pt.y + 1, size);
    assertEq(result.q, q, `round-trip q for (${q},${r})`);
    assertEq(result.r, r, `round-trip r for (${q},${r})`);
  }
});

suite('approximateQR', () => {
  const size = 40;
  const pt = sandbox.qrToPixel(2, 3, size);
  const approx = sandbox.approximateQR(pt.x + 1, pt.y - 1, size);
  assertEq(approx.q, 2, 'approximateQR recovers q near the apex');
  assertEq(approx.r, 3, 'approximateQR recovers r near the apex');
});

suite('solveStepToUV', () => {
  // In 12-EDO, ix=7,iz=4: step 0 should give u=0,v=0
  const r0 = sandbox.solveStepToUV(0, 7, 4, 12);
  assertEq(r0.u, 0, 'step=0 u');
  assertEq(r0.v, 0, 'step=0 v');

  // step 7 with ix=7,iz=4: u=1,v=0 is the simplest (1*7 = 7 mod 12)
  const r7 = sandbox.solveStepToUV(7, 7, 4, 12);
  let val7 = (r7.u * 7 + r7.v * 4) % 12;
  if (val7 < 0) val7 += 12;
  assertEq(val7, 7, 'step=7 maps correctly');

  // step 4: v=1,u=0 (0*7 + 1*4 = 4 mod 12)
  const r4 = sandbox.solveStepToUV(4, 7, 4, 12);
  let val4 = (r4.u * 7 + r4.v * 4) % 12;
  if (val4 < 0) val4 += 12;
  assertEq(val4, 4, 'step=4 maps correctly');

  // Arbitrary: step 11 in 12-EDO, verify congruence
  const r11 = sandbox.solveStepToUV(11, 7, 4, 12);
  let val11 = (r11.u * 7 + r11.v * 4) % 12;
  if (val11 < 0) val11 += 12;
  assertEq(val11, 11, 'step=11 maps correctly');
});

suite('solveStepToUV larger EDO regression', () => {
  const result = sandbox.solveStepToUV(25, 1, 1, 50);
  assert(result !== null, 'finds a solution outside the old radius-12 window');
  assert(result.u !== 0 || result.v !== 0, 'does not collapse to the origin for step 25 in 50-EDO');
  assertEq(normalize(result.u * 1 + result.v * 1, 50), 25, 'large-EDO solution satisfies the congruence');
});

suite('solveStepToUV unrepresentable steps', () => {
  const result = sandbox.solveStepToUV(1, 2, 4, 12);
  assertEq(result, null, 'returns null when the step is not representable');
});

suite('findPeriodVectors', () => {
  // Standard 12-EDO, ix=7, iz=4
  const { p1, p2 } = sandbox.findPeriodVectors(7, 4, 12);

  // Both must be zero-congruent: ix*u + iz*v === 0 (mod edo)
  let c1 = (7 * p1.u + 4 * p1.v) % 12;
  if (c1 < 0) c1 += 12;
  assertEq(c1, 0, 'p1 is zero-congruent');

  let c2 = (7 * p2.u + 4 * p2.v) % 12;
  if (c2 < 0) c2 += 12;
  assertEq(c2, 0, 'p2 is zero-congruent');

  // Non-collinear: cross product != 0
  const cross = p1.u * p2.v - p1.v * p2.u;
  assert(cross !== 0, 'p1 and p2 are non-collinear');
});

suite('findPeriodVectors edge cases', () => {
  // EDO=1: everything is congruent to 0
  const { p1: a1, p2: a2 } = sandbox.findPeriodVectors(1, 1, 1);
  assert(a1.u !== 0 || a1.v !== 0, 'p1 non-zero for edo=1');
  const crossA = a1.u * a2.v - a1.v * a2.u;
  assert(crossA !== 0, 'non-collinear for edo=1');

  // ix=iz: degenerate-ish case
  const { p1: b1, p2: b2 } = sandbox.findPeriodVectors(5, 5, 12);
  let cb1 = (5 * b1.u + 5 * b1.v) % 12;
  if (cb1 < 0) cb1 += 12;
  assertEq(cb1, 0, 'p1 zero for ix=iz=5');
  const crossB = b1.u * b2.v - b1.v * b2.u;
  assert(crossB !== 0, 'non-collinear for ix=iz=5');
});

suite('findPeriodVectors larger EDO regression', () => {
  const { p1, p2 } = sandbox.findPeriodVectors(1, 1, 33);
  assertEq(normalize(1 * p1.u + 1 * p1.v, 33), 0, 'p1 is zero-congruent in 33-EDO');
  assertEq(normalize(1 * p2.u + 1 * p2.v, 33), 0, 'p2 is zero-congruent in 33-EDO');
  assert(p1.u * p2.v - p1.v * p2.u !== 0, 'period vectors stay non-collinear in 33-EDO');
});

suite('findNearestOffsets', () => {
  // Reset cache
  sandbox.findNearestOffsets._cache = new Map();
  const size = 40;
  const aq = 0, ar = 0;
  const anchorPx = sandbox.qrToPixel(aq, ar, size);
  const offsets = sandbox.findNearestOffsets(7, 7, 4, 12, aq, ar, size, anchorPx, 4);
  assert(Array.isArray(offsets), 'returns array');
  assert(offsets.length >= 1, 'at least one offset');

  // Each offset must satisfy the congruence
  for (const o of offsets) {
    let val = (7 * o.u + 4 * o.v) % 12;
    if (val < 0) val += 12;
    assertEq(val, 7, `offset (${o.u},${o.v}) is step-7 congruent`);
  }

  // Sorted by distance (d2 non-decreasing)
  for (let i = 1; i < offsets.length; i++) {
    assert(offsets[i].d2 >= offsets[i - 1].d2, 'sorted by distance');
  }
});

suite('findNearestOffsets larger EDO regression', () => {
  sandbox.findNearestOffsets._cache = new Map();
  const size = 40;
  const anchorPx = sandbox.qrToPixel(0, 0, size);
  const offsets = sandbox.findNearestOffsets(25, 1, 1, 50, 0, 0, size, anchorPx, 4);
  assert(offsets.length >= 4, 'finds four congruent offsets beyond the old maxRange=40 cap');
  for (const offset of offsets) {
    assertEq(normalize(offset.u + offset.v, 50), 25, 'offset remains congruent in 50-EDO');
  }
});

suite('pointInTriangle', () => {
  // Simple right triangle with vertices at (0,0), (10,0), (0,10)
  assert(sandbox.pointInTriangle(2, 2, 0, 0, 10, 0, 0, 10), 'interior point');
  assert(sandbox.pointInTriangle(0, 0, 0, 0, 10, 0, 0, 10), 'vertex');
  assert(sandbox.pointInTriangle(5, 0, 0, 0, 10, 0, 0, 10), 'edge');
  assert(!sandbox.pointInTriangle(10, 10, 0, 0, 10, 0, 0, 10), 'outside point');
  assert(!sandbox.pointInTriangle(-1, -1, 0, 0, 10, 0, 0, 10), 'negative outside');
});

suite('anchorFromClick', () => {
  const size = 40;
  const pt = sandbox.qrToPixel(0, 0, size);
  // Search near the apex for a pixel within the overlay triangle
  let res = null;
  const radius = Math.floor(size * 0.5);
  for (let dy = -radius; dy <= radius && !res; dy += 4) {
    for (let dx = -radius; dx <= radius; dx += 4) {
      try {
        const r = sandbox.anchorFromClick(pt.x + dx, pt.y + dy, size, 12, 7, 4, [0, 4, 7]);
        if (r && r.q === 0 && r.r === 0) { res = r; break; }
      } catch (e) {}
    }
  }
  assert(res !== null, 'finds anchor (0,0) near origin');
  assert(res && res.q === 0 && res.r === 0, 'anchor is (0,0)');

  // Null for insufficient steps
  assertEq(sandbox.anchorFromClick(0, 0, size, 12, 7, 4, [0, 4]), null, 'returns null for < 3 steps');
  assertEq(sandbox.anchorFromClick(0, 0, size, 12, 7, 4, null), null, 'returns null for null steps');
});

suite('app bootstrap consolidation', () => {
  const appSource = fs.readFileSync('app.js', 'utf8');
  assertEq(countMatches(appSource, /debouncedDraw = debounce\(drawTonnetz, 120\)/g), 1, 'debounced draw initialization happens in one place');
});

suite('directional axis controls markup', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert(html.includes('id="axisRight"'), 'right axis input exists');
  assert(html.includes('id="axisUpRight"'), 'up-right axis input exists');
  assert(html.includes('id="axisDownRight"'), 'down-right axis input exists');
  assert(html.includes('id="axisRight" value="7"'), 'right axis defaults to 12-EDO fifth');
  assert(html.includes('id="axisUpRight" value="4"'), 'up-right axis defaults to 12-EDO major third');
  assert(html.includes('id="axisDownRight" value="3"'), 'down-right axis defaults to derived minor third');
  assert(!html.includes('id="intervalX"'), 'old interval X input is removed');
  assert(!html.includes('id="intervalZ"'), 'old interval Z input is removed');
});

suite('default overlay docs', () => {
  const readme = fs.readFileSync('README.md', 'utf8');
  assert(readme.includes('auto-tune from a 5-limit major/minor preset'), 'feature summary documents 5-limit axis auto-tuning');
  assert(readme.includes('→ approximates `3/2`, ↗ approximates `5/4`, and ↘ derives from those by default'), 'controls docs describe default axis tuning ratios');
  assert(readme.includes('Up: `[0, ↗, →]`, Down: `[0, ↘, →]`'), 'feature summary documents the new default overlay order');
  assert(readme.includes('Up overlay: `[0, ↗, →]` in red'), 'default overlay section documents red upward overlay first');
  assert(readme.includes('Down overlay: `[0, ↘, →]` in blue'), 'default overlay section documents blue downward overlay second');
  assert(!readme.includes('Down: `[0, ↘, →]`, Up: `[0, ↗, →]`'), 'README no longer documents old default order');
});

suite('app module split', () => {
  assert(fs.existsSync('app-rendering.js'), 'rendering controller file exists');
  assert(fs.existsSync('app-persistence.js'), 'persistence controller file exists');
  assert(fs.existsSync('app-navigation.js'), 'navigation controller file exists');

  const html = fs.readFileSync('index.html', 'utf8');
  const renderingIdx = html.indexOf('app-rendering.js');
  const persistenceIdx = html.indexOf('app-persistence.js');
  const navigationIdx = html.indexOf('app-navigation.js');
  const appIdx = html.indexOf('app.js');

  assert(renderingIdx >= 0, 'index loads rendering controller');
  assert(persistenceIdx >= 0, 'index loads persistence controller');
  assert(navigationIdx >= 0, 'index loads navigation controller');
  assert(renderingIdx < appIdx, 'rendering controller loads before app bootstrap');
  assert(persistenceIdx < appIdx, 'persistence controller loads before app bootstrap');
  assert(navigationIdx < appIdx, 'navigation controller loads before app bootstrap');

  const appSource = fs.readFileSync('app.js', 'utf8');
  assert(appSource.includes('createTonnetzRenderingController('), 'app bootstraps the rendering controller');
  assert(appSource.includes('createTonnetzPersistenceController('), 'app bootstraps the persistence controller');
  assert(appSource.includes('initializeAdaptiveNav('), 'app bootstraps the navigation controller');
  assert(appSource.includes("let axisEditOrder = ['right', 'upRight'];"), 'app defaults to deriving down-right axis');
  assert(appSource.includes('applyDirectionalAxesTuning();'), 'EDO changes apply axis tuning preset');
});

suite('legacy cleanup', () => {
  const helpersSource = fs.readFileSync('helpers.js', 'utf8');
  const persistenceSource = fs.readFileSync('app-persistence.js', 'utf8');

  assert(!helpersSource.includes('function hexToRgba('), 'unused hexToRgba alias has been removed');
  assert(!persistenceSource.includes("document.execCommand('copy')"), 'copy fallback no longer uses deprecated execCommand');
});

suite('browser smoke', () => {
  const smokeRun = spawnSync(process.execPath, [path.join(__dirname, 'run_browser_smoke.js')], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });

  if (smokeRun.status !== 0 && /CDP connection closed|Failed to connect to ws:\/\//i.test(`${smokeRun.stdout}\n${smokeRun.stderr}`)) {
    if (smokeRun.stdout.trim()) console.log(smokeRun.stdout.trim());
    console.log('SKIP: browser smoke tests (browser closed before results)');
    return;
  }
  if (smokeRun.stdout.trim()) console.log(smokeRun.stdout.trim());
  if (smokeRun.stderr.trim()) console.error(smokeRun.stderr.trim());
  assertEq(smokeRun.status, 0, 'browser smoke tests pass');
});

// ── Summary ─────────────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(50)}`);
console.log(`Tests: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
  process.exit(0);
}
