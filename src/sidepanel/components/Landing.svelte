<script>
    import { createEventDispatcher, onMount } from "svelte";
    import {
        Sparkles,
        MessageSquare,
        FileText,
        Mic,
        CheckCircle2,
    } from "lucide-svelte";
    import { messages } from "../store";
    import { gsap } from "gsap";

    const dispatch = createEventDispatcher();
    let micAllowed = false;
    let landingRef;

    onMount(async () => {
        gsap.from(".landing-title", {
            y: 30,
            opacity: 0,
            duration: 1.2,
            ease: "power4.out",
        });
        gsap.from(".landing-action", {
            y: 20,
            opacity: 0,
            duration: 1,
            stagger: 0.1,
            delay: 0.4,
            ease: "power3.out",
        });

        const isAllowed = await chrome.extension.isAllowedFileSchemeAccess();
        // Mic permission check
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            stream.getTracks().forEach((t) => t.stop());
            micAllowed = true;
        } catch (e) {
            micAllowed = false;
        }
    });

    const quickActions = [
        {
            icon: Sparkles,
            text: "Analyze this page",
            prompt: "Can you analyze this page and give me a quick summary of the most important takeaways?",
        },
        {
            icon: FileText,
            text: "Summarize themes",
            prompt: "What are the core themes being discussed here?",
        },
        {
            icon: MessageSquare,
            text: "Explain layout",
            prompt: "Can you explain how this page is organized and what each section is for?",
        },
    ];

    function activateMic() {
        window.open(chrome.runtime.getURL("voice-setup.html"));
    }
</script>

<div
    bind:this={landingRef}
    class="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center space-y-12 py-10"
>
    <div
        class="landing-title w-20 h-20 bg-surface/40 backdrop-blur-md rounded-3xl border border-accent/20 p-4 flex items-center justify-center mb-4 shadow-2xl"
    >
        <img
            src="/public/icons/icon128.png"
            alt="ConteXia Logo"
            class="w-full h-full object-contain filter drop-shadow-lg"
        />
    </div>

    <div class="space-y-4">
        <h1
            class="landing-title text-4xl font-bold tracking-tight text-foreground/90 leading-tight"
        >
            Hi there. What should we <span class="text-highlight"
                >dive into</span
            > today?
        </h1>
        <p class="landing-title text-muted text-sm tracking-wide opacity-80">
            I'm ConteXia, your companion for deep reading and thoughtful
            dialogue.
        </p>
    </div>

    <div class="grid grid-cols-1 gap-4 w-full max-w-sm">
        {#each quickActions as action}
            <button
                on:click={() => dispatch("submit", action.prompt)}
                class="landing-action flex items-center gap-4 p-4 rounded-xl bg-surface/40 border border-border/20 hover:bg-surface/60 hover:border-accent/40 hover:shadow-lg transition-all text-left group"
            >
                <div
                    class="p-2 rounded-lg bg-surface border border-border/10 text-muted group-hover:text-highlight transition-colors"
                >
                    <svelte:component this={action.icon} size={18} />
                </div>
                <span
                    class="text-xs font-semibold text-foreground/80 tracking-wide"
                    >{action.text}</span
                >
            </button>
        {/each}
    </div>

    <div class="landing-action w-full max-w-sm">
        {#if !micAllowed}
            <div
                class="p-5 rounded-2xl bg-accent/5 border-2 border-dashed border-accent/20 space-y-4"
            >
                <div class="flex items-center gap-3 text-highlight/80">
                    <Mic size={18} />
                    <span class="text-xs font-bold uppercase tracking-widest"
                        >Hands-Free Activation</span
                    >
                </div>
                <p class="text-[11px] text-muted text-left leading-relaxed">
                    To enable live voice dialogue and transcription, I'll need
                    your permission to listen.
                </p>
                <button
                    on:click={activateMic}
                    class="w-full py-3 px-4 bg-highlight text-white text-xs font-black uppercase tracking-[0.2em] rounded-md hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                >
                    Activate Microphone
                </button>
            </div>
        {:else}
            <div
                class="flex items-center justify-center gap-2 text-highlight/60 py-4 opacity-60"
            >
                <CheckCircle2 size={14} />
                <span class="text-[10px] font-black uppercase tracking-[0.2em]"
                    >Voice Systems Online</span
                >
            </div>
        {/if}
    </div>
</div>

<style>
    .text-highlight {
        background: linear-gradient(120deg, #059669 0%, #10b981 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
</style>
