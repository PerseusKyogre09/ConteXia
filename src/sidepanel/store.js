import { writable, derived } from 'svelte/store';

export const context = writable(null);
export const messages = writable([]);
export const isListening = writable(false);
export const isSpeaking = writable(false);
export const isLoading = writable(false);
export const ttsEngine = writable('api');

const INITIAL_GROQ = import.meta.env.VITE_GROQ_API_KEY || '';
const INITIAL_CARTESIA = import.meta.env.VITE_CARTESIA_API_KEY || '';

export const useCustomKey = writable(false);
export const customApiKey = writable('');
export const cartesiaKey = writable('');
export const cartesiaVoiceId = writable('6ccbfb76-1fc6-48f7-b71d-91ac6298247b'); // Tessa (Premium)

export const apiKey = derived(
    [useCustomKey, customApiKey],
    ([$useCustomKey, $customApiKey]) => $useCustomKey ? $customApiKey : INITIAL_GROQ
);

export const currentCartesiaKey = derived([cartesiaKey], ([$k]) => $k || INITIAL_CARTESIA);

export const tone = writable('Casual');
export const preferVoice = writable(true); // Default to enabled
export const showSettings = writable(false);
export const proactiveHint = writable(null);
export const currentSelection = writable('');
export const staticSurface = writable(false);

chrome.storage.local.get(['groq_api_key', 'contexia_tone', 'use_custom_key', 'custom_api_key', 'cartesia_key', 'cartesia_voice_id', 'contexia_tts_engine', 'contexia_prefer_voice']).then(data => {
    if (data.use_custom_key !== undefined) useCustomKey.set(data.use_custom_key);
    if (data.custom_api_key) customApiKey.set(data.custom_api_key);
    if (data.contexia_tts_engine) ttsEngine.set(data.contexia_tts_engine);
    else if (data.groq_api_key) {
        customApiKey.set(data.groq_api_key);
        useCustomKey.set(true);
    }
    if (data.contexia_tone) tone.set(data.contexia_tone);
    if (data.cartesia_key) cartesiaKey.set(data.cartesia_key);
    if (data.cartesia_voice_id) cartesiaVoiceId.set(data.cartesia_voice_id);
    if (data.contexia_prefer_voice !== undefined) preferVoice.set(data.contexia_prefer_voice);
});

chrome.storage.session.get(['contexia_messages']).then(data => {
    if (data.contexia_messages) messages.set(data.contexia_messages);
});

let init = false;
setTimeout(() => init = true, 500);

const sync = (key, val) => init && chrome.storage.local.set({ [key]: val });

useCustomKey.subscribe(v => sync('use_custom_key', v));
customApiKey.subscribe(v => sync('custom_api_key', v));
tone.subscribe(v => sync('contexia_tone', v));
messages.subscribe(v => init && chrome.storage.session.set({ contexia_messages: v }));
cartesiaKey.subscribe(v => sync('cartesia_key', v));
cartesiaVoiceId.subscribe(v => sync('cartesia_voice_id', v));
ttsEngine.subscribe(v => sync('contexia_tts_engine', v));
preferVoice.subscribe(v => sync('contexia_prefer_voice', v));

export function addMessage(role, content) {
    messages.update(m => [...m, { role, content, timestamp: Date.now() }]);
}

export function clearHistory() {
    messages.set([]);
}
