/**
 * Quantum Residences - Hide Landmarks / Hide Navigation overlay
 *
 * Scenes are addressed by their PANORAMA_INDEX position (same idea as the
 * Iloilo Centrale tour's PANORAMA_INDEX table), resolved to the tour's
 * actual panorama id once at boot. Ids stay stable if a scene is ever
 * reordered in 3DVista; indices don't - so resolution logs a warning
 * whenever a resolved scene's label doesn't look like what its index name
 * promises, which is the signal to come update the number below.
 *
 * Landmarks button (Overview / Taft Avenue / Amenity Deck): hides/restores
 * that panorama's hotspot overlays. Each overlay has separate enabled
 * flags per viewing mode (enabledInStandard, enabledInVR,
 * enabledInCardboard, enabledInSurfaceSelection) plus a generic `enabled`,
 * and its own native `fadeInDuration`/`fadeOutDuration` (authored in
 * 3DVista, confirmed live on this tour at 200ms) that animates `enabled`
 * automatically. `enabledInStandard` alone is a hard cut with no fade -
 * confirmed directly against this tour - so hiding sets `enabled` first
 * (plays the native fade) and only flips `enabledInStandard` off after
 * that fade's own duration elapses, so the pin actually fades out instead
 * of popping. Showing reverses the order: gate open first, then trigger
 * the fade-in. A snapshot restores each overlay to its own prior state
 * instead of forcing every overlay back on.
 *
 * Navigation button (1BR 28sqm / 1BR 31sqm): each unit is really ~11
 * playlist scenes (a header view, several FURNISHED room angles, then
 * several UNFURNISHED room angles) - the unfurnished ones are literally
 * labeled just "UNFURNISHED" with no unit info, so there's no text to
 * match them by. Instead the full set is walked forward from the unit's
 * PANORAMA_INDEX position at boot - the same "read the tour's own
 * structure instead of a hand-picked list" idea used for the landmarks.
 *
 * Hide/show is tracked as ONE global flag (navHidden), not one per unit -
 * the button means "hide the navigation UI" and also drives the shared
 * components (bottom bar / dropdown / floor status display) that aren't
 * tied to either unit specifically. Tracking it per unit key used to mean
 * moving into the OTHER unit (whose flag was still at its untouched
 * default) re-showed those shared containers even though the user had
 * explicitly hidden nav.
 *
 * Both the unit container and the shared components fade via their own
 * `opacity` model property, tweened every animation frame - confirmed
 * live that 3DVista's Container class actually repaints on `opacity`
 * (unlike a same-named DOM `#id` CSS rule, which never matched anything:
 * these containers don't exist as real DOM nodes, 3DVista draws them on
 * canvas). `visible` only flips to false once the fade-out finishes, and
 * to true the instant a fade-in starts, so it stays interactive/rendered
 * for the whole animation. The same per-frame loop that drives the tween
 * also re-applies the hidden state every single frame for as long as
 * nav is meant to be hidden - one-br-28 specifically doesn't hold a
 * plain one-time `visible=false`: something in 3DVista keeps
 * re-asserting `visible:true` on that unit for as long as you're on one
 * of its scenes, not just once on scene load. A slower poll loses that
 * fight continuously (looks like "doesn't hide at all"); checking every
 * frame never lets it go uncontested, and doubles as the loop that steps
 * the opacity tween.
 *
 * Switching which unit is active (navKey changes) snaps the tween
 * instantly to whatever the current hidden state already is, rather than
 * replaying the fade - otherwise walking through a unit's own room
 * angles while nav is hidden would flash a fade-in/out on every scene.
 * The fade only plays on a real state change: the user's own click, or
 * a full-screen overlay opening/closing (see below).
 *
 * Amenities / Location / Contact Us: Location and Contact Us are
 * full-screen overlays - our root is pinned at the max z-index, so
 * without suppression it renders on top of them. Detected by diffing
 * every player component's `visible` before/after each tab, live against
 * this tour: each flips one dedicated full-screen Container to visible.
 * Landmarks suppresses on all three of Amenities/Location/Contact Us.
 * Navigation only suppresses on Location/Contact Us - Amenities is just
 * a dropdown row (a WebFrame+ThumbnailList pair swapped into the shared
 * dropdown menu container) that doesn't actually collide with the nav
 * button or panel, so hiding nav for it was reported as a bug and
 * removed. Units does the same dropdown-row trick as Amenities but was
 * never in either suppression list - it's the tab the nav buttons
 * themselves belong to. Suppressed panels fade through the exact same
 * path as a manual toggle, and restore to whatever the user's own
 * hide/show choice was once the overlay closes.
 *
 * The nav button's position/size is a fixed CSS anchor (.icx-nav-toggle),
 * not computed from the container - an earlier version tracked
 * Container_D91DDFDB.../Container_9E80E91A...'s live actualWidth and
 * anchored under it, but that container is a full-height (100%) sidebar,
 * so "under the container" landed off the bottom of the viewport, and
 * per feedback the button shouldn't resize/move at all - it should just
 * stay put.
 *
 * Install: paste this whole IIFE into the Player's "On Start" JavaScript
 * action in 3DVista:
 * Root Player > Behaviour > Actions > On Start > Execute Javascript
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

    // Single source of truth for scene positions. Verified against the
    // live playlist via:
    //   window.tour.player.getById('rootPlayer').mainPlayList.get('items')
    //     .map((it, i) => i + ': ' + it.get('media').get('label'))
    var PANORAMA_INDEX = {
        'overview': 0,
        'taft-avenue': 1,
        'amenity-deck': 2,
        'sky-lounge-view': 3,
        'one-br-28': 20, // "1BR ±28SQM" header; furnished + unfurnished room angles follow it
        'one-br-31': 33  // "1BR ±31SQM" header; furnished + unfurnished room angles follow it
    };

    // Landmarks button shows only on these scenes.
    var LANDMARK_SCENE_KEYS = ['overview', 'taft-avenue', 'amenity-deck'];

    // Navigation button shows on every scene belonging to a unit group -
    // resolved dynamically at boot, see resolveNavConfigs(). Each key here
    // must also exist in PANORAMA_INDEX.
    var NAV_COMPONENTS = {
        'one-br-28': {
            containerId: 'Container_D91DDFDB_CFBB_A4F6_41E7_C9F3BE422936'
        },
        'one-br-31': {
            containerId: 'Container_9E80E91A_D18E_ED76_41D3_D1ACEE389253'
        }
    };

    var BOTTOM_CONTAINER_ID = 'Container_CC19B678_DFEF_928A_41A7_7EA0761A91A0';
    var DROPDOWN_MENU_ID = 'Container_815E7CDA_CDE2_324A_41DE_DA46CBB02763';
    var FLOOR_STATUS_DISPLAY_ID = 'Container_AC92D15E_DBDE_5C78_41D8_90555FB63865';
    var NAV_SHARED_COMPONENT_IDS = [
        BOTTOM_CONTAINER_ID,
        DROPDOWN_MENU_ID,
        FLOOR_STATUS_DISPLAY_ID
    ];

    // Component ids that indicate Amenities / Location / Contact Us is
    // currently open - found by diffing every player component's
    // `visible` state before/after clicking each tab on the live tour.
    // Fragile the same way every other hardcoded id in this file is: if
    // the tour is re-exported with these rebuilt, this stops detecting
    // and just silently fails to suppress (isBlockingOverlayOpen degrades
    // to "nothing open" per missing id, it doesn't throw).
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
            return model && typeof model.get === 'function' ? model.get(key) : null;
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
        return value === null || typeof value === 'undefined' ? '' : String(value);
    }

    function nowMs() {
        return (window.performance && performance.now) ? performance.now() : Date.now();
    }

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    // Resolves the currently active Panorama component so its hotspot
    // overlays can be looked up. It lives on the dedicated PanoramaPlayer
    // component ('MainViewerPanoramaPlayer' in this tour) under the key
    // 'panorama'.
    function getCurrentPanorama(player) {
        var attempts = [
            function () {
                var pp = window.tour && window.tour.player && typeof window.tour.player.getById === 'function'
                    ? window.tour.player.getById('MainViewerPanoramaPlayer') : null;
                return pp ? safeGet(pp, 'panorama') : null;
            },
            function () {
                var pp = player && typeof player.getById === 'function' ? player.getById('MainViewerPanoramaPlayer') : null;
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
                if (panorama) return panorama;
            } catch (e) {}
        }
        return null;
    }

    function getCurrentPanoramaId(player) {
        return safeGet(getCurrentPanorama(player), 'id');
    }

    // Resolves a PANORAMA_INDEX entry to its actual {id, label, index}
    // from the live playlist, warning if the label at that position
    // doesn't contain `expectedFragment` - the sign that a scene moved in
    // 3DVista and PANORAMA_INDEX needs updating.
    function resolveSceneIndex(items, key, expectedFragment) {
        var index = PANORAMA_INDEX[key];
        var media = items[index] ? safeGet(items[index], 'media') : null;
        var id = media ? safeGet(media, 'id') : null;
        var label = media ? readModelText(media, 'label') : '';

        if (!id) {
            console.warn(LOG_PREFIX, 'PANORAMA_INDEX["' + key + '"] = ' + index + ' is out of range or empty - check the playlist order in 3DVista');
            return null;
        }
        if (label.toUpperCase().indexOf(expectedFragment.toUpperCase()) === -1) {
            console.warn(LOG_PREFIX, 'PANORAMA_INDEX["' + key + '"] = ' + index + ' resolved to "' + label + '", expected something containing "' + expectedFragment + '" - the scene may have moved, update PANORAMA_INDEX');
        }
        return { id: id, label: label, index: index };
    }

    // Walks the playlist forward from a unit's header scene, collecting
    // every scene that belongs to it (furnished room angles, then
    // unfurnished room angles). A "Divider" entry only ends the group when
    // it ISN'T immediately followed by another FURNISHED/UNFURNISHED
    // entry - dividers are also used *within* a unit, to separate
    // furnished from unfurnished.
    function collectUnitPanoramaIds(items, startIndex) {
        var ids = [];
        for (var i = startIndex; i < items.length; i++) {
            var media = safeGet(items[i], 'media');
            if (!media) continue;
            var id = safeGet(media, 'id');
            var label = readModelText(media, 'label').toUpperCase();

            if (label === 'DIVIDER') {
                var nextMedia = items[i + 1] ? safeGet(items[i + 1], 'media') : null;
                var nextLabel = nextMedia ? readModelText(nextMedia, 'label').toUpperCase() : '';
                if (nextLabel === 'FURNISHED' || nextLabel === 'UNFURNISHED') continue;
                break;
            }
            if (id) ids.push(id);
        }
        return ids;
    }

    console.info(LOG_PREFIX, 'waiting for tour player...');

    var waitTimer = setInterval(function () {
        waited += RETRY_INTERVAL_MS;
        var player = getPlayer();
        if (!player || !player.mainPlayList) {
            if (waited >= MAX_WAIT_MS) {
                clearInterval(waitTimer);
                window.__icxQuantumBooting = false;
                console.error(LOG_PREFIX, 'gave up after ' + (MAX_WAIT_MS / 1000) + 's: rootPlayer/mainPlayList never available.');
            }
            return;
        }
        clearInterval(waitTimer);
        try {
            init(player);
            window.__icxQuantumReady = true;
            window.__icxQuantumBooting = false;
            console.info(LOG_PREFIX, 'init complete after ' + waited + 'ms');
        } catch (e) {
            window.__icxQuantumBooting = false;
            console.error(LOG_PREFIX, 'init threw an error:', e);
        }
    }, RETRY_INTERVAL_MS);

    function init(player) {
        var items = safeGet(player.mainPlayList, 'items') || [];

        // ---- Resolve PANORAMA_INDEX -> real ids, once, at boot ----

        var landmarkPanoramaIds = LANDMARK_SCENE_KEYS.map(function (key) {
            var scene = resolveSceneIndex(items, key, key.replace(/-/g, ' '));
            return scene ? scene.id : null;
        }).filter(Boolean);

        var navConfigs = Object.keys(NAV_COMPONENTS).map(function (key) {
            var scene = resolveSceneIndex(items, key, key.replace('one-br-', ''));
            var panoramaIds = scene ? collectUnitPanoramaIds(items, scene.index) : [];
            console.info(LOG_PREFIX, 'nav group resolved:', key, '->', panoramaIds.length, 'scene(s)');
            return {
                key: key,
                panoramaIds: panoramaIds,
                containerId: NAV_COMPONENTS[key].containerId
            };
        });

        function getNavConfigForPanorama(panoramaId) {
            for (var i = 0; i < navConfigs.length; i++) {
                if (navConfigs[i].panoramaIds.indexOf(panoramaId) !== -1) return navConfigs[i];
            }
            return null;
        }

        // Any of Amenities / Location / Contact Us currently open? See
        // header comment for how these three ids were found. Landmarks
        // suppresses on all three. Navigation only suppresses on Location
        // and Contact Us (true full-screen overlays our max-z-index root
        // would otherwise bleed through) - Amenities is just a dropdown
        // row that doesn't actually collide with the nav button/panel, so
        // hiding nav for it was reported as a bug and removed; landmarks
        // keeps it since that pairing wasn't flagged.
        function isBlockingOverlayOpen() {
            var keys = Object.keys(OVERLAY_WATCH_IDS);
            for (var i = 0; i < keys.length; i++) {
                var comp = player[OVERLAY_WATCH_IDS[keys[i]]];
                if (comp && safeGet(comp, 'visible') === true) return true;
            }
            return false;
        }

        function isFullScreenOverlayOpen() {
            var loc = player[OVERLAY_WATCH_IDS.locationPane];
            var contact = player[OVERLAY_WATCH_IDS.contactUsPane];
            return (loc && safeGet(loc, 'visible') === true) || (contact && safeGet(contact, 'visible') === true);
        }

        // ---- Landmarks: hide/restore hotspot overlays, fading via each
        // overlay's own native fadeInDuration/fadeOutDuration ----

        var landmarksVisible = true;
        var landmarksEffectiveVisible = true;
        var hotspotVisibilitySnapshot = null;
        var hotspotHideTimers = {};
        var overlayFallbackId = 0;

        function getOverlayKey(overlay) {
            var id = safeGet(overlay, 'id');
            if (id) return id;
            if (!overlay.__icxOverlayKey) {
                overlayFallbackId += 1;
                overlay.__icxOverlayKey = 'overlay-ref-' + overlayFallbackId;
            }
            return overlay.__icxOverlayKey;
        }

        function clearHideTimer(key) {
            if (hotspotHideTimers[key]) {
                clearTimeout(hotspotHideTimers[key]);
                delete hotspotHideTimers[key];
            }
        }

        function syncHotspotOverlays(visible) {
            if (!visible) {
                var currentId = getCurrentPanoramaId(player);
                if (landmarkPanoramaIds.indexOf(currentId) === -1) return;

                var overlays = safeGet(getCurrentPanorama(player), 'overlays') || [];
                if (!hotspotVisibilitySnapshot) hotspotVisibilitySnapshot = {};

                for (var i = 0; i < overlays.length; i++) {
                    var overlay = overlays[i];
                    var key = getOverlayKey(overlay);
                    if (!(key in hotspotVisibilitySnapshot)) {
                        hotspotVisibilitySnapshot[key] = {
                            overlay: overlay,
                            priorEnabled: safeGet(overlay, 'enabled') !== false,
                            priorEnabledInStandard: safeGet(overlay, 'enabledInStandard') !== false
                        };
                    }
                    clearHideTimer(key);
                    // enabled alone plays the native fade; enabledInStandard
                    // is a hard cut, so it waits for that fade to finish.
                    safeSet(overlay, 'enabled', false);
                    var fadeMs = safeGet(overlay, 'fadeOutDuration');
                    if (typeof fadeMs !== 'number' || fadeMs < 0) fadeMs = OVERLAY_FADE_FALLBACK_MS;
                    hotspotHideTimers[key] = setTimeout((function (ov, k) {
                        return function () {
                            safeSet(ov, 'enabledInStandard', false);
                            delete hotspotHideTimers[k];
                        };
                    })(overlay, key), fadeMs);
                }
            } else {
                var snapshot = hotspotVisibilitySnapshot;
                hotspotVisibilitySnapshot = null;
                if (!snapshot) return;
                Object.keys(snapshot).forEach(function (key) {
                    var entry = snapshot[key];
                    clearHideTimer(key);
                    // Gate open first, then trigger enabled's native fade-in.
                    safeSet(entry.overlay, 'enabledInStandard', entry.priorEnabledInStandard);
                    safeSet(entry.overlay, 'enabled', entry.priorEnabled);
                });
            }
        }

        // `landmarksVisible` is one global flag across all three landmark
        // scenes (Overview/Taft Avenue/Amenity Deck), by design - hiding
        // on Overview should stay hidden on Taft Avenue and Amenity Deck
        // too, and Show Landmarks should restore all of them. But
        // syncHotspotOverlays() only ever touches the CURRENT scene's
        // overlays, and this only re-ran it when targetVisible actually
        // flipped - so hiding on Overview, then walking to Taft Avenue
        // (target stays false the whole time, nothing "flips"), never
        // hid Taft Avenue's own pins at all. `sceneChanged` forces a
        // re-run on every scene entry while the target is still "hidden",
        // so each landmark scene's pins get hidden as you reach them, not
        // just the one you were on when you clicked Hide Landmarks.
        function applyLandmarksEffective(targetVisible, sceneChanged) {
            if (targetVisible === landmarksEffectiveVisible) {
                if (!targetVisible && sceneChanged) syncHotspotOverlays(false);
                return;
            }
            landmarksEffectiveVisible = targetVisible;
            syncHotspotOverlays(targetVisible);
        }

        function setLandmarksVisible(visible) {
            landmarksVisible = visible;
            paintLandmarksBtn();
        }

        // ---- Navigation: hide/restore the furnished/unfurnished panel ----

        var uiState = window.__icxQuantumUiState || { navHidden: false, tourEntered: false };
        window.__icxQuantumUiState = uiState;
        var tourEntered = uiState.tourEntered === true;
        var tourEnteredTimer = 0;

        function markTourEntered() {
            if (tourEntered || tourEnteredTimer) return;
            tourEnteredTimer = setTimeout(function () {
                tourEntered = true;
                uiState.tourEntered = true;
            }, 900);
        }
        document.addEventListener('pointerdown', markTourEntered, true);
        document.addEventListener('keydown', markTourEntered, true);

        // ONE global hide/show flag, not one per unit - see header comment.
        var navHidden = uiState.navHidden === true;

        function setNavHidden(hidden) {
            navHidden = !!hidden;
            uiState.navHidden = navHidden;
        }

        // Applies an animated opacity value to a nav group's own container
        // plus the shared components. `hiddenTarget` (not the animated
        // value) gates interactionEnabled so a fading-out panel stops
        // accepting clicks immediately rather than only once fully
        // transparent, and a fading-in one accepts them right away.
        function applyNavVisual(cfg, opacityVal, hiddenTarget) {
            var visible = opacityVal > 0.001;
            var container = player[cfg.containerId];
            if (container) {
                safeSet(container, 'opacity', opacityVal);
                safeSet(container, 'visible', visible);
                safeSet(container, 'interactionEnabled', !hiddenTarget);
            }
            for (var i = 0; i < NAV_SHARED_COMPONENT_IDS.length; i++) {
                var shared = player[NAV_SHARED_COMPONENT_IDS[i]];
                if (shared) {
                    safeSet(shared, 'opacity', opacityVal);
                    safeSet(shared, 'visible', visible);
                    safeSet(shared, 'interactionEnabled', !hiddenTarget);
                }
            }
        }

        // ---- UI ----

        injectStyles();
        var root = document.createElement('div');
        root.id = ROOT_ID;
        document.body.appendChild(root);

        var EYE_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
        var EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.6 21.6 0 0 1 5.06-5.94"/>' +
            '<path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a21.6 21.6 0 0 1-2.16 3.19"/>' +
            '<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';

        function makeButton(className) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'icx-toggle-btn ' + className;
            root.appendChild(btn);
            return btn;
        }

        var landmarksBtn = makeButton('icx-landmarks-toggle');
        var navBtn = makeButton('icx-nav-toggle');
        var navRevealBtn = makeButton('icx-nav-reveal');
        navRevealBtn.innerHTML = EYE_OPEN;
        navRevealBtn.title = 'Show Navigation';
        navRevealBtn.setAttribute('aria-label', 'Show Navigation');

        function paintLandmarksBtn() {
            var hidden = !landmarksVisible;
            landmarksBtn.innerHTML = (hidden ? EYE_OPEN : EYE_OFF) + '<span>' + (hidden ? 'Show Landmarks' : 'Hide Landmarks') + '</span>';
            landmarksBtn.removeAttribute('title');
            landmarksBtn.removeAttribute('aria-label');
        }
        landmarksBtn.onclick = function () { setLandmarksVisible(!landmarksVisible); };

        function paintNavBtn(cfg) {
            var hidden = navHidden;
            navBtn.innerHTML = (hidden ? EYE_OPEN : EYE_OFF) + '<span>' + (hidden ? 'Show Navigation' : 'Hide Navigation') + '</span>';
            navBtn.removeAttribute('title');
            navBtn.removeAttribute('aria-label');
            navBtn.onclick = function () { setNavHidden(!navHidden); };
            navRevealBtn.onclick = function () { setNavHidden(false); };
        }

        // ---- Single per-frame loop: scene detection, landmarks fade,
        // nav opacity tween + continuous re-assertion, positioning, and
        // blocking-overlay suppression all live here so they react to
        // each other on the same tick (an overlay opening mid-fade, a
        // scene change mid-fade, etc. never fight each other a frame
        // apart). See header comment for why this needs to run every
        // frame rather than on a slower poll.

        var lastPanoramaId = null;
        var lastNavKey = null;
        var lastPaintedNavKey = null;
        var lastPaintedNavHidden = null;

        var navOpacity = navHidden ? 0 : 1;
        var navAnimFrom = navOpacity;
        var navAnimTo = navOpacity;
        var navAnimStart = 0;
        var lastNavTarget = navHidden;

        function frameLoop() {
            var currentId = getCurrentPanoramaId(player);
            var sceneChanged = currentId !== lastPanoramaId;
            lastPanoramaId = currentId;

            var hasTourScene = !!currentId;
            var isLandmarkScene = landmarkPanoramaIds.indexOf(currentId) !== -1;
            var navCfg = getNavConfigForPanorama(currentId);
            var blockerActive = isBlockingOverlayOpen();

            // Keep the UI completely off the landing screen and other non-tour
            // areas even if the root is injected globally.
            root.classList.toggle('icx-hidden', !hasTourScene);

            var blockingOverlayOpen = blockerActive;

            // Landmarks
            var onLandmarkScene = tourEntered && isLandmarkScene;
            landmarksBtn.classList.toggle('icx-visible', onLandmarkScene && !blockingOverlayOpen && !!currentId);
            applyLandmarksEffective(onLandmarkScene && landmarksVisible && !blockingOverlayOpen && !!currentId, sceneChanged);

            // Navigation
            var navKeyChanged = (navCfg ? navCfg.key : null) !== lastNavKey;
            lastNavKey = navCfg ? navCfg.key : null;

            if (navCfg && !!currentId) {
                var navSuppressed = isFullScreenOverlayOpen();
                var navTarget = navHidden || navSuppressed;
                if (navKeyChanged) {
                    navOpacity = navTarget ? 0 : 1;
                    navAnimFrom = navOpacity;
                    navAnimTo = navOpacity;
                    navAnimStart = nowMs();
                    lastNavTarget = navTarget;
                } else if (navTarget !== lastNavTarget) {
                    navAnimFrom = navOpacity;
                    navAnimTo = navTarget ? 0 : 1;
                    navAnimStart = nowMs();
                    lastNavTarget = navTarget;
                }
                var elapsed = nowMs() - navAnimStart;
                var t = NAV_FADE_MS > 0 ? Math.min(1, elapsed / NAV_FADE_MS) : 1;
                navOpacity = navAnimFrom + (navAnimTo - navAnimFrom) * easeOutCubic(t);
                applyNavVisual(navCfg, navOpacity, navTarget);

                if (navCfg.key !== lastPaintedNavKey || navHidden !== lastPaintedNavHidden) {
                    paintNavBtn(navCfg);
                    lastPaintedNavKey = navCfg.key;
                    lastPaintedNavHidden = navHidden;
                }

                navBtn.classList.toggle('icx-visible', !navHidden && !navSuppressed && !!currentId);
                navRevealBtn.classList.toggle('icx-visible', navHidden && !navSuppressed && !!currentId);
            } else {
                navBtn.classList.remove('icx-visible');
                navRevealBtn.classList.remove('icx-visible');
            }

            requestAnimationFrame(frameLoop);
        }

        paintLandmarksBtn();
        requestAnimationFrame(frameLoop);
    }

    function injectStyles() {
        var oldStyle = document.getElementById(STYLE_ID);
        if (oldStyle && oldStyle.parentNode) oldStyle.parentNode.removeChild(oldStyle);
        var styleEl = document.createElement('style');
        styleEl.id = STYLE_ID;
        styleEl.textContent =
            '#' + ROOT_ID + '{position:fixed;inset:0;z-index:2147483646;font-family:Arial,Helvetica,sans-serif;pointer-events:none;}' +
            '#' + ROOT_ID + '.icx-hidden{display:none;}' +
            '.icx-toggle-btn{position:fixed;display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;color:#fff;border:1px solid rgba(255,255,255,.28);border-radius:0;padding:10px 8px;font-family:inherit;font-weight:800;font-size:12.5px;letter-spacing:.04em;text-transform:uppercase;line-height:1.2;text-align:center;cursor:pointer;box-shadow:0 10px 24px rgba(0,0,0,.22);background:rgba(255,255,255,.14);-webkit-backdrop-filter:blur(14px) saturate(150%);backdrop-filter:blur(14px) saturate(150%);white-space:normal;pointer-events:none;opacity:0;transform:translateY(12px) scale(.98);transition:opacity 340ms ease, transform 340ms cubic-bezier(.22,1,.36,1), box-shadow 220ms ease, background 180ms ease;}' +
            '.icx-toggle-btn.icx-visible{opacity:1;pointer-events:auto;transform:translateY(0) scale(1);}' +
            '.icx-toggle-btn.icx-visible:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 14px 28px rgba(0,0,0,.3);background:rgba(255,255,255,.24);}' +
            '.icx-toggle-btn:active{transform:scale(.96);}' +
            '.icx-toggle-btn:focus-visible{outline:2px solid #fff;outline-offset:2px;}' +
            '.icx-landmarks-toggle{left:20px;bottom:150px;width:min(230px,calc(100vw - 70px));}' +
            '.icx-nav-toggle{left:20px;bottom:150px;width:min(230px,calc(100vw - 70px));}' +
            '.icx-nav-reveal{top:50%;left:12px;transform:translateY(-50%) translateX(-120%);width:48px;height:48px;min-height:48px;border-radius:50%;padding:0;}' +
            '.icx-nav-reveal.icx-visible{transform:translateY(-50%) translateX(0);}' +
            '.icx-nav-reveal.icx-visible:hover{transform:translateY(-50%) scale(1.08);}' +
            '.icx-toggle-btn svg{width:16px;height:16px;flex-shrink:0;}' +
            '.icx-nav-reveal svg{width:22px;height:22px;}' +
            '.icx-toggle-btn svg path,.icx-toggle-btn svg circle{stroke:#fff;}';
        document.head.appendChild(styleEl);
    }
})(this);
