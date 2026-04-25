import { getSelectedText, getVisibleText, getSectionAroundElement } from '../utils/context_extractor';
import { gsap } from 'gsap';

let hoveredText = '';
let overlay = null;
let dwellManager = null;

class DwellTrigger {
    constructor() {
        this.timer = null;
        this.chip = null;
        this.activeElement = null;
        this.init();
    }

    init() {
        const style = document.createElement('style');
        style.textContent = `
            #contexia-dwell-chip {
                position: fixed;
                padding: 8px 16px;
                background: #FDFEFA;
                border: 1.5px solid #064E3B;
                border-radius: 20px;
                color: #064E3B;
                font-family: 'Outfit', sans-serif;
                font-size: 11px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                z-index: 1000001;
                box-shadow: 0 10px 25px rgba(6, 78, 59, 0.15);
                pointer-events: auto;
                opacity: 0;
                transform: scale(0.9) translateY(10px);
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
            }
            #contexia-dwell-chip:hover {
                background: #E0FDE4;
                transform: scale(1) translateY(8px);
            }
            #contexia-dwell-chip .chip-icon {
                width: 14px;
                height: 14px;
                background: #16A34A;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 8px;
            }
        `;
        document.head.appendChild(style);

        this.chip = document.createElement('div');
        this.chip.id = 'contexia-dwell-chip';
        this.chip.innerHTML = `
            <svg viewBox="0 0 512 512" fill="currentColor" style="width:14px;height:14px;">
                <path d="M433.2 64.1l-14.5 14.5-19-19 14.5-14.5c6.2-6.2 16.4-6.2 22.6 0l16.4 16.4c6.2 6.2 6.2 16.4 0 22.6zM374.7 85.3l19 19L137.9 360l-19-19L374.7 85.3zM91.7 394.1l19 19-33.8 11.3 14.8-30.3zm401-166.1l-50.7-50.7c-6.2-6.2-16.4-6.2-22.6 0l-14.5 14.5 73.4 73.4 14.5-14.5c6.2-6.2 6.2-16.4 0-22.6zM399 264.1l-73.4-73.4L64.1 452.2c-6.2 6.2-6.2 16.4 0 22.6l50.7 50.7c6.2 6.2 16.4 6.2 22.6 0l261.6-261.4z"/>
            </svg>
            SUMMARIZE?
        `;
        this.chip.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.triggerSummary();
        };
        document.body.appendChild(this.chip);

        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('selectionchange', () => this.handleSelection());
    }

    handleSelection() {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText.length > 5) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            this.showChipAt(rect.left + rect.width / 2, rect.bottom + 10, selectedText);
        } else {
            this.reset();
        }
    }

    handleMouseMove(e) {
        if (window.getSelection().toString().trim().length > 0) return;

        const el = e.target;
        if (el === this.chip || this.chip.contains(el)) return;

        // Grace distance: don't hide if mouse is close to the chip
        if (this.chip.style.opacity === '1') {
            const rect = this.chip.getBoundingClientRect();
            const dx = e.clientX - (rect.left + rect.width / 2);
            const dy = e.clientY - (rect.top + rect.height / 2);
            if (Math.sqrt(dx * dx + dy * dy) < 80) return;
        }

        const container = this.findTextContainer(el);
        if (container) {
            if (this.activeElement !== container) {
                this.reset();
                this.activeElement = container;

                const isPDF = container.tagName === 'EMBED' || container.tagName === 'OBJECT' || window.location.pathname.toLowerCase().endsWith('.pdf');
                const delay = isPDF ? 8000 : 2000;

                this.timer = setTimeout(() => this.showChip(e), delay);
            }
        } else {
            this.reset();
        }
    }

    findTextContainer(el) {
        let current = el;

        if (current && (
            current.tagName === 'EMBED' ||
            current.tagName === 'OBJECT' ||
            window.location.pathname.toLowerCase().endsWith('.pdf')
        )) {
            const type = current.type?.toLowerCase();
            if (type?.includes('pdf') || current.src?.toLowerCase().endsWith('.pdf') || window.location.pathname.toLowerCase().endsWith('.pdf')) {
                return current;
            }
        }

        const tags = ['P', 'DIV', 'ARTICLE', 'SECTION', 'LI', 'H1', 'H2', 'H3', 'MAIN'];
        while (current && current !== document.documentElement) {
            if (tags.includes(current.tagName)) {
                const text = current.innerText?.trim() || "";
                if (text.length > 100) return current;
            }
            current = current.parentElement;
        }
        return null;
    }

    showChip(e) {
        let text = this.activeElement?.innerText?.trim() || "";

        if (!text && (this.activeElement?.tagName === 'EMBED' || window.location.pathname.toLowerCase().endsWith('.pdf'))) {
            text = "Visual Analysis of Document";
        }

        this.showChipAt(e.clientX, e.clientY + 20, text);
    }

    showChipAt(x, y, text) {
        if (text) this.chip.dataset.text = text;
        Object.assign(this.chip.style, {
            top: `${y}px`,
            left: `${x - 60}px`,
            opacity: '1',
            transform: 'scale(1) translateY(0)',
            pointerEvents: 'auto'
        });
    }

    reset() {
        clearTimeout(this.timer);
        if (window.getSelection().toString().trim().length === 0) {
            this.activeElement = null;
            Object.assign(this.chip.style, {
                opacity: '0',
                transform: 'scale(0.9) translateY(10px)',
                pointerEvents: 'none'
            });
        }
    }

    triggerSummary() {
        const selection = window.getSelection().toString().trim();
        const text = selection || this.chip.dataset.text;

        if (!text) return;

        chrome.runtime.sendMessage({
            type: 'CHIP_CLICK',
            payload: {
                action: 'SUMMARIZE',
                text: text,
                msgId: `chip_${Date.now()}`
            }
        });
        this.reset();
        window.getSelection().removeAllRanges();
    }
}

if (!dwellManager) {
    dwellManager = new DwellTrigger();
}

class InkOverlay {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.drawing = false;
        this.points = [];
        this.toolbar = null;
    }

    activate() {
        if (this.canvas) return;

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'contexia-ink-layer';
        Object.assign(this.canvas.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            zIndex: '999999',
            pointerEvents: 'auto',
            cursor: 'crosshair'
        });

        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.resize();

        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('mousedown', (e) => this.start(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stop());

        this.createSidebar();
    }

    resize() {
        this.canvas.width = window.innerWidth * window.devicePixelRatio;
        this.canvas.height = window.innerHeight * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = '#064E3B';
        this.ctx.lineWidth = 3;
    }

    createSidebar() {
        this.toolbar = document.createElement('div');
        this.toolbar.id = 'contexia-ink-sidebar';
        this.toolbar.innerHTML = `
            <div class="ink-btn ink-close" title="Close Pen">✕</div>
            <div class="ink-btn ink-clear" title="Clear Canvas">🗑</div>
            <div class="ink-sep"></div>
            <div class="ink-color active" style="background:#064E3B" data-color="#064E3B"></div>
            <div class="ink-color" style="background:#059669" data-color="#059669"></div>
            <div class="ink-color" style="background:#3b82f6" data-color="#3b82f6"></div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #contexia-ink-sidebar {
                position: fixed;
                right: 20px;
                top: 50%;
                transform: translateY(-50%);
                background: #E0FDE4;
                border: 2px solid #064E3B;
                border-radius: 40px;
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 15px;
                z-index: 1000000;
                box-shadow: -10px 0 30px rgba(6, 78, 59, 0.1);
                opacity: 0;
            }
            .ink-btn {
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #064E3B;
                font-weight: bold;
                cursor: pointer;
                background: white;
                border: 1px solid #064E3B;
                border-radius: 50%;
                box-shadow: 0 4px 0 #064E3B;
                transition: all 0.1s;
            }
            .ink-btn:active {
                transform: translateY(2px);
                box-shadow: 0 2px 0 #064E3B;
            }
            .ink-sep {
                height: 1px;
                background: #064E3B;
                opacity: 0.2;
                margin: 5px 0;
            }
            .ink-color {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                border: 2px solid transparent;
                transition: transform 0.2s;
            }
            .ink-color.active { border-color: #064E3B; transform: scale(1.1); }
        `;
        document.head.appendChild(style);
        document.body.appendChild(this.toolbar);

        this.toolbar.querySelector('.ink-close').onclick = () => this.destroy();
        this.toolbar.querySelector('.ink-clear').onclick = () => this.clear();
        this.toolbar.querySelectorAll('.ink-color').forEach(el => {
            el.onclick = () => {
                this.ctx.strokeStyle = el.dataset.color;
                this.toolbar.querySelectorAll('.ink-color').forEach(c => c.classList.remove('active'));
                el.classList.add('active');
            };
        });

        gsap.to(this.toolbar, { x: 0, opacity: 1, duration: 0.8, ease: 'elastic.out(1, 0.7)' });
    }

    start(e) {
        this.drawing = true;
        this.points = [{ x: e.clientX, y: e.clientY }];
    }

    draw(e) {
        if (!this.drawing) return;

        this.points.push({ x: e.clientX, y: e.clientY });
        if (this.points.length < 3) return;

        this.ctx.beginPath();
        this.ctx.moveTo(this.points[0].x, this.points[0].y);

        for (let i = 1; i < this.points.length - 2; i++) {
            const xc = (this.points[i].x + this.points[i + 1].x) / 2;
            const yc = (this.points[i].y + this.points[i + 1].y) / 2;
            this.ctx.quadraticCurveTo(this.points[i].x, this.points[i].y, xc, yc);
        }
        this.ctx.stroke();
    }

    stop() {
        this.drawing = false;
        this.points = [];
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    destroy() {
        if (this.canvas) this.canvas.remove();
        if (this.toolbar) this.toolbar.remove();
        chrome.runtime.sendMessage({ type: 'PEN_CLOSED' });
        overlay = null;
    }
}

document.addEventListener('mouseover', (e) => {
    hoveredText = getSectionAroundElement(e.target);
}, { passive: true });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_CONTEXT') {
        sendResponse({
            selectedText: getSelectedText(),
            visibleViewportText: getVisibleText(),
            hoveredSection: hoveredText,
            url: window.location.href,
            pageTitle: document.title
        });
    }
    if (request.type === 'TOGGLE_PEN') {
        if (!overlay) {
            overlay = new InkOverlay();
            overlay.activate();
        } else {
            overlay.destroy();
        }
    }
});
