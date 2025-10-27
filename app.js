document.addEventListener('DOMContentLoaded', function () {
    // Get references to the canvas and context
    const canvas = document.getElementById('tonnetzCanvas');
    const ctx = canvas.getContext('2d');

    // References to controls
    const canvasSizeSelect = document.getElementById('canvasSize');
    const orientationSelect = document.getElementById('orientation');
    const customSizeGroup = document.getElementById('customSizeGroup');
    const canvasWidthInput = document.getElementById('canvasWidth');
    const canvasHeightInput = document.getElementById('canvasHeight');
    const colorXInput = document.getElementById('colorX');
    const colorYInput = document.getElementById('colorY');
    const colorZInput = document.getElementById('colorZ');
    const backgroundColorInput = document.getElementById('backgroundColor');
    const labelColorInput = document.getElementById('labelColor');
    const highlightZeroInput = document.getElementById('highlightZero'); // Checkbox for highlighting "0" label
    const triangleSizeInput = document.getElementById('triangleSize');
    const edoInput = document.getElementById('edo');
    const intervalXInput = document.getElementById('intervalX');
    const intervalZInput = document.getElementById('intervalZ');
    // (Removed legacy single-overlay controls)
    
    // Multi-overlay controls
    const showMultiOverlaysInput = document.getElementById('showMultiOverlays');
    const addOverlayBtn = document.getElementById('addOverlayBtn');
    const overlayListContainer = document.getElementById('overlayList');

    // (Removed legacy selectedAnchors; use per-overlay anchors)
    
    // Multi-overlay state
    let overlays = []; // [{id, visible, steps, root, color, opacity, anchors: [{q,r}]}]
    let overlayIdCounter = 1;
    let activeOverlayId = null;

    // References to buttons
    const saveImageButton = document.getElementById('saveImageButton');
    const savePdfButton = document.getElementById('savePdfButton');

    // Add event listeners
    document.getElementById('drawButton').addEventListener('click', drawTonnetz);
    canvasSizeSelect.addEventListener('change', handleCanvasSizeChange);

    // Event listeners for real-time color updates
    colorXInput.addEventListener('input', drawTonnetz);
    colorYInput.addEventListener('input', drawTonnetz);
    colorZInput.addEventListener('input', drawTonnetz);
    backgroundColorInput.addEventListener('input', drawTonnetz);
    labelColorInput.addEventListener('input', drawTonnetz);
    highlightZeroInput.addEventListener('input', drawTonnetz); // Trigger redraw when checkbox is toggled
    // (Removed listeners for legacy single-overlay)
    // Multi-overlay listeners
    showMultiOverlaysInput?.addEventListener('change', drawTonnetz);
    addOverlayBtn?.addEventListener('click', () => {
        addOverlay();
        renderOverlayListPanel();
        drawTonnetz();
    });
    overlayListContainer?.addEventListener('input', onOverlayPanelEvent, true);
    overlayListContainer?.addEventListener('change', onOverlayPanelEvent, true);
    overlayListContainer?.addEventListener('click', onOverlayPanelEvent, true);

    // Event listeners for numeric controls: redraw only on 'change' (blur or enter)
    triangleSizeInput.addEventListener('change', drawTonnetz);
    edoInput.addEventListener('change', drawTonnetz);
    intervalXInput.addEventListener('change', drawTonnetz);
    intervalZInput.addEventListener('change', drawTonnetz);

    // Event listeners for saving
    saveImageButton.addEventListener('click', saveAsImage);
    savePdfButton.addEventListener('click', saveAsPdf);

    // Toggle chord anchor by clicking the lattice
    canvas.addEventListener('click', onCanvasClick);

    function handleCanvasSizeChange() {
        if (canvasSizeSelect.value === 'Custom') {
            customSizeGroup.style.display = 'block';
            orientationSelect.disabled = true;
        } else {
            customSizeGroup.style.display = 'none';
            orientationSelect.disabled = false;
        }
    }

    // Cap maximum render resolution for performance
    const MAX_CANVAS_WIDTH = 2000;
    const MAX_CANVAS_HEIGHT = 2000;
    const PREVIEW_SCALE = 0.5; // Use 0.5 for preview if size exceeds cap

    function getCanvasDimensions() {
        let width, height, scale = 1;
        const paperSizes = {
            'A4': { width: 2480, height: 3508 },
            'A3': { width: 3508, height: 4961 },
            'Letter': { width: 2550, height: 3300 },
            'Legal': { width: 2550, height: 4200 },
        };

        if (canvasSizeSelect.value === 'Custom') {
            width = parseInt(canvasWidthInput.value) || 600;
            height = parseInt(canvasHeightInput.value) || 600;
        } else {
            const size = paperSizes[canvasSizeSelect.value];
            if (orientationSelect.value === 'portrait') {
                width = size.width;
                height = size.height;
            } else {
                width = size.height;
                height = size.width;
            }
        }

        // If requested size exceeds cap, use preview scale
        if (width > MAX_CANVAS_WIDTH || height > MAX_CANVAS_HEIGHT) {
            scale = PREVIEW_SCALE;
            width = Math.round(width * scale);
            height = Math.round(height * scale);
        }
        return { width, height, scale };
    }

    function drawTonnetz() {
        // Get colors from input fields
        const colorX = colorXInput.value;
        const colorY = colorYInput.value;
        const colorZ = colorZInput.value;
        const backgroundColor = backgroundColorInput.value;
        const labelColor = labelColorInput.value;
        const highlightZero = highlightZeroInput.checked; // Check if "0" label should be highlighted

        // Get triangle size from input fields
        const sizeInput = document.getElementById('triangleSize').value;
        const size = parseInt(sizeInput) || 40;

        // Get EDO value and intervals
        const edoInput = document.getElementById('edo').value;
        const edo = parseInt(edoInput) || 12;

        const intervalXInput = document.getElementById('intervalX').value;
        const intervalZInput = document.getElementById('intervalZ').value;
        const intervalX = parseInt(intervalXInput) || 7;
        const intervalZ = parseInt(intervalZInput) || 4;

    // Multiple overlays only

        // Get canvas dimensions and scale
        const { width: canvasWidth, height: canvasHeight, scale } = getCanvasDimensions();

        // If scaling, draw to offscreen canvas and copy to visible canvas
        if (scale < 1) {
            const offscreen = document.createElement('canvas');
            offscreen.width = Math.round(canvasWidth / scale);
            offscreen.height = Math.round(canvasHeight / scale);
            const offCtx = offscreen.getContext('2d');
            // Fill background
            offCtx.fillStyle = backgroundColor;
            offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
            // Parameters for the grid
            const h = size * (Math.sqrt(3) / 2);
            const rows = Math.ceil(offscreen.height / h) + 4;
            const cols = Math.ceil(offscreen.width / size) + 4;
            for (let row = -2; row < rows; row++) {
                for (let col = -2; col < cols; col++) {
                    drawTriangle(col, row, size, colorX, colorY, colorZ, edo, intervalX, intervalZ, labelColor, highlightZero, offCtx);
                }
            }
            // Draw overlays
            if (overlays.length) {
                for (const ov of overlays) {
                    if (!ov.visible) continue;
                    drawChordOverlay(offCtx, offscreen.width, offscreen.height, size, edo, intervalX, intervalZ, ov.root, ov.steps, ov.color, ov.opacity, ov.anchors);
                }
            }
            // Copy scaled preview to visible canvas
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(offscreen, 0, 0, offscreen.width, offscreen.height, 0, 0, canvas.width, canvas.height);
        } else {
            // Update canvas dimensions
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            // Fill background color
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Parameters for the grid
            const h = size * (Math.sqrt(3) / 2);
            const rows = Math.ceil(canvas.height / h) + 4;
            const cols = Math.ceil(canvas.width / size) + 4;
            for (let row = -2; row < rows; row++) {
                for (let col = -2; col < cols; col++) {
                    drawTriangle(col, row, size, colorX, colorY, colorZ, edo, intervalX, intervalZ, labelColor, highlightZero, ctx);
                }
            }
            // Draw overlays
            if (overlays.length) {
                for (const ov of overlays) {
                    if (!ov.visible) continue;
                    drawChordOverlay(ctx, canvas.width, canvas.height, size, edo, intervalX, intervalZ, ov.root, ov.steps, ov.color, ov.opacity, ov.anchors);
                }
            }
        }
    }

    function onCanvasClick(evt) {
        const rect = canvas.getBoundingClientRect();
        // Map client coords to canvas pixel coords
        let px = (evt.clientX - rect.left) * (canvas.width / rect.width);
        let py = (evt.clientY - rect.top) * (canvas.height / rect.height);
        const size = parseInt(document.getElementById('triangleSize').value) || 40;
        const { scale } = getCanvasDimensions();
        if (scale < 1) {
            px = px / scale;
            py = py / scale;
        }
        const { q, r } = pixelToQR(px, py, size);
        // Ensure an overlay exists and is active
        if (!overlays.length) {
            addOverlay();
            renderOverlayListPanel();
        }
        if (activeOverlayId == null) activeOverlayId = overlays[0].id;
        const ov = overlays.find(o => o.id === activeOverlayId);
        if (ov) {
            const i = ov.anchors.findIndex(a => a.q === q && a.r === r);
            if (i >= 0) ov.anchors.splice(i, 1); else ov.anchors.push({ q, r });
            updateOverlayAnchorsCount(ov.id, ov.anchors.length);
        }
        drawTonnetz();
    }

    function clamp(v, min, max, fallback) {
        const n = Number.isFinite(v) ? v : fallback;
        return Math.max(min, Math.min(max, n));
    }

    function sanitizeInt(val, fallback = 0) {
        const n = parseInt(val);
        return Number.isFinite(n) ? n : fallback;
    }

    function parseChordSteps(text) {
        if (!text) return [0];
        try {
            return text
                .split(/[,\s]+/)
                .filter(Boolean)
                .map(s => sanitizeInt(s.trim(), 0));
        } catch {
            return [0];
        }
    }

    function hexToRgba(hex, alpha = 0.35) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!m) return `rgba(0,170,0,${alpha})`;
        const r = parseInt(m[1], 16);
        const g = parseInt(m[2], 16);
        const b = parseInt(m[3], 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function drawChordOverlay(ctxDraw, width, height, size, edo, intervalX, intervalZ, root, steps, colorHex, opacity, anchors) {
        // Draw chord shapes (lines) at each provided anchor
        if (!anchors || !anchors.length) return;
        ctxDraw.save();
        ctxDraw.globalAlpha = opacity;
        ctxDraw.strokeStyle = colorHex;
        ctxDraw.lineWidth = Math.max(1, size / 14);

        for (const anchor of anchors) {
            drawChordShapeAtAnchor(ctxDraw, anchor.q, anchor.r, size, edo, intervalX, intervalZ, root, steps);
        }

        ctxDraw.restore();
    }

    // -------- Multi-overlay helpers --------
    function addOverlay(preset) {
        const palette = ['#00AA00', '#AA00AA', '#00AAAA', '#AA5500', '#0055AA', '#AA0055', '#557700'];
        const color = preset?.color || palette[(overlayIdCounter - 1) % palette.length];
        const ov = {
            id: overlayIdCounter++,
            visible: true,
            steps: preset?.steps || [0, 4, 7],
            root: Number.isFinite(preset?.root) ? preset.root : 0,
            color,
            opacity: Number.isFinite(preset?.opacity) ? preset.opacity : 0.35,
            anchors: preset?.anchors || []
        };
        overlays.push(ov);
        activeOverlayId = ov.id;
    }

    function removeOverlay(id) {
        const idx = overlays.findIndex(o => o.id === id);
        if (idx >= 0) overlays.splice(idx, 1);
        if (activeOverlayId === id) activeOverlayId = overlays[0]?.id ?? null;
    }

    function clearOverlayAnchors(id) {
        const ov = overlays.find(o => o.id === id);
        if (ov) {
            ov.anchors = [];
            updateOverlayAnchorsCount(id, 0);
        }
    }

    function updateOverlayAnchorsCount(id, count) {
        const el = overlayListContainer?.querySelector(`.overlay-card[data-id="${id}"] .ov-anchors-count`);
        if (el) el.textContent = String(count);
    }

    function onOverlayPanelEvent(e) {
        const target = e.target;
        const card = target.closest('.overlay-card');
        if (!card) return;
        const id = parseInt(card.getAttribute('data-id'));
        const ov = overlays.find(o => o.id === id);
        if (!ov) return;
        if (target.classList.contains('ov-visible')) {
            ov.visible = !!target.checked;
            drawTonnetz();
        } else if (target.classList.contains('ov-active')) {
            activeOverlayId = id;
        } else if (target.classList.contains('ov-steps')) {
            ov.steps = parseChordSteps(target.value);
            drawTonnetz();
        } else if (target.classList.contains('ov-root')) {
            ov.root = sanitizeInt(target.value, 0);
            drawTonnetz();
        } else if (target.classList.contains('ov-color')) {
            ov.color = target.value;
            drawTonnetz();
        } else if (target.classList.contains('ov-opacity')) {
            ov.opacity = clamp(parseFloat(target.value), 0, 1, 0.35);
            drawTonnetz();
        } else if (target.classList.contains('ov-clear-anchors')) {
            e.preventDefault();
            clearOverlayAnchors(id);
            drawTonnetz();
        } else if (target.classList.contains('ov-delete')) {
            e.preventDefault();
            removeOverlay(id);
            renderOverlayListPanel();
            drawTonnetz();
        }
    }

    function renderOverlayListPanel() {
        if (!overlayListContainer) return;
        overlayListContainer.innerHTML = '';
        for (const ov of overlays) {
            const card = document.createElement('div');
            card.className = 'overlay-card';
            card.setAttribute('data-id', String(ov.id));
            // Make layout simple to fit the rest of the menu
            card.style.display = 'flex';
            card.style.flexWrap = 'wrap';
            card.style.alignItems = 'center';
            card.style.gap = '6px';

            card.innerHTML = `
                <input type="checkbox" class="ov-visible" ${ov.visible ? 'checked' : ''} title="Toggle visibility">
                <input type="radio" name="activeOverlay" class="ov-active" ${activeOverlayId === ov.id ? 'checked' : ''} title="Make active for clicks">
                <span>Overlay ${ov.id}</span>
                <label>Steps:</label>
                <input type="text" class="ov-steps" value="${ov.steps.join(',')}" style="width:120px" title="Comma-separated steps">
                <label>Root:</label>
                <input type="number" class="ov-root" value="${ov.root}" style="width:70px">
                <label>Color:</label>
                <input type="color" class="ov-color" value="${ov.color}">
                <label>Opacity:</label>
                <input type="number" class="ov-opacity" min="0" max="1" step="0.05" value="${ov.opacity}" style="width:70px">
                <span style="font-size: 12px">Anchors: <strong class="ov-anchors-count">${ov.anchors.length}</strong></span>
                <button class="ov-clear-anchors">Clear Anchors</button>
                <button class="ov-delete">Delete</button>
            `;
            overlayListContainer.appendChild(card);
        }
    }

    function drawChordShapeAtAnchor(ctxDraw, aq, ar, size, edo, intervalX, intervalZ, root, steps) {
        ctxDraw.lineCap = 'round';
        ctxDraw.lineJoin = 'round';

        // If 3 or more steps: draw first three as a triangle; remaining steps get four arms each.
        if (steps.length >= 3) {
            // Triangle for first three steps only
            const triSteps = steps.slice(0, 3);
            const triNodes = [];
            for (const step of triSteps) {
                const { u, v } = solveStepToUV(((step % edo) + edo) % edo, intervalX, intervalZ, edo);
                const { x, y } = qrToPixel(aq + u, ar + v, size);
                triNodes.push({ x, y });
            }
            if (triNodes.length >= 2) {
                ctxDraw.beginPath();
                ctxDraw.moveTo(triNodes[0].x, triNodes[0].y);
                for (let i = 1; i < triNodes.length; i++) ctxDraw.lineTo(triNodes[i].x, triNodes[i].y);
                ctxDraw.closePath();
                ctxDraw.stroke();
            }

            // Arms only for non-triangle degrees
            if (steps.length > 3) {
                const anchorPx = qrToPixel(aq, ar, size);
                const { p1, p2 } = findPeriodVectors(intervalX, intervalZ, edo);
                for (let i = 3; i < steps.length; i++) {
                    const step = steps[i];
                    drawFourArmsForStep(ctxDraw, aq, ar, size, edo, intervalX, intervalZ, step, anchorPx, p1, p2);
                }
            }
            return;
        }

        // Fewer than 3 steps: arms for each step
        const anchorPx = qrToPixel(aq, ar, size);
        const { p1, p2 } = findPeriodVectors(intervalX, intervalZ, edo);
        for (const step of steps) {
            drawFourArmsForStep(ctxDraw, aq, ar, size, edo, intervalX, intervalZ, step, anchorPx, p1, p2);
        }
    }

    function drawFourArmsForStep(ctxDraw, aq, ar, size, edo, intervalX, intervalZ, step, anchorPx, p1, p2) {
        // Find the four nearest lattice offsets (u,v) that realize this step
        const offsets = findNearestOffsets(((step % edo) + edo) % edo, intervalX, intervalZ, edo, aq, ar, size, anchorPx, 4);
        for (const off of offsets) {
            const { x, y } = qrToPixel(aq + off.u, ar + off.v, size);
            ctxDraw.beginPath();
            ctxDraw.moveTo(anchorPx.x, anchorPx.y);
            ctxDraw.lineTo(x, y);
            ctxDraw.stroke();
        }
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

    function drawTriangle(col, row, size, colorX, colorY, colorZ, edo, intervalX, intervalZ, labelColor, highlightZero, ctxOverride) {
        const ctxDraw = ctxOverride || ctx;
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

    // Draw sides with specified colors so axis-color mapping matches UI and intervals
    // Z axis: points[0] to points[1] (should be blue)
    ctxDraw.strokeStyle = colorZ; // blue
    ctxDraw.beginPath();
    ctxDraw.moveTo(points[0].x, points[0].y);
    ctxDraw.lineTo(points[1].x, points[1].y);
    ctxDraw.stroke();

    // Y axis: points[0] to points[2] (should be red)
    ctxDraw.strokeStyle = colorY; // red
    ctxDraw.beginPath();
    ctxDraw.moveTo(points[0].x, points[0].y);
    ctxDraw.lineTo(points[2].x, points[2].y);
    ctxDraw.stroke();

    // X axis: points[1] to points[2] (should be yellow)
    ctxDraw.strokeStyle = colorX; // yellow
    ctxDraw.beginPath();
    ctxDraw.moveTo(points[1].x, points[1].y);
    ctxDraw.lineTo(points[2].x, points[2].y);
    ctxDraw.stroke();

        // Calculate axial coordinates (q, r) for hex grid
        let q = col - Math.floor(row / 2);
        let r = row;

        // Calculate label
        let label = (intervalX * q + intervalZ * r) % edo;
        if (label < 0) label += edo;

        // Draw label with highlight if "0"
        const labelX = points[0].x;
        const labelY = points[0].y - (size / 5);

        // Highlight the "0" label
        if (label === 0 && highlightZero) {
            ctxDraw.fillStyle = 'rgba(255, 255, 0, 0.3)'; // Light yellow highlight
            ctxDraw.beginPath();
            ctxDraw.arc(labelX, labelY, size / 2.5, 0, Math.PI * 2); // Circle around "0"
            ctxDraw.fill();
        }

        // Draw the label
        ctxDraw.fillStyle = labelColor;
        ctxDraw.font = `${label === 0 && highlightZero ? size / 3 : size / 4}px Arial`;
        ctxDraw.textAlign = 'center';
        ctxDraw.textBaseline = 'bottom';
        ctxDraw.fillText(label.toString(), labelX, labelY);
    }

    function saveAsImage() {
        const image = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = image;
        link.download = 'tonnetz.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function saveAsPdf() {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [canvas.width, canvas.height]
        });
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save('tonnetz.pdf');
    }

    // Initial setup
    handleCanvasSizeChange();
    // Prepare empty overlay list UI
    renderOverlayListPanel();
    drawTonnetz();
});
