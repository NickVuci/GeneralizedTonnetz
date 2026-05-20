// Fixed Up/Down overlay state and panel management.
const OVERLAY_ROLE_ORDER = ['up', 'down'];
const DEFAULT_OVERLAY_ROLE_CONFIG = {
    up: {
        label: 'Up',
        direction: 'up',
        color: 'rgb(255 0 0)',
        opacity: 0.35,
        repeatAll: false
    },
    down: {
        label: 'Down',
        direction: 'down',
        color: 'rgb(0 0 255)',
        opacity: 0.35,
        repeatAll: false
    }
};

let overlayRoleConfig = createDefaultOverlayRoleConfig();

let overlayAnchors = {
    up: [],
    down: []
};

const overlayListContainer = document.getElementById('overlayList');
const overlayTriangleSizeInput = document.getElementById('triangleSize');

function createDefaultOverlayRoleConfig() {
    return OVERLAY_ROLE_ORDER.reduce(function (config, role) {
        config[role] = { ...DEFAULT_OVERLAY_ROLE_CONFIG[role] };
        return config;
    }, {});
}

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

function getOverlayConfig(role) {
    const normalizedRole = normalizeOverlayRole(role);
    return normalizedRole ? overlayRoleConfig[normalizedRole] : null;
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

function getOverlayColorsSnapshot() {
    return OVERLAY_ROLE_ORDER.reduce(function (colors, role) {
        colors[role] = getOverlayConfig(role)?.color || DEFAULT_OVERLAY_ROLE_CONFIG[role].color;
        return colors;
    }, {});
}

function getOverlayRepeatAllSnapshot() {
    return OVERLAY_ROLE_ORDER.reduce(function (repeatAllState, role) {
        repeatAllState[role] = !!getOverlayConfig(role)?.repeatAll;
        return repeatAllState;
    }, {});
}

function setOverlayColors(nextColors) {
    for (const role of OVERLAY_ROLE_ORDER) {
        overlayRoleConfig[role].color = nextColors && Object.prototype.hasOwnProperty.call(nextColors, role)
            ? normalizeColorToRgb(nextColors[role])
            : DEFAULT_OVERLAY_ROLE_CONFIG[role].color;
    }
}

function setOverlayRepeatAll(nextRepeatAll) {
    for (const role of OVERLAY_ROLE_ORDER) {
        overlayRoleConfig[role].repeatAll = !!nextRepeatAll?.[role];
    }
}

function setOverlayColor(role, color) {
    const normalizedRole = normalizeOverlayRole(role);
    if (!normalizedRole) return false;
    overlayRoleConfig[normalizedRole].color = normalizeColorToRgb(color);
    return true;
}

function toggleOverlayRepeatAll(role) {
    const normalizedRole = normalizeOverlayRole(role);
    if (!normalizedRole) return false;
    overlayRoleConfig[normalizedRole].repeatAll = !overlayRoleConfig[normalizedRole].repeatAll;
    return overlayRoleConfig[normalizedRole].repeatAll;
}

function setOverlayRepeatAllForRole(role, repeatAll) {
    const normalizedRole = normalizeOverlayRole(role);
    if (!normalizedRole) return false;
    overlayRoleConfig[normalizedRole].repeatAll = !!repeatAll;
    return overlayRoleConfig[normalizedRole].repeatAll;
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
        const config = getOverlayConfig(role);
        return {
            role,
            label: config.label,
            direction: config.direction,
            color: config.color,
            opacity: config.opacity,
            repeatAll: !!config.repeatAll,
            steps: getOverlayStepsForRole(role, intervalX, intervalZ, edo),
            anchors: getOverlayAnchors(role)
        };
    });
}

function getOverlayIconStrokeWidth() {
    const size = parseInt(overlayTriangleSizeInput?.value, 10) || 40;
    return Math.max(1, size / 14);
}

function buildOverlayRoleIcon(config) {
    const icon = document.createElement('label');
    icon.className = `ov-role-icon ov-role-icon-${config.direction} ov-color-trigger`;
    icon.style.setProperty('--ov-role-color', config.color);
    icon.style.setProperty('--ov-role-stroke-width', String(getOverlayIconStrokeWidth()));
    icon.setAttribute('data-role', config.role);
    icon.title = `${config.label} overlay color`;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');

    const triangle = document.createElementNS(svgNS, 'polygon');
    triangle.setAttribute(
        'points',
        config.direction === 'down'
            ? '4,5 20,5 12,19'
            : '12,5 20,19 4,19'
    );

    svg.appendChild(triangle);
    icon.appendChild(svg);

    const colorInput = document.createElement('input');
    colorInput.className = 'ov-color-input';
    colorInput.type = 'color';
    colorInput.value = rgbStringToHex(config.color);
    colorInput.setAttribute('data-role', config.role);
    colorInput.setAttribute('aria-label', `${config.label} overlay color`);
    icon.appendChild(colorInput);

    return icon;
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

function updateOverlayRepeatAllControl(role, repeatAll) {
    const normalizedRole = normalizeOverlayRole(role);
    if (!normalizedRole) return;
    const input = overlayListContainer?.querySelector(`.overlay-card[data-role="${normalizedRole}"] .ov-repeat-all-toggle`);
    if (input) input.checked = !!repeatAll;
    const label = input?.closest('.ov-toggle-label');
    if (label) label.classList.toggle('is-active', !!repeatAll);
}

function syncOverlayIconColorInput(input) {
    if (!input) return;
    const trigger = input.closest?.('.ov-color-trigger');
    if (!trigger) return;
    trigger.style.setProperty('--ov-role-color', normalizeColorToRgb(input.value));
}

function onOverlayPanelEvent(e) {
    const target = e.target;
    const clearButton = target.closest?.('.ov-clear-anchors');
    if (clearButton) {
        e.preventDefault();
        clearOverlayAnchors(clearButton.getAttribute('data-role'));
        return true;
    }

    if (target.classList?.contains('ov-color-input') && (e.type === 'input' || e.type === 'change')) {
        if (!setOverlayColor(target.getAttribute('data-role'), target.value)) return false;
        syncOverlayIconColorInput(target);
        return true;
    }

    if (target.classList?.contains('ov-repeat-all-toggle') && e.type === 'change') {
        const repeatAll = setOverlayRepeatAllForRole(target.getAttribute('data-role'), target.checked);
        updateOverlayRepeatAllControl(target.getAttribute('data-role'), repeatAll);
        return true;
    }

    return false;
}

function renderOverlayListPanel() {
    if (!overlayListContainer) return;
    overlayListContainer.innerHTML = '';
    for (const role of OVERLAY_ROLE_ORDER) {
        const config = {
            role,
            ...getOverlayConfig(role)
        };
        const card = document.createElement('div');
        card.className = 'overlay-card fixed-overlay-card';
        card.setAttribute('data-role', role);

        const titleRow = document.createElement('div');
        titleRow.className = 'ov-row ov-header';

        const icon = buildOverlayRoleIcon(config);

        const repeatLabel = document.createElement('label');
        repeatLabel.className = `ov-toggle-label ov-action${config.repeatAll ? ' is-active' : ''}`;

        const repeatInput = document.createElement('input');
        repeatInput.className = 'ov-repeat-all-toggle';
        repeatInput.type = 'checkbox';
        repeatInput.checked = !!config.repeatAll;
        repeatInput.setAttribute('data-role', role);
        repeatInput.setAttribute('aria-label', `${config.label} overlay repeat`);

        const repeatText = document.createElement('span');
        repeatText.className = 'ov-toggle-text';
        repeatText.textContent = 'Repeat';
        repeatText.title = 'Show this overlay on every matching chord on the lattice.';

        repeatLabel.appendChild(repeatInput);
        repeatLabel.appendChild(repeatText);

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

        titleRow.appendChild(icon);
        titleRow.appendChild(anchorsSpan);
        titleRow.appendChild(repeatLabel);
        titleRow.appendChild(btnClear);

        card.appendChild(titleRow);
        overlayListContainer.appendChild(card);
    }
}
