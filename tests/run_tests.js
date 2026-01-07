const fs = require('fs');
const vm = require('vm');

function loadIntoSandbox(path, sandbox) {
  const code = fs.readFileSync(path, 'utf8');
  vm.runInContext(code, sandbox, { filename: path });
}

const sandbox = vm.createContext({ console, Math, Set, Map, Number, Array, String });

// Load geometry helpers
loadIntoSandbox('geometry.js', sandbox);

function assert(cond, msg) {
  if (!cond) {
    console.error('Assertion failed:', msg);
    process.exit(1);
  }
}

const size = 40;
// Pixel for anchor (0,0)
const pt = sandbox.qrToPixel(0, 0, size);
// Search for a pixel near the apex that resolves to the expected anchor
let res = null;
const radius = Math.floor(size * 0.5);
for (let dy = -radius; dy <= radius && !res; dy += 4) {
  for (let dx = -radius; dx <= radius; dx += 4) {
    const px = pt.x + dx;
    const py = pt.y + dy;
    try {
      const r = sandbox.anchorFromClick(px, py, size, 12, 7, 4, [0, 4, 7]);
      if (r && r.q === 0 && r.r === 0) { res = r; break; }
    } catch (e) {}
  }
}
console.log('anchorFromClick returned:', res);
assert(res && res.q === 0 && res.r === 0, 'anchorFromClick should resolve to (0,0) for a point near apex');

console.log('All tests passed.');
process.exit(0);
