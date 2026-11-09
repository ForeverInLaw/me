// Tells a look from a pass-through as the pointer moves over a set of rows, so
// a consumer can keep its full response for the rows the pointer means and
// answer the ones it merely crosses with something lighter.

import { createPointerSpeed } from './pointer-speed.js';

// Entering a row faster than this (px/ms) starts a run; the run ends on the
// row the pointer then stays on for SETTLE_MS. The two belong together: at
// RUN_SPEED a row some 40px tall is crossed in about SETTLE_MS, so anything
// slower would have come to rest on every row anyway.
const RUN_SPEED = 0.3;
const SETTLE_MS = 120;

/**
 * Watches `rows`. Pointer speed is measured across `area`, an element around
 * them, so a pointer arriving from outside the rows is already known to be
 * running.
 *
 * - `onLook(index)`: the row was entered slowly, took focus, or is where a
 *   run came to rest.
 * - `onPass(index)`: a run is crossing the row.
 * - `onAbandon()`: a run left the rows without coming to rest on one.
 */
export function watchRowIntent(rows, { area, onLook, onPass, onAbandon }) {
    const speedAt = createPointerSpeed();
    let running = false;
    let settleTimer = 0;

    // Ends the run, if any, with `outcome`.
    const rest = (outcome, index) => {
        clearTimeout(settleTimer);
        running = false;
        outcome(index);
    };

    const settleWith = (outcome, index) => {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(rest, SETTLE_MS, outcome, index);
    };

    area.addEventListener('pointermove', speedAt, { passive: true });

    rows.forEach((row, index) => {
        // Once running, only staying on a row ends it: a pointer slowing as
        // it crosses rows would otherwise flip between the two answers.
        row.addEventListener('pointerenter', (event) => {
            if (speedAt(event) <= RUN_SPEED && !running) return rest(onLook, index);
            running = true;
            settleWith(onLook, index);
            onPass(index);
        });
        // Unless the next row picks the run up, it has left the rows.
        row.addEventListener('pointerleave', () => running && settleWith(onAbandon));
        row.addEventListener('focus', () => rest(onLook, index));
    });
}
