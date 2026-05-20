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
        axisRightInput,
        axisUpRightInput,
        axisDownRightInput,
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

    function getCurrentIntervalParams() {
        const edo = coerceEdoValue(edoInput.value);
        const intervals = directionalAxesToIntervals({
            right: axisRightInput?.value,
            upRight: axisUpRightInput?.value,
            downRight: axisDownRightInput?.value
        }, edo);
        return {
            edo,
            intervalX: intervals.intervalX,
            intervalZ: intervals.intervalZ
        };
    }

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
        const { edo, intervalX, intervalZ } = getCurrentIntervalParams();

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

            const overlayDescriptors = getFixedOverlayDescriptors(intervalX, intervalZ, edo);
            for (const overlay of overlayDescriptors) {
                if (overlay.anchors.length) {
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
                        overlay.anchors,
                        overlay.repeatAll
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
        if (typeof findNearestOffsets !== 'undefined' && findNearestOffsets._cache) {
            findNearestOffsets._cache.clear();
        }
        renderOverlayListPanel();
        drawTonnetz();
    }

    function onCanvasClick(evt) {
        const rect = canvas.getBoundingClientRect();
        let px = (evt.clientX - rect.left) * (canvas.width / rect.width);
        let py = (evt.clientY - rect.top) * (canvas.height / rect.height);
        const size = parseInt(triangleSizeInput.value, 10) || 40;
        const { edo, intervalX, intervalZ } = getCurrentIntervalParams();
        const { scale } = getCanvasDimensions();
        if (scale < 1) {
            px = px / scale;
            py = py / scale;
        }

        const approx = pixelToQR(px, py, size);
        const apexPixel = qrToPixel(approx.q, approx.r, size);
        const orientation = py >= apexPixel.y ? 'up' : 'down';

        const role = orientation === 'up' ? 'up' : 'down';
        const steps = getOverlayStepsForRole(role, intervalX, intervalZ, edo);
        let anchorQR = null;
        try {
            anchorQR = anchorFromClick(px, py, size, edo, intervalX, intervalZ, steps);
        } catch (e) {
            console.error('Error resolving anchor from click', e);
        }
        if (!anchorQR) return;

        const { q, r } = anchorQR;
        toggleOverlayAnchor(role, q, r, {
            repeatAll: !!getOverlayConfig(role)?.repeatAll,
            intervalX,
            intervalZ,
            edo
        });

        drawTonnetz();
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
