import { RateLimiter } from '../utils/rate_limiter';

const groqLimiter = new RateLimiter('Groq', 10, 60000);
const cartesiaLimiter = new RateLimiter('Cartesia', 20, 60000);
const whisperLimiter = new RateLimiter('Whisper', 30, 60000);

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.startsWith('file://')) {
        const isAllowed = await chrome.extension.isAllowedFileSchemeAccess();
        if (isAllowed) {
            const manifest = chrome.runtime.getManifest();
            const contentScript = manifest.content_scripts?.[0]?.js?.[0];
            if (contentScript) {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: [contentScript]
                }).catch(() => { });
            }
        }
    }
});

chrome.runtime.onInstalled.addListener(() => {
    const menus = [
        { id: 'ask-contexia', title: 'Ask ConteXia', contexts: ['selection'] },
        { id: 'contexia-summarize', title: 'Summarize with ConteXia', contexts: ['all'] },
        { id: 'contexia-explain', title: 'Explain with ConteXia', contexts: ['all'] },
        { id: 'contexia-read-aloud', title: 'Read Aloud with ConteXia', contexts: ['all'] }
    ];
    menus.forEach(menu => chrome.contextMenus.create(menu));
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'ask-contexia') {
        chrome.sidePanel.open({ tabId: tab.id });
        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: 'PUSH_SELECTION',
                payload: info.selectionText
            }).catch(() => { });
        }, 800);
        return;
    }

    const actions = {
        'contexia-summarize': 'SUMMARIZE',
        'contexia-explain': 'EXPLAIN',
        'contexia-read-aloud': 'READ_ALOUD'
    };

    const action = actions[info.menuItemId];
    if (action) {
        const msgId = `context_${Date.now()}`;
        const text = info.selectionText || '';

        chrome.storage.local.set({
            pending_command: {
                action,
                text,
                msgId,
                timestamp: Date.now()
            }
        });

        chrome.sidePanel.open({ tabId: tab.id });

        const dispatch = () => {
            chrome.runtime.sendMessage({
                type: 'APP_COMMAND',
                payload: { action, text, msgId }
            }).catch(() => { });
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

    if (message.type === 'CHIP_CLICK' && message.payload.action === 'SUMMARIZE') {
        const { text, msgId } = message.payload;
        const tabId = sender.tab.id;

        chrome.storage.local.set({
            pending_command: {
                action: 'SUMMARIZE',
                text,
                msgId,
                timestamp: Date.now()
            }
        });

        chrome.sidePanel.open({ tabId });

        const dispatch = () => {
            chrome.runtime.sendMessage({
                type: 'APP_COMMAND',
                payload: { action: 'SUMMARIZE', text, msgId }
            }).catch(() => { });
        };

        dispatch();
        setTimeout(dispatch, 800);
        setTimeout(dispatch, 2000);
        return true;
    }
});

async function handleCartesiaTTS({ transcript, voiceId, apiKey }) {
    const limitCheck = await cartesiaLimiter.checkLimit();
    if (!limitCheck.allowed) return { error: limitCheck.message };

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
                output_format: {
                    container: 'wav',
                    encoding: 'pcm_s16le',
                    sample_rate: 44100
                }
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Cartesia rejected: ${response.status} - ${errBody}`);
        }

        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return { data: btoa(binary) };
    } catch (error) {
        console.error("Cartesia request failed:", error);
        return { error: error.message };
    }
}

async function handleGroqTranscription({ base64Audio, apiKey, filename = 'speech.webm' }) {
    const limitCheck = await whisperLimiter.checkLimit();
    if (!limitCheck.allowed) return { error: limitCheck.message };

    try {
        await whisperLimiter.recordRequest();

        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/webm' });
        const file = new File([blob], filename, { type: 'audio/webm' });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('model', 'whisper-large-v3');
        formData.append('response_format', 'json');

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}` },
            body: formData
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Whisper rejected: ${response.status} - ${errBody}`);
        }

        const data = await response.json();
        return { text: data.text };
    } catch (error) {
        console.error("Whisper request failed:", error);
        return { error: error.message };
    }
}

async function handleGroqTTS({ transcript, apiKey }) {
    const limitCheck = await groqLimiter.checkLimit();
    if (!limitCheck.allowed) return { error: limitCheck.message };

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

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Groq TTS rejected: ${response.status} - ${errBody}`);
        }

        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return { data: btoa(binary) };
    } catch (error) {
        console.error("Groq TTS request failed:", error);
        return { error: error.message };
    }
}

async function handleGroqRequest({ question, context, apiKey, tone, history }) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const finalContext = context || {
        url: tab?.url || '',
        pageTitle: tab?.title || '',
        selectedText: '',
        visibleViewportText: '',
        hoveredSection: ''
    };

    const isVisionKeyword = /chart|table|image|layout|what am i looking at|see|this page|look|view/i.test(question);
    const isPDF = finalContext.url?.toLowerCase().endsWith('.pdf') || finalContext.pageTitle?.toLowerCase().includes('.pdf');
    const isVision = isVisionKeyword || isPDF;

    const model = isVision ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile';

    const systemPrompt = `You are ConteXia, a chill, knowledgeable friend.
Tone: ${tone || 'Casual'}.
CRITICAL IMMERSION RULES:
1. NEVER mention technical terms like "screenshot," "capture," "image," "file," "PDF," or "this page."
2. Talk as if you are looking over the user's shoulder at their screen.
3. Refer to visual input as "what I'm seeing," "your notes," "your annotations," or directly by the content.
4. If this is a follow-up, just reply naturally like a friend in a DM.
5. Be causal, warm, and conversational.
6. Adapt your length to the request.
7. Prioritize a comprehensive breakdown for "explain" requests.
8. No disclaimers, no robotic greetings, no "As an AI."`;

    let messages = [{ role: 'system', content: systemPrompt }];

    if (history?.length) {
        messages.push(...history.map(m => ({
            role: m.role === "ai" ? "assistant" : m.role,
            content: m.content,
        })));
    }

    const isFirstMessage = !history || history.length === 0;
    const userMessageContent = (isFirstMessage || isVision)
        ? buildUserPrompt(question, finalContext)
        : question;

    if (isVision && tab) {
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 40 });
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: userMessageContent },
                    { type: 'image_url', image_url: { url: dataUrl } }
                ]
            });
        } catch (error) {
            messages.push({ role: 'user', content: userMessageContent });
        }
    }

    const limitCheck = await groqLimiter.checkLimit();
    if (!limitCheck.allowed) return { error: limitCheck.message };

    try {
        await groqLimiter.recordRequest();
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return { answer: data.choices[0].message.content.trim() };
    } catch (error) {
        return { error: error.message };
    }
}

function buildUserPrompt(question, context) {
    if (!context) return `User question: "${question}"`;

    const contextBlock = context.selectedText
        ? `I noticed you highlighted this: "${context.selectedText}"`
        : context.hoveredSection
            ? `It seems you're looking at: "${context.hoveredSection}"`
            : `I can see you're on: "${context.pageTitle || 'this page'}"`;

    return `Context: ${contextBlock}\nUser: ${question}`;
}
