// A screenshot is shown whole in a frame of one fixed shape, on the desktop
// stage (project-stage.js) and in the phone's reel (works-reel.js) alike. What
// margin that leaves is filled from the shot's own edges.

// The frame's shape: a shot wider than it is left with margins above and
// below, a narrower one with margins at its sides.
const FRAME_RATIO = 16 / 9;

const fills = new Map();

/** A strip of `shot`, one pixel deep, as a CSS image. */
function edgeStrip(shot, x, y, width, height) {
    const canvas = Object.assign(document.createElement('canvas'), { width, height });
    canvas.getContext('2d').drawImage(shot, x, y, width, height, 0, 0, width, height);
    return `url(${canvas.toDataURL()})`;
}

/**
 * What fills a screenshot's margins in the frame: its two outer rows of
 * pixels, or columns, which the layer draws out to the frame's edges (the
 * [data-fill] rules in project-stage.css), so the picture carries on past
 * its own.
 *
 * The shot is decoded off the main thread and only the two strips are ever
 * drawn; decoding it into a canvas instead stalls the page as it comes in.
 */
export function fillFor(src) {
    if (!fills.has(src)) {
        fills.set(src, fetch(src)
            .then((res) => res.blob())
            .then((blob) => createImageBitmap(blob))
            .then((shot) => {
                const { width, height } = shot;
                const rows = width / height > FRAME_RATIO;
                const strips = rows
                    ? [edgeStrip(shot, 0, 0, width, 1), edgeStrip(shot, 0, height - 1, width, 1)]
                    : [edgeStrip(shot, 0, 0, 1, height), edgeStrip(shot, width - 1, 0, 1, height)];
                shot.close();
                return { axis: rows ? 'rows' : 'columns', image: strips.join(', ') };
            })
            .catch(() => null));
    }
    return fills.get(src);
}

/** Gives `img`, which shows `src`, its fill, unless it has moved on to another shot by then. */
export function paintFill(img, src) {
    img.style.backgroundImage = '';
    fillFor(src).then((fill) => {
        if (!fill || img.getAttribute('src') !== src) return;
        img.dataset.fill = fill.axis;
        img.style.backgroundImage = fill.image;
    });
}
