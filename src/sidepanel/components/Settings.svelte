<script>
    import {
        Settings as SettingsIcon,
        ChevronLeft,
        Save,
        Trash2,
        Key,
        MessageSquare,
        Mic,
    } from "lucide-svelte";
    import {
        apiKey,
        tone,
        showSettings,
        clearHistory,
        useCustomKey,
        customApiKey,
    } from "../store";
    import { fly, fade } from "svelte/transition";

    let tempApiKey = "";
    customApiKey.subscribe((v) => (tempApiKey = v));

    const tones = [
        "Casual",
        "Professional",
        "Academic",
        "Humorous",
        "Minimalist",
    ];

    function saveSettings() {
        customApiKey.set(tempApiKey);
        showSettings.set(false);
    }

    function closeSettings() {
        showSettings.set(false);
    }

    function handleClearHistory() {
        if (confirm("Clear all conversations?")) {
            clearHistory();
            showSettings.set(false);
        }
    }
    function handleVoiceActivation() {
        chrome.tabs.create({ url: "voice-setup.html" });
    }
</script>

<div
    class="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl p-6 flex flex-col space-y-8 animate-in fade-in zoom-in-95 duration-200"
    in:fly={{ y: 20, duration: 300 }}
    out:fade={{ duration: 200 }}
>
    <header class="flex items-center justify-between">
        <button
            on:click={closeSettings}
            class="p-2 rounded-sm bg-surface/50 border border-border/40 text-muted hover:text-foreground transition-all ink-border"
        >
            <ChevronLeft size={18} />
        </button>
        <span
            class="text-xs font-black uppercase tracking-[0.3em] text-muted opacity-60"
            >Heart & Soul</span
        >
        <div class="w-10"></div>
    </header>

    <main class="flex-1 space-y-10 overflow-y-auto pb-10 scrollbar-hide">
        <section class="space-y-4">
            <div
                class="flex items-center justify-between gap-2 text-highlight/80"
            >
                <div class="flex items-center gap-2">
                    <Key size={14} />
                    <h2
                        class="text-[10px] font-black uppercase tracking-widest"
                    >
                        Identity
                    </h2>
                </div>

                <button
                    on:click={() => useCustomKey.update((v) => !v)}
                    class="px-2 py-1 flex items-center gap-2 rounded-sm border transition-all {$useCustomKey
                        ? 'bg-accent/10 border-accent/40 text-accent'
                        : 'bg-surface/20 border-border/20 text-muted opacity-50'}"
                >
                    <span class="text-[8px] font-black uppercase tracking-wider"
                        >{$useCustomKey ? "Private Mode" : "Guest Mode"}</span
                    >
                    <div
                        class="w-2 h-2 rounded-full {$useCustomKey
                            ? 'bg-accent animate-pulse'
                            : 'bg-muted'}"
                    ></div>
                </button>
            </div>

            {#if $useCustomKey}
                <div class="relative group" in:fly={{ y: -10, duration: 200 }}>
                    <input
                        type="password"
                        bind:value={tempApiKey}
                        placeholder="Enter your key..."
                        class="w-full bg-surface/40 border border-accent/30 rounded-sm p-3 py-4 text-xs text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent/60 inset-shadow ink-border transition-all"
                    />
                </div>
            {:else}
                <div
                    class="p-4 bg-surface/20 border border-border/10 rounded-sm italic text-[10px] text-muted/60 text-center"
                >
                    Using system default API key.
                </div>
            {/if}
            <p class="text-[9px] text-muted leading-relaxed px-1">
                Your key is stored locally on this device. Never shared.
            </p>
        </section>

        <section class="space-y-5">
            <div class="flex items-center gap-2 text-accent/80">
                <MessageSquare size={14} />
                <h2 class="text-[10px] font-black uppercase tracking-widest">
                    How I Speak
                </h2>
            </div>
            <div class="grid grid-cols-2 gap-2">
                {#each tones as t}
                    <button
                        on:click={() => tone.set(t)}
                        class="p-3 text-[11px] font-semibold border rounded-sm transition-all {$tone ===
                        t
                            ? 'bg-accent border-accent text-white shadow-glow-green'
                            : 'bg-surface/20 border-border/40 text-muted hover:border-accent/30 hover:text-foreground'}"
                    >
                        {t}
                    </button>
                {/each}
            </div>
        </section>

        <section class="space-y-4">
            <div class="flex items-center gap-2 text-highlight/80">
                <Mic size={14} />
                <h2 class="text-[10px] font-black uppercase tracking-widest">
                    Listen to Me
                </h2>
            </div>
            <button
                on:click={handleVoiceActivation}
                class="w-full p-4 border border-border/40 bg-surface/10 rounded-sm text-[10px] font-bold uppercase tracking-widest text-foreground hover:bg-accent/5 hover:border-accent/40 transition-all text-center"
            >
                Activate Microphone
            </button>
            <p class="text-[9px] text-muted leading-relaxed px-1">
                Required once to enable the speech-to-text engine.
            </p>
        </section>

        <section class="pt-6 border-t border-border/20 space-y-4">
            <button
                on:click={handleClearHistory}
                class="w-full p-3 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-red-400/60 hover:text-red-400 hover:bg-red-400/5 rounded-sm transition-all border border-transparent hover:border-red-400/20"
            >
                <Trash2 size={12} />
                Forget Everything
            </button>
        </section>
    </main>

    <footer class="pt-4">
        <button
            on:click={saveSettings}
            class="w-full py-4 bg-accent text-white font-black text-xs uppercase tracking-[0.2em] rounded-sm shadow-xl hover:shadow-glow-green transition-all active:scale-[0.98]"
        >
            Looks Good
        </button>
    </footer>
</div>

<style>
    .shadow-glow-green {
        box-shadow: 0 0 20px rgba(22, 163, 74, 0.2);
    }
</style>
