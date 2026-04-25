<script>
    import { onMount, createEventDispatcher, tick } from "svelte";
    import { Mic, X, Volume2 } from "lucide-svelte";
    import { fade, fly, scale } from "svelte/transition";
    import { isListening, isLoading, cartesiaVoiceId } from "../store";
    import { speakWithCartesia } from "../utils/audio";
    import { gsap } from "gsap";

    export let isOpen = false;
    const dispatch = createEventDispatcher();

    let transcript = "";
    let recognition;
    let silenceTimer;
    let isSpeaking = false;
    let orbElement;
    let pulseTimeline;

    onMount(() => {
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;

            recognition.onresult = (event) => {
                const current = Array.from(event.results)
                    .map((result) => result[0].transcript)
                    .join("");
                transcript = current;

                clearTimeout(silenceTimer);
                silenceTimer = setTimeout(() => {
                    if (transcript.trim() && !isSpeaking) {
                        dispatch("submit", transcript);
                        transcript = "";
                    }
                }, 1500);
            };

            recognition.onerror = (event) => {
                console.error("Presence Error:", event.error);
            };
        }

        pulseTimeline = gsap.timeline({ repeat: -1 });
    });

    $: if (isOpen && orbElement) {
        initGsap();
    }

    async function initGsap() {
        await tick();
        if (!orbElement) return;

        gsap.fromTo(
            orbElement,
            { scale: 0.9, opacity: 0.5 },
            {
                scale: 1.1,
                opacity: 0.8,
                duration: 2,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
            },
        );
    }

    $: if ($isLoading || transcript || isSpeaking) {
        gsap.to(orbElement, {
            scale: 1.3,
            duration: 0.5,
            ease: "elastic.out(1, 0.5)",
            overwrite: true,
        });
    } else if (orbElement) {
        gsap.to(orbElement, {
            scale: 1,
            duration: 1,
            ease: "power2.out",
            overwrite: true,
        });
    }

    $: if (isOpen && recognition) {
        try {
            recognition.start();
        } catch (e) {}
    } else if (!isOpen && recognition) {
        recognition.stop();
    }

    export async function speak(text) {
        if (recognition) recognition.stop();
        isSpeaking = true;

        try {
            await speakWithCartesia(text);
        } catch (e) {
            console.error("Cartesia speak failed:", e);
        } finally {
            isSpeaking = false;
            if (isOpen && recognition) {
                try {
                    recognition.start();
                } catch (e) {}
            }
        }
    }

    function close() {
        dispatch("close");
        if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
</script>

{#if isOpen}
    <div
        class="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-8 text-center"
        transition:fade={{ duration: 300 }}
    >
        <button
            on:click={close}
            class="absolute top-8 right-8 p-3 rounded-full bg-surface/40 text-muted hover:text-white transition-colors"
        >
            <X size={24} />
        </button>

        <div class="relative flex items-center justify-center mb-12">
            <div
                bind:this={orbElement}
                class="absolute inset-0 bg-accent/20 rounded-full blur-3xl opacity-50"
            ></div>

            <div
                class="relative w-40 h-40 rounded-full border-2 border-accent/30 flex items-center justify-center bg-surface/20 backdrop-blur-xl shadow-glow-blue"
                transition:scale={{ duration: 500, start: 0.8 }}
            >
                {#if $isLoading}
                    <div class="flex gap-1">
                        <div
                            class="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]"
                        ></div>
                        <div
                            class="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]"
                        ></div>
                        <div
                            class="w-2 h-2 bg-accent rounded-full animate-bounce"
                        ></div>
                    </div>
                {:else if isSpeaking}
                    <Volume2 size={48} class="text-accent animate-pulse" />
                {:else}
                    <Mic
                        size={48}
                        class="text-accent {transcript
                            ? 'scale-110'
                            : ''} transition-transform"
                    />
                {/if}
            </div>
        </div>

        <div class="flex flex-col items-center gap-12 mt-12 text-center">
            <h1
                class="text-2xl font-black tracking-[0.4em] text-accent uppercase animate-in fade-in slide-in-from-bottom-4 duration-1000"
            >
                Presence
            </h1>

            <p class="text-muted font-medium italic text-[13px] opacity-60">
                {#if transcript}
                    “{transcript}”
                {:else if $isLoading}
                    ConteXia is listening...
                {:else if isSpeaking}
                    conteXia is speaking...
                {:else}
                    I'm listening to you...
                {/if}
            </p>
        </div>

        <footer class="pb-12 text-center absolute bottom-0 w-full left-0">
            <span
                class="text-[9px] font-bold tracking-[0.3em] text-muted/40 uppercase"
                >Whisper when you're ready</span
            >
        </footer>
    </div>
{/if}

<style>
    .shadow-glow-blue {
        box-shadow: 0 0 40px rgba(56, 189, 248, 0.15);
    }
</style>
