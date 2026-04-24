### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/)
- A [Groq API Key](https://console.groq.com/keys)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/ConteXia.git
    cd ConteXia
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Build the extension**:
    ```bash
    npm run build
    ```

4.  **Load into Chrome**:
    - Open `chrome://extensions/`
    - Enable **Developer mode** (top right).
    - Click **Load unpacked** and select the `dist` folder in this project directory.

## 🛠️ Technology Stack

- **Framework**: [Svelte](https://svelte.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/) with [CRXJS](https://crxjs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Intelligence**: [Groq Cloud](https://groq.com/) (Llama 3.3 & Llama 4 Scout)
- **Voice**: Web Speech API (Recognition & Synthesis)

## 🎨 Design Philosophy

ConteXia adheres to the **Midnight Ink** design system:
- **Palette**: `#0F172A` (Midnight), `#38BDF8` (Icy Blue), `#FACC15` (Gold).
- **Texture**: Fractal-noise overlays for a "physical paper" feel.
- **Typography**: High-density "Outfit" sans-serif for professional readability.

## 📄 License

MIT License. Designed with care for the modern reader.
