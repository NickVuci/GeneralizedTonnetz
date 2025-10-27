// Overlay state and panel management
let overlays = [];
let overlayIdCounter = 1;
let activeOverlayId = null;

const overlayListContainer = document.getElementById('overlayList');

function addOverlay(preset) {
    const palette = ['#00AA00', '#AA00AA', '#00AAAA', '#AA5500', '#0055AA', '#AA0055', '#557700'];
    const color = preset?.color || palette[(overlayIdCounter - 1) % palette.length];

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

    const ov = {
        id: overlayIdCounter++,
        visible: true,
        steps: preset?.steps || stepsDefault,
        color,
        opacity: Number.isFinite(preset?.opacity) ? preset.opacity : 0.35,
        anchors: preset?.anchors || []
    };
    overlays.push(ov);
    activeOverlayId = ov.id;
}

function removeOverlay(id) {
    const idx = overlays.findIndex(o => o.id === id);
    if (idx >= 0) overlays.splice(idx, 1);
    if (activeOverlayId === id) activeOverlayId = overlays[0]?.id ?? null;
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
    } else if (target.classList.contains('ov-color')) {
        ov.color = target.value;
    } else if (target.classList.contains('ov-opacity')) {
        ov.opacity = clamp(parseFloat(target.value), 0, 1, 0.35);
    } else if (target.classList.contains('ov-clear-anchors')) {
        e.preventDefault();
        clearOverlayAnchors(id);
    } else if (target.classList.contains('ov-delete')) {
        e.preventDefault();
        removeOverlay(id);
        renderOverlayListPanel();
    }
}

function renderOverlayListPanel() {
    if (!overlayListContainer) return;
    overlayListContainer.innerHTML = '';
    for (const ov of overlays) {
        const card = document.createElement('div');
        card.className = 'overlay-card';
        card.setAttribute('data-id', String(ov.id));
        card.style.display = 'flex';
        card.style.flexWrap = 'wrap';
        card.style.alignItems = 'center';
        card.style.gap = '6px';

        card.innerHTML = `
            <input type="checkbox" class="ov-visible" ${ov.visible ? 'checked' : ''} title="Toggle visibility">
            <input type="radio" name="activeOverlay" class="ov-active" ${activeOverlayId === ov.id ? 'checked' : ''} title="Make active for clicks">
            <span>Overlay ${ov.id}</span>
            <label>Steps:</label>
            <input type="text" class="ov-steps" value="${ov.steps.join(',')}" style="width:120px" title="Comma-separated steps">
            <label>Color:</label>
            <input type="color" class="ov-color" value="${ov.color}">
            <label>Opacity:</label>
            <input type="number" class="ov-opacity" min="0" max="1" step="0.05" value="${ov.opacity}" style="width:70px">
            <span style="font-size: 12px">Anchors: <strong class="ov-anchors-count">${ov.anchors.length}</strong></span>
            <button class="ov-clear-anchors">Clear Anchors</button>
            <button class="ov-delete">Delete</button>
        `;
        overlayListContainer.appendChild(card);
    }
}
