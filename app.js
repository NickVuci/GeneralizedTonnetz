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
    const intervalXInput = document.getElementById('intervalX');
    const intervalZInput = document.getElementById('intervalZ');
    const scaleDegreesInput = document.getElementById('scaleDegrees');
    const scaleSizeInput = document.getElementById('scaleSize');
    const scaleDotsInput = document.getElementById('scaleDots');
    const scaleDotColorInput = document.getElementById('scaleDotColor');
    const scaleDotSizeInput = document.getElementById('scaleDotSize');
    const addOverlayBtn = document.getElementById('addOverlayBtn');
    const overlayListContainer = document.getElementById('overlayList');
    const saveImageButton = document.getElementById('saveImageButton');
    const savePdfButton = document.getElementById('savePdfButton');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const resetBtn = document.getElementById('resetBtn');
    const toggleControlsBtn = document.getElementById('toggleControls');
    const controlsContainer = document.getElementById('controls');
    const controlsContent = document.getElementById('controlsContent');
    const scaleContent = document.getElementById('scaleContent');
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    const overlaySidebar = document.getElementById('overlaySidebar');
    const actionBtns = document.getElementById('actionBtns');
    const controlsBackdrop = document.getElementById('controlsBackdrop');

    let debouncedDraw = null;

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
        intervalXInput,
        intervalZInput,
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
        onOverlayPanelEvent(e);
        queueDraw();
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
        intervalXInput,
        intervalZInput,
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
    triangleSizeInput.addEventListener('change', queueDraw);
    edoInput.addEventListener('change', onIntervalParamsChange);
    intervalXInput.addEventListener('change', onIntervalParamsChange);
    intervalZInput.addEventListener('change', onIntervalParamsChange);
    saveImageButton.addEventListener('click', saveAsImage);
    savePdfButton.addEventListener('click', saveAsPdf);
    scaleDegreesInput?.addEventListener('input', queueDraw);
    scaleSizeInput?.addEventListener('input', queueDraw);
    scaleDotsInput?.addEventListener('change', queueDraw);
    scaleDotColorInput?.addEventListener('input', queueDraw);
    scaleDotSizeInput?.addEventListener('input', queueDraw);
    addOverlayBtn?.addEventListener('click', function () {
        addOverlay();
        renderOverlayListPanel();
        queueDraw();
    });
    overlayListContainer?.addEventListener('input', handleOverlayPanelInteraction, true);
    overlayListContainer?.addEventListener('click', function (e) {
        if (!e.target.closest('button')) return;
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

    initializePersistence();
});
