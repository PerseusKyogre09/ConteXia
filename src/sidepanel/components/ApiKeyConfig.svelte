<script>
    import { createEventDispatcher } from "svelte";
    import { customApiKey, useCustomKey, apiKey } from "../store";
    import { Key, ArrowRight, ShieldCheck, Zap } from "lucide-svelte";
    import { fade, fly } from "svelte/transition";

    const dispatch = createEventDispatcher();
    let value = "";

    // Check if we have a built-in key
    const hasBuiltIn = import.meta.env.VITE_GROQ_API_KEY ? true : false;

    async function saveCustom() {
        if (value.startsWith("gsk_")) {
            customApiKey.set(value);
            useCustomKey.set(true);
            dispatch("save");
        }
    }

    function useDemo() {
        useCustomKey.set(false);
        dispatch("save");
    }
</script>

<div
    class="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-10 bg-background relative overflow-hidden"
    in:fade={{ duration: 400 }}
>
    <!-- Background craft effect -->
    <div class="absolute inset-0 opacity-[0.03] pointer-events-none">
        <svg width="100%" height="100%">
            <filter id="grain">
                <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.65"
                    numOctaves="3"
                    stitchTiles="stitch"
                />
                <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
    </div>

    <div
        class="relative z-10 w-full max-w-sm px-6 py-8 flex flex-col items-center"
    >
        <div
            class="w-16 h-16 rounded-2xl bg-surface border border-accent/20 flex items-center justify-center shadow-lg shadow-accent/10 mb-8 transform hover:scale-105 transition-transform"
        >
            <Key class="text-accent w-8 h-8" />
        </div>
        <div
            class="absolute -bottom-1 -right-1 w-6 h-6 bg-background border border-accent/30 rounded-sm flex items-center justify-center text-accent/80 scale-75"
        >
            <ShieldCheck size={12} />
        </div>
    </div>

    <div class="space-y-3 z-10">
        <h1
            class="text-2xl font-black uppercase tracking-[0.2em] text-foreground"
        >
            ConteXia
        </h1>
    </div>

    <div class="w-full space-y-6 z-10 max-w-[280px]">
        <div class="space-y-4">
            <div class="relative group">
                <input
                    type="password"
                    bind:value
                    placeholder="Enter your Groq Key..."
                    class="w-full bg-surface/40 border border-border/40 rounded-sm px-4 py-4 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent/40 inset-shadow ink-border transition-all font-mono"
                />
                {#if value.startsWith("gsk_")}
                    <div
                        class="absolute right-3 top-0 bottom-0 flex items-center pointer-events-none"
                        in:fade
                    >
                        <Zap
                            size={14}
                            class="text-highlight fill-highlight/20"
                        />
                    </div>
                {/if}
            </div>

            <button
                on:click={saveCustom}
                disabled={!value.startsWith("gsk_")}
                class="w-full bg-accent hover:bg-accent/90 disabled:opacity-30 text-background font-black text-[10px] uppercase tracking-widest py-4 rounded-sm flex items-center justify-center gap-2 transition-all shadow-xl hover:shadow-glow-blue active:scale-[0.98]"
            >
                Initialize Custom Key <ArrowRight size={14} />
            </button>
        </div>

        {#if hasBuiltIn}
            <div class="flex items-center gap-4 py-2">
                <div class="flex-1 h-[1px] bg-border/20"></div>
                <span
                    class="text-[8px] font-black uppercase tracking-widest text-muted/40"
                    >OR</span
                >
                <div class="flex-1 h-[1px] bg-border/20"></div>
            </div>

            <button
                on:click={useDemo}
                class="w-full p-4 border border-border/40 bg-surface/10 rounded-sm text-[10px] font-bold uppercase tracking-widest text-muted/80 hover:text-foreground hover:border-accent/40 transition-all hover:bg-accent/5"
            >
                Enter Demo Mode
            </button>
        {/if}
    </div>

    <p class="text-[9px] text-muted/40 leading-relaxed max-w-[220px] z-10">
        Your key remains physical to this device. Transmitted only to Groq
        Neural Labs for verification.
    </p>
</div>

<style>
</style>
