/* global gsap, ScrollTrigger -- loaded as a classic script before the modules (index.html). */
// How the works column hands over on scroll. "Selected works" and the sheet
// after it are a screen each. As the sheet comes up the screen, the charts of
// "The grind" on it draw themselves (grind-reveal.js); on desktop the works are
// pinned under it meanwhile and fall out of focus. The layout and the looks
// are CSS (works-scroll.css): this module only measures and feeds it the
// progress.

import { prefersReducedMotion } from './viewport.js';
import { stageGrind } from './grind-reveal.js';

// How long the works take to catch up with the scroll position, in seconds:
// enough to round off the steps of a mouse wheel.
const SCRUB_LAG = 0.4;

/**
 * Fired on the works section when it is back in full from under the sheet.
 * Receding, it was out of the pointer's reach (works-scroll.css), so whatever
 * follows the pointer over it has to look again at where the pointer is.
 */
export const WORKS_BACK_EVENT = 'works:back';

/** Call once "The grind" has rendered, so there is something to stage. */
export function initWorksScroll() {
    const works = document.querySelector('.works');
    const projects = works?.querySelector('.projects');
    const sheet = works?.querySelector('.works__sheet');
    if (!projects || !sheet || prefersReducedMotion()) return;

    // Staged before anything below measures the page, so the section is laid
    // out once, as staged, rather than once each way.
    stageGrind(sheet.querySelector('.grind'));

    // The pin needs the section's height to hold a list taller than the
    // window by its last row rather than its first. Measured now as well as
    // observed: the pin must not wait for the observer's first frame.
    const measure = () => projects.style.setProperty('--projects-h', `${projects.offsetHeight}px`);
    works.classList.add('has-sheet');
    measure();
    new ResizeObserver(measure).observe(projects);

    const sheetTop = () => sheet.getBoundingClientRect().top + window.scrollY;

    // How far the works have receded, 0 to 1. The tween writes it here rather
    // than to the element, so the marks are set by the same write as the
    // value. ScrollTrigger runs a tween to its end and back to record it, when
    // it is made and again on the first scroll, and the way back fires no
    // onUpdate: marks set from there stay at "covered" and hide the works for
    // a frame.
    let recede = 0;
    // The marks sit out the first of those runs: following it, they would have
    // the page measured and laid out again with the works blurred and hidden.
    let recorded = false;
    const markReceding = () => {
        const wasReceding = projects.classList.contains('is-receding');
        projects.classList.toggle('is-receding', recede > 0);
        projects.classList.toggle('is-covered', recede === 1);
        if (wasReceding && recede === 0) projects.dispatchEvent(new CustomEvent(WORKS_BACK_EVENT));
    };
    const scene = {
        get recede() {
            return recede;
        },
        set recede(value) {
            recede = value;
            projects.style.setProperty('--recede', String(value));
            if (recorded) markReceding();
        }
    };

    gsap.fromTo(scene, { recede: 0 }, {
        recede: 1,
        ease: 'none',
        scrollTrigger: {
            trigger: sheet,
            // From the sheet's top edge entering the screen to it reaching the
            // top, or to the end of the page where that comes first.
            start: 'top bottom',
            end: () => Math.min(sheetTop(), ScrollTrigger.maxScroll(window)),
            scrub: SCRUB_LAG
        }
    });
    recorded = true;
    markReceding();
}
