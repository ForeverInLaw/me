import { initAvatar } from './modules/avatar.js';
import { initProjectStage } from './modules/project-stage.js';
import { initWorksReel } from './modules/works-reel.js';
import { initWorksMore } from './modules/works-more.js';
import { initSocials } from './modules/socials.js';
import { initSpotify } from './modules/spotify.js';
import { initGithubActivity } from './modules/github-activity.js';
import { initPlaylists } from './modules/playlists.js';
import { initLocalTime } from './modules/local-time.js';
import { initWorksScroll } from './modules/works-scroll.js';

document.addEventListener('DOMContentLoaded', () => {
    initAvatar();
    initProjectStage();
    initWorksReel();
    initWorksMore();
    initSocials();
    initSpotify();
    // The scroll scene stages what the grind rendered, so it waits for it.
    initGithubActivity().then(initWorksScroll);
    initPlaylists();
    initLocalTime();
});
