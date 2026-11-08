import { initPreviewModal } from './modules/preview-modal.js';
import { initWorksReel } from './modules/works-reel.js';
import { initSpotify } from './modules/spotify.js';
import { initGithubActivity } from './modules/github-activity.js';
import { initPlaylists } from './modules/playlists.js';
import { initLocalTime } from './modules/local-time.js';

document.addEventListener('DOMContentLoaded', () => {
    // Row index drives the CSS cascade that brings the works list in.
    document.querySelectorAll('.project-list > li').forEach((row, index) => {
        row.style.setProperty('--i', String(index));
    });

    initPreviewModal();
    initWorksReel();
    initSpotify();
    initGithubActivity();
    initPlaylists();
    initLocalTime();
});
