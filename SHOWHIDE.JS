/**
 * FIX (this version, over the currently-live On Start script):
 *
 * 1) collectUnitPanoramaIds() only stopped scanning forward when it hit a
 *    scene literally labeled "DIVIDER". The live playlist has no scene
 *    labeled that - real boundaries are scenes like
 *    "START 1BR 31SQM ( FURNISHED )" - so the scan never found a stop
 *    condition and ran to the END of the entire ~81-scene playlist every
 *    time. Confirmed live via console:
 *      one-br-28 -> 61 scene(s)      (should be ~13)
 *      one-br-31 -> 48 scene(s)      (should be ~13)
 *      one-br-unit-preselling -> 35 scene(s)
 *    getNavConfigForPanorama() returns the FIRST group whose id list
 *    contains the current scene, so every scene that actually belongs to
 *    one-br-31 also sat (wrongly) inside one-br-28's bloated list and
 *    matched there first - driving the WRONG container. Same thing
 *    shadowed one-br-unit-preselling behind one-br-31. That's why those
 *    two specifically never hid: one-br-28 (nothing precedes it) and
 *    two-br-unit-preselling (last group, nothing follows it to swallow it)
 *    were never affected.
 *
 *    Fix: bound each group's scan at the START of the next group (from
 *    PANORAMA_INDEX, resolved once at boot) instead of trusting a divider
 *    label that doesn't exist in this data. A real DIVIDER label, if one
 *    is ever added back, still works exactly as before within that bound.
 *
 *    Known minor side effect: the single transition scene immediately
 *    before a group's boundary (e.g. "START 1BR 31SQM ( FURNISHED )" at
 *    the scene right before one-br-31's own header) now gets attributed
 *    to the PRECEDING group rather than either group specifically. These
 *    are short-lived "START ..." transition scenes per this tour's own
 *    convention (see the amenity-deck / AMENITY_NAV_RANGE_START pattern,
 *    which already excludes its own leading "START AMENITIES" scene the
 *    same way) - flag if this turns out to matter in practice.
 *
 * 2) Two PANORAMA_INDEX entries had gone stale (scenes reordered in
 *    3DVista since these were last set), confirmed by this script's own
 *    warnings and by reading window.tour.player.getById('rootPlayer')
 *    .mainPlayList.get('items') directly against the live tour:
 *      'one-br-unit-modeled'    52 -> "START 1BR - PRE SELLING" (wrong)   => 59 ("1BR UNIT")
 *      'two-br-unit-preselling' 60 -> "1BR_T&B D0_..." (wrong)            => 67 ("2BR UNIT")
 *
 * Install: paste this whole IIFE into the Player's "On Start" JavaScript
 * action in 3DVista (Root Player > Behaviour > Actions > On Start >
 * Execute Javascript), replacing the current script.
 */
(function (thisArg) {
    'use strict';

    var ROOT_ID = 'icx-quantum';
    var STYLE_ID = ROOT_ID + '-style';
    var LOG_PREFIX = '[icx-quantum]';

    if (window.__icxQuantumReady || window.__icxQuantumBooting || document.getElementById(ROOT_ID)) {
        console.info(LOG_PREFIX, 'already initialized or booting, skipping');
        return;
    }

    window.__icxQuantumBooting = true;

    var PANORAMA_INDEX = {
        'overview': 0,
        'taft-avenue': 1,
        'amenity-deck': 2,
        'sky-lounge-view': 3,
        'one-br-28': 20,
        'one-br-31': 33,
        'one-br-unit-preselling': 46,
        'one-br-unit-modeled': 59,
        'two-br-unit-preselling': 67
    };

    var LANDMARK_SCENE_KEYS = ['overview', 'taft-avenue', 'amenity-deck'];

    var NAV_COMPONENTS = {
        'one-br-28': {
            containerId: 'Container_D91DDFDB_CFBB_A4F6_41E7_C9F3BE422936',
            expectedLabelFragment: '28SQM'
        },

        'one-br-31': {
            containerId: 'Container_9E80E91A_D18E_ED76_41D3_D1ACEE389253',
            expectedLabelFragment: '31SQM'
        },

        'one-br-unit-preselling': {
            containerId: 'Container_BEE64E50_ADDA_A2FE_41E3_CF4FF4459D32',
            expectedLabelFragment: '1BR UNIT'
        },

        'one-br-unit-modeled': {
            containerId: null,
            expectedLabelFragment: '1BR UNIT'
        },

        'two-br-unit-preselling': {
            containerId: 'Container_A4886A57_8070_73BD_41DA_581984D8D2DA',
            expectedLabelFragment: '2BR UNIT'
        }
    };

    var AMENITY_NAV_RANGE_START = 5;
    var AMENITY_NAV_RANGE_END = 18;

    var BOTTOM_CONTAINER_ID = 'Container_CC19B678_DFEF_928A_41A7_7EA0761A91A0';
    var DROPDOWN_MENU_ID = 'Container_815E7CDA_CDE2_324A_41DE_DA46CBB02763';
    var FLOOR_STATUS_DISPLAY_ID = 'Container_AC92D15E_DBDE_5C78_41D8_90555FB63865';

    var NAV_SHARED_COMPONENT_IDS = [
        BOTTOM_CONTAINER_ID,
        DROPDOWN_MENU_ID,
        FLOOR_STATUS_DISPLAY_ID
    ];

    var OVERLAY_WATCH_IDS = {
        amenitiesPane: 'WebFrame_A6558878_D3A2_7256_41D2_0CAA71D3544D',
        locationPane: 'Container_161678CC_19CA_DA20_416C_07A29A19ED38',
        contactUsPane: 'Container_09D8184A_3E5F_D8D6_41CC_9C4F836F650C'
    };

    var NAV_FADE_MS = 320;
    var OVERLAY_FADE_FALLBACK_MS = 200;

    var RETRY_INTERVAL_MS = 250;
    var MAX_WAIT_MS = 30000;
    var waited = 0;

    function getPlayer() {
        try {
            if (window.tour && window.tour.locManager && window.tour.locManager.rootPlayer) {
                return window.tour.locManager.rootPlayer;
            }
        } catch (e) {}

        try {
            if (window.tour && window.tour.player && typeof window.tour.player.getById === 'function') {
                return window.tour.player.getById('rootPlayer') || window.tour.player;
            }
        } catch (e) {}

        return thisArg || null;
    }

    function safeGet(model, key) {
        try {
            return model && typeof model.get === 'function'
                ? model.get(key)
                : null;
        } catch (e) {
            return null;
        }
    }

    function safeSet(model, key, value) {
        try {
            if (model && typeof model.set === 'function') {
                model.set(key, value);
                return true;
            }
        } catch (e) {}

        return false;
    }

    function readModelText(model, key) {
        var value = safeGet(model, key);

        return value === null || typeof value === 'undefined'
            ? ''
            : String(value);
    }

    function nowMs() {
        return (window.performance && performance.now)
            ? performance.now()
            : Date.now();
    }

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function getCurrentPanorama(player) {
        var attempts = [
            function () {
                var pp = window.tour &&
                    window.tour.player &&
                    typeof window.tour.player.getById === 'function'
                    ? window.tour.player.getById('MainViewerPanoramaPlayer')
                    : null;

                return pp ? safeGet(pp, 'panorama') : null;
            },

            function () {
                var pp = player &&
                    typeof player.getById === 'function'
                    ? player.getById('MainViewerPanoramaPlayer')
                    : null;

                return pp ? safeGet(pp, 'panorama') : null;
            },

            function () {
                var items = safeGet(player.mainPlayList, 'items');
                var idx = safeGet(player.mainPlayList, 'selectedIndex');
                var item = items && items[idx];

                return item ? safeGet(item, 'media') : null;
            }
        ];

        for (var i = 0; i < attempts.length; i++) {
            try {
                var panorama = attempts[i]();

                if (panorama) {
                    return panorama;
                }
            } catch (e) {}
        }

        return null;
    }

    function getCurrentPanoramaId(player) {
        return safeGet(getCurrentPanorama(player), 'id');
    }

    function resolveSceneIndex(items, key, expectedFragment) {
        var index = PANORAMA_INDEX[key];

        var media = items[index]
            ? safeGet(items[index], 'media')
            : null;

        var id = media
            ? safeGet(media, 'id')
            : null;

        var label = media
            ? readModelText(media, 'label')
            : '';

        if (!id) {
            console.warn(
                LOG_PREFIX,
                'PANORAMA_INDEX["' +
                key +
                '"] = ' +
                index +
                ' is out of range or empty - check the playlist order in 3DVista'
            );

            return null;
        }

        if (
            label.toUpperCase().indexOf(
                expectedFragment.toUpperCase()
            ) === -1
        ) {
            console.warn(
                LOG_PREFIX,
                'PANORAMA_INDEX["' +
                key +
                '"] = ' +
                index +
                ' resolved to "' +
                label +
                '", expected something containing "' +
                expectedFragment +
                '" - the scene may have moved, update PANORAMA_INDEX'
            );
        }

        return {
            id: id,
            label: label,
            index: index
        };
    }

    // `endIndexExclusive` hard-bounds the scan at the next known group's
    // start index so a missing/relabeled boundary marker can never let one
    // unit's scan swallow the next unit's scenes (see header FIX note).
    // A literal 'DIVIDER' label, if present, still works exactly as before.
    function collectUnitPanoramaIds(items, startIndex, endIndexExclusive) {
        var ids = [];

        var limit = typeof endIndexExclusive === 'number'
            ? Math.min(endIndexExclusive, items.length)
            : items.length;

        for (var i = startIndex; i < limit; i++) {
            var media = safeGet(items[i], 'media');

            if (!media) {
                continue;
            }

            var id = safeGet(media, 'id');
            var label = readModelText(media, 'label').toUpperCase();

            if (label === 'DIVIDER') {
                var nextMedia = items[i + 1]
                    ? safeGet(items[i + 1], 'media')
                    : null;

                var nextLabel = nextMedia
                    ? readModelText(nextMedia, 'label').toUpperCase()
                    : '';

                if (
                    nextLabel === 'FURNISHED' ||
                    nextLabel === 'UNFURNISHED'
                ) {
                    continue;
                }

                break;
            }

            if (id) {
                ids.push(id);
            }
        }

        return ids;
    }

    function collectRangePanoramaIds(items, startIndex, endIndex) {
        var ids = [];

        for (
            var i = startIndex;
            i <= endIndex && i < items.length;
            i++
        ) {
            var media = safeGet(items[i], 'media');

            var id = media
                ? safeGet(media, 'id')
                : null;

            if (id) {
                ids.push(id);
            }
        }

        if (
            ids.length !==
            (endIndex - startIndex + 1)
        ) {
            console.warn(
                LOG_PREFIX,
                'amenities nav range [' +
                startIndex +
                ', ' +
                endIndex +
                '] only resolved ' +
                ids.length +
                ' of ' +
                (endIndex - startIndex + 1) +
                ' scenes - check the playlist order in 3DVista'
            );
        }

        return ids;
    }

    console.info(
        LOG_PREFIX,
        'waiting for tour player...'
    );

    var waitTimer = setInterval(function () {
        waited += RETRY_INTERVAL_MS;

        var player = getPlayer();

        if (!player || !player.mainPlayList) {
            if (waited >= MAX_WAIT_MS) {
                clearInterval(waitTimer);

                window.__icxQuantumBooting = false;

                console.error(
                    LOG_PREFIX,
                    'gave up after ' +
                    (MAX_WAIT_MS / 1000) +
                    's: rootPlayer/mainPlayList never available.'
                );
            }

            return;
        }

        clearInterval(waitTimer);

        try {
            init(player);

            window.__icxQuantumReady = true;
            window.__icxQuantumBooting = false;

            console.info(
                LOG_PREFIX,
                'init complete after ' +
                waited +
                'ms'
            );
        } catch (e) {
            window.__icxQuantumBooting = false;

            console.error(
                LOG_PREFIX,
                'init threw an error:',
                e
            );
        }
    }, RETRY_INTERVAL_MS);

    function init(player) {
        var items =
            safeGet(player.mainPlayList, 'items') || [];

        var landmarkPanoramaIds =
            LANDMARK_SCENE_KEYS
                .map(function (key) {
                    var scene = resolveSceneIndex(
                        items,
                        key,
                        key.replace(/-/g, ' ')
                    );

                    return scene
                        ? scene.id
                        : null;
                })
                .filter(Boolean);

        var navKeys = Object.keys(NAV_COMPONENTS);

        var resolvedNavScenes = navKeys.map(function (key) {
            return resolveSceneIndex(
                items,
                key,
                NAV_COMPONENTS[key].expectedLabelFragment
            );
        });

        var navConfigs =
            navKeys
                .map(function (key, i) {
                    var cfg = NAV_COMPONENTS[key];
                    var scene = resolvedNavScenes[i];

                    var boundary = items.length;

                    for (var j = i + 1; j < resolvedNavScenes.length; j++) {
                        if (resolvedNavScenes[j]) {
                            boundary = resolvedNavScenes[j].index;
                            break;
                        }
                    }

                    var panoramaIds = scene
                        ? collectUnitPanoramaIds(
                            items,
                            scene.index,
                            boundary
                        )
                        : [];

                    console.info(
                        LOG_PREFIX,
                        'nav group resolved:',
                        key,
                        '->',
                        panoramaIds.length,
                        'scene(s)'
                    );

                    return {
                        key: key,
                        panoramaIds: panoramaIds,
                        containerId: cfg.containerId
                    };
                });

        var amenityNavIds =
            collectRangePanoramaIds(
                items,
                AMENITY_NAV_RANGE_START,
                AMENITY_NAV_RANGE_END
            );

        console.info(
            LOG_PREFIX,
            'nav group resolved: amenities ->',
            amenityNavIds.length,
            'scene(s)'
        );

        navConfigs.push({
            key: 'amenities',
            panoramaIds: amenityNavIds,
            containerId: null
        });

        function getNavConfigForPanorama(panoramaId) {
            for (var i = 0; i < navConfigs.length; i++) {
                if (
                    navConfigs[i].panoramaIds.indexOf(
                        panoramaId
                    ) !== -1
                ) {
                    return navConfigs[i];
                }
            }

            return null;
        }

        function isBlockingOverlayOpen() {
            var keys =
                Object.keys(OVERLAY_WATCH_IDS);

            for (var i = 0; i < keys.length; i++) {
                var comp =
                    player[
                        OVERLAY_WATCH_IDS[keys[i]]
                    ];

                if (
                    comp &&
                    safeGet(comp, 'visible') === true
                ) {
                    return true;
                }
            }

            return false;
        }

        function isFullScreenOverlayOpen() {
            var loc =
                player[
                    OVERLAY_WATCH_IDS.locationPane
                ];

            var contact =
                player[
                    OVERLAY_WATCH_IDS.contactUsPane
                ];

            return (
                (loc &&
                    safeGet(loc, 'visible') === true) ||
                (contact &&
                    safeGet(contact, 'visible') === true)
            );
        }

        var landmarksVisible = true;
        var landmarksEffectiveVisible = true;
        var hotspotVisibilitySnapshot = null;
        var hotspotHideTimers = {};
        var overlayFallbackId = 0;

        function getOverlayKey(overlay) {
            var id = safeGet(overlay, 'id');

            if (id) {
                return id;
            }

            if (!overlay.__icxOverlayKey) {
                overlayFallbackId += 1;

                overlay.__icxOverlayKey =
                    'overlay-ref-' +
                    overlayFallbackId;
            }

            return overlay.__icxOverlayKey;
        }

        function clearHideTimer(key) {
            if (hotspotHideTimers[key]) {
                clearTimeout(
                    hotspotHideTimers[key]
                );

                delete hotspotHideTimers[key];
            }
        }

        function syncHotspotOverlays(visible) {
            if (!visible) {
                var currentId =
                    getCurrentPanoramaId(player);

                if (
                    landmarkPanoramaIds.indexOf(
                        currentId
                    ) === -1
                ) {
                    return;
                }

                var overlays =
                    safeGet(
                        getCurrentPanorama(player),
                        'overlays'
                    ) || [];

                if (!hotspotVisibilitySnapshot) {
                    hotspotVisibilitySnapshot = {};
                }

                for (
                    var i = 0;
                    i < overlays.length;
                    i++
                ) {
                    var overlay = overlays[i];

                    var key =
                        getOverlayKey(overlay);

                    if (
                        !(key in
                            hotspotVisibilitySnapshot)
                    ) {
                        hotspotVisibilitySnapshot[key] = {
                            overlay: overlay,

                            priorEnabled:
                                safeGet(
                                    overlay,
                                    'enabled'
                                ) !== false,

                            priorEnabledInStandard:
                                safeGet(
                                    overlay,
                                    'enabledInStandard'
                                ) !== false
                        };
                    }

                    clearHideTimer(key);

                    safeSet(
                        overlay,
                        'enabled',
                        false
                    );

                    var fadeMs =
                        safeGet(
                            overlay,
                            'fadeOutDuration'
                        );

                    if (
                        typeof fadeMs !== 'number' ||
                        fadeMs < 0
                    ) {
                        fadeMs =
                            OVERLAY_FADE_FALLBACK_MS;
                    }

                    hotspotHideTimers[key] =
                        setTimeout(
                            (function (ov, k) {
                                return function () {
                                    safeSet(
                                        ov,
                                        'enabledInStandard',
                                        false
                                    );

                                    delete hotspotHideTimers[k];
                                };
                            })(overlay, key),
                            fadeMs
                        );
                }
            } else {
                var snapshot =
                    hotspotVisibilitySnapshot;

                hotspotVisibilitySnapshot = null;

                if (!snapshot) {
                    return;
                }

                Object.keys(snapshot)
                    .forEach(function (key) {
                        var entry =
                            snapshot[key];

                        clearHideTimer(key);

                        safeSet(
                            entry.overlay,
                            'enabledInStandard',
                            entry.priorEnabledInStandard
                        );

                        safeSet(
                            entry.overlay,
                            'enabled',
                            entry.priorEnabled
                        );
                    });
            }
        }

        function applyLandmarksEffective(
            targetVisible,
            sceneChanged
        ) {
            if (
                targetVisible ===
                landmarksEffectiveVisible
            ) {
                if (
                    !targetVisible &&
                    sceneChanged
                ) {
                    syncHotspotOverlays(false);
                }

                return;
            }

            landmarksEffectiveVisible =
                targetVisible;

            syncHotspotOverlays(
                targetVisible
            );
        }

        function setLandmarksVisible(visible) {
            landmarksVisible = visible;

            paintLandmarksBtn();
        }

        var uiState =
            window.__icxQuantumUiState || {
                navHidden: false,
                tourEntered: false
            };

        window.__icxQuantumUiState =
            uiState;

        var tourEntered =
            uiState.tourEntered === true;

        var tourEnteredTimer = 0;

        function markTourEntered() {
            if (
                tourEntered ||
                tourEnteredTimer
            ) {
                return;
            }

            tourEnteredTimer =
                setTimeout(function () {
                    tourEntered = true;

                    uiState.tourEntered =
                        true;
                }, 900);
        }

        document.addEventListener(
            'pointerdown',
            markTourEntered,
            true
        );

        document.addEventListener(
            'keydown',
            markTourEntered,
            true
        );

        var navHidden =
            uiState.navHidden === true;

        function setNavHidden(hidden) {
            navHidden = !!hidden;

            uiState.navHidden =
                navHidden;
        }

        function applyNavVisual(
            cfg,
            opacityVal,
            hiddenTarget
        ) {
            var visible =
                opacityVal > 0.001;

            /*
             * This controls the specific navigation
             * container for each unit.
             *
             * 2BR PRE-SELLING:
             * Container_A4886A57_8070_73BD_41DA_581984D8D2DA
             */
            var container =
                cfg.containerId
                    ? player[cfg.containerId]
                    : null;

            if (container) {
                safeSet(
                    container,
                    'opacity',
                    opacityVal
                );

                safeSet(
                    container,
                    'visible',
                    visible
                );

                safeSet(
                    container,
                    'interactionEnabled',
                    !hiddenTarget
                );
            }

            var sharedOpacity =
                hiddenTarget ? 0 : 1;

            for (
                var i = 0;
                i < NAV_SHARED_COMPONENT_IDS.length;
                i++
            ) {
                var shared =
                    player[
                        NAV_SHARED_COMPONENT_IDS[i]
                    ];

                if (shared) {
                    safeSet(
                        shared,
                        'opacity',
                        sharedOpacity
                    );

                    safeSet(
                        shared,
                        'visible',
                        true
                    );

                    safeSet(
                        shared,
                        'interactionEnabled',
                        !hiddenTarget
                    );
                }
            }
        }

        injectStyles();

        var root =
            document.createElement('div');

        root.id = ROOT_ID;

        document.body.appendChild(root);

        function relocateRootForFullscreen() {
            var fsEl =
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement;

            var target =
                fsEl || document.body;

            if (
                root.parentNode !== target
            ) {
                target.appendChild(root);
            }
        }

        [
            'fullscreenchange',
            'webkitfullscreenchange',
            'mozfullscreenchange',
            'MSFullscreenChange'
        ].forEach(function (evt) {
            document.addEventListener(
                evt,
                relocateRootForFullscreen
            );
        });

        var EYE_OPEN =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>' +
            '<circle cx="12" cy="12" r="3"/>' +
            '</svg>';

        var EYE_OFF =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.6 21.6 0 0 1 5.06-5.94"/>' +
            '<path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a21.6 21.6 0 0 1-2.16 3.19"/>' +
            '<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>' +
            '<path d="M1 1l22 22"/>' +
            '</svg>';

        function makeButton(className) {
            var btn =
                document.createElement('button');

            btn.type = 'button';

            btn.className =
                'icx-toggle-btn ' +
                className;

            root.appendChild(btn);

            return btn;
        }

        var landmarksBtn =
            makeButton(
                'icx-landmarks-toggle'
            );

        var navBtn =
            makeButton(
                'icx-nav-toggle'
            );

        function paintLandmarksBtn() {
            var hidden =
                !landmarksVisible;

            landmarksBtn.innerHTML =
                hidden
                    ? EYE_OPEN
                    : EYE_OFF;

            landmarksBtn.title =
                hidden
                    ? 'Show Landmarks'
                    : 'Hide Landmarks';

            landmarksBtn.setAttribute(
                'aria-label',
                landmarksBtn.title
            );
        }

        landmarksBtn.onclick =
            function () {
                setLandmarksVisible(
                    !landmarksVisible
                );
            };

        function paintNavBtn() {
            navBtn.innerHTML =
                navHidden
                    ? EYE_OPEN
                    : EYE_OFF;

            navBtn.title =
                navHidden
                    ? 'Show Navigation'
                    : 'Hide Navigation';

            navBtn.setAttribute(
                'aria-label',
                navBtn.title
            );
        }

        navBtn.onclick =
            function () {
                setNavHidden(
                    !navHidden
                );
            };

        var lastPanoramaId = null;
        var lastNavKey = null;
        var lastPaintedNavKey = null;
        var lastPaintedNavHidden = null;
        var lastResolvedNavCfg = null;

        var navOpacity =
            navHidden ? 0 : 1;

        var navAnimFrom =
            navOpacity;

        var navAnimTo =
            navOpacity;

        var navAnimStart = 0;

        var lastNavTarget =
            navHidden;

        function frameLoop() {
            var currentId =
                getCurrentPanoramaId(player);

            var sceneChanged =
                currentId !== lastPanoramaId;

            lastPanoramaId =
                currentId;

            var blockingOverlayOpen =
                isBlockingOverlayOpen();

            var isLandmarkScene =
                landmarkPanoramaIds.indexOf(
                    currentId
                ) !== -1;

            var rawNavCfg =
                getNavConfigForPanorama(
                    currentId
                );

            var navCfg;

            if (rawNavCfg) {
                navCfg =
                    rawNavCfg;

                lastResolvedNavCfg =
                    rawNavCfg;
            } else if (
                !currentId &&
                !isLandmarkScene &&
                lastResolvedNavCfg
            ) {
                navCfg =
                    lastResolvedNavCfg;
            } else {
                navCfg = null;

                lastResolvedNavCfg =
                    null;
            }

            var onLandmarkScene =
                tourEntered &&
                isLandmarkScene;

            landmarksBtn.classList.toggle(
                'icx-visible',
                onLandmarkScene &&
                !blockingOverlayOpen
            );

            applyLandmarksEffective(
                onLandmarkScene &&
                landmarksVisible &&
                !blockingOverlayOpen,
                sceneChanged
            );

            var navKeyChanged =
                (
                    navCfg
                        ? navCfg.key
                        : null
                ) !== lastNavKey;

            lastNavKey =
                navCfg
                    ? navCfg.key
                    : null;

            if (navCfg) {
                var navSuppressed =
                    isFullScreenOverlayOpen();

                var navTarget =
                    navHidden ||
                    navSuppressed;

                if (navKeyChanged) {
                    navOpacity =
                        navTarget
                            ? 0
                            : 1;

                    navAnimFrom =
                        navOpacity;

                    navAnimTo =
                        navOpacity;

                    navAnimStart =
                        nowMs();

                    lastNavTarget =
                        navTarget;
                } else if (
                    navTarget !==
                    lastNavTarget
                ) {
                    if (navTarget) {
                        navAnimFrom =
                            navOpacity;

                        navAnimTo =
                            0;
                    } else {
                        navOpacity = 1;

                        navAnimFrom = 1;
                        navAnimTo = 1;
                    }

                    navAnimStart =
                        nowMs();

                    lastNavTarget =
                        navTarget;
                }

                var elapsed =
                    nowMs() -
                    navAnimStart;

                var t =
                    NAV_FADE_MS > 0
                        ? Math.min(
                            1,
                            elapsed /
                            NAV_FADE_MS
                        )
                        : 1;

                navOpacity =
                    navAnimFrom +
                    (
                        navAnimTo -
                        navAnimFrom
                    ) *
                    easeOutCubic(t);

                /*
                 * This is where the 2BR Pre-selling
                 * container gets its show/hide state.
                 */
                applyNavVisual(
                    navCfg,
                    navOpacity,
                    navTarget
                );

                if (
                    navCfg.key !==
                        lastPaintedNavKey ||
                    navHidden !==
                        lastPaintedNavHidden
                ) {
                    paintNavBtn();

                    lastPaintedNavKey =
                        navCfg.key;

                    lastPaintedNavHidden =
                        navHidden;
                }

                navBtn.classList.toggle(
                    'icx-visible',
                    !navSuppressed
                );
            } else {
                navBtn.classList.remove(
                    'icx-visible'
                );
            }

            requestAnimationFrame(
                frameLoop
            );
        }

        paintLandmarksBtn();
        paintNavBtn();

        requestAnimationFrame(
            frameLoop
        );
    }

    function injectStyles() {
        var oldStyle =
            document.getElementById(
                STYLE_ID
            );

        if (
            oldStyle &&
            oldStyle.parentNode
        ) {
            oldStyle.parentNode.removeChild(
                oldStyle
            );
        }

        var styleEl =
            document.createElement('style');

        styleEl.id = STYLE_ID;

        styleEl.textContent =
            '#' +
            ROOT_ID +
            '{position:fixed;inset:0;z-index:2147483646;font-family:Arial,Helvetica,sans-serif;pointer-events:none;}' +

            '.icx-toggle-btn{position:fixed;top:50%;right:20px;transform:translateY(-50%) translateX(16px) scale(.9);display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;color:#fff;border:1px solid rgba(255,255,255,.28);cursor:pointer;box-shadow:0 10px 24px rgba(0,0,0,.22);background:rgba(0,0,0,.32);-webkit-backdrop-filter:blur(14px) saturate(150%);backdrop-filter:blur(14px) saturate(150%);pointer-events:none;opacity:0;transition:opacity 260ms ease, transform 260ms cubic-bezier(.22,1,.36,1), box-shadow 220ms ease, background 180ms ease;}' +

            '.icx-toggle-btn.icx-visible{opacity:1;pointer-events:auto;transform:translateY(-50%) translateX(0) scale(1);}' +

            '.icx-toggle-btn.icx-visible:hover{transform:translateY(-50%) scale(1.08);box-shadow:0 14px 28px rgba(0,0,0,.3);background:rgba(255,255,255,.24);}' +

            '.icx-toggle-btn:active{transform:translateY(-50%) scale(.94);}' +

            '.icx-toggle-btn:focus-visible{outline:2px solid #fff;outline-offset:2px;}' +

            '.icx-toggle-btn svg{width:22px;height:22px;stroke:#fff;}';

        document.head.appendChild(
            styleEl
        );
    }
})(this);
