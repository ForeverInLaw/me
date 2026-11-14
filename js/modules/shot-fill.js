// A screenshot is shown whole in a frame of one fixed shape, on the desktop
// stage (project-stage.js) and in the phone's reel (works-reel.js) alike. What
// margin that leaves is filled from the shot's own edges: its two outer rows
// of pixels, or columns, drawn out to the frame's (the [data-fill] rules in
// project-stage.css), so the picture carries on past its own.
//
// The strips come ready from assets/shot-fills.json (scripts/shot-fills.mjs).
// Reading them off the screenshots here would mean decoding every one of them
// a second time.

const FILLS_URL = 'assets/shot-fills.json';

let fills;

/** Every screenshot's fill, by its path. Asked for once; none at all if the file will not load. */
const loadFills = () => {
    fills ??= fetch(FILLS_URL)
        .then((res) => (res.ok ? res.json() : {}))
        .catch(() => ({}));
    return fills;
};

/** Gives `img`, which shows `src`, its fill, unless it has moved on to another shot by then. */
export function paintFill(img, src) {
    img.style.backgroundImage = '';
    loadFills().then(({ [src]: fill }) => {
        if (!fill || img.getAttribute('src') !== src) return;
        img.dataset.fill = fill.axis;
        img.style.backgroundImage = fill.image;
    });
}
