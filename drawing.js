// Drawing functions for grid and overlays
function drawTriangle(col, row, size, colorX, colorY, colorZ, edo, intervalX, intervalZ, labelColor, highlightZero, ctx) {
    const h = size * (Math.sqrt(3) / 2);
    const xOffset = (row % 2) * (size / 2);
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
        ctx.fillStyle = 'rgb(255 255 0 / 0.3)';
        ctx.beginPath();
        ctx.arc(labelX, labelY, size / 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = labelColor;
    ctx.font = `${label === 0 && highlightZero ? size / 3 : size / 4}px Arial`;
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

    if (steps.length >= 3) {
        const triSteps = steps.slice(0, 3);
        const triNodes = [];
        for (const step of triSteps) {
            const { u, v } = solveStepToUV(((step % edo) + edo) % edo, intervalX, intervalZ, edo);
            const { x, y } = qrToPixel(aq + u, ar + v, size);
            triNodes.push({ x, y });
        }
        if (triNodes.length >= 2) {
            // Inset the triangle slightly so edges don't overlap parallel lattice lines
            const INSET = 0.92; // 92% of original size; adjust if needed
            const cx = (triNodes[0].x + triNodes[1].x + triNodes[2].x) / 3;
            const cy = (triNodes[0].y + triNodes[1].y + triNodes[2].y) / 3;
            const inset = triNodes.map(p => ({
                x: cx + (p.x - cx) * INSET,
                y: cy + (p.y - cy) * INSET
            }));
            ctx.beginPath();
            ctx.moveTo(inset[0].x, inset[0].y);
            for (let i = 1; i < inset.length; i++) ctx.lineTo(inset[i].x, inset[i].y);
            ctx.closePath();
            ctx.stroke();
        }

        if (steps.length > 3) {
            const anchorPx = qrToPixel(aq, ar, size);
            const { p1, p2 } = findPeriodVectors(intervalX, intervalZ, edo);
            for (let i = 3; i < steps.length; i++) {
                const step = steps[i];
                drawFourArmsForStep(ctx, aq, ar, size, edo, intervalX, intervalZ, step, anchorPx, p1, p2);
            }
        }
        return;
    }

    const anchorPx = qrToPixel(aq, ar, size);
    const { p1, p2 } = findPeriodVectors(intervalX, intervalZ, edo);
    for (const step of steps) {
        drawFourArmsForStep(ctx, aq, ar, size, edo, intervalX, intervalZ, step, anchorPx, p1, p2);
    }
}

function drawFourArmsForStep(ctx, aq, ar, size, edo, intervalX, intervalZ, step, anchorPx, p1, p2) {
    const offsets = findNearestOffsets(((step % edo) + edo) % edo, intervalX, intervalZ, edo, aq, ar, size, anchorPx, 4);
    for (const off of offsets) {
        const { x, y } = qrToPixel(aq + off.u, ar + off.v, size);
        ctx.beginPath();
        ctx.moveTo(anchorPx.x, anchorPx.y);
        ctx.lineTo(x, y);
        ctx.stroke();
    }
}
