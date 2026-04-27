# ConteXia 🌿🖋️
### *The Audio-First Context-Aware Reading Assistant*

[**Visit the Live Site 🌐**](https://perseuskyogre09.github.io/ConteXia/)

**ConteXia** is a minimal, premium AI partner designed for deep work. She lives in your browser, understanding exactly where your attention lies and bridging the gap between digital text and natural spoken dialogue.

### 📄 Deep PDF & Image Support
Unlike standard extensions that only read HTML, ConteXia uses **Spatial Scanning (Viewport Capture)**. This means she can "see" and explain charts in research PDFs, diagrams in technical docs, and even non-selectable text in images exactly as you see them.

---

## 🏆 Hackathon Submission: Context & Audio

### How ConteXia Understands Context
ConteXia employs a multi-modal approach to grounding AI responses in the user's active environment:
1. **Visual Grounding (Spatial Scan)**: Bypasses standard DOM scrapers using `chrome.tabs.captureVisibleTab`. This allows the AI to "see" diagrams, layouts, and OCR non-selectable content in PDFs or images.
2. **Dwell Intelligence**: Monitors "interaction signals" like scroll speed and paragraph-level dwell time. If a user spends an outlier amount of time on a dense section, ConteXia proactively offers a simplified audio summary.
3. **Directed Attention**: Dynamically ingests hover-states and text selections, ensuring the AI response is weighted toward the user’s immediate point of focus.

### The Role of Audio
Audio is not an afterthought in ConteXia—it is the primary interface.
1. **Presence Mode**: A speech-to-speech interaction layer using **Groq** and **Cartesia**. It treats conversation as a hands-free, ethereal dialogue.
2. **Barge-In Logic**: Real-time microphone monitoring allows users to interrupt the AI response naturally, creating a fluid back-and-forth that mimics human collaborative reading.
3. **Contextual Alerts**: Uses subtle audio chimes to signal when it has extra context or an "Ink Mind" annotation available, reducing visual cognitive load.

---

## 🧠 Intelligence & Deep Features

-   **Vision Mapping (Spatial Scan)**: High-fidelity viewport capture to understand any visual surface.
-   **Tree Log Interface**: A nature-themed, 9-slice reactive UI that grows with your thoughts.
-   **Presence (Liquid Audio)**: Sub-500ms latency STT/TTS pipeline with real-time frequency-reactive visualizations.
-   **Boutique Annotation Ink**: Persistently annotate the web with smooth, stationer-grade digital strokes.
-   **Production Hardening**: Persistent rate limiting and multi-model fallbacks for high availability.

---

## 🛠️ The Stack

-   **Frontend**: Svelte (Vite) + Tailwind CSS v4
-   **Reasoning**: **Groq** (Llama 3.3 70B & Vision models)
-   **Voice**: **Cartesia Sonic-3** (Premium TTS)
-   **Motion**: GSAP for liquid physics and fluid transitions.

---

## 🚀 Installation

### 1. Configure Keys
Create a `.env` file in the root directory with your API keys:
```bash
cp .env.example .env
```

### 2. Build and Load
```bash
npm install
npm run build
```
Load the **`dist`** folder into Chrome via `chrome://extensions/` with **Developer mode** enabled.

---

## 🛡️ Usage & Limits
- **Chat**: 10 requests / min
- **Voice**: 20 requests / min

---
*Built for the future of deep reading.*