import { invalidateMasonry } from './masonry.js';
import { isCompact, prefersReducedMotion } from './viewport.js';

/* global gsap, ScrollTrigger -- loaded as globals by libs/gsap/gsap-bundle.min.js */

// Off-screen section headers that reveal on scroll. The intro timeline
// already animates the two above-fold titles, so they are deliberately
// excluded. The Grind header is taken as a whole wrapper so the subtitle
// travels with its title instead of sitting beside a moving heading.
const SCROLL_HEADERS_SELECTOR =
    '.playlists-section .section-title, .section-header-wrapper';

/**
 * Reveals the given header elements, using the same vocabulary as the intro
 * titles (fade + rise, no blur - blur is reserved for cards). `immediate`
 * skips the tween and just drops them in visible - the reduced-motion path.
 */
function revealHeaders(elements, immediate = false) {
    if (elements.length === 0) return;
    if (immediate) {
        gsap.set(elements, { autoAlpha: 1, y: 0 });
        return;
    }
    gsap.to(elements, {
        autoAlpha: 1,
        y: 0,
        duration: 0.45,
        ease: 'power3.out',
        overwrite: 'auto',
        onComplete: () => gsap.set(elements, { clearProps: 'transform' })
    });
}

export function initScrollAnimations() {
    const projectCards = document.querySelectorAll('.project-card');
    const scrollRevealSelector = '.project-card:not([data-entry-revealed="true"])';
    const scrollRevealCards = document.querySelectorAll(scrollRevealSelector);
    const scrollHeaders = document.querySelectorAll(SCROLL_HEADERS_SELECTOR);
    const projectsRow = document.querySelector('.projects-row');

    if (prefersReducedMotion()) {
        gsap.set(scrollRevealCards, { autoAlpha: 1, y: 0, filter: 'none' });
        scrollRevealCards.forEach(el => { el.dataset.revealed = 'true'; });
        revealHeaders(scrollHeaders, true);
        if (projectsRow) projectsRow.classList.add('is-interactive');
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
        return;
    }

    gsap.set(scrollRevealCards, {
        autoAlpha: 0,
        y: 26,
        filter: 'blur(8px)'
    });
    gsap.set(scrollHeaders, {
        autoAlpha: 0,
        y: 20
    });

    const isMobile = isCompact();
    const startPosition = isMobile ? 'top 105%' : 'top 90%';

    let revealedCount = projectCards.length - scrollRevealCards.length;

    function markInteractiveIfDone() {
        if (!projectsRow || projectCards.length === 0) return;
        if (revealedCount >= projectCards.length) {
            projectsRow.classList.add('is-interactive');
        }
    }

    if (scrollRevealCards.length > 0) {
        ScrollTrigger.batch(scrollRevealSelector, {
            start: startPosition,
            once: true,
            onEnter: (batch) => gsap.to(batch, {
                duration: 0.6,
                autoAlpha: 1,
                y: 0,
                filter: 'blur(0px)',
                stagger: 0.08,
                ease: 'power3.out',
                overwrite: 'auto'
            }).then(() => {
                batch.forEach(el => {
                    gsap.set(el, { clearProps: 'transform,filter' });
                    if (!el.dataset.revealed) {
                        el.dataset.revealed = 'true';
                        revealedCount += 1;
                    }
                });
                markInteractiveIfDone();
                invalidateMasonry();
            })
        });
    }

    if (scrollHeaders.length > 0) {
        ScrollTrigger.batch(scrollHeaders, {
            start: 'top 92%',
            once: true,
            onEnter: (batch) => revealHeaders(batch)
        });
    }

    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => markInteractiveIfDone());
    } else {
        setTimeout(markInteractiveIfDone, 500);
    }

    window.addEventListener('pagehide', (event) => {
        if (event.persisted) return;
        ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    });
}
