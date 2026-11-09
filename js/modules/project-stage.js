/* global gsap -- loaded as a classic script before the modules (index.html). */
// Desktop stage beside the works list. Hovering or focusing a row puts that
// project on the stage: its screenshot wipes in (shot-stack.js) inside one
// fixed frame, fitted whole, with a blurred glow of itself filling the margins;
// a project without a screenshot shows its name there instead.
//
// A pointer running down the list is only passing through, so the stage does
// not follow it row by row: it holds the project it has and drifts out of
// focus the longer the run lasts, then wipes to the row the run ended on as
// it sharpens again - the last row crossed, even when the pointer went on off
// the list. A quick hop to a nearby row is over before the drift shows.
//
// The list stays the content - the stage only repeats it - so it is hidden
// from assistive tech and left out of the tab order. Touch screens never get
// it; works-reel.js shows their screenshots inline instead.

import { projectCards, readProjectCard } from './project-card.js';
import { canHoverPreview, prefersReducedMotion } from './viewport.js';
import { createShotStack } from './shot-stack.js';
import { watchRowIntent } from './row-intent.js';

const SWAP_IN = { autoAlpha: 1, filter: 'blur(0px)', duration: 0.35, ease: 'sine.out', clearProps: 'filter', overwrite: true, lazy: false };
const SWAP_FROM = { autoAlpha: 0, filter: 'blur(4px)' };
// The text's share of the drift out of focus; the frame's is in
// project-stage.css, on the same clock.
const SKIM_BLUR = { autoAlpha: 0.45, filter: 'blur(3px)', duration: 0.52, delay: 0.08, ease: 'sine.inOut', overwrite: true };

const glows = new Map();

/**
 * The ambient glow for a screenshot, as a data URL: drawn once into a tiny
 * canvas, blurred and dimmed, and stretched under the shot to fill its margins.
 * It is drawn past the canvas edges so the blur does not fade out there.
 */
function glowFor(src) {
    if (!glows.has(src)) {
        const img = new Image();
        img.src = src;
        glows.set(src, img.decode().then(() => {
            const canvas = Object.assign(document.createElement('canvas'), { width: 64, height: 36 });
            const ctx = canvas.getContext('2d');
            ctx.filter = 'blur(3px) saturate(1.4) brightness(0.55)';
            ctx.drawImage(img, -8, -6, 80, 48);
            return canvas.toDataURL();
        }).catch(() => ''));
    }
    return glows.get(src);
}

/**
 * Sets `name` in the poster at the largest size its longest word still fits
 * the frame at, so a long single word shrinks rather than runs off the edge.
 */
function fitPosterName(poster, name, text) {
    name.style.fontSize = '';
    name.style.whiteSpace = 'nowrap';
    const room = poster.clientWidth - parseFloat(getComputedStyle(poster).paddingLeft) * 2;
    const widest = Math.max(...text.split(/\s+/).map((word) => {
        name.textContent = word;
        return name.getBoundingClientRect().width;
    }));
    name.style.whiteSpace = '';
    name.textContent = text;
    if (widest > room) name.style.fontSize = `${parseFloat(getComputedStyle(name).fontSize) * room / widest}px`;
}

const tagChips = (tags) => tags.map((tag) => Object.assign(document.createElement('span'), { className: 'project-tag', textContent: tag }));

/** The stage's bottom row: where the project lives, then its status and year. */
function footLine({ status, when, href, domain }) {
    const place = Object.assign(document.createElement('span'), { className: 'project-stage__domain', textContent: href ? `${domain} ↗` : domain });
    const dot = Object.assign(document.createElement('span'), { className: `status status--${status.kind}`, textContent: status.label });
    const year = Object.assign(document.createElement('span'), { textContent: when });
    return [place, dot, year];
}

/** Writes `project` into the stage's link, the text under its frame and its bottom row. */
function writeInfo(stage, project) {
    if (project.href) stage.href = project.href;
    else stage.removeAttribute('href');
    stage.querySelector('.project-stage__title').textContent = project.title;
    stage.querySelector('.project-stage__desc').textContent = project.description;
    stage.querySelector('.project-tags').replaceChildren(...tagChips(project.tags));
    stage.querySelector('.project-stage__meta').replaceChildren(...footLine(project));
}

/**
 * The stage for `cards`: `show(index)` puts a project on it, `skim(index)`
 * marks a row the pointer is running over while the stage drifts out of
 * focus.
 */
function createStage(stage, cards, calm) {
    const poster = stage.querySelector('.project-stage__poster');
    const posterName = poster.firstElementChild;
    // Everything that is words: it swaps and goes out of focus as one.
    const text = stage.querySelectorAll('.project-stage__info, .project-stage__meta');
    const projects = cards.map((card) => readProjectCard(card));

    projects.forEach((p) => p.screenshot && glowFor(p.screenshot));
    let current = -1; // the project on the stage
    let aimed = -1; // the row under the pointer or focus, which a skim runs ahead with
    let showingShot = false;

    const shots = createShotStack(stage.querySelector('.project-stage__shots'), {
        calm,
        axis: 'y',
        zoom: 1.06,
        onState: (state) => {
            stage.dataset.state = state;
            // A shot that will not load leaves the name in its place.
            if (state === 'error') fitPosterName(poster, posterName, projects[current].title);
        },
        // Each layer carries its own glow, so a wipe never shows the previous
        // shot through the margins of the next.
        onPaint: (img, src) => {
            img.style.backgroundImage = '';
            glowFor(src).then((url) => {
                if (url && img.getAttribute('src') === src) img.style.backgroundImage = `url(${url})`;
            });
        }
    });

    const aim = (index) => {
        cards[aimed]?.classList.remove('is-current');
        cards[index].classList.add('is-current');
        aimed = index;
    };

    /** Puts project `index` on the stage, back in focus after any skim. */
    const show = (index) => {
        const fromSkim = stage.classList.contains('is-skimming');
        stage.classList.remove('is-skimming');
        aim(index);

        if (index === current) {
            // A skim that came back to where it started: nothing to swap.
            if (fromSkim) gsap.to(text, SWAP_IN);
            return;
        }
        const direction = index > current ? 1 : -1;
        current = index;
        const project = projects[index];

        if (project.screenshot) {
            if (showingShot) shots.wipeTo(project.screenshot, '', direction);
            else shots.reveal(project.screenshot, '');
        } else {
            // Only a poster project renames the poster: leaving one, it fades
            // out as it was rather than flashing the next name over its shot.
            fitPosterName(poster, posterName, project.title);
            if (!calm) gsap.fromTo(posterName, SWAP_FROM, SWAP_IN);
        }
        showingShot = Boolean(project.screenshot);
        stage.classList.toggle('has-shot', showingShot);

        writeInfo(stage, project);
        // Calm, the text only has a skim's blur to come back from.
        if (calm) gsap.to(text, SWAP_IN);
        else gsap.fromTo(text, SWAP_FROM, SWAP_IN);
    };

    /** Marks row `index` as a run crosses it; the stage keeps what it has. */
    const skim = (index) => {
        aim(index);
        if (stage.classList.contains('is-skimming')) return;
        stage.classList.add('is-skimming');
        gsap.to(text, SKIM_BLUR);
    };

    return { show, skim };
}

export function initProjectStage() {
    const stage = document.getElementById('project-stage');
    const cards = Array.from(projectCards());
    if (!stage || !cards.length || !canHoverPreview()) return;

    const section = stage.closest('.projects');
    const { show, skim } = createStage(stage, cards, prefersReducedMotion());
    watchRowIntent(cards, { area: section, onLook: show, onPass: skim });

    // The stage's bottom row takes the height of one of the index's rows.
    stage.style.setProperty('--rows', String(cards.length));
    stage.hidden = false;
    section.classList.add('has-stage');
    show(0);
}
