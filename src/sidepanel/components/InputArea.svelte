<script>
    import { createEventDispatcher, onMount } from "svelte";
    import { Send, Mic, Headphones } from "lucide-svelte";
    import { isListening, isLoading } from "../store";

    const dispatch = createEventDispatcher();
    let text = "";

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
        if (!recognition) return;

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
            }
        }
    }
</script>

<div
    class="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background to-transparent pt-10 pointer-events-none"
>
    <div class="relative pointer-events-auto">
        <div
            class="relative flex items-end gap-3 bg-surface/60 backdrop-blur-xl border border-border/40 rounded-sm p-3 transition-all inset-shadow ink-border group focus-within:border-accent/40"
        >
            <div class="flex-shrink-0 pb-1">
                <button
                    on:click={toggleVoice}
                    class="p-2 rounded bg-background/40 border border-border/40 transition-all {$isListening
                        ? 'text-red-500 animate-pulse shadow-glow-blue'
                        : 'text-accent'}"
                >
                    <Mic size={16} />
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
