// Global helper utilities
function clamp(v, min, max, fallback) {
    const n = Number.isFinite(v) ? v : fallback;
    return Math.max(min, Math.min(max, n));
}

function sanitizeInt(val, fallback = 0) {
    const n = parseInt(val);
    return Number.isFinite(n) ? n : fallback;
}

function parseChordSteps(text) {
    if (!text) return [0];
    try {
        return text
            .split(/[\,\s]+/)
            .filter(Boolean)
            .map(s => sanitizeInt(s.trim(), 0));
    } catch {
        return [0];
    }
}

function hexToRgbString(hex, alpha) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return alpha == null ? `rgb(0 170 0)` : `rgb(0 170 0 / ${alpha})`;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return alpha == null ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

// Back-compat alias: return rgb() with optional alpha using slash syntax
function hexToRgba(hex, alpha = 0.35) {
    return hexToRgbString(hex, alpha);
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
