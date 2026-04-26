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
    import logChat from "../../assets/log-chat.svg";

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
    class="fixed bottom-0 left-0 right-0 px-0 pb-4 bg-gradient-to-t from-background to-transparent pt-10 pointer-events-none"
>
    <div class="relative pointer-events-auto flex flex-col gap-0.5">
        <div
            class="flex gap-2 animate-in slide-in-from-bottom-2 duration-500 relative px-4"
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
            class="log-background relative flex items-center transition-all group overflow-hidden min-h-[140px] h-auto px-0 py-[38px]"
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

            <div class="flex-shrink-0 z-10">
                <button
                    on:click={handleMicClick}
                    class="p-2.5 rounded-lg bg-[#4a3728]/5 border border-[#4a3728]/10 transition-all {isRecording
                        ? 'text-red-500 animate-pulse shadow-glow-blue'
                        : $isSpeaking
                          ? 'text-[#5d4037] scale-110'
                          : 'text-[#5d4037] hover:text-[#4a3728] hover:bg-[#4a3728]/10'}"
                    title="Voice Interaction"
                >
                    {#if $isSpeaking && !isRecording}
                        <Square size={20} />
                    {:else}
                        <Mic size={20} />
                    {/if}
                </button>
            </div>

            <div
                class="flex-1 flex items-center bg-transparent transition-all z-10 mx-0 relative min-w-0 max-h-[125px] overflow-hidden"
            >
                <div
                    class="invisible text-[15px] font-extrabold leading-relaxed px-2 py-3 whitespace-pre-wrap break-all w-full min-h-[1.5em]"
                    aria-hidden="true"
                >
                    {text || "Write a little note..."}
                </div>
                <textarea
                    bind:value={text}
                    placeholder="Write a little note..."
                    class="w-full bg-transparent px-2 py-3 text-[15px] text-[#3e2723] placeholder:text-[#3e2723]/30 font-extrabold leading-relaxed resize-none outline-none drop-shadow-sm absolute inset-0 h-full break-all overflow-y-auto scrollbar-wood"
                    on:keydown={(e) =>
                        e.key === "Enter" && !e.shiftKey && submit()}
                    rows="1"
                ></textarea>
            </div>

            <div class="flex items-center gap-2 z-10">
                <button
                    on:click={togglePen}
                    class="p-2.5 rounded-lg {isPenActive
                        ? 'text-[#8b4513] bg-[#8b4513]/10'
                        : 'text-[#5d4037] hover:text-[#4a3728] hover:bg-[#4a3728]/5'} transition-all"
                    title="Annotate"
                >
                    <PenLine size={20} />
                </button>
                <button
                    on:click={() => dispatch("openLive")}
                    class="p-2.5 rounded-lg text-[#5d4037] hover:text-[#4a3728] transition-all hover:bg-[#4a3728]/5"
                    title="Live Mode"
                >
                    <Headphones size={20} />
                </button>
                <button
                    on:click={() => submit()}
                    disabled={!text.trim() || $isLoading}
                    class="p-2.5 rounded-lg bg-[#5d4037] border border-[#4a3728]/20 text-[#fdf5e6] disabled:opacity-30 disabled:grayscale transition-all shadow-md hover:shadow-[#4a3728]/40 group/send"
                >
                    <Send
                        size={20}
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

<style>
    .log-background {
        border-style: solid;
        border-width: 38px 45px;
        border-image-source: url("../../assets/log-chat.svg");
        border-image-slice: 60 110 60 110 fill;
        border-image-repeat: stretch;
        background: transparent;
        transition: all 0.3s ease;
    }

    .scrollbar-wood::-webkit-scrollbar {
        width: 4px;
    }
    .scrollbar-wood::-webkit-scrollbar-track {
        background: transparent;
    }
    .scrollbar-wood::-webkit-scrollbar-thumb {
        background: #5d4037;
        border-radius: 10px;
    }
</style>
