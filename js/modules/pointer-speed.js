// How fast the pointer is travelling, for telling a pass-through from a look.
// Positions are page coordinates, so content scrolling under a still pointer
// counts as travel too.

const SMOOTHING_MS = 40; // time constant of the running average
const PAUSE_MS = 100; // a gap this long starts the measurement over

/**
 * Returns `sample(event)`: feed it every pointer event of interest and it
 * answers the smoothed speed, in px/ms, as of that event.
 */
export function createPointerSpeed() {
    let last = null;
    let speed = 0;

    return ({ pageX, pageY, timeStamp }) => {
        const elapsed = last ? timeStamp - last.timeStamp : Infinity;
        if (elapsed > PAUSE_MS) {
            speed = 0;
        } else if (elapsed > 0) {
            const instant = Math.hypot(pageX - last.pageX, pageY - last.pageY) / elapsed;
            speed += (instant - speed) * (1 - Math.exp(-elapsed / SMOOTHING_MS));
        }
        last = { pageX, pageY, timeStamp };
        return speed;
    };
}
