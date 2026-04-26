<script>
    import { messages, isLoading, isSpeaking } from "../store";
    import { afterUpdate, onMount, createEventDispatcher } from "svelte";
    import { marked } from "marked";
    import { Volume2, User, Sparkles, Copy, Check } from "lucide-svelte";
    import { fade, fly } from "svelte/transition";
    import { speak } from "../utils/audio";
    import Landing from "./Landing.svelte";

    let container;
    let copiedId = null;
    let speakingId = null;
    const dispatch = createEventDispatcher();

    async function handleVocalize(id, text) {
        if (speakingId === id) {
            speakingId = null;
            return;
        }
        speakingId = id;
        try {
            await speak(text);
        } finally {
            speakingId = null;
        }
    }

    function copyToClipboard(id, text) {
        navigator.clipboard.writeText(text);
        copiedId = id;
        setTimeout(() => (copiedId = null), 2000);
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
            {#each $messages as msg, index}
                <div
                    class="flex flex-col space-y-3 {msg.role === 'user'
                        ? 'items-end'
                        : 'items-start'}"
                >
                    <div
                        class="flex items-center gap-2 px-1 text-[9px] font-black uppercase tracking-[0.2em] text-muted/60"
                    >
                        {msg.role === "user" ? "You" : "ConteXia"}
                        {#if msg.role === "assistant"}
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
                            class="font-medium selection:bg-accent/30 markdown-content {msg.role ===
                            'user'
                                ? 'whitespace-pre-wrap'
                                : ''}"
                        >
                            {#if msg.role === "assistant"}
                                {@html marked.parse(msg.content)}
                            {:else}
                                {msg.content}
                            {/if}
                        </div>
                        {#if msg.role === "assistant"}
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
                                <div class="flex gap-1">
                                    <button
                                        on:click={() =>
                                            handleVocalize(index, msg.content)}
                                        class="p-1.5 rounded-sm hover:bg-accent/10 transition-colors {speakingId ===
                                        index
                                            ? 'text-accent animate-pulse'
                                            : 'text-muted/40 hover:text-accent'}"
                                        title="Narrate"
                                    >
                                        <Volume2 size={12} />
                                    </button>
                                    <button
                                        on:click={() =>
                                            copyToClipboard(index, msg.content)}
                                        class="p-1.5 rounded-sm hover:bg-accent/10 transition-colors {copiedId ===
                                        index
                                            ? 'text-accent'
                                            : 'text-muted/40 hover:text-accent'}"
                                        title="Copy"
                                    >
                                        {#if copiedId === index}
                                            <Check size={11} />
                                        {:else}
                                            <Copy size={11} />
                                        {/if}
                                    </button>
                                </div>
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

<style>
    .markdown-content :global(h1) {
        font-size: 1.125rem;
        font-weight: 700;
        margin: 0.25rem 0;
    }
    .markdown-content :global(h2) {
        font-size: 1rem;
        font-weight: 700;
        margin: 0.2rem 0;
    }
    .markdown-content :global(h3) {
        font-size: 0.875rem;
        font-weight: 700;
        margin: 0.15rem 0;
    }
    .markdown-content :global(p) {
        margin: 0.15rem 0;
    }
    .markdown-content :global(ul) {
        list-style-type: disc;
        list-style-position: inside;
        margin: 0.15rem 0;
    }
    .markdown-content :global(ol) {
        list-style-type: decimal;
        list-style-position: inside;
        margin: 0.15rem 0;
    }
    .markdown-content :global(li) {
        margin: 0.1rem 0;
    }
    .markdown-content :global(strong) {
        font-weight: 700;
        color: #6366f1;
    }
    .markdown-content :global(code) {
        background-color: rgba(255, 255, 255, 0.1);
        padding: 0 0.25rem;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        font-family: monospace;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .markdown-content :global(pre) {
        background-color: rgba(0, 0, 0, 0.2);
        padding: 0.75rem;
        border-radius: 0.125rem;
        margin: 0.5rem 0;
        border: 1px solid rgba(255, 255, 255, 0.1);
        overflow-x: auto;
    }
    .markdown-content :global(pre code) {
        background-color: transparent;
        border: none;
        padding: 0;
    }
</style>
