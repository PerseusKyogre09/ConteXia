let lastUrl = window.location.href;
let revisits = {};

export function startTracking(callback) {
    document.addEventListener('scroll', () => {
        checkDwell(callback);
    }, { passive: true });

    window.addEventListener('blur', () => {
        const url = window.location.href;
        revisits[url] = (revisits[url] || 0) + 1;
        if (revisits[url] >= 2) {
            callback({ type: 'revisit', url });
        }
    });
}

let dwellTimer;
function checkDwell(callback) {
    clearTimeout(dwellTimer);
    dwellTimer = setTimeout(() => {
        callback({ type: 'dwell', msg: 'Focused on this section.' });
    }, 5000);
}
