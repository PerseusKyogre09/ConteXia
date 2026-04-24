export function getSelectedText() {
    return window.getSelection()?.toString().trim() || '';
}

export function getVisibleText() {
    const selectors = 'p, h1, h2, h3, h4, li, td, th, figcaption, blockquote, pre, code';
    const elements = Array.from(document.querySelectorAll(selectors));
    const vh = window.innerHeight;

    return elements
        .filter(el => {
            const r = el.getBoundingClientRect();
            return r.top < vh && r.bottom > 0;
        })
        .map(el => el.innerText?.trim())
        .filter(t => t && t.length > 20)
        .join('\n')
        .slice(0, 3000);
}

export function getSectionAroundElement(el) {
    let node = el;
    while (node && node !== document.body) {
        if (['SECTION', 'ARTICLE', 'MAIN'].includes(node.tagName)) return node.innerText?.slice(0, 2000);
        if (node.querySelector('h1,h2,h3,h4')) return node.innerText?.slice(0, 2000);
        node = node.parentElement;
    }
    return el.closest('p, li, td')?.parentElement?.innerText?.slice(0, 2000) || el.innerText;
}
