import { RateLimiter } from '../utils/rate_limiter';

const groqLimiter = new RateLimiter('Groq', 10, 60000);
const cartesiaLimiter = new RateLimiter('Cartesia', 20, 60000);
const whisperLimiter = new RateLimiter('Whisper', 30, 60000);

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);

chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
    if (change.status === 'complete' && tab.url?.startsWith('file://')) {
        const isAllowed = await chrome.extension.isAllowedFileSchemeAccess();
        if (isAllowed) {
            const manifest = chrome.runtime.getManifest();
            const contentScript = manifest.content_scripts?.[0]?.js?.[0];
            if (contentScript) {
                chrome.scripting.executeScript({
                    target: { tabId },
                    files: [contentScript]
                }).catch(() => { });
            }
        }
    }
});

chrome.runtime.onInstalled.addListener(() => {
    const menus = [
        { id: 'contexia-pronounce', title: 'Pronounce with ConteXia', contexts: ['selection'] },
        { id: 'contexia-summarize', title: 'Summarize with ConteXia', contexts: ['all'] },
        { id: 'contexia-explain', title: 'Explain with ConteXia', contexts: ['all'] },
        { id: 'contexia-read-aloud', title: 'Read Aloud with ConteXia', contexts: ['all'] }
    ];
    menus.forEach(menu => chrome.contextMenus.create(menu));
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    const actionMap = {
        'contexia-pronounce': 'PRONOUNCE',
        'contexia-summarize': 'SUMMARIZE',
        'contexia-explain': 'EXPLAIN',
        'contexia-read-aloud': 'READ_ALOUD'
    };

    const action = actionMap[info.menuItemId];
    if (action) {
        const msgId = `${action.toLowerCase()}_${Date.now()}`;
        const text = info.selectionText || '';
        const payload = { action, text, msgId, timestamp: Date.now() };

        chrome.storage.local.set({ pending_command: payload });
        chrome.sidePanel.open({ tabId: tab.id });

        const dispatch = () => {
            chrome.runtime.sendMessage({ type: 'APP_COMMAND', payload }).catch(() => { });
        };

        setTimeout(dispatch, 800);
        setTimeout(dispatch, 2000);
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handlers = {
        ASK_GROQ: handleGroqRequest,
        CARTESIA_TTS: handleCartesiaTTS,
        GROQ_TTS: handleGroqTTS,
        GROQ_TRANSCRIPTION: handleGroqTranscription
    };

    if (handlers[message.type]) {
        handlers[message.type](message.payload).then(sendResponse);
        return true;
    }

    if (['DWELL_SIGNAL', 'HEADING_ENTERED', 'VISION_HOVER_SIGNAL'].includes(message.type)) {
        chrome.runtime.sendMessage({
            type: `PROACTIVE_${message.type}`,
            payload: message.payload
        }).catch(() => { });
    }

    if (message.type === 'CHIP_CLICK' && message.payload.action === 'SUMMARIZE') {
        const { text, msgId } = message.payload;
        const payload = { action: 'SUMMARIZE', text, msgId, timestamp: Date.now() };

        chrome.storage.local.set({ pending_command: payload });
        chrome.sidePanel.open({ tabId: sender.tab.id });

        chrome.runtime.sendMessage({ type: 'APP_COMMAND', payload }).catch(() => { });
        setTimeout(() => chrome.runtime.sendMessage({ type: 'APP_COMMAND', payload }).catch(() => { }), 1000);
        return true;
    }
});

async function handleCartesiaTTS({ transcript, voiceId, apiKey }) {
    const limit = await cartesiaLimiter.checkLimit();
    if (!limit.allowed) return { error: limit.message };

    try {
        await cartesiaLimiter.recordRequest();
        const response = await fetch('https://api.cartesia.ai/tts/bytes', {
            method: 'POST',
            headers: {
                'X-API-Key': apiKey,
                'Cartesia-Version': '2024-06-10',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model_id: 'sonic-3',
                transcript,
                voice: { mode: 'id', id: voiceId },
                output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 44100 }
            })
        });

        if (!response.ok) throw new Error(`Cartesia error: ${response.status}`);

        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        return { data: btoa(binary) };
    } catch (e) {
        return { error: e.message };
    }
}

async function handleGroqTranscription({ base64Audio, apiKey, filename = 'speech.webm' }) {
    const limit = await whisperLimiter.checkLimit();
    if (!limit.allowed) return { error: limit.message };

    try {
        await whisperLimiter.recordRequest();
        const res = await fetch(`data:audio/webm;base64,${base64Audio}`);
        const file = new File([await res.blob()], filename, { type: 'audio/webm' });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('model', 'whisper-large-v3');

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: formData
        });

        const data = await response.json();
        return { text: data.text };
    } catch (e) {
        return { error: e.message };
    }
}

async function handleGroqTTS({ transcript, apiKey }) {
    const limit = await groqLimiter.checkLimit();
    if (!limit.allowed) return { error: limit.message };

    try {
        await groqLimiter.recordRequest();
        const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'canopylabs/orpheus-v1-english',
                input: transcript,
                voice: 'sonia',
                response_format: 'mp3'
            })
        });

        if (!response.ok) throw new Error(`Groq TTS error: ${response.status}`);

        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        return { data: btoa(binary) };
    } catch (e) {
        return { error: e.message };
    }
}

async function handleGroqRequest({ question, context, apiKey, tone, history }) {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const ctx = context || {
        url: tab?.url || '',
        pageTitle: tab?.title || '',
        selectedText: ''
    };

    const isVision = /chart|table|image|layout|what am i looking at|see|this page|look|view/i.test(question) ||
        ctx.url?.toLowerCase().endsWith('.pdf') || ctx.pageTitle?.toLowerCase().includes('.pdf');

    const model = isVision ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile';

    const systemPrompt = `You are ConteXia, a chill, knowledgeable friend.
Tone: ${tone || 'Casual'}.
CRITICAL IMMERSION RULES:
1. Talk as if you are looking over the user's shoulder. 
2. Refer to context as "this document," "this article," or "what you're reading."
3. Visual input is "what I'm seeing" or "that diagram."
4. Be warm, conversational, and avoid robotic greetings.`;

    const messages = [{ role: 'system', content: systemPrompt }];

    if (history?.length) {
        messages.push(...history.map(m => ({
            role: m.role === "ai" ? "assistant" : m.role,
            content: m.content,
        })));
    }

    const isFirst = !history || history.length === 0;
    const userPrompt = (isFirst || isVision) ? buildUserPrompt(question, ctx) : question;

    if (isVision && tab) {
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 40 });
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: userPrompt },
                    { type: 'image_url', image_url: { url: dataUrl } }
                ]
            });
        } catch {
            messages.push({ role: 'user', content: userPrompt });
        }
    } else {
        messages.push({ role: 'user', content: userPrompt });
    }

    const limit = await groqLimiter.checkLimit();
    if (!limit.allowed) return { error: limit.message };

    try {
        await groqLimiter.recordRequest();
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1024 })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return { answer: data.choices[0].message.content.trim() };
    } catch (e) {
        return { error: e.message };
    }
}

function buildUserPrompt(question, context) {
    if (!context) return question;
    const ctxText = context.selectedText ? `You highlighted: "${context.selectedText}"` : `You're on: "${context.pageTitle}"`;
    return `Context: ${ctxText}\nQuestion: ${question}`;
}
