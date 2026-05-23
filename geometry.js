// Geometry and lattice math helpers
const SQRT3_HALF = Math.sqrt(3) / 2;

function mod(value, modulus) {
    if (!Number.isFinite(modulus) || modulus === 0) return value;
    const remainder = value % modulus;
    return remainder < 0 ? remainder + modulus : remainder;
}

function gcd(a, b) {
    let left = Math.abs(a);
    let right = Math.abs(b);
    while (right !== 0) {
        const next = left % right;
        left = right;
        right = next;
    }
    return left;
}

function extendedGcd(a, b) {
    let oldR = a;
    let r = b;
    let oldS = 1;
    let s = 0;
    let oldT = 0;
    let t = 1;

    while (r !== 0) {
        const q = Math.trunc(oldR / r);
        const nextR = oldR - q * r;
        oldR = r;
        r = nextR;

        const nextS = oldS - q * s;
        oldS = s;
        s = nextS;

        const nextT = oldT - q * t;
        oldT = t;
        t = nextT;
    }

    if (oldR < 0) {
        oldR = -oldR;
        oldS = -oldS;
        oldT = -oldT;
    }

    return { g: oldR, x: oldS, y: oldT };
}

function modInverse(value, modulus) {
    if (modulus === 1) return 0;
    const result = extendedGcd(value, modulus);
    if (result.g !== 1) return null;
    return mod(result.x, modulus);
}

function chooseCenteredRepresentative(value, period) {
    if (!Number.isFinite(period) || period <= 0) return value;
    const normalized = mod(value, period);
    const shifted = normalized - period;
    if (Math.abs(shifted) < Math.abs(normalized)) return shifted;
    return normalized;
}

function compareVectors(a, b) {
    return (a.score - b.score)
        || (a.d2 - b.d2)
        || (Math.abs(a.u) - Math.abs(b.u))
        || (Math.abs(a.v) - Math.abs(b.v))
        || (a.u - b.u)
        || (a.v - b.v);
}

function solveSingleVariableCongruence(coefficient, target, modulus) {
    if (!Number.isFinite(modulus) || modulus <= 0) return null;

    const divisor = gcd(coefficient, modulus);
    if (mod(target, divisor) !== 0) return null;

    const reducedCoefficient = coefficient / divisor;
    const reducedTarget = target / divisor;
    const reducedModulus = modulus / divisor;
    const inverse = modInverse(mod(reducedCoefficient, reducedModulus), reducedModulus);
    if (inverse == null) return null;

    return {
        base: mod(inverse * reducedTarget, reducedModulus),
        period: reducedModulus
    };
}

function enumerateStepSolutionClasses(step, ix, iz, edo) {
    if (!Number.isFinite(edo) || edo <= 0) return [];

    const normalizedStep = mod(step, edo);
    const classes = [];
    const seen = new Set();

    for (let uResidue = 0; uResidue < edo; uResidue++) {
        const rhs = mod(normalizedStep - ix * uResidue, edo);
        const vClass = solveSingleVariableCongruence(iz, rhs, edo);
        if (!vClass) continue;

        const key = `${uResidue}|${vClass.base}|${vClass.period}`;
        if (seen.has(key)) continue;
        seen.add(key);
        classes.push({ uResidue, vBase: vClass.base, vPeriod: vClass.period });
    }

    return classes;
}

function enumerateRepresentativeStepVectors(step, ix, iz, edo, includeZero = false) {
    const solutions = [];
    const seen = new Set();

    for (const item of enumerateStepSolutionClasses(step, ix, iz, edo)) {
        const u = chooseCenteredRepresentative(item.uResidue, edo);
        const v = chooseCenteredRepresentative(item.vBase, item.vPeriod);
        if (!includeZero && u === 0 && v === 0) continue;

        const key = `${u},${v}`;
        if (seen.has(key)) continue;
        seen.add(key);
        solutions.push({
            u,
            v,
            score: Math.abs(u) + Math.abs(v),
            d2: u * u + v * v
        });
    }

    solutions.sort(compareVectors);
    return solutions;
}

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
    const solutions = enumerateRepresentativeStepVectors(step, ix, iz, edo, true);
    if (!solutions.length) return null;
    return { u: solutions[0].u, v: solutions[0].v };
}

function findPeriodVectors(ix, iz, edo) {
    const candidates = enumerateRepresentativeStepVectors(0, ix, iz, edo, false);
    const axisCandidates = [
        { u: edo / Math.max(1, gcd(ix, edo)), v: 0 },
        { u: 0, v: edo / Math.max(1, gcd(iz, edo)) }
    ];

    for (const candidate of axisCandidates) {
        const key = `${candidate.u},${candidate.v}`;
        if (candidates.some(existing => `${existing.u},${existing.v}` === key)) continue;
        candidates.push({
            u: candidate.u,
            v: candidate.v,
            score: Math.abs(candidate.u) + Math.abs(candidate.v),
            d2: candidate.u * candidate.u + candidate.v * candidate.v
        });
    }

    candidates.sort(compareVectors);

    let p1 = candidates[0] || { u: 1, v: 0 };
    let p2 = null;
    for (const candidate of candidates) {
        if (candidate.u === p1.u && candidate.v === p1.v) continue;
        if (p1.u * candidate.v - p1.v * candidate.u !== 0) {
            p2 = candidate;
            break;
        }
    }

    if (!p2) {
        p2 = (p1.u !== 0)
            ? { u: 0, v: edo / Math.max(1, gcd(iz, edo)) }
            : { u: edo / Math.max(1, gcd(ix, edo)), v: 0 };
    }

    return { p1, p2 };
}

function findNearestOffsets(step, ix, iz, edo, aq, ar, size, anchorPx, need = 4) {
    // Enumerate congruent offset classes exactly, then sample nearby lifts and
    // sort by the true pixel distance from the anchor.
    if (typeof findNearestOffsets._cache === 'undefined') findNearestOffsets._cache = new Map();
    const cacheKey = [step, ix, iz, edo, aq, ar, size].join('|');
    if (findNearestOffsets._cache.has(cacheKey)) {
        const cached = findNearestOffsets._cache.get(cacheKey);
        return cached.slice(0, need);
    }

    const seen = new Set();
    const candidates = [];
    const classes = enumerateStepSolutionClasses(step, ix, iz, edo);
    const shiftRadius = Math.max(1, Math.min(3, need));

    for (const item of classes) {
        const centeredU = chooseCenteredRepresentative(item.uResidue, edo);
        const centeredV = chooseCenteredRepresentative(item.vBase, item.vPeriod);
        for (let du = -shiftRadius; du <= shiftRadius; du++) {
            for (let dv = -shiftRadius; dv <= shiftRadius; dv++) {
                const u = centeredU + du * edo;
                const v = centeredV + dv * item.vPeriod;
                if (u === 0 && v === 0) continue;

                const key = `${u},${v}`;
                if (seen.has(key)) continue;
                seen.add(key);

                const pt = qrToPixel(aq + u, ar + v, size);
                const dx = pt.x - anchorPx.x;
                const dy = pt.y - anchorPx.y;
                candidates.push({
                    u,
                    v,
                    d2: dx * dx + dy * dy,
                    man: Math.abs(u) + Math.abs(v)
                });
            }
        }
    }

    candidates.sort((a, b) => (a.d2 - b.d2) || (a.man - b.man));

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
    const triSteps = steps.slice(0, 3).map(s => mod(s, edo));
    // Convert to lattice vectors relative to anchor
    const uv = triSteps.map(s => solveStepToUV(s, ix, iz, edo));
    if (uv.some(v => !v)) return null;
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

function anchorFromClickOffsets(px, py, size, offsets) {
    if (!offsets || offsets.length < 3) return null;
    const triOffsets = offsets.slice(0, 3);
    const approx = approximateQR(px, py, size);
    const CAND_RANGE = 2;
    let best = null;

    for (let dr = -CAND_RANGE; dr <= CAND_RANGE; dr++) {
        for (let dq = -CAND_RANGE; dq <= CAND_RANGE; dq++) {
            const q = approx.q + dq;
            const r = approx.r + dr;
            const vertices = triOffsets.map(function ({ u, v }) {
                return qrToPixel(q + u, r + v, size);
            });
            if (pointInTriangle(
                px,
                py,
                vertices[0].x,
                vertices[0].y,
                vertices[1].x,
                vertices[1].y,
                vertices[2].x,
                vertices[2].y
            )) {
                const cx = (vertices[0].x + vertices[1].x + vertices[2].x) / 3;
                const cy = (vertices[0].y + vertices[1].y + vertices[2].y) / 3;
                const d2 = (px - cx) * (px - cx) + (py - cy) * (py - cy);
                if (!best || d2 < best.d2) best = { q, r, d2 };
            }
        }
    }

    return best ? { q: best.q, r: best.r } : null;
}
