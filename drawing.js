// Drawing functions for grid and overlays
function drawTriangle(col, row, size, colorX, colorY, colorZ, edo, intervalX, intervalZ, labelColor, highlightZero, highlightZeroColor, ctx, scaleSet, scaleSizeFactor, labelFontFamily, pitchAdapter) {
    const h = size * SQRT3_HALF;
    const xOffset = ((row % 2 + 2) % 2) * (size / 2);
    const x = col * size + xOffset;
    const y = row * h;

    // Points of the triangle
    const points = [
        { x: x, y: y },
        { x: x + size / 2, y: y + h },
        { x: x - size / 2, y: y + h }
    ];

    // Z axis: points[0] -> points[1]
    ctx.strokeStyle = colorZ;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();

    // Y axis: points[0] -> points[2]
    ctx.strokeStyle = colorY;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.stroke();

    // X axis: points[1] -> points[2]
    ctx.strokeStyle = colorX;
    ctx.beginPath();
    ctx.moveTo(points[1].x, points[1].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.stroke();

    // Axial coordinates
    const q = col - Math.floor(row / 2);
    const r = row;

    // Label
    let label = (intervalX * q + intervalZ * r) % edo;
    if (label < 0) label += edo;
    const labelData = pitchAdapter && typeof pitchAdapter.getLabel === 'function'
        ? pitchAdapter.getLabel(q, r)
        : { text: label.toString(), value: label, isZero: label === 0, scaleKey: label };
    const labelText = String(labelData?.text ?? label);
    const isZeroLabel = !!labelData?.isZero;
    const scaleKey = labelData?.scaleKey ?? label;

    const labelX = points[0].x;
    const labelY = points[0].y - (size / 5);

    if (isZeroLabel && highlightZero) {
        ctx.fillStyle = highlightZeroColor || 'rgb(255 255 0 / 0.3)';
        ctx.beginPath();
        ctx.arc(labelX, labelY, size / 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = labelColor;
    const baseLabelSize = (isZeroLabel && highlightZero) ? (size / 3) : (size / 4);
    const inScale = !!(scaleSet && scaleSet.has(scaleKey));
    const factor = Number.isFinite(scaleSizeFactor) && scaleSizeFactor > 0 ? scaleSizeFactor : 1;
    const lengthFactor = labelText.length > 7 ? 0.58 : labelText.length > 4 ? 0.72 : 1;
    const finalSize = (inScale ? baseLabelSize * factor : baseLabelSize) * lengthFactor;
    const resolvedLabelFontFamily = labelFontFamily || 'Arial, sans-serif';
    ctx.font = `${finalSize}px ${resolvedLabelFontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(labelText, labelX, labelY, size * 1.8);
}

function getOverlayTriangleOffsets(steps, intervalX, intervalZ, edo) {
    if (!steps || steps.length < 3) return null;
    const triOffsets = steps.slice(0, 3).map(function (step) {
        return solveStepToUV(((step % edo) + edo) % edo, intervalX, intervalZ, edo);
    });
    return triOffsets.some(offset => !offset) ? null : triOffsets;
}

function isOverlayTriangleVisible(aq, ar, size, triOffsets, width, height) {
    const triNodes = triOffsets.map(function ({ u, v }) {
        return qrToPixel(aq + u, ar + v, size);
    });
    const xs = triNodes.map(function (point) { return point.x; });
    const ys = triNodes.map(function (point) { return point.y; });
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);
    return maxX >= 0 && maxY >= 0 && minX <= width && minY <= height;
}

function isEquivalentAnchorTranslation(deltaQ, deltaR, p1, p2) {
    const det = (p1.u * p2.v) - (p1.v * p2.u);
    if (det === 0) return false;
    const n1Numerator = (deltaQ * p2.v) - (deltaR * p2.u);
    const n2Numerator = (p1.u * deltaR) - (p1.v * deltaQ);
    return n1Numerator % det === 0 && n2Numerator % det === 0;
}

function expandRepeatedOverlayAnchors(width, height, size, edo, intervalX, intervalZ, steps, anchors, repeatAll) {
    if (!anchors || !anchors.length) return [];
    if (!repeatAll) return anchors.slice();

    const triOffsets = getOverlayTriangleOffsets(steps, intervalX, intervalZ, edo);
    if (!triOffsets) return anchors.slice();

    const { p1, p2 } = findPeriodVectors(intervalX, intervalZ, edo);
    const corners = [
        approximateQR(0, 0, size),
        approximateQR(width, 0, size),
        approximateQR(0, height, size),
        approximateQR(width, height, size)
    ];
    const uPad = triOffsets.reduce(function (maxOffset, offset) {
        return Math.max(maxOffset, Math.abs(offset.u));
    }, 0) + Math.abs(p1.u) + Math.abs(p2.u) + 2;
    const vPad = triOffsets.reduce(function (maxOffset, offset) {
        return Math.max(maxOffset, Math.abs(offset.v));
    }, 0) + Math.abs(p1.v) + Math.abs(p2.v) + 2;
    const qValues = corners.map(function (corner) { return corner.q; });
    const rValues = corners.map(function (corner) { return corner.r; });
    const qMin = Math.min.apply(null, qValues) - uPad;
    const qMax = Math.max.apply(null, qValues) + uPad;
    const rMin = Math.min.apply(null, rValues) - vPad;
    const rMax = Math.max.apply(null, rValues) + vPad;
    const expanded = [];
    const seen = new Set();

    for (const anchor of anchors) {
        for (let q = qMin; q <= qMax; q++) {
            for (let r = rMin; r <= rMax; r++) {
                const deltaQ = q - anchor.q;
                const deltaR = r - anchor.r;
                if (!isEquivalentAnchorTranslation(deltaQ, deltaR, p1, p2)) continue;
                if (!isOverlayTriangleVisible(q, r, size, triOffsets, width, height)) continue;
                const key = `${q},${r}`;
                if (seen.has(key)) continue;
                seen.add(key);
                expanded.push({ q, r });
            }
        }
    }

    return expanded;
}

function drawChordOverlay(ctx, width, height, size, edo, intervalX, intervalZ, steps, colorHex, opacity, anchors, repeatAll) {
    const anchorsToDraw = expandRepeatedOverlayAnchors(width, height, size, edo, intervalX, intervalZ, steps, anchors, repeatAll);
    if (!anchorsToDraw.length) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = Math.max(1, size / 14);

    for (const anchor of anchorsToDraw) {
        drawChordShapeAtAnchor(ctx, anchor.q, anchor.r, size, edo, intervalX, intervalZ, steps);
    }

    ctx.restore();
}

function drawChordOffsetOverlay(ctx, width, height, size, offsets, colorHex, opacity, anchors) {
    if (!anchors || !anchors.length || !offsets || offsets.length < 3) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = Math.max(1, size / 14);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const anchor of anchors) {
        const triNodes = offsets.slice(0, 3).map(function ({ u, v }) {
            return qrToPixel(anchor.q + u, anchor.r + v, size);
        });
        const INSET = 0.92;
        const cx = (triNodes[0].x + triNodes[1].x + triNodes[2].x) / 3;
        const cy = (triNodes[0].y + triNodes[1].y + triNodes[2].y) / 3;
        const inset = triNodes.map(p => ({
            x: cx + (p.x - cx) * INSET,
            y: cy + (p.y - cy) * INSET
        }));
        ctx.beginPath();
        ctx.moveTo(inset[0].x, inset[0].y);
        ctx.lineTo(inset[1].x, inset[1].y);
        ctx.lineTo(inset[2].x, inset[2].y);
        ctx.closePath();
        ctx.stroke();
    }

    ctx.restore();
}

function drawChordShapeAtAnchor(ctx, aq, ar, size, edo, intervalX, intervalZ, steps) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const triOffsets = getOverlayTriangleOffsets(steps, intervalX, intervalZ, edo);
    if (!triOffsets) return;

    const triNodes = triOffsets.map(function ({ u, v }) {
        return qrToPixel(aq + u, ar + v, size);
    });

    const INSET = 0.92;
    const cx = (triNodes[0].x + triNodes[1].x + triNodes[2].x) / 3;
    const cy = (triNodes[0].y + triNodes[1].y + triNodes[2].y) / 3;
    const inset = triNodes.map(p => ({
        x: cx + (p.x - cx) * INSET,
        y: cy + (p.y - cy) * INSET
    }));
    ctx.beginPath();
    ctx.moveTo(inset[0].x, inset[0].y);
    ctx.lineTo(inset[1].x, inset[1].y);
    ctx.lineTo(inset[2].x, inset[2].y);
    ctx.closePath();
    ctx.stroke();
}

// Final-pass renderer: draw dots at lattice apexes for in-scale degrees, above overlays
function drawScaleDotsGrid(ctx, width, height, size, edo, intervalX, intervalZ, scaleSet, scaleDotColor, scaleDotSize) {
    if (!scaleSet || !scaleSet.size) return;
    const h = size * SQRT3_HALF;
    const rows = Math.ceil(height / h) + 4;
    const cols = Math.ceil(width / size) + 4;
    const dotR = clamp(Number(scaleDotSize) || 6, 1, Math.max(2, Math.floor(size / 3)), 6);
    ctx.save();
    ctx.fillStyle = scaleDotColor || 'rgb(0 0 0)';
    for (let row = -2; row < rows; row++) {
        for (let col = -2; col < cols; col++) {
            const q = col - Math.floor(row / 2);
            const r = row;
            let label = (intervalX * q + intervalZ * r) % edo;
            if (label < 0) label += edo;
            if (!scaleSet.has(label)) continue;
            const { x, y } = qrToPixel(q, r, size);
            ctx.beginPath();
            ctx.arc(x, y, dotR, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}
