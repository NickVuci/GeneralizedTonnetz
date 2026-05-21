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
loadIntoSandbox('drawing.js', sandbox);

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

suite('fixed overlay roles', () => {
  function createElementStub(tagName) {
    return {
      tagName,
      children: [],
      attributes: {},
      style: {
        setProperty(name, value) {
          this[name] = String(value);
        }
      },
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
        this.attributes[name] = String(value);
      },
      getAttribute(name) {
        return this.attributes[name];
      },
      querySelector() {
        return null;
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
          triangleSize: '40',
          edo: '12',
          axisRight: '7',
          axisUpRight: '4',
          axisDownRight: '3'
        };
        return Object.prototype.hasOwnProperty.call(values, id) ? { value: values[id] } : null;
      },
      createElement: createElementStub,
      createElementNS(namespace, tagName) {
        return createElementStub(tagName);
      }
    }
  });
  loadIntoSandbox('helpers.js', overlaySandbox);
  loadIntoSandbox('geometry.js', overlaySandbox);
  loadIntoSandbox('overlays.js', overlaySandbox);

  assertEq(vm.runInContext("getOverlayStepsForRole('up', 7, 3, 12).join(',')", overlaySandbox), '0,4,7', 'up role uses upward triangle steps');
  assertEq(vm.runInContext("getOverlayStepsForRole('down', 7, 3, 12).join(',')", overlaySandbox), '0,3,7', 'down role uses downward triangle steps');
  assertEq(vm.runInContext("getOverlayStepsForRole('up', 9, 4, 12).join(',')", overlaySandbox), '0,5,9', 'up role recomputes from changed axes');
  assertEq(vm.runInContext("getOverlayStepsForRole('down', 9, 4, 12).join(',')", overlaySandbox), '0,4,9', 'down role recomputes from changed axes');

  vm.runInContext("setOverlayAnchors({ up: [{ q: 1, r: 2 }], down: [{ q: 3, r: 4 }, { q: 5, r: 6 }] })", overlaySandbox);
  assertEq(vm.runInContext('getOverlayAnchorsSnapshot().up.length', overlaySandbox), 1, 'up role stores anchors');
  assertEq(vm.runInContext('getOverlayAnchorsSnapshot().down.length', overlaySandbox), 2, 'down role stores anchors');
  assertEq(vm.runInContext('getOverlayColorsSnapshot().up', overlaySandbox), 'rgb(255 0 0)', 'up role starts with default color');
  assertEq(vm.runInContext('getOverlayColorsSnapshot().down', overlaySandbox), 'rgb(0 0 255)', 'down role starts with default color');
  assertEq(vm.runInContext('getOverlayRepeatAllSnapshot().up', overlaySandbox), false, 'up role starts with repeat-all disabled');
  assertEq(vm.runInContext('getOverlayRepeatAllSnapshot().down', overlaySandbox), false, 'down role starts with repeat-all disabled');
  assertEq(vm.runInContext("setOverlayColor('up', '#00FF00'); getOverlayColorsSnapshot().up", overlaySandbox), 'rgb(0 255 0)', 'overlay color updates from hex input');
  assertEq(vm.runInContext("toggleOverlayRepeatAll('up')", overlaySandbox), true, 'repeat-all toggle flips on');
  assertEq(vm.runInContext('getOverlayRepeatAllSnapshot().up', overlaySandbox), true, 'repeat-all snapshot reflects toggled state');
  vm.runInContext("setOverlayAnchors({ up: [{ q: 6, r: 6 }], down: [] })", overlaySandbox);
  const repeatPeriods = vm.runInContext('findPeriodVectors(7, 3, 12)', overlaySandbox);
  assertEq(
    vm.runInContext(`toggleOverlayAnchor('up', ${6 + repeatPeriods.p1.u}, ${6 + repeatPeriods.p1.v}, { repeatAll: true, intervalX: 7, intervalZ: 3, edo: 12 })`, overlaySandbox),
    0,
    'clicking a repeated instance removes the repeated overlay seed'
  );
  assertEq(vm.runInContext('getOverlayAnchorsSnapshot().up.length', overlaySandbox), 0, 'repeated overlay removal clears matching seed anchors');
  vm.runInContext("setOverlayAnchors({ up: [{ q: 1, r: 2 }], down: [{ q: 3, r: 4 }, { q: 5, r: 6 }] })", overlaySandbox);

  vm.runInContext('renderOverlayListPanel()', overlaySandbox);
  assertEq(overlayList.children.length, 2, 'fixed overlay UI renders exactly two rows');
  assertEq(overlayList.children[0].getAttribute('data-role'), 'up', 'first fixed row is up');
  assertEq(overlayList.children[1].getAttribute('data-role'), 'down', 'second fixed row is down');
  assertEq(overlayList.children[0].children[0].children[0].className, 'ov-role-icon ov-role-icon-up ov-color-trigger', 'up row renders clickable up triangle icon');
  assertEq(overlayList.children[1].children[0].children[0].className, 'ov-role-icon ov-role-icon-down ov-color-trigger', 'down row renders clickable down triangle icon');
  assertEq(overlayList.children[0].children[0].children[0].children[0].children[0].attributes.points, '12,5 20,19 4,19', 'up row triangle points upward');
  assertEq(overlayList.children[1].children[0].children[0].children[0].children[0].attributes.points, '4,5 20,5 12,19', 'down row triangle points downward');
  assertEq(overlayList.children[0].children[0].children[0].children[1].value, '#00FF00', 'up row color input reflects updated color');
  assertEq(overlayList.children[0].children[0].children[1].className, 'ov-spacer', 'up row uses spacer where anchor count used to be');
  assertEq(overlayList.children[1].children[0].children[1].className, 'ov-spacer', 'down row uses spacer where anchor count used to be');
  assertEq(overlayList.children[0].children[0].children[2].children[0].checked, true, 'up row repeat-all toggle reflects updated state');
  assertEq(overlayList.children[0].children[0].children[2].children[1].textContent, 'Repeat', 'up row repeat toggle uses compact label');
  assertEq(vm.runInContext('getFixedOverlayDescriptors(7, 3, 12)[0].repeatAll', overlaySandbox), true, 'overlay descriptors include repeat-all state');
});

suite('fixed overlay persistence migration', () => {
  function createElementStub(tagName) {
    return {
      tagName,
      children: [],
      style: {
        setProperty(name, value) {
          this[name] = String(value);
        }
      },
      classList: {
        add() {},
        remove() {},
        toggle() {},
        contains() { return false; }
      },
      attributes: {},
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      getAttribute(name) {
        return this.attributes[name];
      },
      querySelector() {
        return null;
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
  const baseLegacyState = {
    edo: 12,
    axisRight: 7,
    axisUpRight: 4,
    axisDownRight: 3,
    axisEditOrder: ['right', 'upRight'],
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
    sidebarCollapsed: false,
    controlsCollapsed: false
  };
  const oldDefaultState = {
    ...baseLegacyState,
    version: 2,
    axisUpRight: 3,
    axisDownRight: 4,
    axisEditOrder: ['right', 'downRight'],
    overlays: [
      { steps: [0, 4, 7], color: 'rgb(255 0 0)', opacity: 0.35, anchors: [], repeatAll: false, nonTriangleMode: false, visible: true, autoSync: true },
      { steps: [0, 3, 7], color: 'rgb(0 0 255)', opacity: 0.35, anchors: [], repeatAll: false, nonTriangleMode: false, visible: true, autoSync: true }
    ],
    activeOverlayIdx: 1,
    upOverlayIdx: 1,
    downOverlayIdx: 0
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
      createElementNS(namespace, tagName) {
        return createElementStub(tagName);
      },
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
    function createPersistenceControllerForTest() {
      return createTonnetzPersistenceController({
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
    }
    function runPersistenceRestore() {
      const controller = createPersistenceControllerForTest();
      controller.initializePersistence();
      return controller;
    }
    runPersistenceRestore();
  `, migrationSandbox);

  assertEq(elementMap.axisRight.value, 7, 'old saved default migrates right axis to tuned fifth');
  assertEq(elementMap.axisUpRight.value, 4, 'old saved default migrates up-right axis to tuned major third');
  assertEq(elementMap.axisDownRight.value, 3, 'old saved default migrates down-right axis to derived minor third');
  assertEq(vm.runInContext('getOverlayAnchorsSnapshot().up.length', migrationSandbox), 0, 'old saved default starts with empty up anchors');
  assertEq(vm.runInContext('getOverlayAnchorsSnapshot().down.length', migrationSandbox), 0, 'old saved default starts with empty down anchors');
  assertEq(vm.runInContext('getOverlayColorsSnapshot().up', migrationSandbox), 'rgb(255 0 0)', 'old saved default restores up color');
  assertEq(vm.runInContext('getOverlayColorsSnapshot().down', migrationSandbox), 'rgb(0 0 255)', 'old saved default restores down color');
  assertEq(vm.runInContext('getOverlayRepeatAllSnapshot().up', migrationSandbox), false, 'old saved default restores up repeat-all as disabled');
  assertEq(vm.runInContext('getOverlayRepeatAllSnapshot().down', migrationSandbox), false, 'old saved default restores down repeat-all as disabled');

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
  vm.runInContext('setOverlayAnchors({ up: [], down: [] }); runPersistenceRestore();', migrationSandbox);

  assertEq(elementMap.axisRight.value, 7, 'stale v3 default migrates right axis to tuned fifth');
  assertEq(elementMap.axisUpRight.value, 4, 'stale v3 default keeps tuned up-right major third');
  assertEq(elementMap.axisDownRight.value, 3, 'stale v3 default migrates down-right to derived minor third');

  const mappedLegacyState = {
    ...baseLegacyState,
    version: 4,
    overlays: [
      { color: 'rgb(12 12 12)', anchors: [{ q: 10, r: 11 }] },
      { color: 'rgb(34 34 34)', anchors: [{ q: 20, r: 21 }] }
    ],
    upOverlayIdx: 1,
    downOverlayIdx: 0
  };
  storage.set('tonnetz-state', JSON.stringify(mappedLegacyState));
  vm.runInContext('setOverlayAnchors({ up: [], down: [] }); runPersistenceRestore();', migrationSandbox);
  assertEq(vm.runInContext('getOverlayAnchorsSnapshot().up[0].q', migrationSandbox), 20, 'mapped legacy up anchors migrate from upOverlayIdx');
  assertEq(vm.runInContext('getOverlayAnchorsSnapshot().down[0].q', migrationSandbox), 10, 'mapped legacy down anchors migrate from downOverlayIdx');
  assertEq(vm.runInContext('getOverlayColorsSnapshot().up', migrationSandbox), 'rgb(34 34 34)', 'mapped legacy up color migrates from upOverlayIdx');
  assertEq(vm.runInContext('getOverlayColorsSnapshot().down', migrationSandbox), 'rgb(12 12 12)', 'mapped legacy down color migrates from downOverlayIdx');

  const fallbackLegacyState = {
    ...baseLegacyState,
    version: 4,
    overlays: [
      { anchors: [{ q: 1, r: 2 }] },
      { anchors: [{ q: 3, r: 4 }] }
    ],
    upOverlayIdx: -1,
    downOverlayIdx: -1
  };
  storage.set('tonnetz-state', JSON.stringify(fallbackLegacyState));
  vm.runInContext('setOverlayAnchors({ up: [], down: [] }); runPersistenceRestore();', migrationSandbox);
  assertEq(vm.runInContext('getOverlayAnchorsSnapshot().up[0].q', migrationSandbox), 1, 'unmapped legacy up anchors fall back to first overlay');
  assertEq(vm.runInContext('getOverlayAnchorsSnapshot().down[0].q', migrationSandbox), 3, 'unmapped legacy down anchors fall back to second overlay');

  const currentState = {
    ...baseLegacyState,
    version: 6,
    overlayAnchors: {
      up: [{ q: 7, r: 8 }],
      down: [{ q: 9, r: 10 }]
    },
    overlayColors: {
      up: 'rgb(9 8 7)',
      down: '#010203'
    },
    overlayRepeatAll: {
      up: true,
      down: false
    }
  };
  storage.set('tonnetz-state', JSON.stringify(currentState));
  vm.runInContext('setOverlayAnchors({ up: [], down: [] }); runPersistenceRestore();', migrationSandbox);
  assertEq(vm.runInContext('getOverlayAnchorsSnapshot().up[0].q', migrationSandbox), 7, 'current up anchors restore from overlayAnchors');
  assertEq(vm.runInContext('getOverlayAnchorsSnapshot().down[0].q', migrationSandbox), 9, 'current down anchors restore from overlayAnchors');
  assertEq(vm.runInContext('getOverlayColorsSnapshot().up', migrationSandbox), 'rgb(9 8 7)', 'current up color restores from overlayColors');
  assertEq(vm.runInContext('getOverlayColorsSnapshot().down', migrationSandbox), 'rgb(1 2 3)', 'current down color normalizes from hex overlay color');
  assertEq(vm.runInContext('getOverlayRepeatAllSnapshot().up', migrationSandbox), true, 'current up repeat-all restores from overlayRepeatAll');
  assertEq(vm.runInContext('getOverlayRepeatAllSnapshot().down', migrationSandbox), false, 'current down repeat-all restores from overlayRepeatAll');

  vm.runInContext(`
    setOverlayAnchors({
      up: [{ q: 12, r: 13 }],
      down: [{ q: 14, r: 15 }]
    });
    setOverlayColors({
      up: '#102030',
      down: 'rgb(40 50 60)'
    });
    setOverlayRepeatAll({
      up: true,
      down: true
    });
    createPersistenceControllerForTest().saveStateToStorage();
  `, migrationSandbox);
  const savedState = JSON.parse(storage.get('tonnetz-state'));
  assertEq(savedState.version, 7, 'new persistence state uses fixed overlay version');
  assertEq(savedState.overlayAnchors.up[0].q, 12, 'new state saves up anchors');
  assertEq(savedState.overlayAnchors.down[0].q, 14, 'new state saves down anchors');
  assertEq(savedState.overlayColors.up, 'rgb(16 32 48)', 'new state saves up overlay color');
  assertEq(savedState.overlayColors.down, 'rgb(40 50 60)', 'new state saves down overlay color');
  assertEq(savedState.overlayRepeatAll.up, true, 'new state saves up repeat-all setting');
  assertEq(savedState.overlayRepeatAll.down, true, 'new state saves down repeat-all setting');
  assert(!Object.prototype.hasOwnProperty.call(savedState, 'overlays'), 'new state no longer saves arbitrary overlays');
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

suite('expandRepeatedOverlayAnchors', () => {
  const width = 800;
  const height = 800;
  const size = 40;
  const edo = 12;
  const intervalX = 7;
  const intervalZ = 3;
  const steps = [0, 4, 7];
  const seed = { q: 6, r: 6 };

  const single = sandbox.expandRepeatedOverlayAnchors(width, height, size, edo, intervalX, intervalZ, steps, [seed], false);
  assertEq(single.length, 1, 'repeat-all disabled preserves seed anchors only');
  assertEq(single[0].q, seed.q, 'repeat-all disabled preserves seed q');
  assertEq(single[0].r, seed.r, 'repeat-all disabled preserves seed r');

  const repeated = sandbox.expandRepeatedOverlayAnchors(width, height, size, edo, intervalX, intervalZ, steps, [seed], true);
  assert(repeated.length > 1, 'repeat-all expands to more than one visible equivalent anchor');
  assert(repeated.some(function (anchor) {
    return anchor.q === seed.q && anchor.r === seed.r;
  }), 'repeat-all includes the original seed anchor');

  const { p1, p2 } = sandbox.findPeriodVectors(intervalX, intervalZ, edo);
  assert(repeated.some(function (anchor) {
    return (anchor.q === seed.q + p1.u && anchor.r === seed.r + p1.v)
      || (anchor.q === seed.q + p2.u && anchor.r === seed.r + p2.v);
  }), 'repeat-all includes at least one period-translated equivalent anchor');
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

suite('fixed overlay click routing', () => {
  function createCtxStub() {
    return {
      save() {},
      restore() {},
      fillRect() {},
      clearRect() {},
      drawImage() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      stroke() {},
      fill() {},
      arc() {},
      fillText() {}
    };
  }

  const overlayList = { innerHTML: '', querySelector() { return null; }, appendChild() {} };
  const clickSandbox = vm.createContext({
    console, Math, Set, Map, Number, Array, String, parseInt, parseFloat,
    RegExp, Object, Boolean, Error, clearTimeout, setTimeout, JSON,
    document: {
      documentElement: {},
      body: {},
      getElementById(id) {
        return id === 'overlayList' ? overlayList : null;
      },
      createElement(tag) {
        if (tag === 'canvas') {
          return { width: 0, height: 0, getContext() { return createCtxStub(); } };
        }
        return {};
      }
    },
    getComputedStyle() {
      return {
        display: 'grid',
        fontFamily: 'Arial, sans-serif',
        getPropertyValue() { return ''; }
      };
    }
  });
  loadIntoSandbox('helpers.js', clickSandbox);
  loadIntoSandbox('geometry.js', clickSandbox);
  loadIntoSandbox('drawing.js', clickSandbox);
  loadIntoSandbox('overlays.js', clickSandbox);
  loadIntoSandbox('app-rendering.js', clickSandbox);

  vm.runInContext(`
    const canvas = {
      width: 600,
      height: 600,
      getBoundingClientRect: function () {
        return { left: 0, top: 0, width: 600, height: 600 };
      }
    };
    const controller = createTonnetzRenderingController({
      canvas,
      ctx: (${createCtxStub.toString()})(),
      canvasSizeSelect: { value: 'Custom' },
      orientationSelect: { value: 'portrait', disabled: false },
      customSizeGroup: { style: { display: 'grid' } },
      canvasWidthInput: { value: '600' },
      canvasHeightInput: { value: '600' },
      colorXInput: { value: '#FFFF00' },
      colorYInput: { value: '#FF0000' },
      colorZInput: { value: '#0000FF' },
      backgroundColorInput: { value: '#FFFFFF' },
      labelColorInput: { value: '#000000' },
      highlightZeroColorInput: { value: '#FFFF00' },
      highlightZeroInput: { checked: false },
      triangleSizeInput: { value: '40' },
      edoInput: { value: '12' },
      axisRightInput: { value: '7' },
      axisUpRightInput: { value: '4' },
      axisDownRightInput: { value: '3' },
      scaleDegreesInput: { value: '' },
      scaleSizeInput: { value: '1.5' },
      scaleDotsInput: { checked: false },
      scaleDotColorInput: { value: '#000000' },
      scaleDotSizeInput: { value: '6' }
    });

    function findClickForRole(role) {
      const size = 40;
      const edo = 12;
      const ix = 7;
      const iz = 3;
      const steps = getOverlayStepsForRole(role, ix, iz, edo);
      for (let y = -40; y <= 120; y += 2) {
        for (let x = -80; x <= 120; x += 2) {
          const approx = pixelToQR(x, y, size);
          const apex = qrToPixel(approx.q, approx.r, size);
          const orientation = y >= apex.y ? 'up' : 'down';
          if (orientation !== role) continue;
          const anchor = anchorFromClick(x, y, size, edo, ix, iz, steps);
          if (anchor) return { x, y };
        }
      }
      return null;
    }

    const upClick = findClickForRole('up');
    const downClick = findClickForRole('down');
    if (upClick) controller.onCanvasClick({ clientX: upClick.x, clientY: upClick.y });
    if (downClick) controller.onCanvasClick({ clientX: downClick.x, clientY: downClick.y });
  `, clickSandbox);

  assertEq(vm.runInContext('getOverlayAnchorsSnapshot().up.length', clickSandbox), 1, 'up-facing click toggles up role anchor');
  assertEq(vm.runInContext('getOverlayAnchorsSnapshot().down.length', clickSandbox), 1, 'down-facing click toggles down role anchor');
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
  assert(html.includes('class="axis-arrow-color-input" type="color" id="colorX"'), 'right axis arrow owns X color picker');
  assert(html.includes('class="axis-arrow-color-input" type="color" id="colorY"'), 'up-right axis arrow owns Y color picker');
  assert(html.includes('class="axis-arrow-color-input" type="color" id="colorZ"'), 'down-right axis arrow owns Z color picker');
  assert(!html.includes('<label for="colorX">X</label>'), 'old X color row label is removed');
  assert(!html.includes('<label for="colorY">Y</label>'), 'old Y color row label is removed');
  assert(!html.includes('<label for="colorZ">Z</label>'), 'old Z color row label is removed');
  assert(!html.includes('id="intervalX"'), 'old interval X input is removed');
  assert(!html.includes('id="intervalZ"'), 'old interval Z input is removed');
});

suite('default overlay docs', () => {
  const readme = fs.readFileSync('README.md', 'utf8');
  assert(readme.includes('auto-tune from a 5-limit major/minor preset'), 'feature summary documents 5-limit axis auto-tuning');
  assert(readme.includes('→ approximates `3/2`, ↗ approximates `5/4`, and ↘ derives from those by default'), 'controls docs describe default axis tuning ratios');
  assert(readme.includes('Up overlay: `[0, ↗, →]` in red'), 'feature summary documents fixed red upward overlay');
  assert(readme.includes('Down overlay: `[0, ↘, →]` in blue'), 'feature summary documents fixed blue downward overlay');
  assert(readme.includes('Overlay steps update from the current axes; only Up/Down anchor positions are saved.'), 'fixed overlay section documents saved anchor-only state');
  assert(!readme.includes('Add Overlay'), 'README no longer documents arbitrary overlay creation');
  assert(!readme.includes('Non-'), 'README no longer documents non-triangle overlay controls');
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
  const smokePath = path.join(__dirname, 'run_browser_smoke.js');
  if (!fs.existsSync(smokePath)) {
    console.log('SKIP: browser smoke tests (run_browser_smoke.js missing)');
    return;
  }

  const smokeRun = spawnSync(process.execPath, [smokePath], {
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
