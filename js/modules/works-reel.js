import { getProjectDomain } from './project-card.js';

// The desktop hover preview (preview-modal.js) is inert on touch, so the project
// screenshots never reached mobile at all. Here every card that has one carries
// it inline in a browser frame: the card crossing the middle of the viewport
// lights its shot up, the rest stay dimmed. Scroll is the only input, so the
// card can stay a plain <a> and tapping still just opens the project.

const REEL_QUERY = '(max-width: 768px) and (hover: none)';

// A card counts as focused only while it crosses the middle 10% of the viewport,
// which keeps exactly one shot lit at a time.
const FOCUS_BAND = '-45% 0px -45% 0px';

const FRAME_TEMPLATE = `
    <div class="project-shot__bar">
        <span></span><span></span><span></span>
        <em class="project-shot__domain"></em>
    </div>
    <img alt="" loading="lazy" decoding="async">`;

// Returns false when the card has no usable screenshot, so the caller can skip
// observing a card that would never have anything to reveal.
function mountShot(card) {
    const src = card.getAttribute('data-screenshot');
    if (!src) return false;

    const title = card.querySelector('h3')?.textContent?.trim() || 'Project';
    const shot = document.createElement('div');
    shot.className = 'project-shot';
    shot.innerHTML = FRAME_TEMPLATE;
    shot.querySelector('.project-shot__domain').textContent = getProjectDomain(card);

    const image = shot.querySelector('img');
    image.src = src;
    image.alt = `${title} screenshot`;

    card.appendChild(shot);
    return true;
}

export function initWorksReel() {
    // Bound to the same breakpoint that turns masonry off (masonry.js), so the
    // reel never fights absolutely-positioned cards on a wide touch screen.
    if (!window.matchMedia(REEL_QUERY).matches) return;

    const cards = document.querySelectorAll('.projects .project-card[data-screenshot]');
    if (!cards.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            entry.target.classList.toggle('is-focus', entry.isIntersecting);
        });
    }, { rootMargin: FOCUS_BAND });

    cards.forEach((card) => {
        if (mountShot(card)) observer.observe(card);
    });
}
