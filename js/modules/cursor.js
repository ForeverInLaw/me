import { hasFinePointer } from './viewport.js';
import { createFollower } from './pointer-follower.js';
import { INTERACTIVE_ELEMENTS } from './interactive.js';

let activeFollower = null;

/* Jump the cursor dot straight to (x, y). The slider calls this on
   down/move: with pointer capture + preventDefault on pointerdown the
   compat mousemove is suppressed, so easing toward a stale target would
   leave the dot frozen mid-drag. */
export function snapCursorTo(x, y) {
    activeFollower?.jumpTo(x, y);
}
export function initCursor() {
    if (!hasFinePointer()) return;

    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    document.body.appendChild(cursor);
    // Only now hide the native cursor - no-JS / failed-init users keep a real pointer
    document.body.classList.add('has-custom-cursor');

    const follower = createFollower({
        onUpdate: (x, y) => {
            cursor.style.setProperty('--cursor-x', `${x}px`);
            cursor.style.setProperty('--cursor-y', `${y}px`);
        }
    });
    activeFollower = follower;

    let hasMovedMouse = false;

    function onPointerMove(e) {
        if (!hasMovedMouse) {
            hasMovedMouse = true;
            cursor.classList.add('has-moved');
            follower.jumpTo(e.clientX, e.clientY);
            return;
        }
        follower.moveTo(e.clientX, e.clientY);
    }

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('pointermove', onPointerMove);

    document.addEventListener('mouseover', (e) => {
        if (e.target.closest(INTERACTIVE_ELEMENTS)) {
            cursor.classList.add('cursor-hover');
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (document.body.classList.contains('slider-dragging')) return;
        if (e.target.closest(INTERACTIVE_ELEMENTS)) {
            cursor.classList.remove('cursor-hover');
        }
    });
}
