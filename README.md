# ConteXia 🌿🖋️
### *The Audio-First Context-Aware Reading Assistant*

**ConteXia** is a minimal, premium AI partner designed for deep work. She lives in your browser, understanding exactly where your attention lies and bridging the gap between digital text and natural spoken dialogue. No generic summaries—just deep dives and human-grade narration.

---

## 🧠 Intelligence & Features

ConteXia doesn't just "see" the page; she follows your flow.

- **Deep Focus**: Ditch the one-paragraph summary. Get a comprehensive, context-aware breakdown of any text or selection.
- **Pure Audio**: Ultra-low latency narration powered by **Cartesia**. Listen to the web with voices that actually sound human.
- **Visual Brain**: Analyze charts, PDFs, and complex diagrams instantly. If you can see it, ConteXia can explain it.
- **Ink Mind**: A boutique handwriting engine for digital thoughts. Annotate the web with silky-smooth Bézier curves like actual stationery.
- **Prefer Voice**: A dedicated hands-free mode. Enable this to have every AI response narrated automatically.

---

## 🛠️ The Stack

- **Frontend**: Svelte (Vite) + Tailwind CSS v4
- **Reasoning**: **Groq** (Llama 3.3 70B & Vision models)
- **Voice**: **Cartesia Sonic-3** (Premium TTS)
- **Motion**: GSAP for fluid, stationery-inspired transitions.

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
3. Click **Load unpacked** and select the `dist` folder generated in the project root.

> [!NOTE]
> If you are using a pre-packaged release, simply select the extracted folder containing the `manifest.json`.

---

## 🛡️ Usage & Limits
To keep things moving smoothly during the beta:
- **Chat**: 10 requests / min
- **Voice**: 20 requests / min

---
*Built for the future of deep reading.* 🥂🍃
