<script>
    import { messages, isLoading, isSpeaking } from "../store";
    import { afterUpdate, onMount, createEventDispatcher } from "svelte";
    import { Volume2 } from "lucide-svelte";
    import { speak, stop } from "../../lib/tts";
    import { gsap } from "gsap";
    import Landing from "./Landing.svelte";

    let container;
    const dispatch = createEventDispatcher();

    function handleSpeak(text) {
        isSpeaking.set(true);
        speak(text, { onEnd: () => isSpeaking.set(false) });
    }

    function reveal(node) {
        gsap.from(node, {
            y: 20,
            opacity: 0,
            duration: 0.8,
            ease: "power4.out",
        });
    }

    afterUpdate(() => {
        if (container) container.scrollTop = container.scrollHeight;
    });
</script>

<div
    bind:this={container}
    class="flex-1 overflow-y-auto p-5 pb-40 scrollbar-hide bg-background"
>
    {#if $messages.length === 0}
        <Landing on:submit />
    {:else}
        <div class="space-y-10">
            {#each $messages as msg}
                <div
                    use:reveal
                    class="flex flex-col space-y-3 {msg.role === 'user'
                        ? 'items-end'
                        : 'items-start'}"
                >
                    <div
                        class="flex items-center gap-2 px-1 text-[9px] font-black uppercase tracking-[0.2em] text-muted/60"
                    >
                        {msg.role === "user" ? "You" : "ConteXia"}
                        {#if msg.role === "ai"}
                            <div
                                class="w-1.5 h-1.5 rounded-full bg-accent/40"
                            ></div>
                        {/if}
                    </div>

                    <div
                        class="relative min-w-[140px] max-w-[85%] rounded-md p-5 text-[13px] leading-[1.6] shadow-md {msg.role ===
                        'user'
                            ? 'bg-surface/90 border-l-4 border-accent text-foreground ink-border'
                            : 'bg-surface/50 ink-border border-l-4 border-muted text-foreground'}"
                    >
                        <div
                            class="font-medium whitespace-pre-wrap selection:bg-accent/30"
                        >
                            {msg.content}
                        </div>
                        {#if msg.role === "ai"}
                            <div
                                class="mt-4 flex justify-between items-center pt-3 border-t border-border/20"
                            >
                                <div class="flex gap-2">
                                    <div
                                        class="w-3 h-0.5 bg-highlight opacity-40"
                                    ></div>
                                    <div
                                        class="w-1.5 h-0.5 bg-highlight opacity-20"
                                    ></div>
                                </div>
                                <button
                                    on:click={() => handleSpeak(msg.content)}
                                    class="p-1.5 px-3 rounded-sm bg-surface/80 border border-border/40 text-muted hover:text-highlight transition-all flex items-center gap-2 group"
                                >
                                    <Volume2
                                        size={12}
                                        class="group-hover:scale-110 transition-transform"
                                    />
                                    <span
                                        class="text-[9px] uppercase font-black tracking-widest"
                                        >Vocalize</span
                                    >
                                </button>
                            </div>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}

    {#if $isLoading}
        <div class="flex justify-start animate-in fade-in duration-300 mt-10">
            <div
                class="flex items-center gap-3 px-4 py-3 bg-surface/20 border border-border/20 rounded-sm ink-border"
            >
                <div class="relative flex items-center justify-center">
                    <div
                        class="w-2 h-2 bg-highlight rounded-full animate-ping opacity-40"
                    ></div>
                    <div
                        class="absolute w-1.5 h-1.5 bg-highlight rounded-full"
                    ></div>
                </div>
                <span
                    class="text-[10px] font-black uppercase tracking-[0.2em] text-highlight/60"
                    >Tracing...</span
                >
            </div>
        </div>
    {/if}

    <div class="h-16"></div>
</div>
