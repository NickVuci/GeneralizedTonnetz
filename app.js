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
    const labelColorInput = document.getElementById('labelColor'); // New label color input

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
    labelColorInput.addEventListener('input', drawTonnetz); // Real-time label color update

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

    function getCanvasDimensions() {
        let width, height;
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

        return { width, height };
    }

    function drawTonnetz() {
        // Get colors from input fields
        const colorX = colorXInput.value;
        const colorY = colorYInput.value;
        const colorZ = colorZInput.value;
        const backgroundColor = backgroundColorInput.value;
        const labelColor = labelColorInput.value; // Label color

        // Get triangle size from input fields
        const sizeInput = document.getElementById('triangleSize').value;
        const size = parseInt(sizeInput) || 40;

        // Get EDO value and intervals
        const edoInput = document.getElementById('edo').value;
        const edo = parseInt(edoInput) || 12;

        const intervalXInput = document.getElementById('intervalX').value;
        const intervalZInput = document.getElementById('intervalZ').value;
        const intervalX = parseInt(intervalXInput) || 4;
        const intervalZ = parseInt(intervalZInput) || 7;

        // Get canvas dimensions
        const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions();

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

        // Draw the grid
        for (let row = -2; row < rows; row++) {
            for (let col = -2; col < cols; col++) {
                drawTriangle(col, row, size, colorX, colorY, colorZ, edo, intervalX, intervalZ, labelColor);
            }
        }
    }

    function drawTriangle(col, row, size, colorX, colorY, colorZ, edo, intervalX, intervalZ, labelColor) {
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

        // Draw sides with specified colors
        ctx.strokeStyle = colorX;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.stroke();

        ctx.strokeStyle = colorY;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[2].x, points[2].y);
        ctx.stroke();

        ctx.strokeStyle = colorZ;
        ctx.beginPath();
        ctx.moveTo(points[1].x, points[1].y);
        ctx.lineTo(points[2].x, points[2].y);
        ctx.stroke();

        // Calculate axial coordinates (q, r) for hex grid
        let q = col - Math.floor(row / 2);
        let r = row;

        // Calculate label
        let label = (intervalX * q + intervalZ * r) % edo;
        if (label < 0) label += edo;

        // Draw label near the top vertex of the triangle
        const labelX = points[0].x;
        const labelY = points[0].y - (size / 5);

        ctx.fillStyle = labelColor; // Apply label color
        ctx.font = `${size / 4}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label.toString(), labelX, labelY);
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
