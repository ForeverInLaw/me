/* global gsap -- loaded as a classic script before the modules (index.html). */
// The preview's picture: two stacked <img> layers, the shot on show and the one
// wiping in over it. Loads race while the pointer runs down the list, so every
// request takes a ticket and only the newest one may paint.

const CLIP_FULL = 'inset(0% 0% 0% 0%)';
const CLIP_FROM_BELOW = 'inset(100% 0% 0% 0%)';
const CLIP_FROM_ABOVE = 'inset(0% 0% 100% 0%)';
const WIPE = { duration: 0.55, ease: 'expo.out' };

/** Points `img` at `src` and resolves whether it is ready to paint. */
async function paint(img, src) {
    img.src = src;
    try {
        await img.decode();
        return true;
    } catch {
        return false;
    }
}

const isPainted = (img) => img.complete && img.naturalWidth > 0;

const createLayer = (frame) => {
    const img = document.createElement('img');
    img.className = 'preview-shot';
    img.alt = '';
    img.decoding = 'async';
    frame.prepend(img);
    return img;
};

/**
 * Builds the two layers inside `frame`. `onState` hears 'loading', 'ready' or
 * 'error' for the newest request; `calm` swaps motion for plain fades.
 */
export function createShotStack(frame, { calm, onState }) {
    let front = createLayer(frame);
    let back = createLayer(frame);
    let ticket = 0;

    // Ends any wipe in flight on its final frame, so the next one starts clean.
    const settle = () => {
        gsap.killTweensOf([front, back]);
        gsap.set(front, { clipPath: CLIP_FULL, yPercent: 0, scale: 1, autoAlpha: 1, zIndex: 2 });
        gsap.set(back, { clipPath: CLIP_FULL, yPercent: 0, scale: 1, autoAlpha: 0, zIndex: 1 });
    };

    // Starts loading into `img`; reports 'loading' only when it is not cached,
    // so a warm shot never flashes the sweep.
    const load = (img, src, alt) => {
        const mine = ++ticket;
        img.alt = alt;
        const loading = paint(img, src);
        const cached = isPainted(img);
        if (!cached) onState('loading');
        return { cached, done: loading.then((ok) => (mine === ticket ? ok : null)) };
    };

    return {
        /** First appearance: the shot fills the frame and eases out of a zoom. */
        reveal(src, alt) {
            settle();
            const { cached, done } = load(front, src, alt);
            if (cached) onState('ready');
            else gsap.set(front, { autoAlpha: 0 });

            if (!calm) gsap.fromTo(front, { scale: 1.18 }, { scale: 1, duration: 1, ease: 'expo.out' });
            done.then((ok) => {
                if (ok === null || cached) return;
                onState(ok ? 'ready' : 'error');
                if (ok) gsap.to(front, { autoAlpha: 1, duration: 0.25, ease: 'power2.out' });
            });
        },

        /**
         * Wipes to `src` once it can paint. Moving down the list (direction 1)
         * the next shot rises from below and pushes the old one up; moving up,
         * the reverse.
         */
        async wipeTo(src, alt, direction) {
            settle();
            const incoming = back;
            const ok = await load(incoming, src, alt).done;
            if (ok === null) return;
            onState(ok ? 'ready' : 'error');
            if (!ok) return;

            const outgoing = front;
            front = incoming;
            back = outgoing;
            gsap.set(incoming, { zIndex: 2, autoAlpha: 1 });
            gsap.set(outgoing, { zIndex: 1 });

            if (calm) {
                gsap.fromTo(incoming, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15, onComplete: settle });
                return;
            }
            gsap.fromTo(incoming,
                { clipPath: direction > 0 ? CLIP_FROM_BELOW : CLIP_FROM_ABOVE, yPercent: 12 * direction, scale: 1.08 },
                { clipPath: CLIP_FULL, yPercent: 0, scale: 1, ...WIPE });
            gsap.to(outgoing, { yPercent: -20 * direction, scale: 0.96, ...WIPE, onComplete: settle });
        },

        /** Drops in-flight loads and parks both layers, e.g. once hidden. */
        reset() {
            ticket += 1;
            settle();
        }
    };
}

export { CLIP_FULL, CLIP_FROM_BELOW };
