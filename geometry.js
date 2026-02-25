// Geometry and lattice math helpers
const SQRT3_HALF = Math.sqrt(3) / 2;

function qrToPixel(q, r, size) {
    const h = size * SQRT3_HALF;
    const col = q + Math.floor(r / 2);
    const xOffset = ((r % 2 + 2) % 2) * (size / 2);
    const x = col * size + xOffset;
    const y = r * h;
    return { x, y };
}

function pixelToQR(px, py, size) {
    // Robust mapping of a pixel to the apex (q,r) of the triangle that actually contains it.
    // Handles both upward- and downward-pointing triangles by geometric hit-testing
    // instead of nearest-vertex rounding, which misclassifies points near edges.
    const h = size * SQRT3_HALF;

    // Point-in-upward triangle with apex at (ax, ay)
    function inUp(ax, ay) {
        const dx = px - ax;
        const dy = py - ay;
        if (dy < 0 || dy > h) return false;
        const half = (size / 2) * (dy / h);
        return Math.abs(dx) <= half;
    }

    // Point-in-downward triangle with apex at (ax, ay)
    function inDown(ax, ay) {
        const dx = px - ax;
        const dy = ay - py; // distance upward from the bottom apex
        if (dy < 0 || dy > h) return false;
        const half = (size / 2) * (dy / h);
        return Math.abs(dx) <= half;
    }

    // Candidate rows: a point may belong to an upward triangle whose apex is in
    // the current band (rowTop) or the band above (rowTop-1). For downward
    // triangles, the apex is in the band below (rowTop+1) or the current band.
    const rowTop = Math.floor(py / h);

    function xOff(row) { return ((row % 2 + 2) % 2) * (size / 2); } // safe mod for negatives

    // Try upward triangles first (more common for apex indexing)
    for (const rU of [rowTop, rowTop - 1]) {
        if (rU < 0) continue;
        const off = xOff(rU);
        const base = Math.floor((px - off) / size);
        const cols = [base - 1, base, base + 1]; // try a slightly wider neighborhood
        for (const col of cols) {
            const ax = col * size + off;
            const ay = rU * h;
            if (inUp(ax, ay)) {
                const q = col - Math.floor(rU / 2);
                const r = rU;
                return { q, r };
            }
        }
    }

    // Then try downward triangles
    for (const rD of [rowTop + 1, rowTop]) {
        if (rD < 0) continue;
        const off = xOff(rD);
        const base = Math.floor((px - off) / size);
        const cols = [base - 1, base, base + 1];
        for (const col of cols) {
            const ax = col * size + off;
            const ay = rD * h;
            if (inDown(ax, ay)) {
                const q = col - Math.floor(rD / 2);
                const r = rD;
                return { q, r };
            }
        }
    }

    // Fallback: choose the nearest apex among the four candidates
    const candidates = [];
    const rowBottom = rowTop + 1;
    const xOffTop = xOff(rowTop);
    const xOffBot = xOff(rowBottom);
    const topCols = [Math.floor((px - xOffTop) / size) - 1, Math.floor((px - xOffTop) / size), Math.floor((px - xOffTop) / size) + 1];
    const botCols = [Math.floor((px - xOffBot) / size) - 1, Math.floor((px - xOffBot) / size), Math.floor((px - xOffBot) / size) + 1];
    for (const col of topCols) candidates.push({ col, row: rowTop, x: col * size + xOffTop, y: rowTop * h });
    for (const col of botCols) candidates.push({ col, row: rowBottom, x: col * size + xOffBot, y: rowBottom * h });
    let best = candidates[0];
    let bestD2 = (px - best.x) * (px - best.x) + (py - best.y) * (py - best.y);
    for (let i = 1; i < candidates.length; i++) {
        const c = candidates[i];
        const d2 = (px - c.x) * (px - c.x) + (py - c.y) * (py - c.y);
        if (d2 < bestD2) { best = c; bestD2 = d2; }
    }
    const q = best.col - Math.floor(best.row / 2);
    const r = best.row;
    return { q, r };
}

function solveStepToUV(step, ix, iz, edo) {
    // Find small integers u, v s.t. u*ix + v*iz ≡ step (mod edo)
    const RANGE = 12; // search radius
    let best = null;
    for (let u = -RANGE; u <= RANGE; u++) {
        for (let v = -RANGE; v <= RANGE; v++) {
            let val = (u * ix + v * iz) % edo;
            if (val < 0) val += edo;
            if (val === step) {
                const score = Math.abs(u) + Math.abs(v);
                if (!best || score < best.score) best = { u, v, score };
            }
        }
    }
    if (best) return best;
    // Fallback: project along q or r only
    for (let u = -RANGE; u <= RANGE; u++) {
        let val = (u * ix) % edo; if (val < 0) val += edo;
        if (val === step) return { u, v: 0 };
    }
    for (let v = -RANGE; v <= RANGE; v++) {
        let val = (v * iz) % edo; if (val < 0) val += edo;
        if (val === step) return { u: 0, v };
    }
    return { u: 0, v: 0 };
}

function findPeriodVectors(ix, iz, edo) {
    // Find two small, non-collinear vectors (u,v) with ix*u + iz*v ≡ 0 (mod edo)
    const RANGE = 16;
    let candidates = [];
    for (let u = -RANGE; u <= RANGE; u++) {
        for (let v = -RANGE; v <= RANGE; v++) {
            if (u === 0 && v === 0) continue;
            let val = (ix * u + iz * v) % edo;
            if (val < 0) val += edo;
            if (val === 0) {
                const score = Math.abs(u) + Math.abs(v);
                candidates.push({ u, v, score });
            }
        }
    }
    // Sort by Manhattan length
    candidates.sort((a, b) => a.score - b.score);
    let p1 = candidates[0] || { u: 1, v: 0 };
    // Choose p2 not collinear with p1
    let p2 = null;
    for (const c of candidates) {
        if (p1.u * c.v - p1.v * c.u !== 0) { p2 = c; break; }
    }
    // If no non-collinear p2 found, construct one perpendicular-ish to p1
    if (!p2) {
        // Use a vector orthogonal in lattice space: swap and negate
        p2 = { u: -p1.v, v: p1.u, score: Math.abs(p1.v) + Math.abs(p1.u) };
    }
    return { p1, p2 };
}

function findNearestOffsets(step, ix, iz, edo, aq, ar, size, anchorPx, need = 4) {
    // Progressive search for nearest congruent offsets by true pixel distance
    // Use a simple memoization cache keyed by (step,ix,iz,edo,aq,ar,size)
    if (typeof findNearestOffsets._cache === 'undefined') findNearestOffsets._cache = new Map();
    const cacheKey = [step, ix, iz, edo, aq, ar, size].join('|');
    if (findNearestOffsets._cache.has(cacheKey)) {
        const cached = findNearestOffsets._cache.get(cacheKey);
        return cached.slice(0, need);
    }

    const seen = new Set();
    let candidates = [];
    let range = 4;
    const maxRange = 40;
    while (candidates.length < need && range <= maxRange) {
        for (let u = -range; u <= range; u++) {
            for (let v = -range; v <= range; v++) {
                if (u === 0 && v === 0) continue; // skip anchor itself
                let val = (ix * u + iz * v) % edo;
                if (val < 0) val += edo;
                if (val !== step) continue;
                const key = u + "," + v;
                if (seen.has(key)) continue;
                seen.add(key);
                const pt = qrToPixel(aq + u, ar + v, size);
                const dx = pt.x - anchorPx.x;
                const dy = pt.y - anchorPx.y;
                const d2 = dx * dx + dy * dy;
                const man = Math.abs(u) + Math.abs(v);
                candidates.push({ u, v, d2, man });
            }
        }
        range += 4;
    }
    candidates.sort((a, b) => (a.d2 - b.d2) || (a.man - b.man));
    // Cache the full sorted candidates for this key (up to a reasonable cap)
    const CAP = 200;
    findNearestOffsets._cache.set(cacheKey, candidates.slice(0, CAP));
    return candidates.slice(0, need);
}

// Approximate lattice node by simple rounding (used for candidate generation)
function approximateQR(px, py, size) {
    const h = size * SQRT3_HALF;
    const row = Math.round(py / h);
    const xOffset = (row % 2) * (size / 2);
    const col = Math.round((px - xOffset) / size);
    const q = col - Math.floor(row / 2);
    const r = row;
    return { q, r };
}

// Barycentric point-in-triangle test
function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
    const v0x = cx - ax, v0y = cy - ay;
    const v1x = bx - ax, v1y = by - ay;
    const v2x = px - ax, v2y = py - ay;
    const dot00 = v0x * v0x + v0y * v0y;
    const dot01 = v0x * v1x + v0y * v1y;
    const dot02 = v0x * v2x + v0y * v2y;
    const dot11 = v1x * v1x + v1y * v1y;
    const dot12 = v1x * v2x + v1y * v2y;
    const invDenom = 1 / (dot00 * dot11 - dot01 * dot01 || 1); // guard degenerate
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
    return u >= -1e-6 && v >= -1e-6 && (u + v) <= 1 + 1e-6;
}

// Resolve the anchor (q,r) whose overlay triangle (from the first three steps)
// actually contains the pixel. Returns null if not determinable.
function anchorFromClick(px, py, size, edo, ix, iz, steps) {
    if (!steps || steps.length < 3) return null;
    const triSteps = steps.slice(0, 3).map(s => ((s % edo) + edo) % edo);
    // Convert to lattice vectors relative to anchor
    const uv = triSteps.map(s => solveStepToUV(s, ix, iz, edo));
    // Ensure we have the anchor at (0,0) included; if not, prefer the smallest vector as anchor
    let zeroIdx = uv.findIndex(v => v.u === 0 && v.v === 0);
    let basis;
    if (zeroIdx >= 0) {
        basis = uv.filter((_, i) => i !== zeroIdx);
    } else {
        // Pick two shortest by Manhattan length as edges; treat third as anchor (effectively re-basing)
        const sorted = uv.map((v, i) => ({ i, m: Math.abs(v.u) + Math.abs(v.v), v }))
                         .sort((a, b) => a.m - b.m);
        basis = [sorted[0].v, sorted[1].v];
    }
    if (basis.length < 2) return null;
    const e1 = basis[0], e2 = basis[1];

    // Generate candidate anchors around approximate location
    const approx = approximateQR(px, py, size);
    const CAND_RANGE = 2;
    let best = null;
    for (let dr = -CAND_RANGE; dr <= CAND_RANGE; dr++) {
        for (let dq = -CAND_RANGE; dq <= CAND_RANGE; dq++) {
            const q = approx.q + dq;
            const r = approx.r + dr;
            // Triangle vertices in pixel space
            const a = qrToPixel(q, r, size);
            const b = qrToPixel(q + e1.u, r + e1.v, size);
            const c = qrToPixel(q + e2.u, r + e2.v, size);
            if (pointInTriangle(px, py, a.x, a.y, b.x, b.y, c.x, c.y)) {
                // Prefer the one whose centroid is closest to the click
                const cx = (a.x + b.x + c.x) / 3;
                const cy = (a.y + b.y + c.y) / 3;
                const d2 = (px - cx) * (px - cx) + (py - cy) * (py - cy);
                if (!best || d2 < best.d2) best = { q, r, d2 };
            }
        }
    }
    if (best) return { q: best.q, r: best.r };
    return null;
}
