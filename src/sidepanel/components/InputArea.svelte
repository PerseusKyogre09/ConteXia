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
        X,
    } from "lucide-svelte";
    import {
        isListening,
        isLoading,
        addMessage,
        messages,
        isSpeaking,
        apiKey,
        proactiveHint,
        currentSelection,
    } from "../store";
    import { speak, stopAllAudio } from "../utils/audio";
    import { AudioRecorder } from "../utils/recorder";
    import { fade, slide, fly } from "svelte/transition";

    const dispatch = createEventDispatcher();
    let text = "";
    let isPenActive = false;
    let isRecording = false;
    let isProcessing = false;

    const recorder = new AudioRecorder();

    onMount(() => {
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.type === "PEN_CLOSED") isPenActive = false;
        });

        const handleKeyDown = async (e) => {
            if (e.code === "Space" && !isRecording && !isProcessing) {
                const active = document.activeElement;
                if (
                    active.tagName !== "TEXTAREA" &&
                    active.tagName !== "INPUT"
                ) {
                    e.preventDefault();
                    if (await recorder.start()) isRecording = true;
                }
            }
        };

        const handleKeyUp = async (e) => {
            if (e.code === "Space" && isRecording) {
                e.preventDefault();
                isRecording = false;
                isProcessing = true;
                const blob = await recorder.stop();
                if (blob) await transcribe(blob);
                isProcessing = false;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            recorder.destroy();
        };
    });

    async function handleMicClick() {
        if ($isSpeaking) return stopAllAudio();

        if (isRecording) {
            isRecording = false;
            isProcessing = true;
            const blob = await recorder.stop();
            if (blob) await transcribe(blob);
            isProcessing = false;
        } else {
            if (await recorder.start()) isRecording = true;
        }
    }

    async function transcribe(blob) {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        return new Promise((resolve) => {
            reader.onloadend = async () => {
                const result = reader.result;
                if (typeof result !== "string") return resolve();
                const base64Audio = result.split(",")[1];

                try {
                    const response = await chrome.runtime.sendMessage({
                        type: "GROQ_TRANSCRIPTION",
                        payload: { base64Audio, apiKey: $apiKey },
                    });

                    if (response.text) {
                        text = response.text;
                        if (text.length > 3) submit(true);
                    }
                } catch (err) {
                    console.error(err);
                }
                resolve();
            };
        });
    }

    async function togglePen() {
        const [tab] = await chrome.tabs.query({
            active: true,
            lastFocusedWindow: true,
        });
        if (!tab?.id) return;

        if (tab.url?.startsWith("file://")) {
            const isAllowed =
                await chrome.extension.isAllowedFileSchemeAccess();
            if (!isAllowed) {
                alert(
                    'Please enable "Allow access to file URLs" in ConteXia settings to annotate PDFs.',
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

    function submit(autoSpeak = false) {
        if (text.trim()) {
            dispatch("submit", { text, autoSpeak });
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
            recognition.onresult = (e) => {
                text = Array.from(e.results)
                    .map((r) => r[0].transcript)
                    .join("");
            };
            recognition.onerror = () => isListening.set(false);
            recognition.onend = () => isListening.set(false);
        }
        return () => {
            if (recognition) recognition.stop();
        };
    });

    function toggleVoice() {
        if ($isSpeaking) return stopAllAudio();
        if (!recognition) return;

        if ($isListening) {
            recognition.stop();
            isListening.set(false);
        } else {
            try {
                recognition.start();
                isListening.set(true);
            } catch {
                isListening.set(false);
            }
        }
    }

    const quickAction = (q, auto = false) => {
        text = q;
        submit(auto);
    };
    const handleSummarize = () =>
        quickAction("Summarize this page for me please.");
    const handleExplain = () =>
        quickAction(
            "Explain everything on this page in detail, breaking it down in easy language.",
        );
    const handleReadAloud = () => {
        const lastAi = [...$messages]
            .reverse()
            .find((m) => m.role === "assistant");
        if (lastAi) {
            stopAllAudio();
            speak(lastAi.content);
        } else
            quickAction(
                "Tell me briefly what this page is about and read it aloud.",
                true,
            );
    };

    function handlePronounce() {
        if ($currentSelection) {
            dispatch("submit", {
                text: `How do I pronounce "${$currentSelection}"? Please give me a brief phonetic breakdown and read it aloud clearly.`,
                autoSpeak: true,
            });
            currentSelection.set("");
        }
    }
</script>

<div
    class="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background to-transparent pt-10 pointer-events-none"
>
    <div class="relative pointer-events-auto flex flex-col gap-3">
        <div
            class="flex gap-2 animate-in slide-in-from-bottom-2 duration-500 relative"
        >
            {#if $proactiveHint}
                <div
                    in:fly={{ y: 20, duration: 400 }}
                    out:fade={{ duration: 200 }}
                    class="absolute -top-12 left-0 right-0 flex justify-center z-50 px-4"
                >
                    <button
                        on:click={() => {
                            if ($proactiveHint.type === "smart")
                                quickAction(
                                    `Can you help me simplify or explain this section: "${$proactiveHint.text.slice(0, 100)}..."`,
                                );
                            else if ($proactiveHint.type === "vision")
                                dispatch("triggerVision");
                            proactiveHint.set(null);
                        }}
                        class="flex items-center gap-2 px-4 py-2 bg-accent text-background rounded-full shadow-2xl border border-white/20 hover:scale-105 transition-all group"
                    >
                        <Sparkles size={14} class="animate-pulse" />
                        <span
                            class="text-[11px] font-bold uppercase tracking-wider"
                        >
                            {$proactiveHint.type === "smart"
                                ? "Simplify this section?"
                                : "Perform Spatial Scan?"}
                        </span>
                        <div
                            role="button"
                            tabindex="0"
                            class="ml-2 opacity-50 hover:opacity-100 transition-opacity p-1"
                            on:click|stopPropagation={() =>
                                proactiveHint.set(null)}
                            on:keydown={(e) =>
                                e.key === "Enter" && proactiveHint.set(null)}
                        >
                            <X size={14} />
                        </div>
                    </button>
                </div>
            {/if}

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

            <button
                on:click={handlePronounce}
                disabled={!$currentSelection}
                class="flex items-center gap-1.5 px-3 py-1.5 border rounded-full transition-all group animate-in fade-in zoom-in duration-300 {!$currentSelection
                    ? 'opacity-30 grayscale cursor-not-allowed bg-surface/20 border-border/20'
                    : 'bg-accent/10 hover:bg-accent/20 border-accent/30'}"
            >
                <Volume2
                    size={12}
                    class="text-accent group-hover:scale-110 transition-transform"
                />
                <span class="text-[10px] font-bold text-accent tracking-wide"
                    >Pronounce</span
                >
            </button>
        </div>

        <div
            class="relative flex items-end gap-3 bg-surface/60 backdrop-blur-xl border border-border/40 rounded-sm p-3 transition-all inset-shadow ink-border group focus-within:border-accent/40"
        >
            {#if isRecording}
                <div
                    class="absolute inset-0 z-50 bg-highlight/10 backdrop-blur-md rounded-sm flex items-center justify-center gap-3 animate-pulse border-2 border-highlight/30"
                >
                    <div class="flex gap-1 items-center">
                        <div
                            class="w-1.5 h-1.5 rounded-full bg-highlight animate-bounce [animation-delay:-0.3s]"
                        ></div>
                        <div
                            class="w-1.5 h-1.5 rounded-full bg-highlight animate-bounce [animation-delay:-0.15s]"
                        ></div>
                        <div
                            class="w-1.5 h-1.5 rounded-full bg-highlight animate-bounce"
                        ></div>
                    </div>
                    <span
                        class="text-xs font-bold text-highlight uppercase tracking-[0.2em]"
                        >Listening...</span
                    >
                </div>
            {:else if isProcessing}
                <div
                    class="absolute inset-0 z-50 bg-background/40 backdrop-blur-md rounded-sm flex items-center justify-center gap-2"
                >
                    <Sparkles size={14} class="text-accent animate-spin" />
                    <span class="text-xs font-medium text-accent italic"
                        >Transcribing...</span
                    >
                </div>
            {/if}

            <div class="flex-shrink-0 pb-1">
                <button
                    on:click={handleMicClick}
                    class="p-2 rounded bg-background/40 border border-border/40 transition-all {isRecording
                        ? 'text-red-500 animate-pulse shadow-glow-blue'
                        : $isSpeaking
                          ? 'text-highlight scale-110'
                          : 'text-accent hover:text-highlight'}"
                    title="Click to Toggle (Spacebar holds to Talk)"
                >
                    {#if $isSpeaking && !isRecording}
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
                    on:click={() => submit()}
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
        <div
            class="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-highlight/30 rounded-t-full"
        ></div>
    </div>
</div>
