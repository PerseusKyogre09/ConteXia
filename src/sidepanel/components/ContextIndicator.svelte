<script>
    import { context } from "../store";

    $: info = $context || {};
    $: label = info.selectedText
        ? "Selection"
        : info.hoveredSection
          ? "Section"
          : info.visibleViewportText
            ? "Viewport"
            : "Idle";
    $: color = info.selectedText
        ? "bg-green-500"
        : info.hoveredSection
          ? "bg-yellow-500"
          : info.visibleViewportText
            ? "bg-blue-500"
            : "bg-gray-500";
    $: snippet =
        info.selectedText ||
        info.hoveredSection ||
        info.visibleViewportText ||
        info.pageTitle ||
        "Waiting...";
</script>

<div
    class="p-2.5 mx-3 mt-4 rounded-sm bg-surface/30 border border-border/40 flex items-center gap-3 overflow-hidden text-[10px] shadow-inner ink-border"
>
    <div class="flex items-center gap-2 shrink-0">
        <div
            class="w-1.5 h-1.5 rounded-full {color} shadow-glow-blue {info.selectedText
                ? 'animate-pulse'
                : ''}"
        ></div>
        <span class="font-bold uppercase tracking-[0.2em] text-muted opacity-60"
            >{label}</span
        >
        <div class="w-[1px] h-3 bg-border/40"></div>
    </div>
    <span class="truncate text-muted-foreground font-medium">"{snippet}"</span>

    {#if info.selectedText}
        <div
            class="ml-auto w-1 h-1 rounded-full bg-highlight animate-ping"
        ></div>
    {/if}
</div>
