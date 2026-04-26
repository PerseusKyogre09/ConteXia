import { get, writable } from 'svelte/store';
import { currentCartesiaKey, cartesiaVoiceId, ttsEngine, apiKey as groqApiKey, isSpeaking } from '../store';

export const audioVolume = writable(0);

let audioCtx;
let currentSource = null;
let analyser;
let micStream;
let micSource;

const sanitize = (text) => text.replace(/[*_#~`]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/!\[([^\]]+)\]\([^)]+\)/g, '').replace(/<[^>]*>?/gm, '').trim();

export function stopAllAudio() {
    isSpeaking.set(false);
    if (currentSource) {
        try { currentSource.stop(); } catch { }
        currentSource = null;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
}

async function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            audioVolume.set(avg / 128);
            requestAnimationFrame(loop);
        };
        loop();
    }
    if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => { });
    return audioCtx;
}

export async function startMicVolume() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx = await getAudioCtx();
        micStream = stream;
        micSource = ctx.createMediaStreamSource(stream);
        micSource.connect(analyser);
    } catch (e) {
        console.error(e);
    }
}

export function stopMicVolume() {
    if (micSource) micSource.disconnect();
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    micSource = micStream = null;
}

export async function speak(text) {
    const mode = get(ttsEngine);
    const textToSpeak = sanitize(text);

    if (mode === 'browser') return fallbackSpeak(textToSpeak);

    const cartesiaKey = get(currentCartesiaKey);
    if (cartesiaKey) {
        try {
            const resp = await chrome.runtime.sendMessage({
                type: 'CARTESIA_TTS',
                payload: { transcript: textToSpeak, voiceId: get(cartesiaVoiceId), apiKey: cartesiaKey }
            });
            if (resp?.data) return playBase64(resp.data);
        } catch { }
    }

    const gKey = get(groqApiKey);
    if (gKey) {
        try {
            const resp = await chrome.runtime.sendMessage({
                type: 'GROQ_TTS',
                payload: { transcript: textToSpeak, apiKey: gKey }
            });
            if (resp?.data) return playBase64(resp.data);
        } catch { }
    }

    return fallbackSpeak(textToSpeak);
}

async function playBase64(data) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const ctx = await getAudioCtx();
    const buffer = await ctx.decodeAudioData(bytes.buffer);
    return playBuffer(buffer);
}

function fallbackSpeak(text) {
    return new Promise((resolve) => {
        if (!window.speechSynthesis) return resolve();
        stopAllAudio();
        isSpeaking.set(true);
        const utter = new SpeechSynthesisUtterance(text);
        utter.onend = utter.onerror = () => { isSpeaking.set(false); resolve(); };
        window.speechSynthesis.speak(utter);
    });
}

export function playProactiveChime(type = 'smart') {
    const ctx = audioCtx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'smart') {
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    } else {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(554.37, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    }
    osc.start();
    osc.stop(ctx.currentTime + 1);
}

export async function playInteractionPing(type = 'chip') {
    const ctx = await getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(type === 'focus' ? 1200 : 880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
}

async function playBuffer(buffer) {
    const ctx = await getAudioCtx();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyser);
    source.connect(ctx.destination);
    return new Promise((resolve) => {
        isSpeaking.set(true);
        source.onended = () => { currentSource = null; isSpeaking.set(false); resolve(); };
        currentSource = source;
        source.start();
    });
}
