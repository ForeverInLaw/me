import { apiEndpoint, fetchJson, safeUrl } from './remote.js';
import { swapText } from './text-swap.js';

const NP_API = apiEndpoint('/api/now-playing', 'https://spotify-now-playing.foreverinlaw.workers.dev/');
const POLL_INTERVAL_MS = 15000;

const BADGE = '<span class="np-card__badge" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm3.67 11.54a.5.5 0 0 1-.69.17c-1.88-1.15-4.25-1.41-7.04-.77a.5.5 0 1 1-.22-.97c3.05-.7 5.67-.4 7.78.88a.5.5 0 0 1 .17.69Zm.98-2.18a.62.62 0 0 1-.86.21c-2.16-1.32-5.45-1.7-8-.93a.62.62 0 1 1-.36-1.2c2.93-.88 6.55-.46 9 1.06a.62.62 0 0 1 .22.86Zm.08-2.27c-2.59-1.54-6.86-1.68-9.34-.93a.75.75 0 0 1-.43-1.44c2.84-.85 7.55-.69 10.53 1.08a.75.75 0 0 1-.76 1.29Z"/></svg></span>';

// The art slot holds two stacked <img> so a new cover can cross-fade over the
// old one; title and artist carry .t-text-swap so their changes animate.
const CARD_HTML = `
    <a class="np-card" target="_blank" rel="noopener noreferrer">
        <div class="np-card__art t-icon-swap" data-state="a">
            <img class="t-icon" data-icon="a" alt="" decoding="async">
            <img class="t-icon" data-icon="b" alt="" decoding="async">
            ${BADGE}
        </div>
        <div class="np-card__info">
            <div class="np-card__title"><span class="t-text-swap"></span></div>
            <div class="np-card__artist"><span class="t-text-swap"></span></div>
            <div class="np-card__progress"><div class="np-card__bar"></div></div>
        </div>
    </a>`.trim();

export function initSpotify() {
    const spotifyWidget = document.getElementById('spotify-now-playing');
    const spotifyTitle = document.querySelector('.spotify-title');

    if (spotifyTitle) {
        spotifyTitle.classList.add('loading');
    }

    if (spotifyWidget) {
        spotifyWidget.innerHTML = '<div class="np-placeholder" aria-hidden="true"><div></div></div>';
    }

    const npState = {
        trackId: null,
        isPlaying: false,
        progressMs: 0,
        durationMs: 0,
        lastSyncAt: 0,
        rafId: 0,
    };
    let npFetching = false;
    let npFailCount = 0;

    function setTitleText(text) {
        if (!spotifyTitle || spotifyTitle.textContent === text) return;
        spotifyTitle.textContent = text;
        if (text === 'Loading...') {
            spotifyTitle.classList.add('loading');
        } else {
            spotifyTitle.classList.remove('loading');
        }
    }

    function progressPercent(data) {
        if (!data.durationMs || data.progressMs == null) return 0;
        const pct = (data.progressMs / data.durationMs) * 100;
        return Math.max(0, Math.min(100, pct));
    }

    // Built and filled off-screen, and put in place of the placeholder only once
    // its cover has decoded, so the slot never shows a half-empty card. Later
    // tracks update it in place (updateCard) so title, artist and cover animate.
    async function mountCard(data) {
        // A plain <div>, not a <template>: images inside template content
        // belong to an inert document and never load, so the decode would fail.
        const holder = document.createElement('div');
        holder.innerHTML = CARD_HTML;
        const card = holder.firstElementChild;
        card.querySelector('.np-card__title .t-text-swap').textContent = data.track.name;
        card.querySelector('.np-card__artist .t-text-swap').textContent = data.track.artists;
        await updateCard(card, data);
        spotifyWidget.replaceChildren(card);
    }

    /**
     * Fades a new cover in over the old one. The state only flips once the
     * image has actually decoded, so a slow or broken URL leaves the previous
     * cover up instead of blanking the slot.
     */
    async function swapAlbumArt(slot, src) {
        if (!src || slot.dataset.src === src) return;
        slot.dataset.src = src;

        const nextIcon = slot.dataset.state === 'a' ? 'b' : 'a';
        const image = slot.querySelector(`[data-icon="${nextIcon}"]`);
        image.src = src;

        try {
            await image.decode();
        } catch {
            return;
        }
        if (slot.dataset.src !== src) return; // a newer cover won the race
        slot.dataset.state = nextIcon;
    }

    /** Fills `card` from `data`; resolves once the cover has settled. */
    function updateCard(card, data) {
        const t = data.track;
        card.href = safeUrl(t.url);
        card.setAttribute('aria-label', `${t.name} by ${t.artists}`);
        card.classList.toggle('is-stale', !data.isPlaying);

        swapText(card.querySelector('.np-card__title .t-text-swap'), t.name);
        swapText(card.querySelector('.np-card__artist .t-text-swap'), t.artists);
        const art = card.querySelector('.np-card__art');
        card.querySelector('.np-card__bar').style.width = `${progressPercent(data)}%`;

        const pulse = art.querySelector('.np-card__pulse');
        if (data.isPlaying && !pulse) {
            const dot = document.createElement('span');
            dot.className = 'np-card__pulse';
            dot.setAttribute('aria-hidden', 'true');
            art.appendChild(dot);
        } else if (!data.isPlaying && pulse) {
            pulse.remove();
        }
        return swapAlbumArt(art, safeUrl(t.albumArt));
    }

    function showMessage(text) {
        if (!spotifyWidget) return;
        const el = document.createElement('div');
        el.className = 'np-message';
        el.textContent = text;
        spotifyWidget.replaceChildren(el);
    }

    function stopProgressLoop() {
        if (npState.rafId) {
            cancelAnimationFrame(npState.rafId);
            npState.rafId = 0;
        }
    }

    function startProgressLoop() {
        stopProgressLoop();
        if (!npState.isPlaying || !npState.durationMs) return;
        const tick = () => {
            const bar = spotifyWidget && spotifyWidget.querySelector('.np-card__bar');
            if (!bar) {
                npState.rafId = 0;
                return;
            }
            const elapsed = Date.now() - npState.lastSyncAt;
            const cur = Math.min(npState.durationMs, npState.progressMs + elapsed);
            const pct = (cur / npState.durationMs) * 100;
            bar.style.width = `${pct}%`;
            if (cur >= npState.durationMs) {
                npState.rafId = 0;
                return;
            }
            npState.rafId = requestAnimationFrame(tick);
        };
        npState.rafId = requestAnimationFrame(tick);
    }

    async function fetchNowPlaying() {
        if (npFetching) return;
        npFetching = true;
        try {
            const data = await fetchJson(NP_API, { cache: 'no-store' });
            npFailCount = 0;

            if (!data || !data.track) {
                npState.trackId = null;
                npState.isPlaying = false;
                stopProgressLoop();
                setTitleText('Not playing');
                showMessage('Nothing playing right now.');
                return;
            }

            setTitleText(data.isPlaying ? 'Now Playing' : 'Last Played');

            npState.trackId = data.track.id;
            npState.isPlaying = !!data.isPlaying;
            npState.progressMs = data.progressMs || 0;
            npState.durationMs = data.durationMs || 0;
            npState.lastSyncAt = Date.now();

            const card = spotifyWidget.querySelector('.np-card');
            if (card) updateCard(card, data);
            else await mountCard(data);

            startProgressLoop();
        } catch (err) {
            console.error('now-playing fetch failed:', err);
            npFailCount++;
            // Keep the last view on a single blip; only show an error once it's clearly down
            if (npFailCount >= 2) {
                stopProgressLoop();
                setTitleText('Unavailable');
                showMessage("Can't reach Spotify right now.");
            }
        } finally {
            npFetching = false;
        }
    }

    if (!spotifyWidget) return;

    fetchNowPlaying();
    setInterval(fetchNowPlaying, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopProgressLoop();
        } else {
            fetchNowPlaying();
        }
    });
}
