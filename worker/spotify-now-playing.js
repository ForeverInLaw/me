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
            return svgResponse(await nowPlayingCard(env, searchParams.get('theme')));
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
async function nowPlayingCard(env, theme) {
    try {
        return renderCard(await getNowPlaying(env), theme);
    } catch {
        return renderCard({ isPlaying: false, track: null }, theme);
    }
}

// Rendered with system fonts: track names can use any script, so a subset font cannot cover them.
export function renderCard(payload, theme) {
    const colors = theme === 'light'
        ? { accent: '#8F2784', fg: '#1D1421', hairline: '#E2DCE7' }
        : { accent: '#F492F0', fg: '#F4EFF8', hairline: '#2A2433' };
    const label = payload.isPlaying ? 'Now playing' : 'Last played';
    const line = payload.track
        ? `${payload.track.name} — ${payload.track.artists}`
        : 'Nothing on the turntable';
    const clipped = line.length > 72 ? `${line.slice(0, 71)}…` : line;
    const font = 'font-family="ui-monospace,Consolas,Menlo,monospace" font-size="15"';

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 72" width="840" height="72" role="img">`
        + `<title>${escapeXml(`${label}: ${line}`)}</title>`
        + `<rect width="840" height="1" fill="${colors.hairline}"/>`
        + `<text x="0" y="44" ${font} fill="${colors.accent}">${label}</text>`
        + `<text x="124" y="44" ${font} fill="${colors.fg}">${escapeXml(clipped)}</text>`
        + `</svg>`;
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
            'Cache-Control': 'no-cache, max-age=0',
        },
    });
}
