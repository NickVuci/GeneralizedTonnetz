const fs = require('fs');
const vm = require('vm');

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

suite('responsive stylesheet consolidation', () => {
  const css = fs.readFileSync('styles.css', 'utf8');
  assertEq(countMatches(css, /\.controls-scroll-body\s*\{/g), 1, 'controls-scroll-body rule is defined once');
  assertEq(countMatches(css, /\.action-btns button\s*\{/g), 1, 'action button rule is defined once');
  assertEq(countMatches(css, /\.overlay-sidebar\.desktop-collapsed \.overlay-header-title,/g), 1, 'collapsed sidebar visibility override is defined once');
});

suite('app bootstrap consolidation', () => {
  const appSource = fs.readFileSync('app.js', 'utf8');
  assertEq(countMatches(appSource, /debouncedDraw = debounce\(drawTonnetz, 120\)/g), 1, 'debounced draw initialization happens in one place');
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
