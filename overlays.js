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
    } catch {}

    const isFirst = overlays.length === 0;
    const isSecond = overlays.length === 1;
    const ov = {
        id: overlayIdCounter++,
        visible: true,
        steps: preset?.steps || stepsDefault,
        color,
        opacity: Number.isFinite(preset?.opacity) ? preset.opacity : 0.35,
        anchors: preset?.anchors || [],
        repeatAll: !!preset?.repeatAll
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
        card.style.display = 'flex';
        card.style.flexWrap = 'wrap';
        card.style.alignItems = 'center';
        card.style.gap = '6px';

        const isUp = upOverlayId === ov.id;
        const isDown = downOverlayId === ov.id;
        card.innerHTML = `
            <input type="checkbox" class="ov-visible" ${ov.visible ? 'checked' : ''} title="Toggle visibility">
            <input type="radio" name="activeOverlay" class="ov-active" ${activeOverlayId === ov.id ? 'checked' : ''} title="Make active for clicks">
            <span>Overlay ${displayNum}</span>
            <label title="Map to Up-triangle clicks" style="margin-left:4px">↑</label>
            <input type="radio" name="mapUp" class="ov-map-up" ${isUp ? 'checked' : ''} title="Use this chord for Up triangles">
            <label title="Map to Down-triangle clicks">↓</label>
            <input type="radio" name="mapDown" class="ov-map-down" ${isDown ? 'checked' : ''} title="Use this chord for Down triangles">
            <label title="Auto-place at all matching triangles" style="margin-left:4px">Repeat</label>
            <input type="checkbox" class="ov-repeat" ${ov.repeatAll ? 'checked' : ''} title="Automatically place at all matching triangles">
            <label>Steps:</label>
            <input type="text" class="ov-steps" value="${ov.steps.join(',')}" style="width:120px" title="Comma-separated steps">
            <label>Color:</label>
            <input type="color" class="ov-color" value="${rgbStringToHex(ov.color)}">
            <label>Opacity:</label>
            <input type="number" class="ov-opacity" min="0" max="1" step="0.05" value="${ov.opacity}" style="width:70px">
            <span style="font-size: 12px">Anchors: <strong class="ov-anchors-count">${ov.anchors.length}</strong></span>
            <button class="ov-clear-anchors">Clear Anchors</button>
            <button class="ov-delete">Delete</button>
        `;
        overlayListContainer.appendChild(card);
    });
}
