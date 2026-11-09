// The "Selected Works" cards are plain markup: an <a class="project-card"> (or
// a bare <article> when the project is private) carrying data-screenshot, an
// <h3>, a <p>, some .project-tag chips and a .project-meta line (status, then
// year and role). Two consumers need that data - the desktop stage and the
// mobile reel - so the markup contract is read here once instead of being
// re-scraped in each of them.

const PRIVATE_LABEL = 'Private project';
const FALLBACK_TITLE = 'Project';
const FALLBACK_DESCRIPTION = 'No short description provided.';

// Cards with a screenshot to show, inside the projects section.
const SCREENSHOT_CARD_SELECTOR = '.projects .project-card[data-screenshot]';

const text = (el, fallback = '') => el?.textContent?.trim() || fallback;

/**
 * Human-readable source label for a card: its bare hostname when the card links
 * out, the raw href for non-http links, and a placeholder for cards that are
 * plain <article> elements with nowhere to go.
 */
export function getProjectDomain(card) {
    const href = cardHref(card);
    if (!href) return PRIVATE_LABEL;
    if (!/^https?:\/\//i.test(href)) return href;

    try {
        return new URL(href).hostname.replace(/^www\./, '');
    } catch {
        return href;
    }
}

/** The card's outgoing link, or '' for cards that aren't anchors. */
export function cardHref(card) {
    return card.tagName.toLowerCase() === 'a' ? card.getAttribute('href') || '' : '';
}

/**
 * Everything the consumers need from one card, with the fallbacks applied.
 * `tags` can be capped for a consumer with room for only a few chips.
 * `status` is the dot's kind (active, wip, oss, archived) and its label;
 * `when` the year and role as written, e.g. "2026 · Client".
 */
export function readProjectCard(card, { maxTags = Infinity } = {}) {
    const status = card.querySelector('.status');
    return {
        title: text(card.querySelector('h3'), FALLBACK_TITLE),
        description: text(card.querySelector('p'), FALLBACK_DESCRIPTION),
        screenshot: card.getAttribute('data-screenshot') || '',
        domain: getProjectDomain(card),
        href: cardHref(card),
        tags: Array.from(card.querySelectorAll('.project-tag'))
            .slice(0, maxTags)
            .map(tag => text(tag)),
        status: {
            kind: status?.className.match(/status--(\w+)/)?.[1] ?? 'archived',
            label: text(status)
        },
        when: text(card.querySelector('.project-meta > span:last-child'))
    };
}

/** Every card in the projects list that has a screenshot to show. */
export function screenshotCards() {
    return document.querySelectorAll(SCREENSHOT_CARD_SELECTOR);
}

/** Every card in the projects list, in page order. */
export function projectCards() {
    return document.querySelectorAll('.projects .project-card');
}
