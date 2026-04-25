# ConteXia 🌿🖋️
### *The Audio-First Context-Aware Reading Assistant*

**ConteXia** is an immersive AI partner designed for deep work. She lives in your browser, understanding exactly where your attention lies and bridging the gap between digital text and natural spoken dialogue.

---

## 🧠 Live Context Awareness (25%)
ConteXia doesn't just "see" the page; she follows your attention.

- **Dwell-Time Tracking**: Our `DwellTrigger` system monitors mouse movement and scroll patterns. If you linger on a section for more than 2 seconds (8s for dense PDFs), ConteXia discreetly offers assistance.
- **Precision Extraction**: Using the `context_extractor` utility, we synthesize information from:
    - **Active Selection**: Immediate focus on highlighted text.
    - **Proximity Hover**: Context derived from elements nearest to the cursor.
    - **Visual Grounding**: Native support for PDFs and complex layouts via Vision LLMs.
- **Ink Annotation Layer**: For absolute precision, use the **silky-smooth Bézier pen** to circle or underline sections. ConteXia "sees" these annotations and prioritizes them in her reasoning.

## 🎙️ Audio-First Experience (25%)
Audio is the primary outcome, not an afterthought.

- **Ultra-Low Latency Speech**: Powered by **Cartesia**, ConteXia delivers near-instant spoken summaries and explanations (sub-200ms latency).
- **Interactive Audio Feedback**: Subtle **Sine-wave pings** provide non-visual confirmation when ConteXia identifies a focus point or completes an analysis.
- **Presence Mode**: A hands-free reactive interface. ConteXia listens and responds, with a **liquid-physics visualization** that dances in sync with the audio volume.
- **Sanitized Narrations**: Automatic markdown stripping ensures ConteXia talks like a human friend, not a screen reader.

## 🛠️ Tech Stack & Execution
- **Framework**: Svelte + Vite (Chrome Extension v3 Manifesto)
- **Intelligence**: **Groq** (Llama 3.3 70B for reasoning, Llama 4 Scout for vision)
- **Voice**: **Cartesia Sonic-3** for premium TTS.
- **Animations**: GSAP for fluid, stationery-inspired transitions.

---

## 🚀 Getting Started

### 1. Environment Configuration
ConteXia requires API keys for Groq and Cartesia. Create a `.env` file from the example:
```bash
cp .env.example .env
```

### 2. Build the Extension
```bash
# Install dependencies
npm install

# Create the production build
npm run build
```

### 3. Load into Chrome (Developer Mode)
Since this extension is in active development, you can load it directly into Chrome without using the Web Store:

1. Open **Chrome** and navigate to `chrome://extensions/`.
2. In the top-right corner, toggle **Developer mode** to **ON**.
3. Click the **Load unpacked** button that appears.
4. Select the `dist` folder located in the project root.

> [!TIP]
> ConteXia is now active! Look for the extension icon in your toolbar or open the Side Panel directly.


---

## 🛡️ Usage & Rate Limits
To prevent API abuse during the demo phase:
- **Chat**: 10 requests per minute.
- **Voice**: 20 requests per minute.

---
*Designed for the Hackathon Challenge: Building Context-Aware Audio Assistants.* 🥂🍃🛡️✨
