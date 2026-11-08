/* global gsap -- loaded as a classic script before the modules (index.html). */
// Floating project preview for pointer devices: a screenshot card that hangs off
// the cursor over any project row with data-screenshot. It rises in on the first
// hover, leans with the pointer's speed, and wipes to the next shot from the
// direction the pointer travelled through the list (shot-stack.js).

import { readProjectCard, screenshotCards, SCREENSHOT_CARD_SELECTOR } from './project-card.js';
import { canHoverPreview, prefersReducedMotion } from './viewport.js';
import { createFollower, placeNearPointer } from './pointer-follower.js';
import { createShotStack, CLIP_FULL, CLIP_FROM_BELOW } from './shot-stack.js';

const POINTER_OFFSET = 20;
const HIDE_DELAY_MS = 60;     // bridges the hairline between two rows
const LEAN_PER_PX = 0.35;     // degrees of lean per px of travel in one frame
const LEAN_MAX = 5;

/**
 * Keeps `modal` beside the pointer. The card hangs from the corner nearest the
 * cursor and trails behind horizontal movement: hanging below the cursor it
 * swings like a pendulum, propped above it, it tips the other way.
 */
function createPlacement(modal, calm) {
    let leanSign = 1;
    let prevX = null;

    const follower = createFollower({
        ease: calm ? 1 : 0.3,
        onUpdate: (x, y) => {
            const travel = prevX === null ? 0 : x - prevX;
            prevX = x;
            const lean = calm ? 0 : gsap.utils.clamp(-LEAN_MAX, LEAN_MAX, travel * LEAN_PER_PX * leanSign);
            gsap.set(modal, { x, y, rotation: lean });
        }
    });

    return {
        place(pointer, immediate) {
            const size = { width: modal.offsetWidth, height: modal.offsetHeight };
            const viewport = { width: window.innerWidth, height: window.innerHeight };
            const { x, y } = placeNearPointer(pointer, size, viewport, POINTER_OFFSET);

            const above = y < pointer.y;
            leanSign = above ? -1 : 1;
            gsap.set(modal, { transformOrigin: `${x < pointer.x ? 'right' : 'left'} ${above ? 'bottom' : 'top'}` });

            if (immediate) {
                prevX = null;
                follower.jumpTo(x, y);
            } else {
                follower.moveTo(x, y);
            }
        },
        stop: follower.stop
    };
}

/**
 * Feeds `track` the element under the mouse as it moves and as the page scrolls
 * beneath it, and calls `hide` when the pointer or the window goes away.
 */
function listen(pointer, track, hide) {
    document.addEventListener('pointermove', (event) => {
        if (event.pointerType !== 'mouse') return;
        Object.assign(pointer, { x: event.clientX, y: event.clientY, known: true });
        track(event.target);
    }, { passive: true });

    let scrollFrame = 0;
    window.addEventListener('scroll', () => {
        if (!pointer.known || scrollFrame) return;
        scrollFrame = requestAnimationFrame(() => {
            scrollFrame = 0;
            track(document.elementFromPoint(pointer.x, pointer.y));
        });
    }, { passive: true });

    document.documentElement.addEventListener('pointerleave', () => {
        pointer.known = false;
        hide();
    });
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') hide();
    });
}

function initProjectPreview() {
    const modal = document.getElementById('project-preview');
    const cards = Array.from(screenshotCards());
    if (!modal || cards.length === 0) return;

    const card = modal.querySelector('.preview-card');
    const domain = modal.querySelector('#preview-domain');
    const calm = prefersReducedMotion();
    const placement = createPlacement(modal, calm);
    const shots = createShotStack(modal.querySelector('.preview-media'), {
        calm,
        onState: (state) => { modal.dataset.state = state; }
    });

    const pointer = { x: 0, y: 0, known: false };
    let active = null;
    let activeIndex = -1;
    let hideTimer = 0;

    const cancelHide = () => {
        clearTimeout(hideTimer);
        hideTimer = 0;
    };

    // First hover: the card rises out of the row from its bottom edge.
    const enter = () => {
        gsap.killTweensOf([modal, card]);
        gsap.fromTo(modal, { autoAlpha: 0, scale: 1 }, { autoAlpha: 1, duration: calm ? 0.15 : 0.2, ease: 'power2.out' });
        if (!calm) gsap.fromTo(card, { clipPath: CLIP_FROM_BELOW }, { clipPath: CLIP_FULL, duration: 0.7, ease: 'expo.out' });
    };

    const show = (row) => {
        cancelHide();
        const index = cards.indexOf(row);
        const direction = index > activeIndex ? 1 : -1;
        // Still on screen while fading out counts as showing: wipe, don't re-rise.
        const showing = active !== null || modal.classList.contains('is-visible');
        active = row;
        activeIndex = index;

        const { title, screenshot, domain: label, href } = readProjectCard(row);
        const alt = `${title} screenshot`;
        domain.textContent = label;
        modal.classList.toggle('is-private', !href);
        modal.classList.add('is-visible');
        placement.place(pointer, !showing);

        if (showing) {
            gsap.killTweensOf(modal);
            gsap.to(modal, { autoAlpha: 1, scale: 1, duration: 0.2, ease: 'power2.out' });
            shots.wipeTo(screenshot, alt, direction);
        } else {
            enter();
            shots.reveal(screenshot, alt);
        }
    };

    const hide = () => {
        cancelHide();
        if (!active) return;
        active = null;
        activeIndex = -1;
        placement.stop();
        gsap.killTweensOf(modal);
        gsap.to(modal, {
            autoAlpha: 0,
            scale: 0.96,
            duration: 0.18,
            ease: 'power2.in',
            onComplete: () => {
                modal.classList.remove('is-visible');
                gsap.set(modal, { rotation: 0 });
                shots.reset();
            }
        });
    };

    // One hit test serves pointer movement and scrolling: while the wheel
    // carries rows under a still cursor, the preview flips through them too.
    const track = (target) => {
        const row = target?.closest?.(SCREENSHOT_CARD_SELECTOR);
        if (row && row !== active) show(row);
        else if (row) placement.place(pointer, false);
        else if (active && !hideTimer) hideTimer = setTimeout(hide, HIDE_DELAY_MS);
    };

    listen(pointer, track, hide);
}

export function initPreviewModal() {
    if (!canHoverPreview()) return;
    initProjectPreview();

    // Warm the cache so the first wipe to each shot does not wait on the network.
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
            screenshotCards().forEach((card) => {
                const { screenshot } = readProjectCard(card);
                if (!screenshot) return;
                const link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'image';
                link.href = screenshot;
                document.head.appendChild(link);
            });
        }, { timeout: 2000 });
    }
}
