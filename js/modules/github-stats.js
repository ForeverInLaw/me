export function initGithubStats() {
    const graphContent = document.querySelector('.graph-card .card-content');
    if (!graphContent) return;

    const scrollToEnd = () => { graphContent.scrollLeft = graphContent.scrollWidth; };

    const graphImgs = graphContent.querySelectorAll('img');
    if (graphImgs.length) {
        graphImgs.forEach(img => {
            if (img.complete) return;
            img.addEventListener('load', scrollToEnd, { once: true });
        });
    }
    scrollToEnd();

    const updateFade = () => {
        const atLeft = graphContent.scrollLeft <= 10;
        const atRight = graphContent.scrollLeft + graphContent.clientWidth >= graphContent.scrollWidth - 10;

        graphContent.classList.remove('fade-left', 'fade-right', 'fade-both');
        if (!atLeft && !atRight) graphContent.classList.add('fade-both');
        else if (!atLeft) graphContent.classList.add('fade-left');
        else if (!atRight) graphContent.classList.add('fade-right');
    };
    graphContent.addEventListener('scroll', updateFade, { passive: true });
    updateFade();
}
