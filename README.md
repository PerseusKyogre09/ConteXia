# ConteXia 🌿🖋️
### *The Audio-First Context-Aware Reading Assistant*

[**Visit the Live Site 🌐**](https://perseuskyogre09.github.io/ConteXia/)

**ConteXia** is a minimal, premium AI partner designed for deep work. She lives in your browser, understanding exactly where your attention lies and bridging the gap between digital text and natural spoken dialogue. No generic summaries—just deep dives and human-grade narration.

---

## 🧠 Intelligence & Deep Features

ConteXia is a multi-modal context engine disguised as a nature-themed sidepanel.

-   **Vision Mapping (Spatial Scan)**: Bypasses traditional text scrapers using dynamic viewport capture (via `chrome.tabs.captureVisibleTab`). Understands layouts, diagrams, and OCRs non-selectable content in real-time.
-   **Tree Log Interface**: A reactive physics UI using **9-slice bark textures** and Svelte transitions. The input interface scales vertically with your thoughts, providing a physical, textured feel to digital dialogue.
-   **Presence (Liquid Audio)**: An ultra-low latency STT/TTS pipeline (Groq + Cartesia) with frequency-reactive gooey blob physics. Implements **barge-in** logic, allowing users to interrupt the AI for natural, human-like turn-taking.
-   **Boutique Annotation Ink**: A Shadow DOM-isolated canvas layer for SILKY smooth digital ink. Uses quadratic curve interpolation for a high-fidelity "stationery" feel that persists across page refreshes.
-   **Dwell Intelligence**: Silent background "Reading Sentinel" that monitors focus patterns and scroll density to offer proactive help exactly when you encounter complex sections.
-   **Production Hardening**: Persistent rate limiting (10 RPM Groq, 20 RPM Cartesia) and secure key management, ensuring reliability for multi-user demonstrations.

---

## 🛠️ The Stack

-   **Frontend**: Svelte (Vite) + Tailwind CSS v4
-   **Reasoning**: **Groq** (Llama 3.3 70B & Vision models)
-   **Voice**: **Cartesia Sonic-3** (Premium TTS)
-   **Motion**: GSAP for fluid, stationery-inspired transitions.

---

## 🚀 Installation

### 1. Configure Keys
ConteXia requires API keys for Groq and Cartesia. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

### 2. Build for Chrome
Since this is a Vite-powered extension, it needs to be built before loading into Chrome:
```bash
# Install dependencies
npm install

# Create the production build
npm run build
```

### 3. Load into Browser
1. Open **Chrome** and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** to **ON** (top-right).
3. Click **Load unpacked** and select the **`dist`** folder (generated in step 2).

> [!CAUTION]
> **Do NOT load the root project folder.** Chrome will fail with a syntax error because the source code isn't bundled yet. You must load the `dist` folder.

---

## 🛡️ Usage & Limits
To keep things moving smoothly during the beta:
- **Chat**: 10 requests / min
- **Voice**: 20 requests / min

---
*Built for the future of deep reading.* 🥂🍃
