import { get, writable } from 'svelte/store';
import { currentCartesiaKey, cartesiaVoiceId, ttsEngine, apiKey as groqApiKey, isSpeaking } from '../store';

export const audioVolume = writable(0);

let audioCtx;
let currentSource = null;
let analyser;
let micStream;
let micSource;

function sanitizeForTTS(text) {
    return text
        .replace(/[*_#~`]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/!\[([^\]]+)\]\([^)]+\)/g, '')
        .replace(/<[^>]*>?/gm, '')
        .trim();
}

export function stopAllAudio() {
    isSpeaking.set(false);
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
        audioVolume.set(average / 128);
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
        micSource.connect(analyser);
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

export async function speak(text) {
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
        } catch (error) {
            console.warn("Cartesia failed, falling back to Groq:", error);
        }
    }

    const apiKey = get(groqApiKey);
    if (apiKey) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GROQ_TTS',
                payload: { transcript: sanitized, apiKey }
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
        } catch (error) {
            console.warn("Groq failed, final fallback to Browser:", error);
        }
    }

    return fallbackSpeak(sanitized);
}

function fallbackSpeak(text) {
    return new Promise((resolve) => {
        if (!window.speechSynthesis) return resolve();
        stopAllAudio();
        isSpeaking.set(true);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => {
            isSpeaking.set(false);
            resolve();
        };
        utterance.onerror = () => {
            isSpeaking.set(false);
            resolve();
        };
        window.speechSynthesis.speak(utterance);
    });
}

export function playProactiveChime(type = 'smart') {
    const ctx = audioCtx;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'smart') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    } else if (type === 'vision') {
        osc.type = 'sine';
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
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (type === 'chip' || type === 'focus') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(type === 'chip' ? 880 : 1200, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.04, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    }

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);
}

async function playAudioBuffer(buffer) {
    const ctx = await getAudioCtx();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyser);
    source.connect(ctx.destination);

    return new Promise((resolve) => {
        isSpeaking.set(true);
        source.onended = () => {
            currentSource = null;
            isSpeaking.set(false);
            resolve();
        };
        currentSource = source;
        source.start();
    });
}
