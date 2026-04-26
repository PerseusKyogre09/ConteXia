<script>
  import { onMount } from "svelte";
  import {
    messages,
    isLoading,
    apiKey,
    showSettings,
    tone,
    preferVoice,
    proactiveHint,
    currentSelection,
  } from "./store";
  import Header from "./components/Header.svelte";
  import ChatList from "./components/ChatList.svelte";
  import InputArea from "./components/InputArea.svelte";
  import ApiKeyConfig from "./components/ApiKeyConfig.svelte";
  import LiveMode from "./components/LiveMode.svelte";
  import Settings from "./components/Settings.svelte";
  import {
    playInteractionPing,
    playProactiveChime,
    speak,
    stopAllAudio,
  } from "./utils/audio";

  let initialized = false;
  let isLiveMode = false;
  let liveModeRef;
  const processedMsgIds = new Set();

  onMount(() => {
    setInterval(pollSelection, 1000);
    setTimeout(checkSurfaceContent, 1000);

    const tabUpdate = (id, change) => {
      if (change.status === "complete" || change.url) checkSurfaceContent();
    };

    chrome.tabs.onUpdated.addListener(tabUpdate);
    chrome.tabs.onActivated.addListener(() => checkSurfaceContent());

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "PUSH_SELECTION" || msg.type === "SELECTION_UPDATED") {
        currentSelection.set(msg.payload || "");
      } else if (msg.type === "APP_COMMAND") {
        handleNavigationCommand(msg.payload);
      } else if (msg.type === "PROACTIVE_DWELL_SIGNAL") {
        playProactiveChime("smart");
        proactiveHint.set({ type: "smart", text: msg.payload.text });
      } else if (msg.type === "PROACTIVE_HEADING_ENTERED") {
        if ($preferVoice) speak(msg.payload);
      } else if (msg.type === "PROACTIVE_VISION_HOVER_SIGNAL") {
        playProactiveChime("vision");
        proactiveHint.set({ type: "vision", text: "Analyzing visual..." });
      }
    });

    chrome.storage.local.get(["pending_command"], (data) => {
      initialized = true;
      if (data.pending_command) {
        handleNavigationCommand(data.pending_command);
        chrome.storage.local.remove("pending_command");
      }
    });
  });

  async function checkSurfaceContent() {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (!tab?.id) return;

    const url = tab.url?.toLowerCase() || "";
    const isPDF =
      url.endsWith(".pdf") ||
      url.includes("/pdf/") ||
      url.includes(".pdf?") ||
      url.startsWith("file://") ||
      url.startsWith("blob:") ||
      tab.title?.toLowerCase().endsWith(".pdf");

    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "GET_CONTEXT",
      });
      if (
        isPDF &&
        (!response.visibleViewportText ||
          response.visibleViewportText.length < 150)
      ) {
        proactiveHint.set({
          type: "vision",
          text: "Static surface detected. Scan page layout?",
        });
      }
      currentSelection.set(response.selectedText || "");
    } catch (e) {
      currentSelection.set("");
      if (isPDF) {
        proactiveHint.set({
          type: "vision",
          text: "PDF / Image detected. Perform visual scan?",
        });
      }
    }
  }

  async function pollSelection() {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (!tab?.id || tab.url?.startsWith("chrome://")) return;
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, {
        type: "GET_SELECTION",
      });
      if (resp?.selection !== undefined) currentSelection.set(resp.selection);
    } catch (e) {}
  }

  function handleNavigationCommand(payload) {
    const { action, text, msgId, timestamp } = payload;
    if (timestamp && Date.now() - timestamp > 15000) return;
    if (processedMsgIds.has(msgId)) return;

    processedMsgIds.add(msgId);
    playInteractionPing("focus");

    const prompts = {
      SUMMARIZE: text
        ? `Summarize this: "${text}"`
        : "Can you summarize what I'm looking at?",
      EXPLAIN: text
        ? `Explain this in detail: "${text}"`
        : "Explain everything on this page in detail.",
      READ_ALOUD: text
        ? `Read this aloud: "${text}"`
        : "Read what's on this page aloud.",
      PRONOUNCE: `How do I pronounce "${text}"? Please give me a brief phonetic breakdown and read it aloud clearly.`,
    };

    if (prompts[action]) {
      handleQuestion(
        prompts[action],
        action === "READ_ALOUD" || action === "PRONOUNCE",
      );
    }
  }

  async function handleVisionScan() {
    isLoading.set(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ASK_GROQ",
        payload: {
          question:
            "Perform a high-level spatial scan of this viewport. Identify layout, key sections, and visual findings. Provide a 2-sentence summary and suggest how I can help.",
          apiKey: $apiKey,
          tone: $tone,
          history: [],
        },
      });
      if (response.answer) {
        messages.update((m) => [
          ...m,
          { role: "assistant", content: response.answer, isVision: true },
        ]);
        if ($preferVoice) speak(response.answer);
        proactiveHint.set(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      isLoading.set(false);
    }
  }

  async function handleQuestion(text, autoSpeak = false) {
    if (!text.trim()) return;
    proactiveHint.set(null);
    messages.update((m) => [...m, { role: "user", content: text }]);
    isLoading.set(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "ASK_GROQ",
        payload: {
          question: text,
          apiKey: $apiKey,
          tone: $tone,
          history: $messages.slice(-6),
        },
      });

      if (response.error) throw new Error(response.error);
      const answer = response.answer;
      messages.update((m) => [...m, { role: "assistant", content: answer }]);

      if (isLiveMode && liveModeRef) {
        liveModeRef.speak(answer);
      } else if (autoSpeak || $preferVoice) {
        stopAllAudio();
        speak(answer);
      }
    } catch (e) {
      messages.update((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "I'm having a little trouble connecting. Could you check your key or connection?",
        },
      ]);
    } finally {
      isLoading.set(false);
    }
  }
</script>

<main
  class="flex flex-col h-screen bg-background text-foreground selection:bg-accent/30 overflow-hidden relative"
>
  <div
    class="fixed inset-0 pointer-events-none opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-50"
  ></div>

  {#if !initialized}
    <ApiKeyConfig on:save={() => (initialized = true)} />
  {:else}
    <Header />
    <ChatList on:submit={(e) => handleQuestion(e.detail)} />
    <InputArea
      on:submit={(e) =>
        handleQuestion(e.detail.text || e.detail, e.detail.autoSpeak)}
      on:triggerVision={handleVisionScan}
      on:openLive={() => (isLiveMode = true)}
    />
  {/if}

  {#if isLiveMode}
    <LiveMode
      bind:this={liveModeRef}
      isOpen={true}
      on:close={() => (isLiveMode = false)}
      on:submit={(e) => handleQuestion(e.detail)}
    />
  {/if}

  {#if $showSettings}
    <Settings />
  {/if}
</main>
