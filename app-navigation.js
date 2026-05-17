function initializeAdaptiveNav(options) {
    const {
        controlsContainer,
        controlsContent,
        scaleContent,
        overlaySidebar,
        actionBtns,
        controlsBackdrop,
        setControlsDesktopCollapsedState
    } = options;

    const MOBILE_BREAKPOINT = 768;
    const DRAG_CLOSE_DISTANCE_PX = 72;
    const DRAG_CLOSE_VELOCITY_PX_PER_MS = 0.45;
    const mobileNavSettings = document.getElementById('mobileNavSettings');
    const mobileNavChords = document.getElementById('mobileNavChords');
    const mobileNavScale = document.getElementById('mobileNavScale');
    const mobileNavMore = document.getElementById('mobileNavMore');
    if (!mobileNavSettings && !mobileNavChords && !mobileNavScale && !mobileNavMore) return;

    let activeMobilePanel = null;
    let lastBottomNavViewport = isBottomNavViewport();

    const navTabIds = {
        settings: 'mobileNavSettings',
        chords: 'mobileNavChords',
        scale: 'mobileNavScale',
        more: 'mobileNavMore'
    };
    const panelDefs = {
        settings: {
            key: 'settings',
            panel: controlsContent,
            handle: controlsContent?.querySelector('[data-sheet-handle]'),
            open: function () {
                controlsContent?.classList.remove('desktop-collapsed');
                controlsContent?.classList.add('mobile-open');
            },
            close: function () {
                controlsContent?.classList.remove('mobile-open');
            }
        },
        chords: {
            key: 'chords',
            panel: overlaySidebar,
            handle: overlaySidebar?.querySelector('[data-sheet-handle]'),
            open: function () {
                overlaySidebar?.classList.add('mobile-open');
            },
            close: function () {
                overlaySidebar?.classList.remove('mobile-open');
            }
        },
        scale: {
            key: 'scale',
            panel: scaleContent,
            handle: scaleContent?.querySelector('[data-sheet-handle]'),
            open: function () {
                scaleContent?.classList.add('mobile-open');
            },
            close: function () {
                scaleContent?.classList.remove('mobile-open');
            }
        },
        more: {
            key: 'more',
            panel: actionBtns,
            handle: actionBtns?.querySelector('[data-sheet-handle]'),
            open: function () {
                setMoreMenuOpen(true);
            },
            close: function () {
                setMoreMenuOpen(false);
            }
        }
    };

    function setMoreMenuOpen(isOpen) {
        if (!actionBtns) return;
        actionBtns.classList.toggle('mobile-open', !!isOpen);
    }

    function syncControlsOffset() {
        if (!controlsContainer) return;
        const offset = Math.round(controlsContainer.getBoundingClientRect().height);
        document.documentElement.style.setProperty('--controls-offset', `${offset}px`);
    }

    function isBottomNavViewport() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    function suppressLayoutTransitions() {
        document.documentElement.classList.add('suppress-layout-transitions');
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                document.documentElement.classList.remove('suppress-layout-transitions');
            });
        });
    }

    function updateNavPressed() {
        Object.keys(navTabIds).forEach(function (panelKey) {
            document.getElementById(navTabIds[panelKey])
                ?.setAttribute('aria-pressed', String(activeMobilePanel === panelKey));
        });
    }

    function focusMobilePanel(panelEl) {
        if (!isBottomNavViewport() || !panelEl) return;
        if (!panelEl.hasAttribute('tabindex')) panelEl.tabIndex = -1;
        requestAnimationFrame(function () {
            if (!panelEl.classList.contains('mobile-open')) return;
            panelEl.focus({ preventScroll: true });
        });
    }

    function resetPanelDragVisual(panelEl) {
        if (!panelEl) return;
        panelEl.style.removeProperty('--sheet-drag-offset');
        panelEl.classList.remove('mobile-sheet-dragging');
    }

    function closeMobilePanel(options) {
        const shouldRestoreFocus = options?.restoreFocus !== false;
        const closingPanelKey = activeMobilePanel;
        const closingPanel = closingPanelKey ? panelDefs[closingPanelKey]?.panel : null;
        const restoreFocusTarget = closingPanelKey ? document.getElementById(navTabIds[closingPanelKey]) : null;

        if (closingPanelKey && panelDefs[closingPanelKey]) {
            panelDefs[closingPanelKey].close();
        }
        Object.values(panelDefs).forEach(function (def) {
            resetPanelDragVisual(def.panel);
        });
        controlsBackdrop?.classList.remove('visible');
        activeMobilePanel = null;
        updateNavPressed();

        if (shouldRestoreFocus && closingPanel?.contains(document.activeElement)) {
            restoreFocusTarget?.focus({ preventScroll: true });
        }
    }

    function openMobilePanel(panelKey) {
        if (activeMobilePanel === panelKey) {
            closeMobilePanel();
            return;
        }

        closeMobilePanel({ restoreFocus: false });
        const nextPanel = panelDefs[panelKey]?.panel;
        panelDefs[panelKey]?.open();
        controlsBackdrop?.classList.toggle('visible', isBottomNavViewport());
        activeMobilePanel = panelKey;
        updateNavPressed();
        focusMobilePanel(nextPanel);
    }

    function bindDragToCollapse(def) {
        const panel = def?.panel;
        const handle = def?.handle;
        const panelKey = def?.key;
        if (!panel || !handle || !panelKey) return;

        let dragging = false;
        let pointerId = null;
        let startY = 0;
        let lastY = 0;
        let lastMoveTs = 0;
        let recentVelocity = 0;

        function detachPointerListeners() {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUpOrCancel);
            window.removeEventListener('pointercancel', onPointerUpOrCancel);
        }

        function onPointerMove(e) {
            if (!dragging || e.pointerId !== pointerId) return;
            const now = performance.now();
            const dt = Math.max(1, now - lastMoveTs);
            recentVelocity = (e.clientY - lastY) / dt;
            lastMoveTs = now;
            const dy = Math.max(0, e.clientY - startY);
            lastY = e.clientY;
            panel.style.setProperty('--sheet-drag-offset', `${dy}px`);
            if (e.cancelable) e.preventDefault();
        }

        function onPointerUpOrCancel(e) {
            if (!dragging || e.pointerId !== pointerId) return;
            const dy = Math.max(0, (lastY || e.clientY) - startY);
            const shouldClose = activeMobilePanel === panelKey && (
                dy >= DRAG_CLOSE_DISTANCE_PX || recentVelocity >= DRAG_CLOSE_VELOCITY_PX_PER_MS
            );

            dragging = false;
            pointerId = null;
            detachPointerListeners();
            resetPanelDragVisual(panel);

            if (shouldClose) closeMobilePanel();
        }

        handle.addEventListener('pointerdown', function (e) {
            if (!isBottomNavViewport()) return;
            if (activeMobilePanel !== panelKey) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;

            dragging = true;
            pointerId = e.pointerId;
            startY = e.clientY;
            lastY = e.clientY;
            lastMoveTs = performance.now();
            recentVelocity = 0;

            panel.classList.add('mobile-sheet-dragging');
            panel.style.setProperty('--sheet-drag-offset', '0px');
            if (handle.setPointerCapture) handle.setPointerCapture(pointerId);

            window.addEventListener('pointermove', onPointerMove, { passive: false });
            window.addEventListener('pointerup', onPointerUpOrCancel);
            window.addEventListener('pointercancel', onPointerUpOrCancel);
            if (e.cancelable) e.preventDefault();
        });
    }

    if (actionBtns) {
        document.addEventListener('click', function (e) {
            if (window.innerWidth <= MOBILE_BREAKPOINT) return;
            if (!actionBtns.contains(e.target) && !e.target.closest('#mobileNavMore')) {
                setMoreMenuOpen(false);
            }
        });
    }

    try {
        setControlsDesktopCollapsedState(true);
        syncControlsOffset();
    } catch (e) {
        console.error('Error initializing controls collapse state', e);
    }

    controlsBackdrop?.addEventListener('click', function () {
        closeMobilePanel();
    });

    document.addEventListener('click', function (e) {
        if (!isBottomNavViewport() || !activeMobilePanel) return;

        const activePanel = panelDefs[activeMobilePanel]?.panel;
        const activeNavTab = document.getElementById(navTabIds[activeMobilePanel]);
        const clickedNavTab = Object.values(navTabIds).some(function (navTabId) {
            return document.getElementById(navTabId)?.contains(e.target);
        });
        if (!activePanel) return;
        if (activePanel.contains(e.target) || activeNavTab?.contains(e.target) || clickedNavTab) return;

        e.preventDefault();
        e.stopPropagation();
        closeMobilePanel();
    }, true);

    mobileNavSettings?.addEventListener('click', function () {
        openMobilePanel('settings');
    });
    mobileNavChords?.addEventListener('click', function () {
        openMobilePanel('chords');
    });
    mobileNavScale?.addEventListener('click', function () {
        openMobilePanel('scale');
    });
    mobileNavMore?.addEventListener('click', function () {
        openMobilePanel('more');
    });

    Object.values(panelDefs).forEach(bindDragToCollapse);

    window.addEventListener('resize', function () {
        const isBottomNav = isBottomNavViewport();
        if (isBottomNav !== lastBottomNavViewport) {
            suppressLayoutTransitions();
            lastBottomNavViewport = isBottomNav;
        }
        Object.values(panelDefs).forEach(function (def) {
            resetPanelDragVisual(def.panel);
        });
        if (!isBottomNav) controlsBackdrop?.classList.remove('visible');
        syncControlsOffset();
        updateNavPressed();
    });

    closeMobilePanel();
    setControlsDesktopCollapsedState(true);
    controlsContent?.classList.remove('mobile-open');
    overlaySidebar?.classList.remove('mobile-open');
    scaleContent?.classList.remove('mobile-open');
    setMoreMenuOpen(false);
    syncControlsOffset();
}