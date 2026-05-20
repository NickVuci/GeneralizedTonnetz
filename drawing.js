// Drawing functions for grid and overlays
function drawTriangle(col, row, size, colorX, colorY, colorZ, edo, intervalX, intervalZ, labelColor, highlightZero, highlightZeroColor, ctx, scaleSet, scaleSizeFactor, labelFontFamily) {
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

    const labelX = points[0].x;
    const labelY = points[0].y - (size / 5);

    if (label === 0 && highlightZero) {
        ctx.fillStyle = highlightZeroColor || 'rgb(255 255 0 / 0.3)';
        ctx.beginPath();
        ctx.arc(labelX, labelY, size / 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = labelColor;
    const baseLabelSize = (label === 0 && highlightZero) ? (size / 3) : (size / 4);
    const inScale = !!(scaleSet && scaleSet.has(label));
    const factor = Number.isFinite(scaleSizeFactor) && scaleSizeFactor > 0 ? scaleSizeFactor : 1;
    const finalSize = inScale ? baseLabelSize * factor : baseLabelSize;
    const resolvedLabelFontFamily = labelFontFamily || 'Arial, sans-serif';
    ctx.font = `${finalSize}px ${resolvedLabelFontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label.toString(), labelX, labelY);
}

function drawChordOverlay(ctx, width, height, size, edo, intervalX, intervalZ, steps, colorHex, opacity, anchors) {
    if (!anchors || !anchors.length) return;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = Math.max(1, size / 14);

    for (const anchor of anchors) {
        drawChordShapeAtAnchor(ctx, anchor.q, anchor.r, size, edo, intervalX, intervalZ, steps);
    }

    ctx.restore();
}

function drawChordShapeAtAnchor(ctx, aq, ar, size, edo, intervalX, intervalZ, steps) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (!steps || steps.length < 3) return;
    const triOffsets = steps.slice(0, 3).map(step => solveStepToUV(((step % edo) + edo) % edo, intervalX, intervalZ, edo));
    if (triOffsets.some(offset => !offset)) return;

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
