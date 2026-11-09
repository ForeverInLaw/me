// The motion tokens of variables.css, for the few motions JS has to time or
// run itself. Read where they are used, so they cannot drift from the CSS.

/** A token as it is written: an easing, say. */
export const motionToken = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** A duration token, in milliseconds. */
export const motionMs = (name) => parseFloat(motionToken(name)) || 0;
