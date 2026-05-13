export function initConnectCodeHover() {
    const cards = document.querySelectorAll('.hero__links .link-card');
    if (!cards.length) return;

    const characterSet = '!"№;%:?*()_+|/.,<>~`-=.,@#$^&[]{}';

    const generateRandomString = (length) => {
        return Array.from({ length }, () => {
            return characterSet[Math.floor(Math.random() * characterSet.length)];
        }).join('');
    };

    cards.forEach((card) => {
        if (card.querySelector('.link-card__code-bg')) return;

        const codeBg = document.createElement('div');
        codeBg.className = 'link-card__code-bg';
        codeBg.setAttribute('aria-hidden', 'true');
        card.appendChild(codeBg);

        const updatePointer = (clientX, clientY) => {
            const rect = card.getBoundingClientRect();
            const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
            const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
            card.style.setProperty('--code-x', `${x}px`);
            card.style.setProperty('--code-y', `${y}px`);
        };

        const refreshText = () => {
            const rect = card.getBoundingClientRect();
            const estimatedLength = Math.max(650, Math.min(2200, Math.round((rect.width * rect.height) / 14)));
            codeBg.textContent = generateRandomString(estimatedLength);
        };

        const start = () => {
            card.classList.add('is-code-hover');
            if (!codeBg.textContent) {
                refreshText();
            }
        };

        const stop = () => {
            card.classList.remove('is-code-hover');
        };

        card.addEventListener('mouseenter', (event) => {
            updatePointer(event.clientX, event.clientY);
            start();
        });

        card.addEventListener('mousemove', (event) => {
            updatePointer(event.clientX, event.clientY);
            refreshText();
        });

        card.addEventListener('mouseleave', stop);
        card.addEventListener('focusin', start);
        card.addEventListener('focusout', stop);

        card.addEventListener('touchstart', (event) => {
            const touch = event.touches[0];
            if (!touch) return;
            updatePointer(touch.clientX, touch.clientY);
            start();
        }, { passive: true });

        card.addEventListener('touchmove', (event) => {
            const touch = event.touches[0];
            if (!touch) return;
            updatePointer(touch.clientX, touch.clientY);
            refreshText();
        }, { passive: true });

        card.addEventListener('touchend', stop, { passive: true });
        card.addEventListener('touchcancel', stop, { passive: true });
    });
}
