function createTonnetzPersistenceController(options) {
    const {
        canvas,
        controlsBackdrop,
        controlsContent,
        overlaySidebar,
        canvasSizeSelect,
        orientationSelect,
        canvasWidthInput,
        canvasHeightInput,
        triangleSizeInput,
        colorXInput,
        colorYInput,
        colorZInput,
        backgroundColorInput,
        labelColorInput,
        highlightZeroInput,
        highlightZeroColorInput,
        scaleDegreesInput,
        scaleSizeInput,
        scaleDotsInput,
        scaleDotColorInput,
        scaleDotSizeInput,
        edoInput,
        axisRightInput,
        axisUpRightInput,
        axisDownRightInput,
        syncDirectionalAxes,
        getAxisEditOrder,
        setAxisEditOrder,
        copyLinkBtn,
        resetBtn,
        DEFAULT_COLORS,
        handleCanvasSizeChange,
        getDrawTonnetz,
        getLastOffscreenCanvas,
        setControlsDesktopCollapsedState,
        setSidebarDesktopCollapsedState
    } = options;

    const STATE_KEY = 'tonnetz-state';
    const STATE_VERSION = 2;

    function serializeState() {
        const edo = coerceEdoValue(edoInput.value);
        const axes = deriveDirectionalAxes({
            right: axisRightInput?.value,
            upRight: axisUpRightInput?.value,
            downRight: axisDownRightInput?.value
        }, edo, null);
        return {
            version: STATE_VERSION,
            edo,
            axisRight: axes.right,
            axisUpRight: axes.upRight,
            axisDownRight: axes.downRight,
            axisEditOrder: typeof getAxisEditOrder === 'function' ? getAxisEditOrder() : ['right', 'downRight'],
            intervalX: axes.right,
            intervalZ: axes.downRight,
            canvasSize: canvasSizeSelect.value,
            orientation: orientationSelect.value,
            canvasWidth: parseInt(canvasWidthInput.value, 10) || 1000,
            canvasHeight: parseInt(canvasHeightInput.value, 10) || 1000,
            triangleSize: parseInt(triangleSizeInput.value, 10) || 75,
            colorX: colorXInput.value,
            colorY: colorYInput.value,
            colorZ: colorZInput.value,
            backgroundColor: backgroundColorInput.value,
            labelColor: labelColorInput.value,
            highlightZero: highlightZeroInput.checked,
            highlightZeroColor: highlightZeroColorInput.value,
            scaleDegrees: scaleDegreesInput?.value || '',
            scaleSize: scaleSizeInput?.value || '1.5',
            scaleDots: !!scaleDotsInput?.checked,
            scaleDotColor: scaleDotColorInput?.value || '#000000',
            scaleDotSize: scaleDotSizeInput?.value || '6',
            overlays: overlays.map(function (overlay) {
                return {
                    steps: overlay.steps,
                    color: overlay.color,
                    opacity: overlay.opacity,
                    anchors: overlay.anchors,
                    repeatAll: overlay.repeatAll,
                    nonTriangleMode: overlay.nonTriangleMode,
                    visible: overlay.visible,
                    autoSync: overlay.autoSync
                };
            }),
            activeOverlayIdx: overlays.findIndex(function (overlay) {
                return overlay.id === activeOverlayId;
            }),
            upOverlayIdx: overlays.findIndex(function (overlay) {
                return overlay.id === upOverlayId;
            }),
            downOverlayIdx: overlays.findIndex(function (overlay) {
                return overlay.id === downOverlayId;
            }),
            sidebarCollapsed: overlaySidebar?.classList.contains('desktop-collapsed') || false,
            controlsCollapsed: controlsContent?.classList.contains('desktop-collapsed') || false
        };
    }

    function deserializeState(state) {
        if (!state || (state.version !== STATE_VERSION && state.version !== 1)) return false;

        try {
            edoInput.value = state.edo;
            if (state.version === 1) {
                const edo = coerceEdoValue(state.edo);
                const legacyRight = clampAxisDirectionValue(state.intervalX, edo, 7);
                const legacyDownRight = clampAxisDirectionValue(state.intervalZ, edo, 4);
                if (axisRightInput) axisRightInput.value = legacyRight;
                if (axisDownRightInput) axisDownRightInput.value = legacyDownRight;
                if (axisUpRightInput) axisUpRightInput.value = normalizeAxisDirectionValue(legacyRight - legacyDownRight, edo);
                if (typeof setAxisEditOrder === 'function') setAxisEditOrder(['right', 'downRight']);
            } else {
                if (typeof setAxisEditOrder === 'function') setAxisEditOrder(state.axisEditOrder);
                if (axisRightInput) axisRightInput.value = state.axisRight;
                if (axisUpRightInput) axisUpRightInput.value = state.axisUpRight;
                if (axisDownRightInput) axisDownRightInput.value = state.axisDownRight;
            }
            if (typeof syncDirectionalAxes === 'function') syncDirectionalAxes();
            canvasSizeSelect.value = state.canvasSize;
            orientationSelect.value = state.orientation;
            canvasWidthInput.value = state.canvasWidth;
            canvasHeightInput.value = state.canvasHeight;
            triangleSizeInput.value = state.triangleSize;
            colorXInput.value = state.colorX;
            colorYInput.value = state.colorY;
            colorZInput.value = state.colorZ;
            backgroundColorInput.value = state.backgroundColor;
            labelColorInput.value = state.labelColor;
            highlightZeroInput.checked = !!state.highlightZero;
            highlightZeroColorInput.value = state.highlightZeroColor;
            if (scaleDegreesInput) scaleDegreesInput.value = state.scaleDegrees || '';
            if (scaleSizeInput) scaleSizeInput.value = state.scaleSize || '1.5';
            if (scaleDotsInput) scaleDotsInput.checked = !!state.scaleDots;
            if (scaleDotColorInput) scaleDotColorInput.value = state.scaleDotColor || '#000000';
            if (scaleDotSizeInput) scaleDotSizeInput.value = state.scaleDotSize || '6';

            overlays.length = 0;
            overlayIdCounter = 1;
            activeOverlayId = null;
            upOverlayId = null;
            downOverlayId = null;
            if (Array.isArray(state.overlays) && state.overlays.length > 0) {
                for (const savedOverlay of state.overlays) {
                    overlays.push({
                        id: overlayIdCounter++,
                        visible: savedOverlay.visible !== false,
                        steps: savedOverlay.steps || [0, 4, 7],
                        color: savedOverlay.color || 'rgb(255 0 0)',
                        opacity: Number.isFinite(savedOverlay.opacity) ? savedOverlay.opacity : 0.35,
                        anchors: Array.isArray(savedOverlay.anchors) ? savedOverlay.anchors : [],
                        repeatAll: !!savedOverlay.repeatAll,
                        nonTriangleMode: !!savedOverlay.nonTriangleMode,
                        autoSync: !!savedOverlay.autoSync
                    });
                }

                if (state.activeOverlayIdx >= 0 && state.activeOverlayIdx < overlays.length) {
                    activeOverlayId = overlays[state.activeOverlayIdx].id;
                } else {
                    activeOverlayId = overlays[0].id;
                }
                if (state.upOverlayIdx >= 0 && state.upOverlayIdx < overlays.length) {
                    upOverlayId = overlays[state.upOverlayIdx].id;
                }
                if (state.downOverlayIdx >= 0 && state.downOverlayIdx < overlays.length) {
                    downOverlayId = overlays[state.downOverlayIdx].id;
                }
            }

            if (window.innerWidth <= 768) {
                setControlsDesktopCollapsedState(true);
                controlsBackdrop?.classList.remove('visible');
                overlaySidebar?.classList.remove('mobile-open');
            } else {
                if (state.controlsCollapsed) {
                    setControlsDesktopCollapsedState(true);
                    controlsBackdrop?.classList.remove('visible');
                } else {
                    setControlsDesktopCollapsedState(false);
                }
                setSidebarDesktopCollapsedState(!!state.sidebarCollapsed);
            }

            handleCanvasSizeChange();
            renderOverlayListPanel();
            getDrawTonnetz()?.();
            return true;
        } catch (e) {
            console.error('Error deserializing state', e);
            return false;
        }
    }

    function saveStateToStorage() {
        try {
            localStorage.setItem(STATE_KEY, JSON.stringify(serializeState()));
        } catch (e) {
        }
    }

    function stateToHash(state) {
        return `#${btoa(JSON.stringify(state))}`;
    }

    function buildShareUrl(hash) {
        const shareUrl = new URL(location.href);
        shareUrl.hash = hash;
        return shareUrl.toString();
    }

    function updateShareHash(hash) {
        try {
            history.replaceState(null, '', hash);
        } catch (e) {
        }
    }

    function hashToState(hash) {
        try {
            if (!hash || hash.length < 2) return null;
            return JSON.parse(atob(hash.slice(1)));
        } catch (e) {
            return null;
        }
    }

    function saveAsImage() {
        const exportCanvas = getLastOffscreenCanvas() || canvas;
        const image = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = image;
        link.download = 'tonnetz.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function saveAsPdf() {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert('PDF export requires jsPDF. Please check your internet connection and try again.');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const exportCanvas = getLastOffscreenCanvas() || canvas;
            const width = exportCanvas.width;
            const height = exportCanvas.height;
            const pdf = new jsPDF({
                orientation: width > height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [width, height]
            });
            const imgData = exportCanvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', 0, 0, width, height);
            pdf.save('tonnetz.pdf');
        } catch (e) {
            console.error('PDF export failed', e);
            alert(`PDF export failed: ${e.message}`);
        }
    }

    function showCopyLinkSuccess() {
        if (!copyLinkBtn) return;
        copyLinkBtn.classList.add('copied');
        setTimeout(function () {
            copyLinkBtn.classList.remove('copied');
        }, 1500);
    }

    function copyUrlToClipboard(url) {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            return navigator.clipboard.writeText(url);
        }
        return Promise.reject(new Error('Clipboard API unavailable'));
    }

    function promptManualCopy(url) {
        try {
            window.prompt('Copy this link:', url);
        } catch (e) {
            alert(`Copy this link: ${url}`);
        }
    }

    function wirePersistenceControls() {
        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', function () {
                const state = serializeState();
                const hash = stateToHash(state);
                const url = buildShareUrl(hash);
                updateShareHash(hash);
                copyUrlToClipboard(url).then(function () {
                    showCopyLinkSuccess();
                }).catch(function () {
                    promptManualCopy(url);
                });
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', function () {
                localStorage.removeItem(STATE_KEY);
                history.replaceState(null, '', location.pathname);
                location.reload();
            });
        }
    }

    function initializePersistence() {
        let stateRestored = false;

        wirePersistenceControls();

        try {
            const hashState = hashToState(location.hash);
            if (hashState) stateRestored = deserializeState(hashState);
        } catch (e) {
            console.error('Error restoring state from URL hash', e);
        }

        if (!stateRestored) {
            try {
                const stored = localStorage.getItem(STATE_KEY);
                if (stored) stateRestored = deserializeState(JSON.parse(stored));
            } catch (e) {
                console.error('Error restoring state from localStorage', e);
            }
        }

        if (!stateRestored) {
            handleCanvasSizeChange();
            try {
                colorXInput.value = rgbStringToHex(DEFAULT_COLORS.x);
                colorYInput.value = rgbStringToHex(DEFAULT_COLORS.y);
                colorZInput.value = rgbStringToHex(DEFAULT_COLORS.z);
                backgroundColorInput.value = rgbStringToHex(DEFAULT_COLORS.bg);
                labelColorInput.value = rgbStringToHex(DEFAULT_COLORS.label);
                highlightZeroColorInput.value = rgbStringToHex(DEFAULT_COLORS.highlightZero);
                if (scaleDotColorInput) scaleDotColorInput.value = '#000000';
                if (scaleDotSizeInput) scaleDotSizeInput.value = '6';
            } catch (e) {
                console.error('Error seeding color inputs', e);
            }
            try {
                if (!overlays || overlays.length === 0) {
                    addOverlay({ color: 'rgb(255 0 0)' });
                    addOverlay({ color: 'rgb(0 0 255)' });
                }
            } catch (e) {
                console.error('Error ensuring default overlays', e);
            }
            renderOverlayListPanel();
            getDrawTonnetz()?.();
        }
    }

    return {
        saveStateToStorage,
        saveAsImage,
        saveAsPdf,
        initializePersistence
    };
}
