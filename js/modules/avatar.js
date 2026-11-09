// The avatar is served by GitHub and arrives when it arrives. It stays out
// until it has decoded, then comes in over the circle holding its place
// (bio.css). One that fails to load leaves the circle standing.

export function initAvatar() {
    const picture = document.querySelector('.who__avatar img');
    picture?.decode()
        .then(() => picture.classList.add('is-loaded'))
        .catch((error) => console.error('Avatar failed to load:', error));
}
