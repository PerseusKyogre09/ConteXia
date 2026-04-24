<script>
  import { onMount } from "svelte";
  import { messages, isLoading, apiKey } from "./store";
  import Header from "./components/Header.svelte";
  import ChatList from "./components/ChatList.svelte";
  import InputArea from "./components/InputArea.svelte";
  import ApiKeyConfig from "./components/ApiKeyConfig.svelte";
  import LiveMode from "./components/LiveMode.svelte";

  let initialized = false;
  let isLiveMode = false;

  onMount(async () => {
    const data = await chrome.storage.local.get(["apiKey"]);
    if (data.apiKey) {
      apiKey.set(data.apiKey);
      initialized = true;
    }

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "PUSH_SELECTION") {
        handleQuestion(`What do you think about this? "${msg.payload}"`);
      }
    });
  });

  async function handleQuestion(text) {
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
      messages.update((m) => [...m, { role: "ai", content: response.answer }]);
    } catch (e) {
      messages.update((m) => [
        ...m,
        {
          role: "ai",
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
      on:submit={(e) => handleQuestion(e.detail)}
      on:openLive={() => (isLiveMode = true)}
    />
  {/if}

  {#if isLiveMode}
    <LiveMode on:close={() => (isLiveMode = false)} />
  {/if}
</main>
