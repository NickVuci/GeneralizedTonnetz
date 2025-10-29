document.addEventListener('DOMContentLoaded', function () {
    // Canvas and context
    const canvas = document.getElementById('tonnetzCanvas');
    const ctx = canvas.getContext('2d');

    // Controls
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
    const highlightZeroColorInput = document.getElementById('highlightZeroColor');
    const highlightZeroInput = document.getElementById('highlightZero');
    const triangleSizeInput = document.getElementById('triangleSize');
    const edoInput = document.getElementById('edo');
    const intervalXInput = document.getElementById('intervalX');
    const intervalZInput = document.getElementById('intervalZ');
    const scaleDegreesInput = document.getElementById('scaleDegrees');
    const scaleSizeInput = document.getElementById('scaleSize');
    const scaleDotsInput = document.getElementById('scaleDots');
    const scaleDotColorInput = document.getElementById('scaleDotColor');
    const scaleDotSizeInput = document.getElementById('scaleDotSize');
    const addOverlayBtn = document.getElementById('addOverlayBtn');
    const overlayListContainer = document.getElementById('overlayList');
    const saveImageButton = document.getElementById('saveImageButton');
    const savePdfButton = document.getElementById('savePdfButton');
    const toggleControlsBtn = document.getElementById('toggleControls');
    const controlsContent = document.getElementById('controlsContent');

    // Wire events
    document.getElementById('drawButton').addEventListener('click', drawTonnetz);
    canvasSizeSelect.addEventListener('change', handleCanvasSizeChange);
    colorXInput.addEventListener('input', drawTonnetz);
    colorYInput.addEventListener('input', drawTonnetz);
    colorZInput.addEventListener('input', drawTonnetz);
    backgroundColorInput.addEventListener('input', drawTonnetz);
    labelColorInput.addEventListener('input', drawTonnetz);
    highlightZeroColorInput.addEventListener('input', drawTonnetz);
    highlightZeroInput.addEventListener('input', drawTonnetz);
    triangleSizeInput.addEventListener('change', drawTonnetz);
    edoInput.addEventListener('change', onIntervalParamsChange);
    intervalXInput.addEventListener('change', onIntervalParamsChange);
    intervalZInput.addEventListener('change', onIntervalParamsChange);
    saveImageButton.addEventListener('click', saveAsImage);
    savePdfButton.addEventListener('click', saveAsPdf);
    scaleDegreesInput?.addEventListener('input', drawTonnetz);
    scaleSizeInput?.addEventListener('input', drawTonnetz);
    scaleDotsInput?.addEventListener('change', drawTonnetz);
    scaleDotColorInput?.addEventListener('input', drawTonnetz);
    scaleDotSizeInput?.addEventListener('input', drawTonnetz);
    addOverlayBtn?.addEventListener('click', () => { addOverlay(); renderOverlayListPanel(); drawTonnetz(); });
    overlayListContainer?.addEventListener('input', (e) => { onOverlayPanelEvent(e); drawTonnetz(); }, true);
    overlayListContainer?.addEventListener('change', (e) => { onOverlayPanelEvent(e); drawTonnetz(); }, true);
    overlayListContainer?.addEventListener('click', (e) => { onOverlayPanelEvent(e); drawTonnetz(); }, true);
    canvas.addEventListener('click', onCanvasClick);
    toggleControlsBtn?.addEventListener('click', toggleControls);

    // Start with controls collapsed by default
    try {
        if (controlsContent && !controlsContent.classList.contains('collapsed')) {
            controlsContent.classList.add('collapsed');
        }
        if (toggleControlsBtn) {
            toggleControlsBtn.textContent = '+';
            toggleControlsBtn.title = 'Expand controls';
        }
    } catch {}

    // Limits
    const MAX_CANVAS_WIDTH = 2000;
    const MAX_CANVAS_HEIGHT = 2000;
    const PREVIEW_SCALE = 0.5;

    // Default colors (stored as rgb()) and applied to inputs as hex
    const DEFAULT_COLORS = {
        x: 'rgb(255 255 0)',
        y: 'rgb(255 0 0)',
        z: 'rgb(0 0 255)',
        bg: 'rgb(255 255 255)',
        label: 'rgb(0 0 0)',
        highlightZero: 'rgb(255 255 0)'
    };

    function handleCanvasSizeChange() {
        if (canvasSizeSelect.value === 'Custom') {
            customSizeGroup.style.display = 'block';
            orientationSelect.disabled = true;
        } else {
            customSizeGroup.style.display = 'none';
            orientationSelect.disabled = false;
        }
    }

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

        if (width > MAX_CANVAS_WIDTH || height > MAX_CANVAS_HEIGHT) {
            scale = PREVIEW_SCALE;
            width = Math.round(width * scale);
            height = Math.round(height * scale);
        }
        return { width, height, scale };
    }

    function drawTonnetz() {
        const colorX = hexToRgbString(colorXInput.value);
        const colorY = hexToRgbString(colorYInput.value);
        const colorZ = hexToRgbString(colorZInput.value);
        const backgroundColor = hexToRgbString(backgroundColorInput.value);
    const labelColor = hexToRgbString(labelColorInput.value);
    const highlightZeroColor = hexToRgbString(highlightZeroColorInput.value, 0.3);
        const highlightZero = highlightZeroInput.checked;

        const size = parseInt(document.getElementById('triangleSize').value) || 40;
        const edo = parseInt(document.getElementById('edo').value) || 12;
        const intervalX = parseInt(document.getElementById('intervalX').value) || 7;
        const intervalZ = parseInt(document.getElementById('intervalZ').value) || 4;

        // Scale highlighting (treat blank as no degrees; do NOT default to [0])
        let scaleSet = null;
        try {
            const raw = (scaleDegreesInput?.value ?? '').trim();
            const tokens = raw.length ? raw.split(/[\,\s]+/).filter(Boolean) : [];
            if (tokens.length) {
                const set = new Set();
                for (const tok of tokens) {
                    const n = parseInt(tok, 10);
                    if (!Number.isFinite(n)) continue;
                    let v = n % edo; if (v < 0) v += edo;
                    set.add(v);
                }
                if (set.size > 0) scaleSet = set;
            }
        } catch {}
    const scaleSizeFactor = clamp(parseFloat(scaleSizeInput?.value), 0.1, 10, 1.5);
    const drawScaleDots = !!(scaleDotsInput?.checked);
    const scaleDotColor = hexToRgbString(scaleDotColorInput?.value || '#000000');
    const scaleDotSize = clamp(parseFloat(scaleDotSizeInput?.value), 1, 50, 6);

        // Keep the two default overlays synced to current X/Z if they are autoSync
        try { synchronizeDefaultOverlaySteps(intervalX, intervalZ, edo); } catch {}

        const { width: canvasWidth, height: canvasHeight, scale } = getCanvasDimensions();

        if (scale < 1) {
            const offscreen = document.createElement('canvas');
            offscreen.width = Math.round(canvasWidth / scale);
            offscreen.height = Math.round(canvasHeight / scale);
            const offCtx = offscreen.getContext('2d');
            offCtx.fillStyle = backgroundColor;
            offCtx.fillRect(0, 0, offscreen.width, offscreen.height);
            const h = size * (Math.sqrt(3) / 2);
            const rows = Math.ceil(offscreen.height / h) + 4;
            const cols = Math.ceil(offscreen.width / size) + 4;
            for (let row = -2; row < rows; row++) {
                for (let col = -2; col < cols; col++) {
                    // Draw base grid without dots (dots will be drawn on top in a final pass)
                    drawTriangle(col, row, size, colorX, colorY, colorZ, edo, intervalX, intervalZ, labelColor, highlightZero, highlightZeroColor, offCtx, scaleSet, scaleSizeFactor, false, null, null);
                }
            }
            if (overlays.length) {
                for (const ov of overlays) {
                    if (!ov.visible) continue;
                    const anchors = buildAnchorsForOverlay(ov, offscreen.width, offscreen.height, size, edo, intervalX, intervalZ);
                    drawChordOverlay(offCtx, offscreen.width, offscreen.height, size, edo, intervalX, intervalZ, ov.steps, ov.color, ov.opacity, anchors);
                }
            }
            // Draw scale dots above overlays
            if (drawScaleDots && scaleSet) {
                drawScaleDotsGrid(offCtx, offscreen.width, offscreen.height, size, edo, intervalX, intervalZ, scaleSet, scaleDotColor, scaleDotSize);
            }
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(offscreen, 0, 0, offscreen.width, offscreen.height, 0, 0, canvas.width, canvas.height);
        } else {
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const h = size * (Math.sqrt(3) / 2);
            const rows = Math.ceil(canvas.height / h) + 4;
            const cols = Math.ceil(canvas.width / size) + 4;
            for (let row = -2; row < rows; row++) {
                for (let col = -2; col < cols; col++) {
                    // Draw base grid without dots (dots will be drawn on top in a final pass)
                    drawTriangle(col, row, size, colorX, colorY, colorZ, edo, intervalX, intervalZ, labelColor, highlightZero, highlightZeroColor, ctx, scaleSet, scaleSizeFactor, false, null, null);
                }
            }
            if (overlays.length) {
                for (const ov of overlays) {
                    if (!ov.visible) continue;
                    const anchors = buildAnchorsForOverlay(ov, canvas.width, canvas.height, size, edo, intervalX, intervalZ);
                    drawChordOverlay(ctx, canvas.width, canvas.height, size, edo, intervalX, intervalZ, ov.steps, ov.color, ov.opacity, anchors);
                }
            }
            // Draw scale dots above overlays
            if (drawScaleDots && scaleSet) {
                drawScaleDotsGrid(ctx, canvas.width, canvas.height, size, edo, intervalX, intervalZ, scaleSet, scaleDotColor, scaleDotSize);
            }
        }
    }

    // When X/Z/EDO change, update default overlay steps and refresh the panel inputs
    function onIntervalParamsChange() {
        const edo = parseInt(edoInput.value) || 12;
        const ix = parseInt(intervalXInput.value) || 7;
        const iz = parseInt(intervalZInput.value) || 4;
        try { synchronizeDefaultOverlaySteps(ix, iz, edo); } catch {}
        renderOverlayListPanel();
        drawTonnetz();
    }

    // Helper: determine if a clicked lattice point is equivalent to an existing
    // anchor under translations by the lattice period vectors p1, p2.
    function findEquivalentAnchorIndex(anchors, q, r, p1, p2) {
        const D = p1.u * p2.v - p1.v * p2.u;
        if (!D) return -1;
        const isInt = (x) => Math.abs(x - Math.round(x)) < 1e-6;
        for (let i = 0; i < anchors.length; i++) {
            const a = anchors[i];
            const dq = q - a.q;
            const dr = r - a.r;
            const n1 = (p2.v * dq - p2.u * dr) / D;
            const n2 = (-p1.v * dq + p1.u * dr) / D;
            if (isInt(n1) && isInt(n2)) return i;
        }
        return -1;
    }

    // Combine user-selected anchors with optional periodic tiling across the lattice
    function buildAnchorsForOverlay(ov, width, height, size, edo, ix, iz) {
        const anchors = Array.isArray(ov.anchors) ? ov.anchors.slice() : [];
        if (!ov.repeatAll || anchors.length === 0) return anchors;

        // Period vectors tile the lattice for the given EDO/intervals
        const { p1, p2 } = findPeriodVectors(ix, iz, edo);
        const MARGIN = size * 2; // a bit of extra space offscreen
        const diag = Math.hypot(width, height);

        // Use the first anchor to estimate pixel spacing for p1/p2
        const base = anchors[0];
        const basePx = qrToPixel(base.q, base.r, size);
        const p1Px = qrToPixel(base.q + p1.u, base.r + p1.v, size);
        const p2Px = qrToPixel(base.q + p2.u, base.r + p2.v, size);
        const l1 = Math.max(1, Math.hypot(p1Px.x - basePx.x, p1Px.y - basePx.y));
        const l2 = Math.max(1, Math.hypot(p2Px.x - basePx.x, p2Px.y - basePx.y));
        const r1 = Math.min(40, Math.ceil(diag / l1) + 2);
        const r2 = Math.min(40, Math.ceil(diag / l2) + 2);

        const seen = new Set(anchors.map(a => `${a.q},${a.r}`));
        const originals = anchors.slice(); // only tile placed anchors
        for (const a of originals) {
            for (let n1 = -r1; n1 <= r1; n1++) {
                for (let n2 = -r2; n2 <= r2; n2++) {
                    const q = a.q + n1 * p1.u + n2 * p2.u;
                    const r = a.r + n1 * p1.v + n2 * p2.v;
                    const key = `${q},${r}`;
                    if (seen.has(key)) continue;
                    const pt = qrToPixel(q, r, size);
                    if (pt.x < -MARGIN || pt.x > width + MARGIN || pt.y < -MARGIN || pt.y > height + MARGIN) continue;
                    seen.add(key);
                    anchors.push({ q, r });
                }
            }
        }
        return anchors;
    }

    function onCanvasClick(evt) {
        const rect = canvas.getBoundingClientRect();
        let px = (evt.clientX - rect.left) * (canvas.width / rect.width);
        let py = (evt.clientY - rect.top) * (canvas.height / rect.height);
        const size = parseInt(document.getElementById('triangleSize').value) || 40;
        const edo = parseInt(document.getElementById('edo').value) || 12;
        const intervalX = parseInt(document.getElementById('intervalX').value) || 7;
        const intervalZ = parseInt(document.getElementById('intervalZ').value) || 4;
        const { scale } = getCanvasDimensions();
        if (scale < 1) { px = px / scale; py = py / scale; }
        // Choose overlay automatically based on triangle orientation (up/down)
        // Determine the triangle under the click and its apex position
        const approx = pixelToQR(px, py, size);
        const apexPx = qrToPixel(approx.q, approx.r, size);
        const orientation = py >= apexPx.y ? 'up' : 'down';

        // Ensure at least one overlay exists (defaults added on load too)
        if (!overlays.length) { addOverlay(); addOverlay(); renderOverlayListPanel(); }
        if (activeOverlayId == null) activeOverlayId = overlays[0].id;

        // Resolve overlay: mapped up/down if set, else fall back to active overlay
        let targetOverlayId = orientation === 'up' ? (typeof upOverlayId === 'number' ? upOverlayId : null)
                                                  : (typeof downOverlayId === 'number' ? downOverlayId : null);
        if (targetOverlayId == null) targetOverlayId = activeOverlayId;
        let ov = overlays.find(o => o.id === targetOverlayId) || overlays.find(o => o.id === activeOverlayId) || overlays[0];

        // Prefer overlay-aware anchor resolution when the overlay forms a triangle
        let anchorQR = null;
        if (ov && ov.steps && ov.steps.length >= 3) {
            try {
                anchorQR = anchorFromClick(px, py, size, edo, intervalX, intervalZ, ov.steps);
            } catch {}
            // If we are using a triangular overlay and the click does not fall inside
            // any of its triangle cells, ignore the click.
            if (!anchorQR) return;
        }
        if (!anchorQR) anchorQR = approx; // non-triangular overlays anchor to the clicked apex
        const { q, r } = anchorQR;
        if (ov) {
            let i = ov.anchors.findIndex(a => a.q === q && a.r === r);
            if (i < 0 && ov.repeatAll) {
                const { p1, p2 } = findPeriodVectors(intervalX, intervalZ, edo);
                i = findEquivalentAnchorIndex(ov.anchors, q, r, p1, p2);
            }
            if (i >= 0) ov.anchors.splice(i, 1); else ov.anchors.push({ q, r });
            updateOverlayAnchorsCount(ov.id, ov.anchors.length);
        }
        drawTonnetz();
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

    function toggleControls() {
        const isCollapsed = controlsContent.classList.toggle('collapsed');
        toggleControlsBtn.textContent = isCollapsed ? '+' : '−';
        toggleControlsBtn.title = isCollapsed ? 'Expand controls' : 'Collapse controls';
    }

    // Init
    handleCanvasSizeChange();
    // Seed color inputs from rgb() defaults -> hex for input[type=color]
    try {
        colorXInput.value = rgbStringToHex(DEFAULT_COLORS.x);
        colorYInput.value = rgbStringToHex(DEFAULT_COLORS.y);
        colorZInput.value = rgbStringToHex(DEFAULT_COLORS.z);
        backgroundColorInput.value = rgbStringToHex(DEFAULT_COLORS.bg);
        labelColorInput.value = rgbStringToHex(DEFAULT_COLORS.label);
        highlightZeroColorInput.value = rgbStringToHex(DEFAULT_COLORS.highlightZero);
        // Defaults for scale dot controls
        if (scaleDotColorInput) scaleDotColorInput.value = '#000000';
        if (scaleDotSizeInput) scaleDotSizeInput.value = '6';
    } catch {}
    // Ensure two default overlays exist (red then blue)
    try {
        if (!overlays || overlays.length === 0) {
            addOverlay({ color: 'rgb(255 0 0)' });
            addOverlay({ color: 'rgb(0 0 255)' });
        }
    } catch {}
    renderOverlayListPanel();
    drawTonnetz();
});
