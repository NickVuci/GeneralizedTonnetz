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

// ── Summary ─────────────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(50)}`);
console.log(`Tests: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
  process.exit(0);
}
