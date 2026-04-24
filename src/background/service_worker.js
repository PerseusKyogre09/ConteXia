chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

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
            }).catch(() => {
                console.log('ConteXia: Side panel not yet ready for selection push.');
            });
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
CRITICAL:
1. DO NOT mention "this document," "the PDF," or "the page" ever again after the first message.
2. If this is a follow-up (history exists), just reply normally like a friend in a DM.
3. Be causal, warm, and extremely brief (1-2 sentences unless asked for more).
4. No disclaimers. No "As an AI." No robotic greetings.
5. If the user is just chatting (e.g., "how are you"), do NOT bring up the file context.`;

    let messages = [{ role: 'system', content: systemPrompt }];

    if (history && history.length > 0) {
        messages = [...messages, ...history];
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
            console.error('Vision capture failed:', error);
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
        return { answer: data.choices[0].message.content };
    } catch (error) {
        return { error: error.message };
    }
}

function buildUserPrompt(question, context) {
    if (!context) {
        return `<|start_header_id|>user<|end_header_id|>
User's question: "${question}"
Answer based on general knowledge since no page context is available.<|eot_id|><|start_header_id|>assistant<|end_header_id|>`;
    }

    const contextBlock = context.selectedText
        ? `I noticed you highlighted this: "${context.selectedText}"`
        : context.hoveredSection
            ? `It seems you're looking at: "${context.hoveredSection}"`
            : `I can see you're on: "${context.pageTitle || 'this page'}"`;

    return `<|start_header_id|>user<|end_header_id|>
Context: ${contextBlock}
User: ${question}
<|eot_id|><|start_header_id|>assistant<|end_header_id|>`;
}
