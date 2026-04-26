import { getSelectedText, getVisibleText, getSectionAroundElement } from '../utils/context_extractor';
import { gsap } from 'gsap';

let hoveredText = '';
let overlay = null;
let isExtracting = false;

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
    startDwellTracking(e.target);
}, { passive: true });

document.addEventListener('mouseout', (e) => {
    stopDwellTracking(e.target);
}, { passive: true });

let dwellTimer = null;
let currentDwellElement = null;

function startDwellTracking(el) {
    if (currentDwellElement === el) return;
    stopDwellTracking();

    const denseTags = ['P', 'BLOCKQUOTE', 'LI', 'ARTICLE', 'SECTION'];
    if (!denseTags.includes(el.tagName)) return;

    const text = el.innerText?.trim() || "";
    if (text.length < 200) return;

    currentDwellElement = el;
    dwellTimer = setTimeout(() => {
        chrome.runtime.sendMessage({
            type: 'DWELL_SIGNAL',
            payload: {
                text: text.slice(0, 1000),
                tagName: el.tagName
            }
        });
    }, 8000);
}

function stopDwellTracking() {
    if (dwellTimer) clearTimeout(dwellTimer);
    dwellTimer = null;
    currentDwellElement = null;
}

const headingObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const text = entry.target.innerText?.trim();
            if (text) {
                chrome.runtime.sendMessage({
                    type: 'HEADING_ENTERED',
                    payload: text
                });
            }
        }
    });
}, { threshold: 0.5 });

observeHeadings();

let visionHoverTimer = null;
document.addEventListener('mousemove', (e) => {
    const target = e.target;
    const isVisionTarget = ['IMG', 'CANVAS', 'SVG'].includes(target.tagName) ||
        (target.tagName === 'DIV' && window.getComputedStyle(target).backgroundImage !== 'none');

    if (isVisionTarget) {
        if (visionHoverTimer) return;
        visionHoverTimer = setTimeout(() => {
            chrome.runtime.sendMessage({ type: 'VISION_HOVER_SIGNAL' });
        }, 1500);
    } else {
        if (visionHoverTimer) {
            clearTimeout(visionHoverTimer);
            visionHoverTimer = null;
        }
    }
});

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
