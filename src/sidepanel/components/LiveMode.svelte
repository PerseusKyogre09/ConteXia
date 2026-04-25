<script>
    import { onMount, createEventDispatcher, tick } from "svelte";
    import { Mic, X, Volume2 } from "lucide-svelte";
    import { fade, fly, scale } from "svelte/transition";
    import { isListening, isLoading, cartesiaVoiceId } from "../store";
    import {
        speakWithCartesia,
        stopAllAudio,
        audioVolume,
        startMicVolume,
        stopMicVolume,
    } from "../utils/audio";
    import { gsap } from "gsap";

    export let isOpen = false;
    const dispatch = createEventDispatcher();

    let transcript = "";
    let recognition;
    let silenceTimer;
    let isSpeaking = false;
    let orbElement;
    let ringElements = [];
    let pulseTimeline;

    let volumeUnsubscribe;

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

                if (isSpeaking && transcript.trim().length > 2) {
                    stopAllAudio();
                    isSpeaking = false;
                }

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

        initGsap();
        startMicVolume();

        volumeUnsubscribe = audioVolume.subscribe((v) => {
            if (!orbElement) return;
            const boost = 1 + v * 1.5;
            gsap.to(orbElement, {
                scale: 1.1 * boost,
                duration: 0.1,
                ease: "power2.out",
                overwrite: "auto",
            });
            ringElements.forEach((ring, i) => {
                if (!ring) return;
                gsap.to(ring, {
                    scale: (1 + i * 0.5) * (1 + v * 2.5),
                    opacity:
                        Math.max(0.1, 0.5 - i * 0.1) * (v > 0.05 ? 1 : 0.6),
                    duration: 0.15,
                    overwrite: "auto",
                });
            });
        });

        return () => {
            if (recognition) recognition.stop();
            if (volumeUnsubscribe) volumeUnsubscribe();
            stopMicVolume();
            clearTimeout(silenceTimer);
        };
    });

    $: if (isOpen && orbElement) {
        initGsap();
    }

    async function initGsap() {
        await tick();
        if (!orbElement || ringElements.length === 0) return;
        gsap.to(orbElement, {
            boxShadow: "0 0 40px rgba(22, 163, 74, 0.4)",
            duration: 2,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
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
        isSpeaking = true;

        try {
            await speakWithCartesia(text);
        } catch (e) {
            console.error("Cartesia speak failed:", e);
        } finally {
            isSpeaking = false;
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

        <div
            class="relative flex items-center justify-center mb-12 h-96 w-full"
        >
            <!-- Background Liquid Layer (Gooey Filter only applied here) -->
            <div
                class="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
                {#each Array(3) as _, i}
                    <div
                        bind:this={ringElements[i]}
                        class="absolute w-48 h-48 rounded-full border-2 border-accent/20 bg-accent/5"
                        style="filter: url(#gooey-filter);"
                    ></div>
                {/each}
            </div>

            <!-- Main Bubble Orb -->
            <div
                bind:this={orbElement}
                class="relative w-64 h-64 rounded-full flex items-center justify-center z-10 shadow-2xl overflow-hidden"
                transition:scale={{ duration: 500, start: 0.8 }}
                style="background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, rgba(34, 197, 94, 0.2) 50%, rgba(22, 163, 74, 0.4) 100%); border: 1px solid rgba(255,255,255,0.3); backdrop-blur: 40px;"
            >
                <!-- Internal Glow -->
                <div
                    class="absolute inset-0 bg-gradient-to-tr from-accent/20 to-transparent pointer-events-none"
                ></div>

                <div
                    class="relative z-20 flex flex-col items-center justify-center"
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
                        <Volume2 size={56} class="text-accent animate-pulse" />
                    {:else}
                        <Mic
                            size={56}
                            class="text-accent {transcript
                                ? 'scale-110 shadow-glow-green'
                                : ''} transition-transform"
                        />
                    {/if}
                </div>
            </div>
        </div>

        <svg style="position: absolute; width: 0; height: 0;">
            <defs>
                <filter id="gooey-filter">
                    <feGaussianBlur
                        in="SourceGraphic"
                        stdDeviation="4"
                        result="blur"
                    />
                    <feColorMatrix
                        in="blur"
                        mode="matrix"
                        values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
                        result="gooey"
                    />
                </filter>
            </defs>
        </svg>

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
</style>
