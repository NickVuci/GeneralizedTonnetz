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

function hexToRgba(hex, alpha = 0.35) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return `rgba(0,170,0,${alpha})`;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
