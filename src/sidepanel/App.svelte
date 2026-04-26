<script>
  import { onMount } from "svelte";
  import { messages, isLoading, apiKey, showSettings } from "./store";
  import Header from "./components/Header.svelte";
  import ChatList from "./components/ChatList.svelte";
  import InputArea from "./components/InputArea.svelte";
  import ApiKeyConfig from "./components/ApiKeyConfig.svelte";
  import LiveMode from "./components/LiveMode.svelte";
  import Settings from "./components/Settings.svelte";
  import {
    playInteractionPing,
    speakWithCartesia,
    stopAllAudio,
  } from "./utils/audio";

  let initialized = false;
  let isLiveMode = false;
  let liveModeRef;

  let processedMsgIds = new Set();

  onMount(async () => {
    const stored = await chrome.storage.local.get(["onboarding_seen"]);

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "PUSH_SELECTION") {
        handleQuestion(`What do you think about this? "${msg.payload}"`);
      } else if (msg.type === "APP_COMMAND") {
        const { action, text, msgId } = msg.payload;
        if (processedMsgIds.has(msgId)) return;
        processedMsgIds.add(msgId);
        playInteractionPing("focus");

        if (action === "SUMMARIZE") {
          handleQuestion(
            text
              ? `Summarize this: "${text}"`
              : "Can you summarize what I'm looking at?",
          );
        } else if (action === "EXPLAIN") {
          handleQuestion(
            text
              ? `Give me a deep dive and comprehensive breakdown of this: "${text}"`
              : "Give me a deep dive and comprehensive breakdown of everything I'm seeing here.",
          );
        } else if (action === "READ_ALOUD") {
          const prompt = text
            ? `Read this aloud: "${text}"`
            : "Read what's on this page aloud for me";
          handleQuestion(prompt, true);
        }
      }
    });

    chrome.storage.local.get(
      ["use_custom_key", "custom_api_key", "pending_command"],
      (data) => {
        initialized = true;
        if (data.pending_command) {
          const { action, text, msgId, timestamp } = data.pending_command;
          if (Date.now() - timestamp < 15000) {
            processedMsgIds.add(msgId);
            playInteractionPing("focus");
            if (action === "SUMMARIZE") {
              handleQuestion(
                text
                  ? `Summarize this: "${text}"`
                  : "Can you summarize what I'm looking at?",
              );
            } else if (action === "EXPLAIN") {
              handleQuestion(
                text
                  ? `Give me a deep dive and comprehensive breakdown of this: "${text}"`
                  : "Give me a deep dive and comprehensive breakdown of everything I'm seeing here.",
              );
            } else if (action === "READ_ALOUD") {
              const prompt = text
                ? `Read this aloud: "${text}"`
                : "Read what's on this page aloud for me";
              handleQuestion(prompt, true);
            }
          }
          chrome.storage.local.remove("pending_command");
        }
      },
    );
  });

  async function handleQuestion(text, autoSpeak = false) {
    if (!text.trim()) return;

    messages.update((m) => [...m, { role: "user", content: text }]);
    isLoading.set(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "ASK_GROQ",
        payload: {
          question: text,
          apiKey: $apiKey,
          history: $messages.slice(-6),
        },
      });

      if (response.error) throw new Error(response.error);
      const answer = response.answer;
      messages.update((m) => [...m, { role: "assistant", content: answer }]);

      if (isLiveMode && liveModeRef) {
        liveModeRef.speak(answer);
      } else if (autoSpeak) {
        stopAllAudio();
        speakWithCartesia(answer);
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
