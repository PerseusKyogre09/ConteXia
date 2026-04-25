<script>
  import { onMount } from "svelte";
  import { messages, isLoading, apiKey, showSettings } from "./store";
  import Header from "./components/Header.svelte";
  import ChatList from "./components/ChatList.svelte";
  import InputArea from "./components/InputArea.svelte";
  import ApiKeyConfig from "./components/ApiKeyConfig.svelte";
  import LiveMode from "./components/LiveMode.svelte";
  import Settings from "./components/Settings.svelte";

  let initialized = false;
  let isLiveMode = false;

  let processedMsgIds = new Set();

  onMount(async () => {
    const detailedPrompt = (text) =>
      text === "Visual Analysis of Section"
        ? "Can you give me a deep dive into this section?"
        : `Deep dive on this: "${text}"`;

    const triggerIfNew = (msgId, text) => {
      if (processedMsgIds.has(msgId)) return;
      processedMsgIds.add(msgId);
      handleQuestion(detailedPrompt(text));
    };

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "PUSH_SELECTION") {
        handleQuestion(`What do you think about this? "${msg.payload}"`);
      } else if (msg.type === "APP_COMMAND") {
        if (msg.payload.action === "SUMMARIZE") {
          triggerIfNew(msg.payload.msgId, msg.payload.text);
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
            if (action === "SUMMARIZE") {
              triggerIfNew(msgId, text);
            }
          }
          chrome.storage.local.remove("pending_command");
        }
      },
    );
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
      messages.update((m) => [
        ...m,
        { role: "assistant", content: response.answer },
      ]);
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

  {#if $showSettings}
    <Settings />
  {/if}
</main>
