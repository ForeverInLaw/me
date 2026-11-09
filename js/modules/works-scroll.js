/* global gsap, ScrollTrigger -- loaded as a classic script before the modules (index.html). */
// How the works column hands over on scroll. "Selected works" and the sheet
// after it are a screen each. As the sheet comes up the screen, "The grind"
// on it lights up (grind-reveal.js); on desktop the works are pinned under it
// meanwhile and fall out of focus. The layout and the looks are CSS
// (works-scroll.css): this module only measures and feeds it the progress.

import { prefersReducedMotion } from './viewport.js';
import { stageGrind } from './grind-reveal.js';

// How long the works take to catch up with the scroll position, in seconds:
// enough to round off the steps of a mouse wheel.
const SCRUB_LAG = 0.4;

/** Call once "The grind" has rendered, so there is something to stage. */
export function initWorksScroll() {
    const works = document.querySelector('.works');
    const projects = works?.querySelector('.projects');
    const sheet = works?.querySelector('.works__sheet');
    if (!projects || !sheet || prefersReducedMotion()) return;

    // The pin needs the section's height to hold a list taller than the
    // window by its last row rather than its first. Measured now as well as
    // observed: the pin must not wait for the observer's first frame.
    const measure = () => works.style.setProperty('--projects-h', `${projects.offsetHeight}px`);
    works.classList.add('has-sheet');
    measure();
    new ResizeObserver(measure).observe(projects);

    const arrive = stageGrind(sheet.querySelector('.grind'));
    const sheetTop = () => sheet.getBoundingClientRect().top + window.scrollY;

    const markReceding = (tween) => {
        const progress = tween.progress();
        projects.classList.toggle('is-receding', progress > 0);
        projects.classList.toggle('is-covered', progress === 1);
    };

    const recede = gsap.fromTo(projects, { '--recede': 0 }, {
        '--recede': 1,
        ease: 'none',
        onUpdate() {
            markReceding(this);
        },
        scrollTrigger: {
            trigger: sheet,
            // From the sheet's top edge entering the screen to it reaching the
            // top, or to the end of the page where that comes first.
            start: 'top bottom',
            end: () => Math.min(sheetTop(), ScrollTrigger.maxScroll(window)),
            scrub: SCRUB_LAG,
            onUpdate: (self) => arrive(self.progress)
        }
    });
    // ScrollTrigger runs a new tween to its end and back to record it, which
    // leaves the marks of the end behind; set them for where it really is.
    markReceding(recede);
}
