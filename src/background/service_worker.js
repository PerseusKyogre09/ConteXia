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
        } catch (e) {
            // Injection not possible
        }
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
});

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
5. Be causal, warm, and extremely brief (1-2 sentences unless asked for more).
6. No disclaimers, no robotic greetings, no "As an AI."`;

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
    } else {
        messages.push({ role: 'user', content: userMessageContent });
    }

    try {
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
