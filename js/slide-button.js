import { INTERACTIVE_ELEMENTS } from './modules/interactive.js';
import { snapCursorTo } from './modules/cursor.js';

/* SlideToConfirm — vanilla port of the panel block.
   Props (all optional, data attributes, clamped):
     data-width  — track length, 220..380px (default 280)
     data-corner — corner radius, 0..28px (default 28)
     data-speed  — takeover speed on release, 0..100 (default 50)
   Drag: the handle follows the pointer exactly (gsap.set, no lag tween);
   the grab offset is taken at the FIRST MOVE, never on press, so pressing
   away from the handle never teleports it.
   Commit: a MORPH — handle width + offset tween together with the same
   ease, the right edge stays ~stationary and the handle opens out behind
   itself to fill the track. Width is animated, never scale (a scale would
   drag the corner radius with it). */

export function initSlideButton() {
    const DEFAULTS = { width: 280, corner: 28, speed: 50 };
    const LIMITS = { width: [220, 380], corner: [0, 28], speed: [0, 100] };
    const THRESHOLD = 0.9;
    const PAD = 4;
    const TRACK_H = 56;
    const GRIP = TRACK_H - PAD * 2;
    const DONE_HOLD = 900;

    const clampNum = (raw, [lo, hi], fallback) => {
        const n = Number(raw);
        if (!Number.isFinite(n)) return fallback;
        return Math.min(hi, Math.max(lo, n));
    };

    const entryScreen = document.getElementById('entry-screen');
    const container = document.getElementById('slide-container');
    const track = document.getElementById('slide-track');
    const fill = document.getElementById('slide-fill');
    const handle = document.getElementById('slide-handle');
    const label = document.getElementById('slide-label');

    if (!entryScreen || !container || !track || !handle) {
        console.error('Slide button elements not found');
        document.body.classList.remove('entry-active');
        return;
    }

    // Skip entry screen if already completed this session
    if (sessionStorage.getItem('entryCompleted')) {
        entryScreen.classList.add('hidden');
        document.body.classList.remove('entry-active');
        window.dispatchEvent(new Event('entryCompleted'));
        return;
    }

    if (!entryScreen.classList.contains('hidden')) {
        document.body.classList.add('entry-active');
    } else {
        document.body.classList.remove('entry-active');
    }

    if (typeof gsap === 'undefined') {
        console.error('GSAP not loaded');
        document.body.classList.remove('entry-active');
        return;
    }

    const cfg = {
        width: clampNum(container.dataset.width, LIMITS.width, DEFAULTS.width),
        corner: clampNum(container.dataset.corner, LIMITS.corner, DEFAULTS.corner),
        speed: clampNum(container.dataset.speed, LIMITS.speed, DEFAULTS.speed),
    };
    container.style.setProperty('--stc-w', `${cfg.width}px`);
    container.style.setProperty('--stc-r', `${cfg.corner}px`);
    // Concentric corners: the nested handle keeps outer radius minus the gap.
    container.style.setProperty('--stc-handle-r', `${Math.max(0, cfg.corner - PAD)}px`);

    const reduceMotion = () =>
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // speed 0 -> slow takeover, 100 -> instant; 50 lands at ~0.33s.
    const releaseDuration = () => 0.55 - (cfg.speed / 100) * 0.43;

    // Measured live so the CSS max-width fallback on narrow screens stays exact.
    const trackWidth = () => track.clientWidth;
    const travel = () => Math.max(0, trackWidth() - GRIP - PAD * 2);
    const fullWidth = () => Math.max(GRIP, trackWidth() - PAD * 2);

    // left = handle offset inside the track (PAD = rest), w = handle width.
    const geom = { left: PAD, w: GRIP };
    let pressing = false;
    let activePointer = null;
    let grab = null;
    let done = false;

    const progress = () => {
        const t = travel();
        return t > 0 ? (geom.left - PAD) / t : 0;
    };
    function render() {
        gsap.set(handle, { x: geom.left - PAD, width: geom.w });
        // The fill trails the grip like a loading bar: it stretches from the
        // track's left edge to the grip's right edge, so at rest it sits
        // exactly under the grip and the union reads as one pill.
        if (fill) gsap.set(fill, { width: (geom.left - PAD) + geom.w });
        const p = progress();
        handle.setAttribute('aria-valuenow', String(Math.round(p * 100)));
        // The label lives inside the track under the fill: it fades as the
        // fill slides over it, and stays gone once the morph commits.
        if (label) label.style.opacity = done ? '0' : String(Math.max(0, 1 - p * 1.6));
        // The arrow dissolves into the fill across the second half of the
        // drag (progress 0.5 -> 1), so by commit time the handle is blank
        // and the check can fly in clean.
        const arrow = handle.querySelector('.slide-button-icon--arrow');
        if (arrow && !done) arrow.style.opacity = String(Math.max(0, 1 - (p - 0.5) * 2));
    }

    // Track-local pointer position, centered on the grip.
    function local(clientX) {
        const rect = track.getBoundingClientRect();
        return clientX - rect.left - PAD - GRIP / 2;
    }
    function onDown(e) {
        if (done || pressing) return;
        pressing = true;
        activePointer = e.pointerId ?? 'mouse';
        // The offset is taken at the FIRST MOVE, never here.
        grab = null;
        gsap.killTweensOf(geom);
        document.body.classList.add('slider-dragging');
        snapCursorTo(e.clientX, e.clientY);
        try {
            container.setPointerCapture(e.pointerId);
        } catch (err) { /* mouse or already released */ }
        e.preventDefault();
    }
    function onMove(e) {
        if (!pressing || done) return;
        if (activePointer !== null && e.pointerId !== undefined && e.pointerId !== activePointer) return;
        // Pointer capture + preventDefault on down suppress the compat
        // mousemove, so the eased cursor would freeze — drive it directly.
        snapCursorTo(e.clientX, e.clientY);
        const at = local(e.clientX);
        if (grab === null) {
            grab = at - (geom.left - PAD);
            return;
        }
        geom.left = PAD + Math.min(travel(), Math.max(0, at - grab));
        geom.w = GRIP;
        render();
    }

    function onUp(e) {
        if (!pressing) return;
        if (e && e.pointerId !== undefined && activePointer !== null && e.pointerId !== activePointer) return;
        pressing = false;
        activePointer = null;
        grab = null;
        document.body.classList.remove('slider-dragging');
        refreshCursorHover();
        if (done) return;
        if (progress() >= THRESHOLD) commit();
        else snapBack();
    }

    function refreshCursorHover() {
        // Give the natural mouseout a tick to fire first.
        setTimeout(() => {
            const cursor = document.querySelector('.custom-cursor');
            if (!cursor) return;
            const hovered = document.querySelectorAll(':hover');
            const selector = INTERACTIVE_ELEMENTS;
            let over = false;
            hovered.forEach((el) => {
                if (el.matches(selector) || el.closest(selector)) over = true;
            });
            if (!over) cursor.classList.remove('cursor-hover');
        }, 0);
    }

    function snapBack() {
        gsap.killTweensOf(geom);
        if (fill) gsap.killTweensOf(fill);
        if (reduceMotion()) {
            geom.left = PAD;
            geom.w = GRIP;
            render();
            return;
        }
        gsap.to(geom, {
            left: PAD,
            duration: releaseDuration(),
            ease: 'power3.out',
            overwrite: true,
            onUpdate: render,
        });
    }

    function commit() {
        done = true;
        gsap.killTweensOf(geom);
        if (fill) gsap.killTweensOf(fill);
        container.classList.add('is-done');
        handle.setAttribute('aria-valuenow', '100');
        if (label) label.style.opacity = '0';
        const arrow = handle.querySelector('.slide-button-icon--arrow');
        if (arrow) arrow.style.opacity = '0';
        if (reduceMotion()) {
            geom.left = PAD;
            geom.w = fullWidth();
            render();
            finishEntry();
            return;
        }
        // MORPH, not a hand-over: offset + width move together by the same
        // tween, so the right edge is ~stationary and the handle opens out
        // behind itself to fill the track it crossed. The fill is already
        // at the grip's right edge from the drag — it only stretches the
        // last few px to the full width, so the union keeps reading as one
        // pill through the whole takeover.
        const fillState = fill ? { w: fill.clientWidth } : null;
        gsap.to(geom, {
            left: PAD,
            w: fullWidth(),
            duration: releaseDuration() + 0.15,
            ease: 'expo.out',
            overwrite: true,
            onUpdate: render,
            onComplete: () => setTimeout(finishEntry, DONE_HOLD),
        });
        if (fill && fillState) {
            gsap.to(fillState, {
                w: fullWidth(),
                duration: releaseDuration() + 0.15,
                ease: 'expo.out',
                overwrite: true,
                onUpdate: () => gsap.set(fill, { width: fillState.w }),
            });
        }
    }

    function finishEntry() {
        entryScreen.classList.add('hidden');
        document.body.classList.remove('entry-active');
        try {
            sessionStorage.setItem('entryCompleted', '1');
        } catch (err) { /* private mode */ }
        window.dispatchEvent(new Event('entryCompleted'));
        if (typeof ScrollTrigger !== 'undefined') {
            setTimeout(() => {
                ScrollTrigger.refresh();
            }, 100);
        }
    }

    // Keyboard path: Enter/Space drives the handle across, then commits.
    function activateViaKeyboard() {
        if (done) return;
        gsap.killTweensOf(geom);
        if (reduceMotion()) {
            commit();
            return;
        }
        gsap.to(geom, {
            left: PAD + travel(),
            duration: 0.45,
            ease: 'power2.out',
            overwrite: true,
            onUpdate: render,
            onComplete: commit,
        });
    }

    function nudge(delta) {
        if (done) return;
        gsap.killTweensOf(geom);
        geom.left = PAD + Math.min(travel(), Math.max(0, geom.left - PAD + delta));
        geom.w = GRIP;
        render();
        if (progress() >= THRESHOLD) commit();
    }

    container.addEventListener('pointerdown', onDown);
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerup', onUp);
    container.addEventListener('pointercancel', onUp);

    handle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            activateViaKeyboard();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            nudge(12);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            nudge(-12);
        }
    });

    window.addEventListener('resize', () => {
        if (done) return;
        gsap.killTweensOf(geom);
        geom.left = PAD;
        geom.w = GRIP;
        render();
    });

    render();

    // Land keyboard focus on the handle so it's reachable without a pointer
    try {
        handle.focus({ preventScroll: true });
    } catch (err) {
        handle.focus();
    }
}
