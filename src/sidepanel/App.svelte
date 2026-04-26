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
  let processedMsgIds = new Set();

  onMount(async () => {
    const handleNavigationCommand = (payload) => {
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
          ? `Give me a deep dive and comprehensive breakdown of this: "${text}"`
          : "Give me a deep dive and comprehensive breakdown of everything I'm seeing here.",
        READ_ALOUD: text
          ? `Read this aloud: "${text}"`
          : "Read what's on this page aloud for me",
      };

      if (prompts[action]) {
        handleQuestion(prompts[action], action === "READ_ALOUD");
      }
    };

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "PUSH_SELECTION") {
        handleQuestion(`What do you think about this? "${msg.payload}"`);
      } else if (msg.type === "APP_COMMAND") {
        handleNavigationCommand(msg.payload);
      } else if (msg.type === "PROACTIVE_DWELL_SIGNAL") {
        playProactiveChime("smart");
        proactiveHint.set({ type: "smart", text: msg.payload.text });
      } else if (msg.type === "PROACTIVE_HEADING_ENTERED") {
        if ($preferVoice) {
          speak(msg.payload, { volume: 0.3 });
        }
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

  async function handleVisionHover() {
    isLoading.set(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ASK_GROQ",
        payload: {
          question:
            "Synthesize this visual focus into a sharp, insightful 1-2 sentence summary. Look for specific labels, data points, or relationships (e.g. 'a Pokemon type dominance chart' or 'a trend of rising costs'). Avoid generic 'this is a diagram' language—tell me the core takeaway.",
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
        if ($preferVoice) {
          speak(response.answer);
        }
        proactiveHint.set(null);
      }
    } catch (e) {
      console.error("Vision hover failed", e);
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
      on:triggerVision={handleVisionHover}
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
