/* global gsap -- loaded as a classic script before the modules (index.html). */
// Desktop stage beside the works list. Hovering or focusing a row puts that
// project on the stage: its screenshot wipes in (shot-stack.js) inside one
// fixed frame, fitted whole, with a blurred glow of itself filling the margins;
// a project without a screenshot shows its name there instead. The list stays
// the content - the stage only repeats it - so it is hidden from assistive tech
// and left out of the tab order. Touch screens never get it; works-reel.js
// shows their screenshots inline instead.

import { projectCards, readProjectCard } from './project-card.js';
import { canHoverPreview, prefersReducedMotion } from './viewport.js';
import { createShotStack } from './shot-stack.js';

const SWAP_IN = { autoAlpha: 1, filter: 'blur(0px)', duration: 0.35, ease: 'sine.out', clearProps: 'filter', overwrite: true, lazy: false };
const SWAP_FROM = { autoAlpha: 0, filter: 'blur(4px)' };

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

function statusLine({ status, when, href, domain }) {
    const dot = Object.assign(document.createElement('span'), { className: `status status--${status.kind}`, textContent: status.label });
    const year = Object.assign(document.createElement('span'), { textContent: when });
    if (!href) return [dot, year];
    return [dot, year, Object.assign(document.createElement('span'), { className: 'project-stage__domain', textContent: `${domain} ↗` })];
}

export function initProjectStage() {
    const stage = document.getElementById('project-stage');
    const cards = Array.from(projectCards());
    if (!stage || !cards.length || !canHoverPreview()) return;

    const calm = prefersReducedMotion();
    const section = stage.closest('.projects');
    const poster = stage.querySelector('.project-stage__poster');
    const posterName = poster.firstElementChild;
    const info = stage.querySelector('.project-stage__info');
    const title = info.querySelector('.project-stage__title');
    const desc = info.querySelector('.project-stage__desc');
    const tags = info.querySelector('.project-tags');
    const meta = info.querySelector('.project-stage__meta');
    const projects = cards.map((card) => readProjectCard(card));

    projects.forEach((p) => p.screenshot && glowFor(p.screenshot));
    let current = -1;
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

    const show = (index) => {
        if (index === current) return;
        const direction = index > current ? 1 : -1;
        cards[current]?.classList.remove('is-current');
        cards[index].classList.add('is-current');
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

        if (project.href) stage.href = project.href;
        else stage.removeAttribute('href');
        title.textContent = project.title;
        desc.textContent = project.description;
        tags.replaceChildren(...tagChips(project.tags));
        meta.replaceChildren(...statusLine(project));
        if (!calm) gsap.fromTo(info, SWAP_FROM, SWAP_IN);
    };

    cards.forEach((card, index) => {
        card.addEventListener('pointerenter', () => show(index));
        card.addEventListener('focus', () => show(index));
    });

    stage.hidden = false;
    section.classList.add('has-stage');
    show(0);
}
