import { writable, derived } from 'svelte/store';

export const context = writable(null);
export const messages = writable([]);
export const isListening = writable(false);
export const isSpeaking = writable(false);
export const isLoading = writable(false);

const INITIAL_BUILTIN = import.meta.env.VITE_GROQ_API_KEY || '';
export const useCustomKey = writable(false);
export const customApiKey = writable('');

export const apiKey = derived(
    [useCustomKey, customApiKey],
    ([$useCustomKey, $customApiKey]) => {
        return $useCustomKey ? $customApiKey : INITIAL_BUILTIN;
    }
);

export const tone = writable('Casual');
export const showSettings = writable(false);


chrome.storage.local.get(['groq_api_key', 'contexia_tone', 'use_custom_key', 'custom_api_key']).then(data => {
    if (data.use_custom_key !== undefined) useCustomKey.set(data.use_custom_key);
    if (data.custom_api_key) customApiKey.set(data.custom_api_key);
    else if (data.groq_api_key) {
        customApiKey.set(data.groq_api_key);
        useCustomKey.set(true);
    }
    if (data.contexia_tone) tone.set(data.contexia_tone);
});

chrome.storage.session.get(['contexia_messages']).then(data => {
    if (data.contexia_messages) messages.set(data.contexia_messages);
});


let initialized = false;
setTimeout(() => initialized = true, 500);

useCustomKey.subscribe(v => initialized && chrome.storage.local.set({ use_custom_key: v }));
customApiKey.subscribe(v => initialized && v && chrome.storage.local.set({ custom_api_key: v }));
tone.subscribe(v => initialized && chrome.storage.local.set({ contexia_tone: v }));
messages.subscribe(v => initialized && chrome.storage.session.set({ contexia_messages: v }));

export function addMessage(role, content) {
    messages.update(m => [...m, { role, content, timestamp: Date.now() }]);
}

export function clearHistory() {
    messages.set([]);
}
