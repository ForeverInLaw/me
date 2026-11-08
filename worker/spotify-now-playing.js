import jpeg from 'jpeg-js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';
const RECENT_URL = 'https://api.spotify.com/v1/me/player/recently-played?limit=1';

export default {
    async fetch(request, env) {
        const origin = env.CORS_ORIGIN || '*';

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(origin),
            });
        }

        if (request.method !== 'GET') {
            return jsonResponse({ error: 'method not allowed' }, 405, origin);
        }

        const { pathname, searchParams } = new URL(request.url);

        if (pathname === '/now-playing.svg') {
            return svgResponse(await nowPlayingCard(env, searchParams.get('theme'), searchParams.get('layout')));
        }

        try {
            return jsonResponse(await getNowPlaying(env), 200, origin);
        } catch (err) {
            return jsonResponse(
                { isPlaying: false, track: null, error: String(err && err.message || err) },
                500,
                origin
            );
        }
    },
};

async function getNowPlaying(env) {
    const token = await getAccessToken(env);

    const nowRes = await fetch(NOW_PLAYING_URL, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (nowRes.status === 200) {
        const data = await nowRes.json();
        if (data && data.item) {
            return buildPayload(data.item, !!data.is_playing, null, data.progress_ms);
        }
    }

    const recentRes = await fetch(RECENT_URL, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!recentRes.ok) {
        return { isPlaying: false, track: null };
    }

    const recent = await recentRes.json();
    const entry = recent.items && recent.items[0];
    if (!entry || !entry.track) {
        return { isPlaying: false, track: null };
    }

    return buildPayload(entry.track, false, entry.played_at, null);
}

// Failures render a quiet card: a broken image on the GitHub profile is worse than no track.
async function nowPlayingCard(env, theme, layout) {
    try {
        const payload = await getNowPlaying(env);
        const cover = await coverLevels(payload.track && payload.track.cover).catch(() => null);
        return renderCard(payload, theme, layout, cover);
    } catch {
        return renderCard({ isPlaying: false, track: null }, theme, layout, null);
    }
}

const COVER_CELLS = 30;
const COVER_LIMIT = 64;
// Per isolate: a cover only changes with the track, so most requests skip the fetch and decode.
const coverCache = new Map();

/** The album cover as COVER_CELLS² brightness levels 0…1, contrast-stretched, or null. */
async function coverLevels(url) {
    if (!url) return null;
    const cached = coverCache.get(url);
    if (cached) return cached;
    const res = await fetch(url);
    if (!res.ok) return null;
    const { width, height, data } = jpeg.decode(new Uint8Array(await res.arrayBuffer()), { useTArray: true, maxResolutionInMP: 1 });
    const sums = new Float64Array(COVER_CELLS * COVER_CELLS);
    const counts = new Uint32Array(COVER_CELLS * COVER_CELLS);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const cell = Math.floor((y / height) * COVER_CELLS) * COVER_CELLS + Math.floor((x / width) * COVER_CELLS);
            sums[cell] += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
            counts[cell] += 1;
        }
    }
    const raw = Array.from(sums, (sum, i) => sum / Math.max(1, counts[i]));
    const sorted = raw.toSorted((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * 0.02)];
    const hi = sorted[Math.floor(sorted.length * 0.98)];
    const levels = raw.map((v) => Math.min(1, Math.max(0, (v - lo) / Math.max(1e-6, hi - lo))));
    if (coverCache.size >= COVER_LIMIT) coverCache.delete(coverCache.keys().next().value);
    coverCache.set(url, levels);
    return levels;
}

// Matches the profile README's slices (ForeverInLaw/ForeverInLaw, src/theme.ts): stone tones from
// the avatar, amber only for the live state. Light has no ground so ink sits on GitHub's page.
const THEMES = {
    dark: { ground: '#12100e', stone: ['#4f4943', '#8c857b', '#b8b1a9', '#e6e5e4'], accent: '#ffb43a', ink: false },
    light: { ground: null, stone: ['#c9c3bb', '#6f685e', '#5d564e', '#2d2824'], accent: '#8f4a0a', ink: true },
};
const RAMP = ' .:-=+*#%@';
const tierOf = (density) => (density <= 2 ? 0 : density <= 4 ? 1 : density <= 6 ? 2 : 3);

/**
 * The cover drawn from the same glyph ramp as the profile portrait: density is light on the dark
 * ground and ink on paper. Every glyph gets its own x, so any monospace fallback keeps the grid.
 */
function coverGlyphs(levels, t, x0, y0, side) {
    const cell = side / COVER_CELLS;
    const rows = [];
    for (let r = 0; r < COVER_CELLS; r++) {
        const byTier = [[], [], [], []];
        for (let c = 0; c < COVER_CELLS; c++) {
            const lum = levels[r * COVER_CELLS + c];
            const density = Math.round((t.ink ? 1 - lum : lum) * 9);
            if (density === 0) continue;
            byTier[tierOf(density)].push([RAMP[density], +(x0 + c * cell).toFixed(2)]);
        }
        const spans = byTier.flatMap((cells, tier) => (cells.length
            ? [`<tspan x="${cells.map(([, x]) => x).join(' ')}" fill="${t.stone[tier]}">${escapeXml(cells.map(([g]) => g).join(''))}</tspan>`]
            : []));
        if (spans.length) rows.push(`<text y="${+(y0 + (r + 0.82) * cell).toFixed(2)}">${spans.join('')}</text>`);
    }
    return `<g font-size="${+(cell / 0.6).toFixed(2)}" font-weight="700">${rows.join('')}</g>`;
}

// Narrow is swapped in on phones, where the wide card would shrink below reading size.
const LAYOUTS = {
    wide: { width: 840, margin: 32, height: 132, barCells: 28 },
    narrow: { width: 420, margin: 20, height: 132, barCells: 14 },
};
const SIZE = 15;
const ADVANCE = 0.6;
const GAP = 28;

const clip = (text, chars) => (text.length > chars ? `${text.slice(0, chars - 1)}…` : text);
const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

function ago(iso, now) {
    const minutes = Math.max(1, Math.round((now - Date.parse(iso)) / 60000));
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

/**
 * The track's progress as a row of glyphs. While playing, an amber fill creeps along it in real
 * time from where the track stood when the card was rendered; a static image shows that moment.
 */
function progressBar(payload, t, x, y, cells, id) {
    const cell = SIZE * ADVANCE;
    const xs = Array.from({ length: cells }, (_, i) => +(x + i * cell).toFixed(2)).join(' ');
    const row = (glyph, fill, clipId, bold) =>
        `<text y="${y}" fill="${fill}"${bold ? ' font-weight="700"' : ''}${clipId ? ` clip-path="url(#${clipId})"` : ''}><tspan x="${xs}">${glyph.repeat(cells)}</tspan></text>`;
    const { progressMs, durationMs } = payload;
    if (!durationMs || progressMs == null) return row('.', t.stone[0]);
    const full = cells * cell;
    const start = +(Math.min(1, progressMs / durationMs) * full).toFixed(2);
    const remaining = Math.max(0, durationMs - progressMs);
    const box = `y="${y - SIZE}" height="${SIZE + 4}"`;
    // Two clips share one boundary: the fill grows from it, the dotted track shrinks behind it.
    return `<clipPath id="${id}-done"><rect class="${id}-done" x="${x}" width="${start}" ${box}/></clipPath>`
        + `<clipPath id="${id}-left"><rect class="${id}-left" x="${x + start}" width="${+(full - start).toFixed(2)}" ${box}/></clipPath>`
        + `<style>.${id}-done{animation:${id}-grow ${remaining}ms linear forwards}`
        + `.${id}-left{animation:${id}-shrink ${remaining}ms linear forwards}`
        + `@keyframes ${id}-grow{to{width:${full}px}}@keyframes ${id}-shrink{to{x:${x + full}px;width:0}}`
        + `@media (prefers-reduced-motion:reduce){.${id}-done,.${id}-left{animation:none}}</style>`
        + row('.', t.stone[0], `${id}-left`)
        + row('=', t.accent, `${id}-done`, true);
}

// Rendered with system fonts: track names can use any script, so a subset font cannot cover them.
// A miniature of the profile's first screen: text on the README's left edge, the cover as a
// full-height glyph plate flush with the right edge, like the portrait on the profile cover.
export function renderCard(payload, theme, layout, cover, now = Date.now()) {
    const t = THEMES[theme === 'light' ? 'light' : 'dark'];
    const { width, margin, height, barCells } = LAYOUTS[layout === 'narrow' ? 'narrow' : 'wide'];
    const track = payload.track;
    const art = track && cover ? coverGlyphs(cover, t, width - height, 0, height) : '';
    const right = art ? width - height - GAP : width - margin;
    const chars = (size) => Math.floor((right - margin) / (size * ADVANCE));
    const text = (y, content, fill, { size = SIZE, bold = false, anchor = 'start', x = margin } = {}) =>
        `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" text-anchor="${anchor}"${bold ? ' font-weight="700"' : ''}>${escapeXml(content)}</text>`;

    const status = payload.isPlaying ? 'playing' : payload.playedAt ? ago(payload.playedAt, now) : track ? 'paused' : '';
    // Only the length: a static image cannot tick, so elapsed time would freeze while the bar moves on.
    const timing = payload.isPlaying && payload.durationMs ? mmss(payload.durationMs) : '';
    const barX = margin;
    const body = track
        ? text(66, clip(track.name, chars(20)), t.stone[3], { size: 20, bold: true })
            + text(90, clip(track.artists, chars(SIZE)), t.stone[2])
            + (payload.isPlaying
                ? progressBar(payload, t, barX, 116, barCells, `np-${theme === 'light' ? 'l' : 'd'}${layout === 'narrow' ? 'n' : 'w'}`) + text(116, timing, t.stone[2], { x: barX + barCells * SIZE * ADVANCE + 12 })
                : '')
        : text(66, 'Nothing playing', t.stone[2], { size: 20, bold: true });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">`
        + `<title>${escapeXml(track ? `${payload.isPlaying ? 'Now playing' : 'Last played'}: ${track.name} — ${track.artists}` : 'Nothing playing')}</title>`
        + `<g font-family="JetBrains Mono,ui-monospace,Consolas,Menlo,monospace" font-size="${SIZE}">`
        + (t.ground ? `<rect width="${width}" height="${height}" fill="${t.ground}"/>` : '')
        + art
        + text(34, '~ $ now-playing', t.stone[3], { bold: true })
        + (status ? text(34, status, payload.isPlaying ? t.accent : t.stone[2], { bold: payload.isPlaying, anchor: 'end', x: right }) : '')
        + body
        + `</g></svg>`;
}

function escapeXml(text) {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

async function getAccessToken(env) {
    const basic = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: env.SPOTIFY_REFRESH_TOKEN,
    });
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`token refresh failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    return data.access_token;
}

function buildPayload(item, isPlaying, playedAt, progressMs) {
    return {
        isPlaying,
        playedAt: playedAt || null,
        progressMs: progressMs == null ? null : progressMs,
        durationMs: item.duration_ms || null,
        track: {
            id: item.id,
            name: item.name,
            artists: (item.artists || []).map((a) => a.name).join(', '),
            album: item.album && item.album.name || '',
            albumArt: pickAlbumArt(item.album && item.album.images),
            cover: pickSmallest(item.album && item.album.images),
            url: item.external_urls && item.external_urls.spotify || '',
        },
    };
}

function pickAlbumArt(images) {
    if (!images || !images.length) return '';
    const sorted = images.slice().sort((a, b) => (b.width || 0) - (a.width || 0));
    const mid = sorted.find((img) => img.width && img.width <= 320) || sorted[sorted.length - 1];
    return mid.url;
}

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };
}

function jsonResponse(data, status, origin) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=15, s-maxage=15',
            ...corsHeaders(origin),
        },
    });
}

function svgResponse(svg) {
    return new Response(svg, {
        headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            // Short enough to stay live, long enough that a burst of profile views shares one render.
            'Cache-Control': 'public, max-age=30, s-maxage=30',
        },
    });
}

// Spotify's smallest cover (64px) is plenty for a 20×20 glyph grid and the cheapest to decode.
function pickSmallest(images) {
    if (!images || !images.length) return '';
    return images.reduce((a, b) => ((b.width || Infinity) < (a.width || Infinity) ? b : a)).url;
}
