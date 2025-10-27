// Geometry and lattice math helpers
function qrToPixel(q, r, size) {
    const h = size * (Math.sqrt(3) / 2);
    const col = q + Math.floor(r / 2);
    const xOffset = (r % 2) * (size / 2);
    const x = col * size + xOffset;
    const yApex = r * h;
    const y = yApex - (size / 5);
    return { x, y };
}

function pixelToQR(px, py, size) {
    const h = size * (Math.sqrt(3) / 2);
    // Adjust to apex coords (labels are drawn at yApex - size/5)
    const pyApex = py + (size / 5);
    const row = Math.round(pyApex / h);
    const xOffset = (row % 2) * (size / 2);
    const col = Math.round((px - xOffset) / size);
    const q = col - Math.floor(row / 2);
    const r = row;
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
    const RANGE = 8;
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
    let p2 = { u: 0, v: 1 };
    for (const c of candidates) {
        if (p1.u * c.v - p1.v * c.u !== 0) { p2 = c; break; }
    }
    return { p1, p2 };
}

function findNearestOffsets(step, ix, iz, edo, aq, ar, size, anchorPx, need = 4) {
    // Progressive search for nearest congruent offsets by true pixel distance
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
    return candidates.slice(0, need);
}
