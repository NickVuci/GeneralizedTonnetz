document.addEventListener('DOMContentLoaded', function () {
    const canvas = document.getElementById('tonnetzCanvas');
    const ctx = canvas.getContext('2d');

    const canvasSizeSelect = document.getElementById('canvasSize');
    const orientationSelect = document.getElementById('orientation');
    const customSizeGroup = document.getElementById('customSizeGroup');
    const canvasWidthInput = document.getElementById('canvasWidth');
    const canvasHeightInput = document.getElementById('canvasHeight');
    const colorXInput = document.getElementById('colorX');
    const colorYInput = document.getElementById('colorY');
    const colorZInput = document.getElementById('colorZ');
    const backgroundColorInput = document.getElementById('backgroundColor');
    const labelColorInput = document.getElementById('labelColor');
    const highlightZeroColorInput = document.getElementById('highlightZeroColor');
    const highlightZeroInput = document.getElementById('highlightZero');
    const triangleSizeInput = document.getElementById('triangleSize');
    const edoInput = document.getElementById('edo');
    const axisRightInput = document.getElementById('axisRight');
    const axisUpRightInput = document.getElementById('axisUpRight');
    const axisDownRightInput = document.getElementById('axisDownRight');
    const scaleDegreesInput = document.getElementById('scaleDegrees');
    const scaleSizeInput = document.getElementById('scaleSize');
    const scaleDotsInput = document.getElementById('scaleDots');
    const scaleDotColorInput = document.getElementById('scaleDotColor');
    const scaleDotSizeInput = document.getElementById('scaleDotSize');
    const overlayListContainer = document.getElementById('overlayList');
    const saveImageButton = document.getElementById('saveImageButton');
    const savePdfButton = document.getElementById('savePdfButton');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const resetBtn = document.getElementById('resetBtn');
    const themeToggleBtn = document.getElementById('themeToggle');
    const toggleControlsBtn = document.getElementById('toggleControls');
    const controlsContainer = document.getElementById('controls');
    const controlsContent = document.getElementById('controlsContent');
    const scaleContent = document.getElementById('scaleContent');
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    const overlaySidebar = document.getElementById('overlaySidebar');
    const actionBtns = document.getElementById('actionBtns');
    const controlsBackdrop = document.getElementById('controlsBackdrop');

    let debouncedDraw = null;
    const THEME_STORAGE_KEY = 'tonnetz-theme';
    const AXIS_KEYS = ['right', 'upRight', 'downRight'];
    let axisEditOrder = ['right', 'upRight'];

    function getAxisInput(axisKey) {
        if (axisKey === 'right') return axisRightInput;
        if (axisKey === 'upRight') return axisUpRightInput;
        if (axisKey === 'downRight') return axisDownRightInput;
        return null;
    }

    function setAxisEditOrder(nextOrder) {
        if (!Array.isArray(nextOrder)) return;
        const filtered = nextOrder.filter(function (axisKey, index) {
            return AXIS_KEYS.includes(axisKey) && nextOrder.indexOf(axisKey) === index;
        });
        if (filtered.length >= 2) axisEditOrder = filtered.slice(-2);
    }

    function getAxisEditOrder() {
        return axisEditOrder.slice();
    }

    function rememberEditedAxis(axisKey) {
        if (!AXIS_KEYS.includes(axisKey)) return;
        axisEditOrder = axisEditOrder.filter(function (item) {
            return item !== axisKey;
        });
        axisEditOrder.push(axisKey);
        if (axisEditOrder.length > 2) axisEditOrder = axisEditOrder.slice(-2);
    }

    function syncDirectionalAxes(editedAxis) {
        if (editedAxis) rememberEditedAxis(editedAxis);

        const edo = coerceEdoValue(edoInput.value);
        edoInput.value = edo;
        const max = String(Math.max(0, edo - 1));
        for (const axisKey of AXIS_KEYS) {
            const input = getAxisInput(axisKey);
            if (!input) continue;
            input.min = '0';
            input.max = max;
        }

        const derivedAxis = AXIS_KEYS.find(function (axisKey) {
            return !axisEditOrder.includes(axisKey);
        }) || 'upRight';
        const axes = deriveDirectionalAxes({
            right: axisRightInput?.value,
            upRight: axisUpRightInput?.value,
            downRight: axisDownRightInput?.value
        }, edo, derivedAxis);

        if (axisRightInput) axisRightInput.value = axes.right;
        if (axisUpRightInput) axisUpRightInput.value = axes.upRight;
        if (axisDownRightInput) axisDownRightInput.value = axes.downRight;
    }

    function applyDirectionalAxesTuning(presetId) {
        const edo = coerceEdoValue(edoInput.value);
        const axes = getDirectionalAxesForTuning(edo, presetId);
        if (axisRightInput) axisRightInput.value = axes.right;
        if (axisUpRightInput) axisUpRightInput.value = axes.upRight;
        if (axisDownRightInput) axisDownRightInput.value = axes.downRight;
        setAxisEditOrder(['right', 'upRight']);
        syncDirectionalAxes();
    }

    function applyTheme(theme) {
        const nextTheme = theme === 'light' ? 'light' : 'dark';
        document.body.dataset.theme = nextTheme;

        if (themeToggleBtn) {
            const isLight = nextTheme === 'light';
            const label = isLight ? 'Switch to dark mode' : 'Switch to light mode';
            themeToggleBtn.title = label;
            themeToggleBtn.setAttribute('aria-label', label);
            themeToggleBtn.setAttribute('aria-pressed', String(isLight));
        }
    }

    function initializeTheme() {
        let savedTheme = 'dark';
        try {
            savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
        } catch (e) {
        }
        applyTheme(savedTheme);
    }

    function toggleTheme() {
        const nextTheme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
        applyTheme(nextTheme);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        } catch (e) {
        }
    }

    function setControlsDesktopCollapsedState(isCollapsed) {
        if (!controlsContent) return;
        controlsContent.classList.toggle('desktop-collapsed', isCollapsed);
        if (toggleControlsBtn) {
            toggleControlsBtn.classList.toggle('expanded', !isCollapsed);
            toggleControlsBtn.title = isCollapsed ? 'Expand settings' : 'Collapse settings';
            toggleControlsBtn.setAttribute('aria-expanded', String(!isCollapsed));
        }
    }

    function setSidebarDesktopCollapsedState(isCollapsed) {
        if (!overlaySidebar) return;
        overlaySidebar.classList.toggle('desktop-collapsed', isCollapsed);
        if (toggleSidebarBtn) {
            toggleSidebarBtn.textContent = isCollapsed ? '⟩' : '⟨';
            toggleSidebarBtn.title = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
        }
    }

    const renderingController = createTonnetzRenderingController({
        canvas,
        ctx,
        canvasSizeSelect,
        orientationSelect,
        customSizeGroup,
        canvasWidthInput,
        canvasHeightInput,
        colorXInput,
        colorYInput,
        colorZInput,
        backgroundColorInput,
        labelColorInput,
        highlightZeroColorInput,
        highlightZeroInput,
        triangleSizeInput,
        edoInput,
        axisRightInput,
        axisUpRightInput,
        axisDownRightInput,
        scaleDegreesInput,
        scaleSizeInput,
        scaleDotsInput,
        scaleDotColorInput,
        scaleDotSizeInput
    });

    const DEFAULT_COLORS = renderingController.DEFAULT_COLORS;
    const handleCanvasSizeChange = renderingController.handleCanvasSizeChange;
    let drawTonnetz = renderingController.drawTonnetz;
    const onIntervalParamsChange = renderingController.onIntervalParamsChange;
    const onCanvasClick = renderingController.onCanvasClick;
    const getLastOffscreenCanvas = renderingController.getLastOffscreenCanvas;

    function queueDraw() {
        if (debouncedDraw) debouncedDraw();
        else drawTonnetz();
    }

    function handleOverlayPanelInteraction(e) {
        if (onOverlayPanelEvent(e)) queueDraw();
    }

    const persistenceController = createTonnetzPersistenceController({
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
        getDrawTonnetz: function () {
            return drawTonnetz;
        },
        getLastOffscreenCanvas,
        setControlsDesktopCollapsedState,
        setSidebarDesktopCollapsedState
    });

    const saveStateToStorage = persistenceController.saveStateToStorage;
    const saveAsImage = persistenceController.saveAsImage;
    const saveAsPdf = persistenceController.saveAsPdf;
    const initializePersistence = persistenceController.initializePersistence;

    function toggleControls() {
        if (!controlsContent) return;
        const isCollapsed = !controlsContent.classList.contains('desktop-collapsed');
        setControlsDesktopCollapsedState(isCollapsed);
        if (controlsBackdrop) {
            controlsBackdrop.classList.toggle('visible', !isCollapsed && window.innerWidth <= 768);
        }
        saveStateToStorage();
    }

    function toggleSidebar() {
        if (!overlaySidebar) return;
        const isCollapsed = !overlaySidebar.classList.contains('desktop-collapsed');
        setSidebarDesktopCollapsedState(isCollapsed);
        saveStateToStorage();
    }

    const debouncedSave = debounce(saveStateToStorage, 500);
    const originalDrawTonnetz = drawTonnetz;
    drawTonnetz = function () {
        originalDrawTonnetz();
        debouncedSave();
    };
    try {
        if (typeof debounce === 'function') debouncedDraw = debounce(drawTonnetz, 120);
    } catch (e) {
    }

    initializeAdaptiveNav({
        controlsContainer,
        controlsContent,
        scaleContent,
        overlaySidebar,
        actionBtns,
        controlsBackdrop,
        setControlsDesktopCollapsedState
    });

    canvasSizeSelect.addEventListener('change', handleCanvasSizeChange);
    colorXInput.addEventListener('input', queueDraw);
    colorYInput.addEventListener('input', queueDraw);
    colorZInput.addEventListener('input', queueDraw);
    backgroundColorInput.addEventListener('input', queueDraw);
    labelColorInput.addEventListener('input', queueDraw);
    highlightZeroColorInput.addEventListener('input', queueDraw);
    highlightZeroInput.addEventListener('input', queueDraw);
    triangleSizeInput.addEventListener('change', function () {
        renderOverlayListPanel();
        queueDraw();
    });
    edoInput.addEventListener('change', function () {
        applyDirectionalAxesTuning();
        onIntervalParamsChange();
    });
    axisRightInput?.addEventListener('change', function () {
        syncDirectionalAxes('right');
        onIntervalParamsChange();
    });
    axisUpRightInput?.addEventListener('change', function () {
        syncDirectionalAxes('upRight');
        onIntervalParamsChange();
    });
    axisDownRightInput?.addEventListener('change', function () {
        syncDirectionalAxes('downRight');
        onIntervalParamsChange();
    });
    saveImageButton.addEventListener('click', saveAsImage);
    savePdfButton.addEventListener('click', saveAsPdf);
    scaleDegreesInput?.addEventListener('input', queueDraw);
    scaleSizeInput?.addEventListener('input', queueDraw);
    scaleDotsInput?.addEventListener('change', queueDraw);
    scaleDotColorInput?.addEventListener('input', queueDraw);
    scaleDotSizeInput?.addEventListener('input', queueDraw);
    overlayListContainer?.addEventListener('click', function (e) {
        if (!e.target.closest('button')) return;
        handleOverlayPanelInteraction(e);
    }, true);
    overlayListContainer?.addEventListener('change', function (e) {
        if (!e.target.classList.contains('ov-color-input')) return;
        handleOverlayPanelInteraction(e);
    }, true);
    overlayListContainer?.addEventListener('input', function (e) {
        if (!e.target.classList.contains('ov-color-input')) return;
        handleOverlayPanelInteraction(e);
    }, true);
    canvas.addEventListener('click', onCanvasClick);

    let touchStartX = 0;
    let touchStartY = 0;
    canvas.addEventListener('touchstart', function (evt) {
        if (evt.touches.length === 1) {
            touchStartX = evt.touches[0].clientX;
            touchStartY = evt.touches[0].clientY;
        }
    }, { passive: true });
    canvas.addEventListener('touchend', function (evt) {
        if (evt.changedTouches.length === 1) {
            const touch = evt.changedTouches[0];
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;
            if (Math.hypot(dx, dy) < 10) {
                evt.preventDefault();
                onCanvasClick({ clientX: touch.clientX, clientY: touch.clientY });
            }
        }
    }, { passive: false });

    toggleControlsBtn?.addEventListener('click', toggleControls);
    toggleSidebarBtn?.addEventListener('click', toggleSidebar);
    themeToggleBtn?.addEventListener('click', toggleTheme);

    initializeTheme();
    syncDirectionalAxes();
    initializePersistence();
});
