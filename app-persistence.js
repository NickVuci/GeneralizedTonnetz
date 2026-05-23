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
        latticeModeSelect,
        edoInput,
        axisRightInput,
        axisUpRightInput,
        axisDownRightInput,
        jiAxisRightInput,
        jiAxisUpRightInput,
        jiAxisDownRightInput,
        jiLabelDisplaySelect,
        syncDirectionalAxes,
        getAxisEditOrder,
        setAxisEditOrder,
        syncJiDirectionalAxes,
        getJiAxisEditOrder,
        setJiAxisEditOrder,
        syncLatticeModeControls,
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
    const STATE_VERSION = 8;

    function isOldDefaultOverlayRoleState(state) {
        if (!state || state.version >= 3 || !Array.isArray(state.overlays) || state.overlays.length < 2) return false;

        const first = state.overlays[0];
        const second = state.overlays[1];
        const firstColor = normalizeColorToRgb(first?.color || '');
        const secondColor = normalizeColorToRgb(second?.color || '');

        return state.upOverlayIdx === 1
            && state.downOverlayIdx === 0
            && first?.autoSync === true
            && second?.autoSync === true
            && firstColor === 'rgb(255 0 0)'
            && secondColor === 'rgb(0 0 255)';
    }

    function hasPlacedAnchors(overlay) {
        return Array.isArray(overlay?.anchors) && overlay.anchors.length > 0;
    }

    function isUntouchedDefaultOverlayPair(state) {
        if (!state || state.version >= STATE_VERSION || !Array.isArray(state.overlays) || state.overlays.length < 2) return false;

        const first = state.overlays[0];
        const second = state.overlays[1];
        const firstColor = normalizeColorToRgb(first?.color || '');
        const secondColor = normalizeColorToRgb(second?.color || '');

        return first?.autoSync === true
            && second?.autoSync === true
            && firstColor === 'rgb(255 0 0)'
            && secondColor === 'rgb(0 0 255)'
            && !hasPlacedAnchors(first)
            && !hasPlacedAnchors(second)
            && !first?.repeatAll
            && !second?.repeatAll
            && !first?.nonTriangleMode
            && !second?.nonTriangleMode;
    }

    function shouldMigrateDefaultAxesToTuning(state) {
        if (!isUntouchedDefaultOverlayPair(state)) return false;

        const edo = coerceEdoValue(state.edo);
        const currentAxes = deriveDirectionalAxes({
            right: state.axisRight ?? state.intervalX,
            upRight: state.axisUpRight,
            downRight: state.axisDownRight ?? state.intervalZ
        }, edo, null);
        const tunedAxes = getDirectionalAxesForTuning(edo);

        return currentAxes.right !== tunedAxes.right
            || currentAxes.upRight !== tunedAxes.upRight
            || currentAxes.downRight !== tunedAxes.downRight;
    }

    function getLegacyOverlayForRole(state, role) {
        const savedOverlays = Array.isArray(state?.overlays) ? state.overlays : [];
        if (!savedOverlays.length) return null;
        if (isOldDefaultOverlayRoleState(state)) {
            return role === 'up' ? savedOverlays[0] : savedOverlays[1];
        }

        const mappedIndex = role === 'up' ? state?.upOverlayIdx : state?.downOverlayIdx;
        if (Number.isInteger(mappedIndex) && mappedIndex >= 0 && mappedIndex < savedOverlays.length) {
            return savedOverlays[mappedIndex];
        }
        return role === 'up' ? savedOverlays[0] : savedOverlays[1];
    }

    function migrateOverlayAnchors(state) {
        if (state?.overlayAnchors) {
            return {
                up: normalizeAnchorList(state.overlayAnchors.up),
                down: normalizeAnchorList(state.overlayAnchors.down)
            };
        }

        return {
            up: normalizeAnchorList(getLegacyOverlayForRole(state, 'up')?.anchors),
            down: normalizeAnchorList(getLegacyOverlayForRole(state, 'down')?.anchors)
        };
    }

    function migrateOverlayColors(state) {
        if (state?.overlayColors) {
            return {
                up: normalizeColorToRgb(state.overlayColors.up || 'rgb(255 0 0)'),
                down: normalizeColorToRgb(state.overlayColors.down || 'rgb(0 0 255)')
            };
        }

        if (Array.isArray(state?.overlays) && state.overlays.length >= 2) {
            return {
                up: normalizeColorToRgb(getLegacyOverlayForRole(state, 'up')?.color || 'rgb(255 0 0)'),
                down: normalizeColorToRgb(getLegacyOverlayForRole(state, 'down')?.color || 'rgb(0 0 255)')
            };
        }

        return {
            up: 'rgb(255 0 0)',
            down: 'rgb(0 0 255)'
        };
    }

    function migrateOverlayRepeatAll(state) {
        if (state?.overlayRepeatAll) {
            return {
                up: !!state.overlayRepeatAll.up,
                down: !!state.overlayRepeatAll.down
            };
        }

        return {
            up: false,
            down: false
        };
    }

    function serializeState() {
        const edo = coerceEdoValue(edoInput.value);
        const axes = deriveDirectionalAxes({
            right: axisRightInput?.value,
            upRight: axisUpRightInput?.value,
            downRight: axisDownRightInput?.value
        }, edo, null);
        return {
            version: STATE_VERSION,
            latticeMode: latticeModeSelect?.value === 'ji' ? 'ji' : 'edo',
            edo,
            axisRight: axes.right,
            axisUpRight: axes.upRight,
            axisDownRight: axes.downRight,
            axisEditOrder: typeof getAxisEditOrder === 'function' ? getAxisEditOrder() : ['right', 'upRight'],
            jiAxisRight: jiAxisRightInput?.value || DEFAULT_JI_AXES.right,
            jiAxisUpRight: jiAxisUpRightInput?.value || DEFAULT_JI_AXES.upRight,
            jiAxisDownRight: jiAxisDownRightInput?.value || DEFAULT_JI_AXES.downRight,
            jiAxisEditOrder: typeof getJiAxisEditOrder === 'function' ? getJiAxisEditOrder() : ['right', 'upRight'],
            jiLabelDisplay: normalizeJiLabelDisplay(jiLabelDisplaySelect?.value),
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
            overlayAnchors: getOverlayAnchorsSnapshot(),
            overlayColors: getOverlayColorsSnapshot(),
            overlayRepeatAll: getOverlayRepeatAllSnapshot(),
            sidebarCollapsed: overlaySidebar?.classList.contains('desktop-collapsed') || false,
            controlsCollapsed: controlsContent?.classList.contains('desktop-collapsed') || false
        };
    }

    function deserializeState(state) {
        if (!state || (state.version !== STATE_VERSION && state.version !== 7 && state.version !== 6 && state.version !== 5 && state.version !== 4 && state.version !== 3 && state.version !== 2 && state.version !== 1)) return false;

        try {
            const shouldMigrateDefaultAxes = shouldMigrateDefaultAxesToTuning(state);

            edoInput.value = state.edo;
            if (shouldMigrateDefaultAxes) {
                const tunedAxes = getDirectionalAxesForTuning(state.edo);
                if (typeof setAxisEditOrder === 'function') setAxisEditOrder(['right', 'upRight']);
                if (axisRightInput) axisRightInput.value = tunedAxes.right;
                if (axisUpRightInput) axisUpRightInput.value = tunedAxes.upRight;
                if (axisDownRightInput) axisDownRightInput.value = tunedAxes.downRight;
            } else if (state.version === 1) {
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
            if (latticeModeSelect) latticeModeSelect.value = state.latticeMode === 'ji' ? 'ji' : 'edo';
            if (typeof setJiAxisEditOrder === 'function') setJiAxisEditOrder(state.jiAxisEditOrder || ['right', 'upRight']);
            if (jiAxisRightInput) jiAxisRightInput.value = state.jiAxisRight || DEFAULT_JI_AXES.right;
            if (jiAxisUpRightInput) jiAxisUpRightInput.value = state.jiAxisUpRight || DEFAULT_JI_AXES.upRight;
            if (jiAxisDownRightInput) jiAxisDownRightInput.value = state.jiAxisDownRight || DEFAULT_JI_AXES.downRight;
            if (jiLabelDisplaySelect) jiLabelDisplaySelect.value = normalizeJiLabelDisplay(state.jiLabelDisplay);
            if (typeof syncJiDirectionalAxes === 'function') syncJiDirectionalAxes();
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

            setOverlayAnchors(migrateOverlayAnchors(state));
            setOverlayColors(migrateOverlayColors(state));
            setOverlayRepeatAll(migrateOverlayRepeatAll(state));

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
            if (typeof syncLatticeModeControls === 'function') syncLatticeModeControls();
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
                if (latticeModeSelect) latticeModeSelect.value = 'edo';
                if (jiAxisRightInput) jiAxisRightInput.value = DEFAULT_JI_AXES.right;
                if (jiAxisUpRightInput) jiAxisUpRightInput.value = DEFAULT_JI_AXES.upRight;
                if (jiAxisDownRightInput) jiAxisDownRightInput.value = DEFAULT_JI_AXES.downRight;
                if (jiLabelDisplaySelect) jiLabelDisplaySelect.value = DEFAULT_JI_LABEL_DISPLAY;
                if (typeof setJiAxisEditOrder === 'function') setJiAxisEditOrder(['right', 'upRight']);
                if (typeof syncJiDirectionalAxes === 'function') syncJiDirectionalAxes();
            } catch (e) {
                console.error('Error seeding color inputs', e);
            }
            setOverlayAnchors({ up: [], down: [] });
            setOverlayColors({ up: 'rgb(255 0 0)', down: 'rgb(0 0 255)' });
            setOverlayRepeatAll({ up: false, down: false });
            renderOverlayListPanel();
            if (typeof syncLatticeModeControls === 'function') syncLatticeModeControls();
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
