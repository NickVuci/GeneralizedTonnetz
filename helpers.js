// Global helper utilities
function clamp(v, min, max, fallback) {
    const n = Number.isFinite(v) ? v : fallback;
    return Math.max(min, Math.min(max, n));
}

function sanitizeInt(val, fallback = 0) {
    const n = parseInt(val);
    return Number.isFinite(n) ? n : fallback;
}

function coerceEdoValue(value, fallback = 12) {
    return clamp(sanitizeInt(value, fallback), 1, 72, fallback);
}

function clampAxisDirectionValue(value, edo, fallback = 0) {
    const max = Math.max(0, coerceEdoValue(edo) - 1);
    return clamp(sanitizeInt(value, fallback), 0, max, fallback);
}

function normalizeAxisDirectionValue(value, edo) {
    const modulus = coerceEdoValue(edo);
    const n = sanitizeInt(value, 0);
    const remainder = n % modulus;
    return remainder < 0 ? remainder + modulus : remainder;
}

const DIRECTIONAL_AXIS_TUNING_PRESETS = {
    fiveLimitMajorMinor: {
        targets: {
            right: 3 / 2,
            upRight: 5 / 4
        },
        derivedAxis: 'downRight'
    }
};

function approximateRatioInEdo(ratio, edo) {
    const modulus = coerceEdoValue(edo);
    const numericRatio = Number(ratio);
    if (!Number.isFinite(numericRatio) || numericRatio <= 0) return 0;
    return normalizeAxisDirectionValue(Math.round(modulus * Math.log2(numericRatio)), modulus);
}

function getDirectionalAxesForTuning(edo, presetId = 'fiveLimitMajorMinor') {
    const modulus = coerceEdoValue(edo);
    const preset = DIRECTIONAL_AXIS_TUNING_PRESETS[presetId] || DIRECTIONAL_AXIS_TUNING_PRESETS.fiveLimitMajorMinor;
    const targets = preset.targets || {};
    const axes = {
        right: approximateRatioInEdo(targets.right, modulus),
        upRight: approximateRatioInEdo(targets.upRight, modulus),
        downRight: approximateRatioInEdo(targets.downRight, modulus)
    };
    return deriveDirectionalAxes(axes, modulus, preset.derivedAxis || 'downRight');
}

function deriveDirectionalAxes(values, edo, derivedAxis) {
    const modulus = coerceEdoValue(edo);
    const axes = {
        right: clampAxisDirectionValue(values?.right, modulus, 0),
        upRight: clampAxisDirectionValue(values?.upRight, modulus, 0),
        downRight: clampAxisDirectionValue(values?.downRight, modulus, 0)
    };

    if (derivedAxis === 'right') {
        axes.right = normalizeAxisDirectionValue(axes.upRight + axes.downRight, modulus);
    } else if (derivedAxis === 'upRight') {
        axes.upRight = normalizeAxisDirectionValue(axes.right - axes.downRight, modulus);
    } else if (derivedAxis === 'downRight') {
        axes.downRight = normalizeAxisDirectionValue(axes.right - axes.upRight, modulus);
    }

    return axes;
}

function directionalAxesToIntervals(values, edo) {
    const axes = deriveDirectionalAxes(values, edo, null);
    return {
        intervalX: axes.right,
        intervalZ: axes.downRight,
        axisUpRight: axes.upRight
    };
}

function hexToRgbString(hex, alpha) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return alpha == null ? `rgb(0 0 0)` : `rgb(0 0 0 / ${alpha})`;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return alpha == null ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

function rgbStringToHex(rgb) {
    const toHex = (n) => {
        const v = Math.max(0, Math.min(255, parseInt(n, 10)));
        return v.toString(16).padStart(2, '0').toUpperCase();
    };
    if (!rgb || typeof rgb !== 'string') return `#${toHex(0)}${toHex(0)}${toHex(0)}`;
    // Supports both rgb(r g b / a) and rgb(r, g, b)
    const m = rgb
        .replace(/\s*,\s*/g, ' ')
        .match(/rgb\s*\(\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s*\/\s*(\d*\.?\d+))?\s*\)/i);
    if (!m) return `#${toHex(0)}${toHex(0)}${toHex(0)}`;
    return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
}

function normalizeColorToRgb(color) {
    if (!color) return 'rgb(0 0 0)';
    if (color.startsWith('#')) return hexToRgbString(color);
    if (/^rgb\s*\(/i.test(color)) return color;
    // Basic named colors support (expand if needed)
    const named = {
        black: 'rgb(0 0 0)',
        white: 'rgb(255 255 255)',
        red: 'rgb(255 0 0)',
        green: 'rgb(0 128 0)',
        blue: 'rgb(0 0 255)'
    };
    return named[color.toLowerCase()] || color;
}

// Debounce helper: returns a function that delays invoking `fn` until after
// `wait` milliseconds have elapsed since the last time it was invoked.
function debounce(fn, wait = 150) {
    let timer = null;
    return function (...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            try { fn.apply(this, args); } catch (e) { console.error('Debounced function error', e); }
        }, wait);
    };
}
