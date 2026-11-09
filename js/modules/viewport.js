// One home for the responsive contract the JS shares with the stylesheets.
//
// Everything here goes through matchMedia rather than window.innerWidth. The
// two disagree by the width of the scrollbar, so a module reading one could
// land on the other side of a breakpoint than the CSS that styles it.

const COMPACT_QUERY = '(max-width: 768px)';

// The mobile screenshot reel only makes sense where there is no hover to drive
// the desktop stage instead.
const TOUCH_REEL_QUERY = `${COMPACT_QUERY} and (hover: none)`;

const HOVER_PREVIEW_QUERY = '(hover: hover) and (pointer: fine)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const matches = (query) => window.matchMedia(query).matches;

/** Small screen with no hover - the inline screenshot reel applies. */
export const isTouchReel = () => matches(TOUCH_REEL_QUERY);

/** A real pointer that can hover: the project stage and playlist window apply. */
export const canHoverPreview = () => matches(HOVER_PREVIEW_QUERY);

export const prefersReducedMotion = () => matches(REDUCED_MOTION_QUERY);

