import { getSelectedText, getVisibleText, getSectionAroundElement } from '../utils/context_extractor';

console.log('ConteXia: Content script initialized');

let hoveredText = '';
let currentSignal = 'idle';

function getPageContext() {
    return {
        selectedText: getSelectedText(),
        visibleViewportText: getVisibleText(),
        hoveredSection: hoveredText,
        url: window.location.href,
        pageTitle: document.title,
        activeSignal: currentSignal
    };
}

document.addEventListener('mouseover', (e) => {
    hoveredText = getSectionAroundElement(e.target);
}, { passive: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_CONTEXT') {
        sendResponse(getPageContext());
    }
});
