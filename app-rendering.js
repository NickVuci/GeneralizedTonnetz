function createTonnetzRenderingController(options) {
    const {
        canvas,
        ctx,
        canvasSizeSelect,
        orientationSelect,
        customSizeGroup,
        canvasWidthInput,
        canvasHeightInput,
        colorXInput,
        colorYInput,
        colorZInput,
        backgroundColorInput,
        labelColorInput,
        highlightZeroColorInput,
        highlightZeroInput,
        triangleSizeInput,
        edoInput,
        intervalXInput,
        intervalZInput,
        scaleDegreesInput,
        scaleSizeInput,
        scaleDotsInput,
        scaleDotColorInput,
        scaleDotSizeInput
    } = options;

    let lastOffscreenCanvas = null;

    const MAX_CANVAS_WIDTH = 2000;
    const MAX_CANVAS_HEIGHT = 2000;
    const PREVIEW_SCALE = 0.5;

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
            customSizeGroup.style.display = '';
            if (window.getComputedStyle(customSizeGroup).display === 'none') {
                customSizeGroup.style.display = 'grid';
            }
            orientationSelect.disabled = true;
        } else {
            customSizeGroup.style.display = 'none';
            orientationSelect.disabled = false;
        }
    }

    function getCanvasDimensions() {
        let width;
        let height;
        let scale = 1;
        const paperSizes = {
            A4: { width: 2480, height: 3508 },
            A3: { width: 3508, height: 4961 },
            Letter: { width: 2550, height: 3300 },
            Legal: { width: 2550, height: 4200 }
        };

        if (canvasSizeSelect.value === 'Custom') {
            width = parseInt(canvasWidthInput.value, 10) || 600;
            height = parseInt(canvasHeightInput.value, 10) || 600;
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

        const size = parseInt(triangleSizeInput.value, 10) || 40;
        const edo = parseInt(edoInput.value, 10) || 12;
        const intervalX = parseInt(intervalXInput.value, 10) || 7;
        const intervalZ = parseInt(intervalZInput.value, 10) || 4;

        let scaleSet = null;
        try {
            const raw = (scaleDegreesInput?.value ?? '').trim();
            const tokens = raw.length ? raw.split(/[\,\s]+/).filter(Boolean) : [];
            if (tokens.length) {
                const set = new Set();
                for (const token of tokens) {
                    const value = parseInt(token, 10);
                    if (!Number.isFinite(value)) continue;
                    let normalized = value % edo;
                    if (normalized < 0) normalized += edo;
                    set.add(normalized);
                }
                if (set.size > 0) scaleSet = set;
            }
        } catch (e) {
            console.error('Error parsing scale degrees', e);
        }

        const scaleSizeFactor = clamp(parseFloat(scaleSizeInput?.value), 0.5, 4, 1.5);
        const drawScaleDots = !!scaleDotsInput?.checked;
        const scaleDotColor = hexToRgbString(scaleDotColorInput?.value || '#000000');
        const scaleDotSize = clamp(parseFloat(scaleDotSizeInput?.value), 1, 50, 6);

        try {
            synchronizeDefaultOverlaySteps(intervalX, intervalZ, edo);
        } catch (e) {
            console.error('Error synchronizing default overlays', e);
        }

        const { width: canvasWidth, height: canvasHeight, scale } = getCanvasDimensions();

        function renderToContext(targetCtx, width, height) {
            targetCtx.fillStyle = backgroundColor;
            targetCtx.fillRect(0, 0, width, height);
            const cellH = size * SQRT3_HALF;
            const rows = Math.ceil(height / cellH) + 4;
            const cols = Math.ceil(width / size) + 4;
            for (let row = -2; row < rows; row++) {
                for (let col = -2; col < cols; col++) {
                    drawTriangle(
                        col,
                        row,
                        size,
                        colorX,
                        colorY,
                        colorZ,
                        edo,
                        intervalX,
                        intervalZ,
                        labelColor,
                        highlightZero,
                        highlightZeroColor,
                        targetCtx,
                        scaleSet,
                        scaleSizeFactor,
                        canvasLabelFontFamily
                    );
                }
            }

            if (overlays.length) {
                for (const overlay of overlays) {
                    if (!overlay.visible) continue;
                    const anchors = buildAnchorsForOverlay(overlay, width, height, size, edo, intervalX, intervalZ);
                    drawChordOverlay(
                        targetCtx,
                        width,
                        height,
                        size,
                        edo,
                        intervalX,
                        intervalZ,
                        overlay.steps,
                        overlay.color,
                        overlay.opacity,
                        anchors,
                        overlay.nonTriangleMode
                    );
                }
            }

            if (drawScaleDots && scaleSet) {
                drawScaleDotsGrid(targetCtx, width, height, size, edo, intervalX, intervalZ, scaleSet, scaleDotColor, scaleDotSize);
            }
        }

        if (scale < 1) {
            const offscreen = document.createElement('canvas');
            offscreen.width = Math.round(canvasWidth / scale);
            offscreen.height = Math.round(canvasHeight / scale);
            const offscreenContext = offscreen.getContext('2d');
            renderToContext(offscreenContext, offscreen.width, offscreen.height);
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

    function onIntervalParamsChange() {
        const edo = parseInt(edoInput.value, 10) || 12;
        const intervalX = parseInt(intervalXInput.value, 10) || 7;
        const intervalZ = parseInt(intervalZInput.value, 10) || 4;
        if (typeof findNearestOffsets !== 'undefined' && findNearestOffsets._cache) {
            findNearestOffsets._cache.clear();
        }
        try {
            synchronizeDefaultOverlaySteps(intervalX, intervalZ, edo);
        } catch (e) {
            console.error('Error synchronizing default overlays (onIntervalParamsChange)', e);
        }
        renderOverlayListPanel();
        drawTonnetz();
    }

    function findEquivalentAnchorIndex(anchors, q, r, p1, p2) {
        const determinant = p1.u * p2.v - p1.v * p2.u;
        if (!determinant) return -1;
        const isInteger = function (value) {
            return Math.abs(value - Math.round(value)) < 1e-6;
        };

        for (let index = 0; index < anchors.length; index++) {
            const anchor = anchors[index];
            const deltaQ = q - anchor.q;
            const deltaR = r - anchor.r;
            const n1 = (p2.v * deltaQ - p2.u * deltaR) / determinant;
            const n2 = (-p1.v * deltaQ + p1.u * deltaR) / determinant;
            if (isInteger(n1) && isInteger(n2)) return index;
        }
        return -1;
    }

    function buildAnchorsForOverlay(overlay, width, height, size, edo, intervalX, intervalZ) {
        const anchors = Array.isArray(overlay.anchors) ? overlay.anchors.slice() : [];
        if (!overlay.repeatAll || anchors.length === 0) return anchors;

        const { p1, p2 } = findPeriodVectors(intervalX, intervalZ, edo);
        const margin = size * 2;
        const diagonal = Math.hypot(width, height);

        const base = anchors[0];
        const basePixel = qrToPixel(base.q, base.r, size);
        const p1Pixel = qrToPixel(base.q + p1.u, base.r + p1.v, size);
        const p2Pixel = qrToPixel(base.q + p2.u, base.r + p2.v, size);
        const length1 = Math.max(1, Math.hypot(p1Pixel.x - basePixel.x, p1Pixel.y - basePixel.y));
        const length2 = Math.max(1, Math.hypot(p2Pixel.x - basePixel.x, p2Pixel.y - basePixel.y));
        const range1 = Math.min(40, Math.ceil(diagonal / length1) + 2);
        const range2 = Math.min(40, Math.ceil(diagonal / length2) + 2);

        const seen = new Set(anchors.map(function (anchor) {
            return `${anchor.q},${anchor.r}`;
        }));
        const originals = anchors.slice();

        for (const anchor of originals) {
            for (let n1 = -range1; n1 <= range1; n1++) {
                for (let n2 = -range2; n2 <= range2; n2++) {
                    const q = anchor.q + n1 * p1.u + n2 * p2.u;
                    const r = anchor.r + n1 * p1.v + n2 * p2.v;
                    const key = `${q},${r}`;
                    if (seen.has(key)) continue;
                    const point = qrToPixel(q, r, size);
                    if (point.x < -margin || point.x > width + margin || point.y < -margin || point.y > height + margin) continue;
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
        const size = parseInt(triangleSizeInput.value, 10) || 40;
        const edo = parseInt(edoInput.value, 10) || 12;
        const intervalX = parseInt(intervalXInput.value, 10) || 7;
        const intervalZ = parseInt(intervalZInput.value, 10) || 4;
        const { scale } = getCanvasDimensions();
        if (scale < 1) {
            px = px / scale;
            py = py / scale;
        }

        const approx = pixelToQR(px, py, size);
        const apexPixel = qrToPixel(approx.q, approx.r, size);
        const orientation = py >= apexPixel.y ? 'up' : 'down';

        if (!overlays.length) {
            addOverlay();
            addOverlay();
            renderOverlayListPanel();
        }
        if (activeOverlayId == null) activeOverlayId = overlays[0].id;

        let targetOverlayId = orientation === 'up'
            ? (typeof upOverlayId === 'number' ? upOverlayId : null)
            : (typeof downOverlayId === 'number' ? downOverlayId : null);
        if (targetOverlayId == null) targetOverlayId = activeOverlayId;

        const overlay = overlays.find(function (item) {
            return item.id === targetOverlayId;
        }) || overlays.find(function (item) {
            return item.id === activeOverlayId;
        }) || overlays[0];

        let anchorQR = null;
        if (overlay && overlay.steps && overlay.steps.length >= 3) {
            try {
                anchorQR = anchorFromClick(px, py, size, edo, intervalX, intervalZ, overlay.steps);
            } catch (e) {
                console.error('Error resolving anchor from click', e);
            }
            if (!anchorQR) return;
        }
        if (!anchorQR) anchorQR = approx;

        const { q, r } = anchorQR;
        if (overlay) {
            let index = overlay.anchors.findIndex(function (anchor) {
                return anchor.q === q && anchor.r === r;
            });
            if (index < 0 && overlay.repeatAll) {
                const { p1, p2 } = findPeriodVectors(intervalX, intervalZ, edo);
                index = findEquivalentAnchorIndex(overlay.anchors, q, r, p1, p2);
            }
            if (index >= 0) overlay.anchors.splice(index, 1);
            else overlay.anchors.push({ q, r });
            updateOverlayAnchorsCount(overlay.id, overlay.anchors.length);
        }

        drawTonnetz();
        canvas.classList.add('canvas-flash');
        setTimeout(function () {
            canvas.classList.remove('canvas-flash');
        }, 300);
    }

    return {
        DEFAULT_COLORS,
        handleCanvasSizeChange,
        getCanvasDimensions,
        drawTonnetz,
        onIntervalParamsChange,
        onCanvasClick,
        getLastOffscreenCanvas: function () {
            return lastOffscreenCanvas;
        }
    };
}