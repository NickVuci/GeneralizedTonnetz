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
    const highlightZeroInput = document.getElementById('highlightZero');
    const triangleSizeInput = document.getElementById('triangleSize');
    const edoInput = document.getElementById('edo');
    const intervalXInput = document.getElementById('intervalX');
    const intervalZInput = document.getElementById('intervalZ');
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
    highlightZeroInput.addEventListener('input', drawTonnetz);
    triangleSizeInput.addEventListener('change', drawTonnetz);
    edoInput.addEventListener('change', drawTonnetz);
    intervalXInput.addEventListener('change', drawTonnetz);
    intervalZInput.addEventListener('change', drawTonnetz);
    saveImageButton.addEventListener('click', saveAsImage);
    savePdfButton.addEventListener('click', saveAsPdf);
    addOverlayBtn?.addEventListener('click', () => { addOverlay(); renderOverlayListPanel(); drawTonnetz(); });
    overlayListContainer?.addEventListener('input', (e) => { onOverlayPanelEvent(e); drawTonnetz(); }, true);
    overlayListContainer?.addEventListener('change', (e) => { onOverlayPanelEvent(e); drawTonnetz(); }, true);
    overlayListContainer?.addEventListener('click', (e) => { onOverlayPanelEvent(e); drawTonnetz(); }, true);
    canvas.addEventListener('click', onCanvasClick);
    toggleControlsBtn?.addEventListener('click', toggleControls);

    // Limits
    const MAX_CANVAS_WIDTH = 2000;
    const MAX_CANVAS_HEIGHT = 2000;
    const PREVIEW_SCALE = 0.5;

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
        const colorX = colorXInput.value;
        const colorY = colorYInput.value;
        const colorZ = colorZInput.value;
        const backgroundColor = backgroundColorInput.value;
        const labelColor = labelColorInput.value;
        const highlightZero = highlightZeroInput.checked;

        const size = parseInt(document.getElementById('triangleSize').value) || 40;
        const edo = parseInt(document.getElementById('edo').value) || 12;
        const intervalX = parseInt(document.getElementById('intervalX').value) || 7;
        const intervalZ = parseInt(document.getElementById('intervalZ').value) || 4;

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
                    drawTriangle(col, row, size, colorX, colorY, colorZ, edo, intervalX, intervalZ, labelColor, highlightZero, offCtx);
                }
            }
            if (overlays.length) {
                for (const ov of overlays) {
                    if (!ov.visible) continue;
                    drawChordOverlay(offCtx, offscreen.width, offscreen.height, size, edo, intervalX, intervalZ, ov.steps, ov.color, ov.opacity, ov.anchors);
                }
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
                    drawTriangle(col, row, size, colorX, colorY, colorZ, edo, intervalX, intervalZ, labelColor, highlightZero, ctx);
                }
            }
            if (overlays.length) {
                for (const ov of overlays) {
                    if (!ov.visible) continue;
                    drawChordOverlay(ctx, canvas.width, canvas.height, size, edo, intervalX, intervalZ, ov.steps, ov.color, ov.opacity, ov.anchors);
                }
            }
        }
    }

    function onCanvasClick(evt) {
        const rect = canvas.getBoundingClientRect();
        let px = (evt.clientX - rect.left) * (canvas.width / rect.width);
        let py = (evt.clientY - rect.top) * (canvas.height / rect.height);
        const size = parseInt(document.getElementById('triangleSize').value) || 40;
        const { scale } = getCanvasDimensions();
        if (scale < 1) { px = px / scale; py = py / scale; }
        const { q, r } = pixelToQR(px, py, size);
        if (!overlays.length) { addOverlay(); renderOverlayListPanel(); }
        if (activeOverlayId == null) activeOverlayId = overlays[0].id;
        const ov = overlays.find(o => o.id === activeOverlayId);
        if (ov) {
            const i = ov.anchors.findIndex(a => a.q === q && a.r === r);
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
    renderOverlayListPanel();
    drawTonnetz();
});
