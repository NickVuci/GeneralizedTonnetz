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

    // References to new buttons
    const saveImageButton = document.getElementById('saveImageButton');
    const savePdfButton = document.getElementById('savePdfButton');

    // Add event listeners
    document.getElementById('drawButton').addEventListener('click', drawTonnetz);
    canvasSizeSelect.addEventListener('change', handleCanvasSizeChange);

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
            'A4': { width: 2480, height: 3508 },    // 300 DPI
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
        const colorX = document.getElementById('colorX').value;
        const colorY = document.getElementById('colorY').value;
        const colorZ = document.getElementById('colorZ').value;

        // Get triangle size from input fields
        const sizeInput = document.getElementById('triangleSize').value;
        const size = parseInt(sizeInput) || 40; // Default to 40 if invalid

        // Get EDO value and intervals
        const edoInput = document.getElementById('edo').value;
        const edo = parseInt(edoInput) || 12; // Default to 12-EDO if invalid

        const intervalXInput = document.getElementById('intervalX').value;
        const intervalYInput = document.getElementById('intervalY').value;
        const intervalX = parseInt(intervalXInput) || 4; // Default to 4 if invalid
        const intervalY = parseInt(intervalYInput) || 7; // Default to 7 if invalid

        // Get canvas dimensions
        const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions();

        // Update canvas dimensions
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Parameters for the grid
        const h = size * (Math.sqrt(3) / 2);
        const rows = Math.ceil(canvas.height / h) + 4;
        const cols = Math.ceil(canvas.width / size) + 4;

        // Draw the grid
        for (let row = -2; row < rows; row++) {
            for (let col = -2; col < cols; col++) {
                drawTriangle(col, row, size, colorX, colorY, colorZ, edo, intervalX, intervalY);
            }
        }
    }

    function drawTriangle(col, row, size, colorX, colorY, colorZ, edo, intervalX, intervalY) {
        const h = size * (Math.sqrt(3) / 2);
        const xOffset = (row % 2) * (size / 2);
        const x = col * size + xOffset;
        const y = row * h;

        // Points of the triangle
        const points = [
            { x: x, y: y }, // Top vertex
            { x: x + size / 2, y: y + h }, // Bottom right
            { x: x - size / 2, y: y + h }  // Bottom left
        ];

        // Draw sides with specified colors

        // Side X (horizontal - yellow)
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.strokeStyle = colorX;
        ctx.stroke();

        // Side Y (left - red)
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[2].x, points[2].y);
        ctx.strokeStyle = colorY;
        ctx.stroke();

        // Side Z (bottom - blue)
        ctx.beginPath();
        ctx.moveTo(points[1].x, points[1].y);
        ctx.lineTo(points[2].x, points[2].y);
        ctx.strokeStyle = colorZ;
        ctx.stroke();

        // Adjusted label calculation to ensure Y-axis increments straight
        // Calculate axial coordinates (q, r) for hex grid
        let q = col - Math.floor(row / 2);
        let r = row;

        // Calculate label
        let label = (intervalX * q + intervalY * r) % edo;
        if (label < 0) label += edo; // Ensure label is positive

        // Draw label near the top vertex of the triangle
        const labelX = points[0].x;
        const labelY = points[0].y - (size / 5); // Adjust the offset as needed

        ctx.fillStyle = '#000';
        ctx.font = `${size / 4}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom'; // Align text so that the bottom of the text is at labelY
        ctx.fillText(label.toString(), labelX, labelY);
    }

    function saveAsImage() {
        // Convert canvas to data URL
        const image = canvas.toDataURL('image/png');

        // Create a link element
        const link = document.createElement('a');
        link.href = image;
        link.download = 'tonnetz.png';

        // Append to the DOM and trigger click
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function saveAsPdf() {
        // Import jsPDF module
        const { jsPDF } = window.jspdf;

        // Create a new jsPDF instance
        const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [canvas.width, canvas.height]
        });

        // Get the image data from the canvas
        const imgData = canvas.toDataURL('image/png');

        // Add the image to the PDF
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);

        // Save the PDF
        pdf.save('tonnetz.pdf');
    }

    // Initial setup
    handleCanvasSizeChange();
    drawTonnetz();
});
