<script>
  import { onMount } from "svelte";
  import Header from "./components/Header.svelte";
  import ContextIndicator from "./components/ContextIndicator.svelte";
  import ChatList from "./components/ChatList.svelte";
  import Settings from "./components/Settings.svelte";
  import InputArea from "./components/InputArea.svelte";
  import ApiKeyConfig from "./components/ApiKeyConfig.svelte";
  import LiveMode from "./components/LiveMode.svelte";
  import {
    context,
    apiKey,
    messages,
    addMessage,
    isLoading,
    showSettings,
    tone,
  } from "./store";

  let initialized = false;
  let isLiveMode = false;
  let liveModeRef;

  onMount(async () => {
    if ($apiKey) {
      initialized = true;
    }

    const unsubscribe = apiKey.subscribe((val) => {
      if (val) initialized = true;
    });

    setInterval(async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        try {
          const ctx = await chrome.tabs.sendMessage(tab.id, {
            type: "GET_CONTEXT",
          });
          context.set(ctx);
        } catch (e) {}
      }
    }, 500);

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "PUSH_SELECTION") {
        handleQuestion(`Describe this selection: ${message.payload}`);
      }
    });
  });

  async function handleQuestion(q) {
    if (!q.trim() || $isLoading) return;

    addMessage("user", q);
    isLoading.set(true);

    const response = await chrome.runtime.sendMessage({
      type: "ASK_GROQ",
      payload: {
        question: q,
        context: $context,
        apiKey: $apiKey,
        tone: $tone,
        history: $messages.map((m) => ({
          role: m.role === "ai" ? "assistant" : m.role,
          content: m.content,
        })),
      },
    });

    isLoading.set(false);

    if (response.error) {
      addMessage("ai", `Error: ${response.error}`);
    } else {
      addMessage("ai", response.answer);
      if (isLiveMode && liveModeRef) {
        liveModeRef.speak(response.answer);
      }
    }
  }
</script>

<div class="flex flex-col h-screen overflow-hidden text-[#1E293B] relative">
  {#if !initialized && !$apiKey}
    <ApiKeyConfig on:save={() => (initialized = true)} />
  {:else}
    <Header />
    <ChatList />
    <InputArea
      on:submit={(e) => handleQuestion(e.detail)}
      on:openLive={() => (isLiveMode = true)}
    />

    <LiveMode
      bind:isOpen={isLiveMode}
      bind:this={liveModeRef}
      on:submit={(e) => handleQuestion(e.detail)}
      on:close={() => (isLiveMode = false)}
    />

    {#if $showSettings}
      <Settings />
    {/if}
  {/if}
</div>
