import { get, writable } from 'svelte/store';
import { currentCartesiaKey, cartesiaVoiceId, ttsEngine, apiKey as groqApiKey } from '../store';

export const audioVolume = writable(0);

let audioCtx;
let currentSource = null;
let analyser;
let micStream;
let micSource;

function sanitizeForTTS(text) {
    return text
        .replace(/[*_#~`]/g, '') // Remove markdown symbols
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
        .replace(/!\[([^\]]+)\]\([^)]+\)/g, '') // Remove images
        .replace(/<[^>]*>?/gm, '') // Remove any HTML tags
        .trim();
}

export function stopAllAudio() {
    if (currentSource) {
        try { currentSource.stop(); } catch (e) { }
        currentSource = null;
    }
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
}

async function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        startVolumeTracking();
    }
    if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch (e) { }
    }
    return audioCtx;
}

function startVolumeTracking() {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const update = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        audioVolume.set(average / 128); // Normalize to ~0.0 - 1.0 range
        requestAnimationFrame(update);
    };
    update();
}

export async function startMicVolume() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx = await getAudioCtx();
        micStream = stream;
        micSource = ctx.createMediaStreamSource(stream);
        micSource.connect(analyser); // We DON'T connect to ctx.destination (no feedback)
    } catch (e) {
        console.error("Mic volume tracking failed:", e);
    }
}

export function stopMicVolume() {
    if (micSource) {
        micSource.disconnect();
        micSource = null;
    }
    if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
    }
}

export async function speakWithCartesia(text) {
    const engine = get(ttsEngine);
    const sanitized = sanitizeForTTS(text);

    if (engine === 'browser') {
        return fallbackSpeak(sanitized);
    }

    const cartesiaKey = get(currentCartesiaKey);
    const voiceId = get(cartesiaVoiceId);

    if (cartesiaKey) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'CARTESIA_TTS',
                payload: { transcript: sanitized, voiceId, apiKey: cartesiaKey }
            });

            if (response && !response.error) {
                const binaryString = atob(response.data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                const ctx = await getAudioCtx();
                const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
                await playAudioBuffer(audioBuffer);
                return;
            }
            console.warn("Cartesia failed:", response?.error);
        } catch (error) {
            console.error("Cartesia communication error:", error);
        }
    }

    // Fallback to Groq
    return speakWithGroq(sanitized);
}

export async function speakWithGroq(text) {
    const apiKey = get(groqApiKey);
    if (!apiKey) {
        return fallbackSpeak(text);
    }

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GROQ_TTS',
            payload: { transcript: text, apiKey }
        });

        if (!response || response.error) {
            throw new Error(response?.error || "Groq fetch failed");
        }

        const binaryString = atob(response.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const ctx = await getAudioCtx();
        const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
        await playAudioBuffer(audioBuffer);
    } catch (error) {
        console.error("Groq fallback failed, final fallback to Browser:", error);
        return fallbackSpeak(text);
    }
}

function fallbackSpeak(text) {
    return new Promise((resolve) => {
        if (!window.speechSynthesis) return resolve();
        stopAllAudio();
        const ut = new SpeechSynthesisUtterance(text);
        ut.onend = resolve;
        ut.onerror = resolve;
        window.speechSynthesis.speak(ut);
    });
}

/**
 * Plays a subtle premium interaction ping.
 */
export async function playInteractionPing(type = 'chip') {
    const ctx = await getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'chip' || type === 'focus') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(type === 'chip' ? 880 : 1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    }

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
}

async function playAudioBuffer(audioBuffer) {
    const ctx = await getAudioCtx();
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyser);
    source.connect(ctx.destination); // Connect speech to speakers explicitly

    return new Promise((resolve) => {
        source.onended = () => {
            currentSource = null;
            resolve();
        };
        currentSource = source;
        source.start();
    });
}
