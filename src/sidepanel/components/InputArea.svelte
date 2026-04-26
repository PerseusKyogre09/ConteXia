<script>
    import { createEventDispatcher, onMount } from "svelte";
    import {
        Send,
        Mic,
        Headphones,
        PenLine,
        Sparkles,
        BookOpen,
        Volume2,
        Square,
    } from "lucide-svelte";
    import {
        isListening,
        isLoading,
        addMessage,
        messages,
        isSpeaking,
    } from "../store";
    import { speakWithCartesia, stopAllAudio } from "../utils/audio";

    const dispatch = createEventDispatcher();
    let text = "";
    let isPenActive = false;

    onMount(() => {
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.type === "PEN_CLOSED") isPenActive = false;
        });
    });

    async function togglePen() {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });
        if (!tab?.id) return;

        if (tab.url?.startsWith("file://")) {
            const isAllowed =
                await chrome.extension.isAllowedFileSchemeAccess();
            if (!isAllowed) {
                alert(
                    'To annotate local files (like PDFs), please enable "Allow access to file URLs" in ConteXia settings (Details page).',
                );
                return;
            }
        }

        try {
            await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PEN" });
            isPenActive = !isPenActive;
        } catch (e) {
            const manifest = chrome.runtime.getManifest();
            const contentScript = manifest.content_scripts?.[0]?.js?.[0];
            if (contentScript) {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: [contentScript],
                });
                await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PEN" });
                isPenActive = true;
            }
        }
    }

    function submit() {
        if (text.trim()) {
            dispatch("submit", text);
            text = "";
        }
    }

    let recognition;

    onMount(() => {
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;

            recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map((result) => result[0].transcript)
                    .join("");
                text = transcript;
            };

            recognition.onerror = (event) => {
                if (event.error === "not-allowed") {
                    alert(
                        'Microphone blocked. Please use "Activate Microphone" in Settings once.',
                    );
                }
                console.error("Speech error:", event.error);
                isListening.set(false);
            };

            recognition.onend = () => {
                isListening.set(false);
            };
        }

        return () => {
            if (recognition) recognition.stop();
        };
    });

    function toggleVoice() {
        if ($isSpeaking) {
            stopAllAudio();
            return;
        }

        if (!recognition) {
            addMessage(
                "assistant",
                "I'm sorry, but your browser doesn't seem to support speech recognition. We can still chat via text though!",
            );
            return;
        }

        if ($isListening) {
            recognition.stop();
            isListening.set(false);
        } else {
            try {
                recognition.start();
                isListening.set(true);
            } catch (e) {
                console.error("Failed to start speech:", e);
                isListening.set(false);
                addMessage(
                    "assistant",
                    "I'd love to listen, but I don't have permission to use your microphone yet. Please enable it in your browser settings so we can talk!",
                );
            }
        }
    }

    function handleSummarize() {
        text = "Summarize this page for me please.";
        submit();
    }

    function handleExplain() {
        text =
            "Explain everything on this page in detail, breaking it down in easy language.";
        submit();
    }

    function handleReadAloud() {
        const lastAiMsg = [...$messages]
            .reverse()
            .find((m) => m.role === "assistant");
        if (lastAiMsg) {
            stopAllAudio();
            speakWithCartesia(lastAiMsg.content);
        } else {
            dispatch("submit", {
                text: "Tell me briefly what this page is about and read it aloud.",
                autoSpeak: true,
            });
        }
    }
</script>

<div
    class="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background to-transparent pt-10 pointer-events-none"
>
    <div class="relative pointer-events-auto flex flex-col gap-3">
        <!-- Suggestions Chips -->
        <div class="flex gap-2 animate-in slide-in-from-bottom-2 duration-500">
            <button
                on:click={handleSummarize}
                class="flex items-center gap-1.5 px-3 py-1.5 bg-surface/40 hover:bg-highlight/10 border border-border/20 hover:border-highlight/30 rounded-full transition-all group"
            >
                <Sparkles
                    size={12}
                    class="text-highlight group-hover:scale-110 transition-transform"
                />
                <span
                    class="text-[10px] font-bold text-muted group-hover:text-highlight tracking-wide"
                    >Summarize</span
                >
            </button>

            <button
                on:click={handleExplain}
                class="flex items-center gap-1.5 px-3 py-1.5 bg-surface/40 hover:bg-highlight/10 border border-border/20 hover:border-highlight/30 rounded-full transition-all group"
            >
                <BookOpen
                    size={12}
                    class="text-highlight group-hover:scale-110 transition-transform"
                />
                <span
                    class="text-[10px] font-bold text-muted group-hover:text-highlight tracking-wide"
                    >Explain</span
                >
            </button>

            <button
                on:click={handleReadAloud}
                class="flex items-center gap-1.5 px-3 py-1.5 bg-surface/40 hover:bg-highlight/10 border border-border/20 hover:border-highlight/30 rounded-full transition-all group"
            >
                <Volume2
                    size={12}
                    class="text-highlight group-hover:scale-110 transition-transform"
                />
                <span
                    class="text-[10px] font-bold text-muted group-hover:text-highlight tracking-wide"
                    >Read Aloud</span
                >
            </button>
        </div>

        <div
            class="relative flex items-end gap-3 bg-surface/60 backdrop-blur-xl border border-border/40 rounded-sm p-3 transition-all inset-shadow ink-border group focus-within:border-accent/40"
        >
            <div class="flex-shrink-0 pb-1">
                <button
                    on:click={toggleVoice}
                    class="p-2 rounded bg-background/40 border border-border/40 transition-all {$isListening
                        ? 'text-red-500 animate-pulse shadow-glow-blue'
                        : $isSpeaking
                          ? 'text-highlight scale-110'
                          : 'text-accent'}"
                >
                    {#if $isSpeaking}
                        <Square size={16} />
                    {:else}
                        <Mic size={16} />
                    {/if}
                </button>
            </div>

            <div
                class="flex-1 min-h-[44px] flex items-center bg-surface/20 rounded-md border border-border/20 transition-all focus-within:border-accent/40"
            >
                <textarea
                    bind:value={text}
                    placeholder="Write a little note..."
                    class="w-full bg-transparent px-4 py-3 text-[13px] text-foreground placeholder:text-muted/40 font-medium leading-relaxed resize-none overflow-hidden"
                    on:keydown={(e) =>
                        e.key === "Enter" && !e.shiftKey && submit()}
                    rows="1"
                ></textarea>
            </div>

            <div class="flex items-center gap-2 pb-1">
                <button
                    on:click={togglePen}
                    class="p-2 rounded-full {isPenActive
                        ? 'text-highlight bg-highlight/10'
                        : 'text-accent hover:text-highlight hover:bg-highlight/5'} transition-all"
                    title="Annotation Pen"
                >
                    <PenLine size={18} />
                </button>

                <button
                    on:click={() => dispatch("openLive")}
                    class="p-2 rounded-full text-accent hover:text-highlight transition-all hover:bg-highlight/5"
                    title="Live Conversation"
                >
                    <Headphones size={18} />
                </button>

                <button
                    on:click={submit}
                    disabled={!text.trim() || $isLoading}
                    class="p-2 rounded bg-accent border border-accent/20 text-background disabled:opacity-30 disabled:grayscale transition-all shadow-lg hover:shadow-accent/40 group/send"
                >
                    <Send
                        size={16}
                        class="group-hover/send:translate-x-0.5 group-hover/send:-translate-y-0.5 transition-transform"
                    />
                </button>
            </div>
        </div>

        <!-- Gold accent line -->
        <div
            class="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-highlight/30 rounded-t-full"
        ></div>
    </div>
</div>
