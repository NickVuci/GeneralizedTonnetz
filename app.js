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
    const controlsContainer = document.getElementById('controls');
    const controlsContent = document.getElementById('controlsContent');
    const scaleContent = document.getElementById('scaleContent');
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    const overlaySidebar = document.getElementById('overlaySidebar');
    const actionBtns = document.getElementById('actionBtns');
    const controlsBackdrop = document.getElementById('controlsBackdrop');
    // Debounced draw function will be assigned after drawTonnetz is defined.
    let debouncedDraw = null;
    let closeActiveMobilePanel = null;
    // Retain the last full-resolution offscreen canvas for high-quality export
    let lastOffscreenCanvas = null;

    function queueDraw() {
        if (debouncedDraw) debouncedDraw();
        else drawTonnetz();
    }

    function handleOverlayPanelInteraction(e) {
        onOverlayPanelEvent(e);
        queueDraw();
    }

    // Wire events
    canvasSizeSelect.addEventListener('change', handleCanvasSizeChange);
    colorXInput.addEventListener('input', queueDraw);
    colorYInput.addEventListener('input', queueDraw);
    colorZInput.addEventListener('input', queueDraw);
    backgroundColorInput.addEventListener('input', queueDraw);
    labelColorInput.addEventListener('input', queueDraw);
    highlightZeroColorInput.addEventListener('input', queueDraw);
    highlightZeroInput.addEventListener('input', queueDraw);
    triangleSizeInput.addEventListener('change', queueDraw);
    edoInput.addEventListener('change', onIntervalParamsChange);
    intervalXInput.addEventListener('change', onIntervalParamsChange);
    intervalZInput.addEventListener('change', onIntervalParamsChange);
    saveImageButton.addEventListener('click', saveAsImage);
    savePdfButton.addEventListener('click', saveAsPdf);
    scaleDegreesInput?.addEventListener('input', queueDraw);
    scaleSizeInput?.addEventListener('input', queueDraw);
    scaleDotsInput?.addEventListener('change', queueDraw);
    scaleDotColorInput?.addEventListener('input', queueDraw);
    scaleDotSizeInput?.addEventListener('input', queueDraw);
    addOverlayBtn?.addEventListener('click', () => { addOverlay(); renderOverlayListPanel(); queueDraw(); });
    overlayListContainer?.addEventListener('input', handleOverlayPanelInteraction, true);
    overlayListContainer?.addEventListener('click', (e) => {
        if (!e.target.closest('button')) return;
        handleOverlayPanelInteraction(e);
    }, true);
    canvas.addEventListener('click', onCanvasClick);
    // Touch tap support — convert single-finger tap to the same handler as click.
    // Track touchstart position so we can distinguish a tap from a pan/scroll.
    let touchStartX = 0;
    let touchStartY = 0;
    canvas.addEventListener('touchstart', function (evt) {
        if (evt.touches.length === 1) {
            touchStartX = evt.touches[0].clientX;
            touchStartY = evt.touches[0].clientY;
        }
    }, { passive: true });
    canvas.addEventListener('touchend', function (evt) {
        if (evt.changedTouches.length === 1) {
            const touch = evt.changedTouches[0];
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;
            // Only treat as a tap if movement was small (< 10px)
            if (Math.hypot(dx, dy) < 10) {
                evt.preventDefault();
                onCanvasClick({ clientX: touch.clientX, clientY: touch.clientY });
            }
        }
    }, { passive: false });
    toggleControlsBtn?.addEventListener('click', toggleControls);
    toggleSidebarBtn?.addEventListener('click', toggleSidebar);
    controlsBackdrop?.addEventListener('click', () => {
        closeActiveMobilePanel?.();
    });

    function setMoreMenuOpen(isOpen) {
        if (!actionBtns) return;
        actionBtns.classList.toggle('mobile-open', !!isOpen);
    }

    function syncControlsOffset() {
        if (!controlsContainer) return;
        const offset = Math.round(controlsContainer.getBoundingClientRect().height);
        document.documentElement.style.setProperty('--controls-offset', `${offset}px`);
    }

    if (actionBtns) {
        // Close on any outside click — desktop only; on mobile the backdrop + closeMobilePanel handle this
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) return;
            if (!actionBtns.contains(e.target) && !e.target.closest('#mobileNavMore')) {
                setMoreMenuOpen(false);
            }
        });
    }

    function setControlsDesktopCollapsedState(isCollapsed) {
        if (!controlsContent) return;
        controlsContent.classList.toggle('desktop-collapsed', isCollapsed);
        if (toggleControlsBtn) {
            toggleControlsBtn.classList.toggle('expanded', !isCollapsed);
            toggleControlsBtn.title = isCollapsed ? 'Expand settings' : 'Collapse settings';
            toggleControlsBtn.setAttribute('aria-expanded', String(!isCollapsed));
        }
    }

    function setSidebarDesktopCollapsedState(isCollapsed) {
        if (!overlaySidebar) return;
        overlaySidebar.classList.toggle('desktop-collapsed', isCollapsed);
        if (toggleSidebarBtn) {
            toggleSidebarBtn.textContent = isCollapsed ? '⟩' : '⟨';
            toggleSidebarBtn.title = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
        }
    }

    // Start with controls collapsed by default
    try {
        setControlsDesktopCollapsedState(true);
        syncControlsOffset();
    } catch (e) { console.error('Error initializing controls collapse state', e); }

    // On mobile, sidebar is managed as a bottom sheet via .mobile-open.
    // On desktop, start sidebar expanded.
    try {
        if (overlaySidebar && window.innerWidth > 768) {
            // Desktop: sidebar visible by default.
        } else if (overlaySidebar && toggleSidebarBtn) {
            toggleSidebarBtn.textContent = '⟩';
            toggleSidebarBtn.title = 'Expand sidebar';
        }
    } catch (e) { console.error('Error initializing sidebar collapse state', e); }

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
            customSizeGroup.style.display = ''; // Revert to CSS (grid)
            if (window.getComputedStyle(customSizeGroup).display === 'none') {
                 // Fallback if CSS doesn't set display (though it should via class)
                 customSizeGroup.style.display = 'grid';
            }
            orientationSelect.disabled = true;
        } else {
            customSizeGroup.style.display = 'none';
            orientationSelect.disabled = false;
        }
    }

    // Install debounced draw using helper (reduces frequent redraws during rapid input)
    try {
        if (typeof debounce === 'function') debouncedDraw = debounce(drawTonnetz, 120);
    } catch (e) { console.error('Failed to create debounced draw', e); }

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
        const rootStyles = getComputedStyle(document.documentElement);
        const canvasLabelFontFamily = rootStyles.getPropertyValue('--font-canvas-label').trim()
            || getComputedStyle(document.body).fontFamily
            || 'Arial, sans-serif';

        const size = parseInt(triangleSizeInput.value) || 40;
        const edo = parseInt(edoInput.value) || 12;
        const intervalX = parseInt(intervalXInput.value) || 7;
        const intervalZ = parseInt(intervalZInput.value) || 4;

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
        } catch (e) { console.error('Error parsing scale degrees', e); }
        const scaleSizeFactor = clamp(parseFloat(scaleSizeInput?.value), 0.5, 4, 1.5);
        const drawScaleDots = !!(scaleDotsInput?.checked);
        const scaleDotColor = hexToRgbString(scaleDotColorInput?.value || '#000000');
        const scaleDotSize = clamp(parseFloat(scaleDotSizeInput?.value), 1, 50, 6);

        // Keep the two default overlays synced to current X/Z if they are autoSync
        try { synchronizeDefaultOverlaySteps(intervalX, intervalZ, edo); } catch (e) { console.error('Error synchronizing default overlays', e); }

        const { width: canvasWidth, height: canvasHeight, scale } = getCanvasDimensions();

        // Shared render logic for both offscreen and direct paths
        function renderToContext(targetCtx, w, h) {
            targetCtx.fillStyle = backgroundColor;
            targetCtx.fillRect(0, 0, w, h);
            const cellH = size * SQRT3_HALF;
            const rows = Math.ceil(h / cellH) + 4;
            const cols = Math.ceil(w / size) + 4;
            for (let row = -2; row < rows; row++) {
                for (let col = -2; col < cols; col++) {
                    drawTriangle(col, row, size, colorX, colorY, colorZ, edo, intervalX, intervalZ, labelColor, highlightZero, highlightZeroColor, targetCtx, scaleSet, scaleSizeFactor, canvasLabelFontFamily);
                }
            }
            if (overlays.length) {
                for (const ov of overlays) {
                    if (!ov.visible) continue;
                    const anchors = buildAnchorsForOverlay(ov, w, h, size, edo, intervalX, intervalZ);
                    drawChordOverlay(targetCtx, w, h, size, edo, intervalX, intervalZ, ov.steps, ov.color, ov.opacity, anchors, ov.nonTriangleMode);
                }
            }
            if (drawScaleDots && scaleSet) {
                drawScaleDotsGrid(targetCtx, w, h, size, edo, intervalX, intervalZ, scaleSet, scaleDotColor, scaleDotSize);
            }
        }

        if (scale < 1) {
            const offscreen = document.createElement('canvas');
            offscreen.width = Math.round(canvasWidth / scale);
            offscreen.height = Math.round(canvasHeight / scale);
            const offCtx = offscreen.getContext('2d');
            renderToContext(offCtx, offscreen.width, offscreen.height);
            lastOffscreenCanvas = offscreen;
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(offscreen, 0, 0, offscreen.width, offscreen.height, 0, 0, canvas.width, canvas.height);
        } else {
            lastOffscreenCanvas = null;
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            renderToContext(ctx, canvas.width, canvas.height);
        }
    }

    // When X/Z/EDO change, update default overlay steps and refresh the panel inputs
    function onIntervalParamsChange() {
        const edo = parseInt(edoInput.value) || 12;
        const ix = parseInt(intervalXInput.value) || 7;
        const iz = parseInt(intervalZInput.value) || 4;
        // Clear memoization caches that depend on lattice parameters
        if (typeof findNearestOffsets !== 'undefined' && findNearestOffsets._cache) findNearestOffsets._cache.clear();
        try { synchronizeDefaultOverlaySteps(ix, iz, edo); } catch (e) { console.error('Error synchronizing default overlays (onIntervalParamsChange)', e); }
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
        const size = parseInt(triangleSizeInput.value) || 40;
        const edo = parseInt(edoInput.value) || 12;
        const intervalX = parseInt(intervalXInput.value) || 7;
        const intervalZ = parseInt(intervalZInput.value) || 4;
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
            } catch (e) { console.error('Error resolving anchor from click', e); }
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
        // Brief visual flash on the canvas for anchor placement feedback
        canvas.classList.add('canvas-flash');
        setTimeout(() => canvas.classList.remove('canvas-flash'), 300);
    }

    function saveAsImage() {
        const exportCanvas = lastOffscreenCanvas || canvas;
        const image = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = image;
        link.download = 'tonnetz.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function saveAsPdf() {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert('PDF export requires jsPDF. Please check your internet connection and try again.');
            return;
        }
        try {
            const { jsPDF } = window.jspdf;
            const exportCanvas = lastOffscreenCanvas || canvas;
            const w = exportCanvas.width;
            const h = exportCanvas.height;
            const pdf = new jsPDF({
                orientation: w > h ? 'landscape' : 'portrait',
                unit: 'px',
                format: [w, h]
            });
            const imgData = exportCanvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', 0, 0, w, h);
            pdf.save('tonnetz.pdf');
        } catch (e) {
            console.error('PDF export failed', e);
            alert('PDF export failed: ' + e.message);
        }
    }

    function toggleControls() {
        if (!controlsContent) return;
        const isCollapsed = !controlsContent.classList.contains('desktop-collapsed');
        setControlsDesktopCollapsedState(isCollapsed);
        // Show/hide backdrop on mobile (bottom-sheet mode)
        if (controlsBackdrop) {
            controlsBackdrop.classList.toggle('visible', !isCollapsed && window.innerWidth <= 768);
        }
        saveStateToStorage();
    }

    function toggleSidebar() {
        if (!overlaySidebar) return;
        const isCollapsed = !overlaySidebar.classList.contains('desktop-collapsed');
        setSidebarDesktopCollapsedState(isCollapsed);
        saveStateToStorage();
    }

    // ==============================
    // State Persistence
    // ==============================
    const STATE_KEY = 'tonnetz-state';
    const STATE_VERSION = 1;

    function serializeState() {
        return {
            version: STATE_VERSION,
            edo: parseInt(edoInput.value) || 12,
            intervalX: parseInt(intervalXInput.value) || 7,
            intervalZ: parseInt(intervalZInput.value) || 4,
            canvasSize: canvasSizeSelect.value,
            orientation: orientationSelect.value,
            canvasWidth: parseInt(canvasWidthInput.value) || 1000,
            canvasHeight: parseInt(canvasHeightInput.value) || 1000,
            triangleSize: parseInt(triangleSizeInput.value) || 75,
            colorX: colorXInput.value,
            colorY: colorYInput.value,
            colorZ: colorZInput.value,
            backgroundColor: backgroundColorInput.value,
            labelColor: labelColorInput.value,
            highlightZero: highlightZeroInput.checked,
            highlightZeroColor: highlightZeroColorInput.value,
            scaleDegrees: scaleDegreesInput?.value || '',
            scaleSize: scaleSizeInput?.value || '1.5',
            scaleDots: !!scaleDotsInput?.checked,
            scaleDotColor: scaleDotColorInput?.value || '#000000',
            scaleDotSize: scaleDotSizeInput?.value || '6',
            overlays: overlays.map(ov => ({
                steps: ov.steps,
                color: ov.color,
                opacity: ov.opacity,
                anchors: ov.anchors,
                repeatAll: ov.repeatAll,
                nonTriangleMode: ov.nonTriangleMode,
                visible: ov.visible,
                autoSync: ov.autoSync
            })),
            activeOverlayIdx: overlays.findIndex(o => o.id === activeOverlayId),
            upOverlayIdx: overlays.findIndex(o => o.id === upOverlayId),
            downOverlayIdx: overlays.findIndex(o => o.id === downOverlayId),
            sidebarCollapsed: overlaySidebar?.classList.contains('desktop-collapsed') || false,
            controlsCollapsed: controlsContent?.classList.contains('desktop-collapsed') || false
        };
    }

    function deserializeState(state) {
        if (!state || state.version !== STATE_VERSION) return false;
        try {
            edoInput.value = state.edo;
            intervalXInput.value = state.intervalX;
            intervalZInput.value = state.intervalZ;
            canvasSizeSelect.value = state.canvasSize;
            orientationSelect.value = state.orientation;
            canvasWidthInput.value = state.canvasWidth;
            canvasHeightInput.value = state.canvasHeight;
            triangleSizeInput.value = state.triangleSize;
            colorXInput.value = state.colorX;
            colorYInput.value = state.colorY;
            colorZInput.value = state.colorZ;
            backgroundColorInput.value = state.backgroundColor;
            labelColorInput.value = state.labelColor;
            highlightZeroInput.checked = !!state.highlightZero;
            highlightZeroColorInput.value = state.highlightZeroColor;
            if (scaleDegreesInput) scaleDegreesInput.value = state.scaleDegrees || '';
            if (scaleSizeInput) scaleSizeInput.value = state.scaleSize || '1.5';
            if (scaleDotsInput) scaleDotsInput.checked = !!state.scaleDots;
            if (scaleDotColorInput) scaleDotColorInput.value = state.scaleDotColor || '#000000';
            if (scaleDotSizeInput) scaleDotSizeInput.value = state.scaleDotSize || '6';

            // Rebuild overlays
            overlays.length = 0;
            overlayIdCounter = 1;
            activeOverlayId = null;
            upOverlayId = null;
            downOverlayId = null;
            if (Array.isArray(state.overlays) && state.overlays.length > 0) {
                for (const saved of state.overlays) {
                    const ov = {
                        id: overlayIdCounter++,
                        visible: saved.visible !== false,
                        steps: saved.steps || [0, 4, 7],
                        color: saved.color || 'rgb(255 0 0)',
                        opacity: Number.isFinite(saved.opacity) ? saved.opacity : 0.35,
                        anchors: Array.isArray(saved.anchors) ? saved.anchors : [],
                        repeatAll: !!saved.repeatAll,
                        nonTriangleMode: !!saved.nonTriangleMode,
                        autoSync: !!saved.autoSync
                    };
                    overlays.push(ov);
                }
                if (state.activeOverlayIdx >= 0 && state.activeOverlayIdx < overlays.length)
                    activeOverlayId = overlays[state.activeOverlayIdx].id;
                else
                    activeOverlayId = overlays[0].id;
                if (state.upOverlayIdx >= 0 && state.upOverlayIdx < overlays.length)
                    upOverlayId = overlays[state.upOverlayIdx].id;
                if (state.downOverlayIdx >= 0 && state.downOverlayIdx < overlays.length)
                    downOverlayId = overlays[state.downOverlayIdx].id;
            }

            // Restore UI collapse states — on mobile all panels always start closed
            if (window.innerWidth <= 768) {
                setControlsDesktopCollapsedState(true);
                controlsBackdrop?.classList.remove('visible');
                overlaySidebar?.classList.remove('mobile-open');
            } else {
                if (state.controlsCollapsed) {
                    setControlsDesktopCollapsedState(true);
                    if (controlsBackdrop) controlsBackdrop.classList.remove('visible');
                } else {
                    setControlsDesktopCollapsedState(false);
                }
                setSidebarDesktopCollapsedState(!!state.sidebarCollapsed);
            }

            handleCanvasSizeChange();
            renderOverlayListPanel();
            drawTonnetz();
            return true;
        } catch (e) {
            console.error('Error deserializing state', e);
            return false;
        }
    }

    function saveStateToStorage() {
        try {
            localStorage.setItem(STATE_KEY, JSON.stringify(serializeState()));
        } catch (e) { /* quota exceeded or private mode — silently ignore */ }
    }

    function stateToHash(state) {
        return '#' + btoa(JSON.stringify(state));
    }

    function hashToState(hash) {
        try {
            if (!hash || hash.length < 2) return null;
            return JSON.parse(atob(hash.slice(1)));
        } catch (e) { return null; }
    }

    // Wire Copy Link button
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => {
            const state = serializeState();
            const hash = stateToHash(state);
            history.replaceState(null, '', hash);
            const url = location.href;
            navigator.clipboard.writeText(url).then(() => {
                copyLinkBtn.classList.add('copied');
                setTimeout(() => copyLinkBtn.classList.remove('copied'), 1500);
            }).catch(() => {
                // Fallback for older browsers
                const ta = document.createElement('textarea');
                ta.value = url;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                copyLinkBtn.classList.add('copied');
                setTimeout(() => copyLinkBtn.classList.remove('copied'), 1500);
            });
        });
    }

    // Wire Reset button
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            localStorage.removeItem(STATE_KEY);
            history.replaceState(null, '', location.pathname);
            location.reload();
        });
    }

    // Auto-save on every draw (debounced separately to avoid frequent synchronous writes)
    const debouncedSave = debounce(saveStateToStorage, 500);
    const originalDrawTonnetz = drawTonnetz;
    drawTonnetz = function () {
        originalDrawTonnetz();
        debouncedSave();
    };
    // Re-create debounced version with the wrapped drawTonnetz
    try {
        if (typeof debounce === 'function') debouncedDraw = debounce(drawTonnetz, 120);
    } catch (e) { /* ignore */ }

    // ==============================
    // Initialization — Restore State
    // ==============================
    let stateRestored = false;

    // Priority 1: URL hash
    try {
        const hashState = hashToState(location.hash);
        if (hashState) stateRestored = deserializeState(hashState);
    } catch (e) { console.error('Error restoring state from URL hash', e); }

    // Priority 2: localStorage
    if (!stateRestored) {
        try {
            const stored = localStorage.getItem(STATE_KEY);
            if (stored) stateRestored = deserializeState(JSON.parse(stored));
        } catch (e) { console.error('Error restoring state from localStorage', e); }
    }

    // Priority 3: Defaults
    if (!stateRestored) {
        handleCanvasSizeChange();
        try {
            colorXInput.value = rgbStringToHex(DEFAULT_COLORS.x);
            colorYInput.value = rgbStringToHex(DEFAULT_COLORS.y);
            colorZInput.value = rgbStringToHex(DEFAULT_COLORS.z);
            backgroundColorInput.value = rgbStringToHex(DEFAULT_COLORS.bg);
            labelColorInput.value = rgbStringToHex(DEFAULT_COLORS.label);
            highlightZeroColorInput.value = rgbStringToHex(DEFAULT_COLORS.highlightZero);
            if (scaleDotColorInput) scaleDotColorInput.value = '#000000';
            if (scaleDotSizeInput) scaleDotSizeInput.value = '6';
        } catch (e) { console.error('Error seeding color inputs', e); }
        try {
            if (!overlays || overlays.length === 0) {
                addOverlay({ color: 'rgb(255 0 0)' });
                addOverlay({ color: 'rgb(0 0 255)' });
            }
        } catch (e) { console.error('Error ensuring default overlays', e); }
        renderOverlayListPanel();
        drawTonnetz();
    }

    // ==============================
    // Adaptive Navigation
    // Uses the same tab/panel controller across viewports.
    // On narrow screens the nav sits at the bottom; on wide screens it becomes a left rail.
    // ==============================
    (function initAdaptiveNav() {
        const MOBILE_BREAKPOINT = 768;
        const DRAG_CLOSE_DISTANCE_PX = 72;
        const DRAG_CLOSE_VELOCITY_PX_PER_MS = 0.45;
        const mobileNavSettings = document.getElementById('mobileNavSettings');
        const mobileNavChords   = document.getElementById('mobileNavChords');
        const mobileNavScale    = document.getElementById('mobileNavScale');
        const mobileNavMore     = document.getElementById('mobileNavMore');
        if (!mobileNavSettings && !mobileNavChords && !mobileNavScale && !mobileNavMore) return;

        let activeMobilePanel = null; // 'settings' | 'chords' | 'scale' | 'more' | null

        const navTabIds = { settings: 'mobileNavSettings', chords: 'mobileNavChords', scale: 'mobileNavScale', more: 'mobileNavMore' };
        const panelDefs = {
            settings: {
                key: 'settings',
                panel: controlsContent,
                handle: controlsContent?.querySelector('[data-sheet-handle]'),
                open() {
                    controlsContent?.classList.remove('desktop-collapsed');
                    controlsContent?.classList.add('mobile-open');
                },
                close() {
                    controlsContent?.classList.remove('mobile-open');
                }
            },
            chords: {
                key: 'chords',
                panel: overlaySidebar,
                handle: overlaySidebar?.querySelector('[data-sheet-handle]'),
                open() {
                    overlaySidebar?.classList.add('mobile-open');
                },
                close() {
                    overlaySidebar?.classList.remove('mobile-open');
                }
            },
            scale: {
                key: 'scale',
                panel: scaleContent,
                handle: scaleContent?.querySelector('[data-sheet-handle]'),
                open() {
                    scaleContent?.classList.add('mobile-open');
                },
                close() {
                    scaleContent?.classList.remove('mobile-open');
                }
            },
            more: {
                key: 'more',
                panel: actionBtns,
                handle: actionBtns?.querySelector('[data-sheet-handle]'),
                open() {
                    setMoreMenuOpen(true);
                },
                close() {
                    setMoreMenuOpen(false);
                }
            }
        };

        function isBottomNavViewport() {
            return window.innerWidth <= MOBILE_BREAKPOINT;
        }

        function updateNavPressed() {
            Object.keys(navTabIds).forEach(function (panel) {
                document.getElementById(navTabIds[panel])
                    ?.setAttribute('aria-pressed', String(activeMobilePanel === panel));
            });
        }

        function focusMobilePanel(panelEl) {
            if (!isBottomNavViewport() || !panelEl) return;
            if (!panelEl.hasAttribute('tabindex')) panelEl.tabIndex = -1;
            requestAnimationFrame(function () {
                if (!panelEl.classList.contains('mobile-open')) return;
                panelEl.focus({ preventScroll: true });
            });
        }

        function resetPanelDragVisual(panelEl) {
            if (!panelEl) return;
            panelEl.style.removeProperty('--sheet-drag-offset');
            panelEl.classList.remove('mobile-sheet-dragging');
        }

        function closeMobilePanel(options) {
            const shouldRestoreFocus = options?.restoreFocus !== false;
            const closingPanelKey = activeMobilePanel;
            const closingPanel = closingPanelKey ? panelDefs[closingPanelKey]?.panel : null;
            const restoreFocusTarget = closingPanelKey ? document.getElementById(navTabIds[closingPanelKey]) : null;

            if (closingPanelKey && panelDefs[closingPanelKey]) {
                panelDefs[closingPanelKey].close();
            }
            Object.values(panelDefs).forEach(def => resetPanelDragVisual(def.panel));
            controlsBackdrop?.classList.remove('visible');
            activeMobilePanel = null;
            updateNavPressed();

            if (shouldRestoreFocus && closingPanel?.contains(document.activeElement)) {
                restoreFocusTarget?.focus({ preventScroll: true });
            }
        }

        closeActiveMobilePanel = closeMobilePanel;

        function openMobilePanel(panel) {
            if (activeMobilePanel === panel) {
                closeMobilePanel();
                return;
            }
            closeMobilePanel({ restoreFocus: false });
            const nextPanel = panelDefs[panel]?.panel;
            panelDefs[panel]?.open();
            controlsBackdrop?.classList.toggle('visible', isBottomNavViewport());
            activeMobilePanel = panel;
            updateNavPressed();
            focusMobilePanel(nextPanel);
        }

        document.addEventListener('click', function (e) {
            if (!isBottomNavViewport() || !activeMobilePanel) return;

            const activePanel = panelDefs[activeMobilePanel]?.panel;
            const activeNavTab = document.getElementById(navTabIds[activeMobilePanel]);
            const clickedNavTab = Object.values(navTabIds).some(function (navTabId) {
                return document.getElementById(navTabId)?.contains(e.target);
            });
            if (!activePanel) return;
            if (activePanel.contains(e.target) || activeNavTab?.contains(e.target) || clickedNavTab) return;

            e.preventDefault();
            e.stopPropagation();
            closeMobilePanel();
        }, true);

        function bindDragToCollapse(def) {
            const panel = def?.panel;
            const handle = def?.handle;
            const panelKey = def?.key;
            if (!panel || !handle || !panelKey) return;

            let dragging = false;
            let pointerId = null;
            let startY = 0;
            let lastY = 0;
            let lastMoveTs = 0;
            let recentVelocity = 0;

            function detachPointerListeners() {
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUpOrCancel);
                window.removeEventListener('pointercancel', onPointerUpOrCancel);
            }

            function onPointerMove(e) {
                if (!dragging || e.pointerId !== pointerId) return;
                const now = performance.now();
                const dt = Math.max(1, now - lastMoveTs);
                recentVelocity = (e.clientY - lastY) / dt;
                lastMoveTs = now;
                const dy = Math.max(0, e.clientY - startY);
                lastY = e.clientY;
                panel.style.setProperty('--sheet-drag-offset', `${dy}px`);
                if (e.cancelable) e.preventDefault();
            }

            function onPointerUpOrCancel(e) {
                if (!dragging || e.pointerId !== pointerId) return;
                const dy = Math.max(0, (lastY || e.clientY) - startY);
                const shouldClose = activeMobilePanel === panelKey && (
                    dy >= DRAG_CLOSE_DISTANCE_PX || recentVelocity >= DRAG_CLOSE_VELOCITY_PX_PER_MS
                );

                dragging = false;
                pointerId = null;
                detachPointerListeners();
                resetPanelDragVisual(panel);

                if (shouldClose) closeMobilePanel();
            }

            handle.addEventListener('pointerdown', function (e) {
                if (!isBottomNavViewport()) return;
                if (activeMobilePanel !== panelKey) return;
                if (e.pointerType === 'mouse' && e.button !== 0) return;

                dragging = true;
                pointerId = e.pointerId;
                startY = e.clientY;
                lastY = e.clientY;
                lastMoveTs = performance.now();
                recentVelocity = 0;

                panel.classList.add('mobile-sheet-dragging');
                panel.style.setProperty('--sheet-drag-offset', '0px');
                if (handle.setPointerCapture) handle.setPointerCapture(pointerId);

                window.addEventListener('pointermove', onPointerMove, { passive: false });
                window.addEventListener('pointerup', onPointerUpOrCancel);
                window.addEventListener('pointercancel', onPointerUpOrCancel);
                if (e.cancelable) e.preventDefault();
            });
        }

        mobileNavSettings?.addEventListener('click', function () { openMobilePanel('settings'); });
        mobileNavChords?.addEventListener('click',   function () { openMobilePanel('chords'); });
        mobileNavScale?.addEventListener('click',    function () { openMobilePanel('scale'); });
        mobileNavMore?.addEventListener('click',     function () { openMobilePanel('more'); });

        Object.values(panelDefs).forEach(bindDragToCollapse);

        window.addEventListener('resize', function () {
            Object.values(panelDefs).forEach(def => resetPanelDragVisual(def.panel));
            if (!isBottomNavViewport()) controlsBackdrop?.classList.remove('visible');
            syncControlsOffset();
            updateNavPressed();
        });

        // Ensure all panels start closed
        closeMobilePanel();
        setControlsDesktopCollapsedState(true);
        controlsContent?.classList.remove('mobile-open');
        overlaySidebar?.classList.remove('mobile-open');
        scaleContent?.classList.remove('mobile-open');
        setMoreMenuOpen(false);
        syncControlsOffset();
    })();
});
