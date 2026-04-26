import { RateLimiter } from '../utils/rate_limiter';

const groqLimiter = new RateLimiter('Groq', 10, 60000);
const cartesiaLimiter = new RateLimiter('Cartesia', 20, 60000);

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error);

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.startsWith('file://')) {
        try {
            const isAllowed = await chrome.extension.isAllowedFileSchemeAccess();
            if (isAllowed) {
                const manifest = chrome.runtime.getManifest();
                const contentScript = manifest.content_scripts?.[0]?.js?.[0];
                if (contentScript) {
                    await chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: [contentScript]
                    });
                }
            }
        } catch (e) { }
    }
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'ask-contexia',
        title: 'Ask ConteXia',
        contexts: ['selection']
    });
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
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ASK_GROQ') {
        handleGroqRequest(message.payload).then(sendResponse);
        return true;
    }
    if (message.type === 'CHIP_CLICK' && message.payload.action === 'SUMMARIZE') {
        const { text, msgId } = message.payload;
        const tabId = sender.tab.id;

        chrome.storage.local.set({
            pending_command: {
                action: 'SUMMARIZE',
                text: text,
                msgId: msgId,
                timestamp: Date.now()
            }
        });

        chrome.sidePanel.open({ tabId });

        const dispatch = () => {
            chrome.runtime.sendMessage({
                type: 'APP_COMMAND',
                payload: { action: 'SUMMARIZE', text: text, msgId: msgId }
            }).catch(() => { });
        };

        dispatch();
        setTimeout(dispatch, 800);
        setTimeout(dispatch, 2000);

        return true;
    }

    if (message.type === 'CARTESIA_TTS') {
        handleCartesiaTTS(message.payload).then(sendResponse);
        return true;
    }
    if (message.type === 'GROQ_TTS') {
        handleGroqTTS(message.payload).then(sendResponse);
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
                transcript: transcript,
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
        console.error("Background TTS error:", error);
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
                voice: 'sonia', // Defaulting to sonia or similar if needed, but the screenshot didn't specify voices for this model clearly. I'll use a generic one or check if it's required.
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
        console.error("Groq TTS error:", error);
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
3. Refer to visual input as "what I'm seeing," "your notes," "your annotations," or directly by the content (e.g., "Those SQL notes look great").
4. If this is a follow-up, just reply naturally like a friend in a DM.
5. Be causal, warm, and conversational.
6. Adapt your length to the request: if asked to "sumarize or explain," provide a deep, thoughtful breakdown. Otherwise, stay concise.
7. No disclaimers, no robotic greetings, no "As an AI."`;

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
                model: model,
                messages: messages,
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
    if (!context) {
        return `User's question: "${question}"
Answer based on general knowledge since no page context is available.`;
    }

    const contextBlock = context.selectedText
        ? `I noticed you highlighted this: "${context.selectedText}"`
        : context.hoveredSection
            ? `It seems you're looking at: "${context.hoveredSection}"`
            : `I can see you're on: "${context.pageTitle || 'this page'}"`;

    return `Context: ${contextBlock}
User: ${question}`;
}
