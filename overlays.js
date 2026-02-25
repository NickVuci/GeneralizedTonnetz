// Overlay state and panel management
let overlays = [];
let overlayIdCounter = 1;
let activeOverlayId = null;
// Mappings for automatic click behavior on up/down triangles
let upOverlayId = null;
let downOverlayId = null;

const overlayListContainer = document.getElementById('overlayList');

function addOverlay(preset) {
    const palette = ['rgb(0 170 0)', 'rgb(170 0 170)', 'rgb(0 170 170)', 'rgb(170 85 0)', 'rgb(0 85 170)', 'rgb(170 0 85)', 'rgb(85 119 0)'];
    const color = preset?.color ? normalizeColorToRgb(preset.color) : palette[(overlayIdCounter - 1) % palette.length];

    // Compute smart defaults for the first two overlays based on current X and Z
    let stepsDefault = [0, 4, 7];
    try {
        const edo = parseInt(document.getElementById('edo')?.value) || 12;
        const ix = parseInt(document.getElementById('intervalX')?.value) || 7; // X
        const iz = parseInt(document.getElementById('intervalZ')?.value) || 4; // Z
        const mod = (n, m) => ((n % m) + m) % m;
        // Upward triangle uses X - Z for its non-shared edge with X
        const ixMinusZ = mod(ix - iz, edo);

        if (overlays.length === 0) {
            // First overlay (downward triangle): 0, Z, X
            stepsDefault = [0, iz, ix];
        } else if (overlays.length === 1) {
            // Second overlay (upward triangle, inversion of the first): 0, (X - Z), X
            stepsDefault = [0, ixMinusZ, ix];
        }
    } catch (e) { console.error('Error computing overlay defaults', e); }

    const isFirst = overlays.length === 0;
    const isSecond = overlays.length === 1;
    const ov = {
        id: overlayIdCounter++,
        visible: true,
        steps: preset?.steps || stepsDefault,
        color,
        opacity: Number.isFinite(preset?.opacity) ? preset.opacity : 0.35,
        anchors: preset?.anchors || [],
        repeatAll: !!preset?.repeatAll,
        nonTriangleMode: !!preset?.nonTriangleMode
    };
    // Auto-sync the two default overlays' steps with X/Z unless user edits them
    ov.autoSync = (preset?.steps == null) && (isFirst || isSecond);
    overlays.push(ov);
    activeOverlayId = ov.id;
    // Auto-assign default up/down mapping for the first two overlays
    if (overlays.length === 1 && downOverlayId == null) downOverlayId = ov.id; // first overlay is downward by default
    else if (overlays.length === 2 && upOverlayId == null) upOverlayId = ov.id; // second overlay is upward by default
}

function removeOverlay(id) {
    const idx = overlays.findIndex(o => o.id === id);
    if (idx >= 0) overlays.splice(idx, 1);
    if (activeOverlayId === id) activeOverlayId = overlays[0]?.id ?? null;
    if (upOverlayId === id) upOverlayId = null;
    if (downOverlayId === id) downOverlayId = null;
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
    } else if (target.classList.contains('ov-active')) {
        activeOverlayId = id;
    } else if (target.classList.contains('ov-steps')) {
        ov.steps = parseChordSteps(target.value);
        ov.autoSync = false; // user has overridden defaults
    } else if (target.classList.contains('ov-repeat')) {
        ov.repeatAll = !!target.checked;
    } else if (target.classList.contains('ov-non-triangle')) {
        ov.nonTriangleMode = !!target.checked;
    } else if (target.classList.contains('ov-color')) {
        // input[type=color] yields hex -> store as rgb() for consistency
        ov.color = hexToRgbString(target.value);
    } else if (target.classList.contains('ov-opacity')) {
        ov.opacity = clamp(parseFloat(target.value), 0, 1, 0.35);
    } else if (target.classList.contains('ov-clear-anchors')) {
        e.preventDefault();
        clearOverlayAnchors(id);
    } else if (target.classList.contains('ov-delete')) {
        e.preventDefault();
        removeOverlay(id);
        renderOverlayListPanel();
    } else if (target.classList.contains('ov-map-up')) {
        upOverlayId = id;
        renderOverlayListPanel();
    } else if (target.classList.contains('ov-map-down')) {
        downOverlayId = id;
        renderOverlayListPanel();
    }
}

// Keep default overlays in sync with current X/Z when autoSync is enabled
function synchronizeDefaultOverlaySteps(ix, iz, edo) {
    const mod = (n, m) => ((n % m) + m) % m;
    const ixMinusZ = mod(ix - iz, edo);
    // Determine canonical default steps given X/Z
    const downSteps = [0, iz, ix];
    const upSteps = [0, ixMinusZ, ix];
    // Track first two autoSync overlays in creation order
    let autoIdx = 0;
    for (const ov of overlays) {
        if (!ov.autoSync) continue;
        autoIdx++;
        if (autoIdx === 1) {
            ov.steps = downSteps.slice();
        } else if (autoIdx === 2) {
            ov.steps = upSteps.slice();
        }
    }
}

function renderOverlayListPanel() {
    if (!overlayListContainer) return;
    overlayListContainer.innerHTML = '';
    overlays.forEach((ov, idx) => {
        const displayNum = idx + 1; // Relative numbering based on current order
        const card = document.createElement('div');
        card.className = 'overlay-card';
        card.setAttribute('data-id', String(ov.id));

        const isUp = upOverlayId === ov.id;
        const isDown = downOverlayId === ov.id;
        // Build DOM nodes safely instead of using innerHTML to avoid injection
        const inputVisible = document.createElement('input');
        inputVisible.type = 'checkbox';
        inputVisible.className = 'ov-visible';
        inputVisible.title = 'Toggle visibility';
        inputVisible.checked = !!ov.visible;

        const inputActive = document.createElement('input');
        inputActive.type = 'radio';
        inputActive.name = 'activeOverlay';
        inputActive.className = 'ov-active';
        inputActive.title = 'Make active for clicks';
        inputActive.checked = (activeOverlayId === ov.id);

        const labelNum = document.createElement('span');
        labelNum.className = 'ov-title';
        labelNum.textContent = `Overlay ${displayNum}`;

        const lblUp = document.createElement('label');
        lblUp.title = 'Map to Up-triangle clicks';
        lblUp.textContent = '↑';
        const inputMapUp = document.createElement('input');
        inputMapUp.type = 'radio';
        inputMapUp.name = 'mapUp';
        inputMapUp.className = 'ov-map-up';
        inputMapUp.title = 'Use this chord for Up triangles';
        inputMapUp.checked = !!isUp;

        const lblDown = document.createElement('label');
        lblDown.title = 'Map to Down-triangle clicks';
        lblDown.textContent = '↓';
        const inputMapDown = document.createElement('input');
        inputMapDown.type = 'radio';
        inputMapDown.name = 'mapDown';
        inputMapDown.className = 'ov-map-down';
        inputMapDown.title = 'Use this chord for Down triangles';
        inputMapDown.checked = !!isDown;

        const lblRepeat = document.createElement('label');
        lblRepeat.title = 'Auto-place at all matching triangles';
        lblRepeat.textContent = 'Repeat';
        const inputRepeat = document.createElement('input');
        inputRepeat.type = 'checkbox';
        inputRepeat.className = 'ov-repeat';
        inputRepeat.title = 'Automatically place at all matching triangles';
        inputRepeat.checked = !!ov.repeatAll;

        const lblNon = document.createElement('label');
        lblNon.title = 'Non-triangle mode: draw 4 arms for all notes';
        lblNon.textContent = 'Non-△';
        const inputNon = document.createElement('input');
        inputNon.type = 'checkbox';
        inputNon.className = 'ov-non-triangle';
        inputNon.title = 'Apply 4-arm logic to all chord tones';
        inputNon.checked = !!ov.nonTriangleMode;

        const lblSteps = document.createElement('label');
        lblSteps.textContent = 'Steps:';
        const inputSteps = document.createElement('input');
        inputSteps.type = 'text';
        inputSteps.className = 'ov-steps';
        inputSteps.title = 'Comma-separated steps';
        inputSteps.value = Array.isArray(ov.steps) ? ov.steps.join(',') : String(ov.steps || '');

        const lblColor = document.createElement('label');
        lblColor.textContent = 'Color:';
        const inputColor = document.createElement('input');
        inputColor.type = 'color';
        inputColor.className = 'ov-color';
        try { inputColor.value = rgbStringToHex(ov.color); } catch (e) { inputColor.value = '#00ff00'; }

        const lblOp = document.createElement('label');
        lblOp.textContent = 'Opacity:';
        const inputOp = document.createElement('input');
        inputOp.type = 'number';
        inputOp.className = 'ov-opacity';
        inputOp.min = '0'; inputOp.max = '1'; inputOp.step = '0.05';
        inputOp.value = String(ov.opacity);

        const anchorsSpan = document.createElement('span');
        anchorsSpan.className = 'ov-anchors';
        anchorsSpan.textContent = 'Anchors: ';
        const anchorsStrong = document.createElement('strong');
        anchorsStrong.className = 'ov-anchors-count';
        anchorsStrong.textContent = String(ov.anchors.length);
        anchorsSpan.appendChild(anchorsStrong);

        const btnClear = document.createElement('button');
        btnClear.className = 'ov-clear-anchors';
        btnClear.textContent = 'Clear Anchors';

        const btnDelete = document.createElement('button');
        btnDelete.className = 'ov-delete';
        btnDelete.textContent = 'Delete';

        const headerRow = document.createElement('div');
        headerRow.className = 'ov-row ov-header';
        headerRow.appendChild(inputVisible);
        headerRow.appendChild(inputActive);
        headerRow.appendChild(labelNum);

        const mapRow = document.createElement('div');
        mapRow.className = 'ov-row ov-mapping';
        mapRow.appendChild(lblUp);
        mapRow.appendChild(inputMapUp);
        mapRow.appendChild(lblDown);
        mapRow.appendChild(inputMapDown);
        mapRow.appendChild(lblRepeat);
        mapRow.appendChild(inputRepeat);
        mapRow.appendChild(lblNon);
        mapRow.appendChild(inputNon);

        const fields = document.createElement('div');
        fields.className = 'ov-fields';

        const fieldSteps = document.createElement('div');
        fieldSteps.className = 'ov-field';
        fieldSteps.appendChild(lblSteps);
        fieldSteps.appendChild(inputSteps);

        const fieldColor = document.createElement('div');
        fieldColor.className = 'ov-field';
        fieldColor.appendChild(lblColor);
        fieldColor.appendChild(inputColor);

        const fieldOpacity = document.createElement('div');
        fieldOpacity.className = 'ov-field';
        fieldOpacity.appendChild(lblOp);
        fieldOpacity.appendChild(inputOp);

        fields.appendChild(fieldSteps);
        fields.appendChild(fieldColor);
        fields.appendChild(fieldOpacity);

        const anchorsRow = document.createElement('div');
        anchorsRow.className = 'ov-row ov-anchors-row';
        anchorsRow.appendChild(anchorsSpan);
        anchorsRow.appendChild(btnClear);
        anchorsRow.appendChild(btnDelete);

        card.appendChild(headerRow);
        card.appendChild(mapRow);
        card.appendChild(fields);
        card.appendChild(anchorsRow);

        overlayListContainer.appendChild(card);
    });
}
