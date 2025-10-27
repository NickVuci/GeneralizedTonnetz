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

    // Event listeners for numeric controls: redraw only on 'change' (blur or enter)
    triangleSizeInput.addEventListener('change', drawTonnetz);
    edoInput.addEventListener('change', drawTonnetz);
    intervalXInput.addEventListener('change', drawTonnetz);
    intervalZInput.addEventListener('change', drawTonnetz);

    // Event listeners for saving
    saveImageButton.addEventListener('click', saveAsImage);
    savePdfButton.addEventListener('click', saveAsPdf);

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
        }
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
    drawTonnetz();
});
