// Fixed Up/Down overlay state and panel management.
const OVERLAY_ROLE_ORDER = ['up', 'down'];
const OVERLAY_ROLE_CONFIG = {
    up: {
        label: 'Up',
        arrow: '↑',
        color: 'rgb(255 0 0)',
        opacity: 0.35
    },
    down: {
        label: 'Down',
        arrow: '↓',
        color: 'rgb(0 0 255)',
        opacity: 0.35
    }
};

let overlayAnchors = {
    up: [],
    down: []
};

const overlayListContainer = document.getElementById('overlayList');

function normalizeOverlayRole(role) {
    return OVERLAY_ROLE_ORDER.includes(role) ? role : null;
}

function normalizeAnchorList(anchors) {
    if (!Array.isArray(anchors)) return [];
    const normalized = [];
    for (const anchor of anchors) {
        const q = sanitizeInt(anchor?.q, NaN);
        const r = sanitizeInt(anchor?.r, NaN);
        if (!Number.isFinite(q) || !Number.isFinite(r)) continue;
        normalized.push({ q, r });
    }
    return normalized;
}

function getOverlayAnchors(role) {
    const normalizedRole = normalizeOverlayRole(role);
    return normalizedRole ? overlayAnchors[normalizedRole] : [];
}

function getOverlayAnchorsSnapshot() {
    return {
        up: normalizeAnchorList(overlayAnchors.up),
        down: normalizeAnchorList(overlayAnchors.down)
    };
}

function setOverlayAnchors(nextAnchors) {
    overlayAnchors = {
        up: normalizeAnchorList(nextAnchors?.up),
        down: normalizeAnchorList(nextAnchors?.down)
    };
}

function getOverlayStepsForRole(role, intervalX, intervalZ, edo) {
    const modulus = coerceEdoValue(edo);
    const ix = normalizeAxisDirectionValue(intervalX, modulus);
    const iz = normalizeAxisDirectionValue(intervalZ, modulus);
    const upRight = normalizeAxisDirectionValue(ix - iz, modulus);
    return role === 'down'
        ? [0, iz, ix]
        : [0, upRight, ix];
}

function getFixedOverlayDescriptors(intervalX, intervalZ, edo) {
    return OVERLAY_ROLE_ORDER.map(function (role) {
        const config = OVERLAY_ROLE_CONFIG[role];
        return {
            role,
            label: config.label,
            arrow: config.arrow,
            color: config.color,
            opacity: config.opacity,
            steps: getOverlayStepsForRole(role, intervalX, intervalZ, edo),
            anchors: getOverlayAnchors(role)
        };
    });
}

function clearOverlayAnchors(role) {
    const normalizedRole = normalizeOverlayRole(role);
    if (!normalizedRole) return;
    overlayAnchors[normalizedRole] = [];
    updateOverlayAnchorsCount(normalizedRole, 0);
}

function toggleOverlayAnchor(role, q, r) {
    const anchors = getOverlayAnchors(role);
    const existingIndex = anchors.findIndex(function (anchor) {
        return anchor.q === q && anchor.r === r;
    });
    if (existingIndex >= 0) anchors.splice(existingIndex, 1);
    else anchors.push({ q, r });
    updateOverlayAnchorsCount(role, anchors.length);
    return anchors.length;
}

function updateOverlayAnchorsCount(role, count) {
    const normalizedRole = normalizeOverlayRole(role);
    if (!normalizedRole) return;
    const el = overlayListContainer?.querySelector(`.overlay-card[data-role="${normalizedRole}"] .ov-anchors-count`);
    if (el) el.textContent = String(count);
}

function onOverlayPanelEvent(e) {
    const target = e.target;
    if (!target.classList.contains('ov-clear-anchors')) return;
    e.preventDefault();
    clearOverlayAnchors(target.getAttribute('data-role'));
    renderOverlayListPanel();
}

function renderOverlayListPanel() {
    if (!overlayListContainer) return;
    overlayListContainer.innerHTML = '';
    for (const role of OVERLAY_ROLE_ORDER) {
        const config = OVERLAY_ROLE_CONFIG[role];
        const card = document.createElement('div');
        card.className = 'overlay-card fixed-overlay-card';
        card.setAttribute('data-role', role);

        const titleRow = document.createElement('div');
        titleRow.className = 'ov-row ov-header';

        const arrow = document.createElement('span');
        arrow.className = `ov-role-arrow ov-role-arrow-${role}`;
        arrow.textContent = config.arrow;

        const title = document.createElement('span');
        title.className = 'ov-title';
        title.textContent = config.label;

        const anchorsSpan = document.createElement('span');
        anchorsSpan.className = 'ov-anchors';
        anchorsSpan.textContent = 'Anchors: ';
        const anchorsStrong = document.createElement('strong');
        anchorsStrong.className = 'ov-anchors-count';
        anchorsStrong.textContent = String(getOverlayAnchors(role).length);
        anchorsSpan.appendChild(anchorsStrong);

        const btnClear = document.createElement('button');
        btnClear.className = 'ov-clear-anchors ov-action';
        btnClear.setAttribute('data-role', role);
        btnClear.textContent = 'Clear';

        titleRow.appendChild(arrow);
        titleRow.appendChild(title);
        titleRow.appendChild(anchorsSpan);
        titleRow.appendChild(btnClear);

        card.appendChild(titleRow);
        overlayListContainer.appendChild(card);
    }
}
