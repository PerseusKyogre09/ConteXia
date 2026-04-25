import { get } from 'svelte/store';
import { currentCartesiaKey, cartesiaVoiceId } from '../store';

let audioCtx;

async function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch (e) { }
    }
    return audioCtx;
}

export async function speakWithCartesia(text) {
    const apiKey = get(currentCartesiaKey);
    const voiceId = get(cartesiaVoiceId);

    if (!apiKey) {
        return fallbackSpeak(text);
    }

    try {
        // Proxy through background to avoid CORS/Origin blocks
        const response = await chrome.runtime.sendMessage({
            type: 'CARTESIA_TTS',
            payload: { transcript: text, voiceId, apiKey }
        });

        if (!response || response.error) {
            throw new Error(response?.error || "Background fetch failed");
        }

        // Convert base64 back to ArrayBuffer
        const binaryString = atob(response.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const ctx = await getAudioCtx();
        const audioBuffer = await ctx.decodeAudioData(bytes.buffer);

        await playAudioBuffer(audioBuffer);
    } catch (error) {
        console.error("Cartesia proxy failed, falling back:", error);
        return fallbackSpeak(text);
    }
}

function fallbackSpeak(text) {
    return new Promise((resolve) => {
        if (!window.speechSynthesis) return resolve();
        window.speechSynthesis.cancel();
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
    source.connect(ctx.destination);

    return new Promise((resolve) => {
        source.onended = resolve;
        source.start();
    });
}
