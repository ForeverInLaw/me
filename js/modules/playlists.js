import { apiEndpoint, escapeHtml, fetchJson, safeUrl } from './remote.js';
import { swapText } from './text-swap.js';
import { attachPlaylistPeek } from './playlist-peek.js';

const PLAYLISTS_API = apiEndpoint(
    '/api/playlists',
    'https://spotify-show-last-68db402e666c.herokuapp.com/api/playlists'
);

/**
 * Renders the playlists as a row of covers in the bio column. The covers are
 * too small to carry their names; hovering or focusing one opens a window
 * with its name and description (playlist-peek.js).
 *
 * The row is built off-screen and swaps in for the ghost tiles once every
 * cover has decoded.
 */
export async function initPlaylists() {
    const container = document.getElementById('playlists-container');
    const caption = document.getElementById('playlists-caption');
    if (!container) return;

    let playlists;
    try {
        playlists = await fetchJson(PLAYLISTS_API);
    } catch (error) {
        console.error('Error loading playlists:', error);
        container.innerHTML = '<li class="playlists__error">Playlists are unavailable right now.</li>';
        return;
    }

    const row = document.createElement('ul');
    row.innerHTML = playlists.map((playlist, index) => {
        const name = escapeHtml(playlist.name.trim());
        return `
        <li style="--i: ${index}">
            <a class="playlist" href="${escapeHtml(safeUrl(playlist.url))}" target="_blank" rel="noopener noreferrer"
                aria-label="${name}, ${escapeHtml(playlist.tracks)} tracks">
                <img src="${escapeHtml(safeUrl(playlist.image))}" alt="" decoding="async">
            </a>
        </li>`;
    }).join('');

    // Detached images still load (no lazy loading here, or they never would);
    // a broken cover just shows its tile colour instead of holding up the row.
    await Promise.allSettled(Array.from(row.querySelectorAll('img'), (img) => img.decode()));
    container.classList.add('is-ready');
    container.replaceChildren(...row.children);

    attachPlaylistPeek(container, playlists);
    swapText(caption, `${playlists.length} playlists on Spotify`);
}
