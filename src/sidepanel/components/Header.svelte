<script>
    import { Settings, X } from "lucide-svelte";
    import { showSettings } from "../store";

    function toggleSettings() {
        showSettings.update((v) => !v);
    }
</script>

<header
    class="flex items-center justify-between p-4 border-b border-border/10 sticky top-0 z-10 ink-border overflow-hidden bg-transparent"
>
    <div class="flex items-center gap-2.5">
        <div
            class="w-7 h-7 rounded bg-surface border border-accent/20 flex items-center justify-center p-1"
        >
            <img
                src="/public/icons/icon128.png"
                alt="Logo"
                class="w-full h-full object-contain"
            />
        </div>
        <span
            class="text-sm font-semibold tracking-[0.2em] text-foreground uppercase"
            >ConteXia</span
        >
    </div>
    <div class="flex gap-2">
        <button
            on:click={toggleSettings}
            class="p-1.5 rounded bg-surface/50 border border-border/40 text-muted hover:text-highlight transition-all hover:shadow-glow-gold"
        >
            <Settings size={14} />
        </button>
    </div>
</header>

<style>
</style>
