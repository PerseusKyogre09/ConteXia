<script>
    import { onMount, createEventDispatcher, tick } from "svelte";
    import { Mic, X, Volume2 } from "lucide-svelte";
    import { fade, fly, scale } from "svelte/transition";
    import { isListening, isLoading, cartesiaVoiceId } from "../store";
    import {
        speak as speakAudio,
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
    let idleCheckTimer;
    let isSpeaking = false;

    const IDLE_THRESHOLD = 120000;

    function resetIdleTimer() {
        clearTimeout(idleCheckTimer);
        idleCheckTimer = setTimeout(() => {
            if (isOpen && !isSpeaking && !$isLoading) {
                speak("You there?");
            }
        }, IDLE_THRESHOLD);
    }

    onMount(() => {
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;

            recognition.onresult = (event) => {
                resetIdleTimer();
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
                        resetIdleTimer();
                    }
                }, 1500);
            };

            recognition.onerror = (event) => {
                console.error("Presence Error:", event.error);
            };
        }

        startMicVolume();
        resetIdleTimer();

        return () => {
            if (recognition) recognition.stop();
            stopMicVolume();
            clearTimeout(silenceTimer);
            clearTimeout(idleCheckTimer);
        };
    });

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
            await speakAudio(text);
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
            class="relative flex items-center justify-center mb-12 h-96 w-full overflow-hidden"
            style="--volume: {$audioVolume};"
        >
            <div class="blob-wrapper">
                <p><span></span></p>
                <p><span></span></p>
            </div>

            <div
                class="relative z-20 flex flex-col items-center justify-center pointer-events-none"
            ></div>
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
    .blob-wrapper {
        --size: calc(350px + var(--volume) * 150px);
        position: absolute;
        width: var(--size);
        height: var(--size);
        filter: url(#gooey-filter);
        display: flex;
        align-items: center;
        justify-content: center;
        transition:
            width 0.2s,
            height 0.2s;
    }

    .blob-wrapper span {
        background: #16a34a;
        position: absolute;
        border-radius: 50%;
        display: inline-block;
    }

    .blob-wrapper p {
        position: absolute;
        top: 50%;
        left: 50%;
    }

    .blob-wrapper p:nth-child(1) {
        animation: skewing-child 0.2s ease-in-out infinite alternate;
    }

    .blob-wrapper p:nth-child(1) span {
        width: calc(var(--size) / 10 + var(--volume) * 20px);
        height: calc(var(--size) / 10 + var(--volume) * 20px);
        margin: calc((var(--size) / 10 + var(--volume) * 20px) / -2);
        animation: moving 2s cubic-bezier(0.97, 0.01, 0.12, 0.99) infinite
            alternate;
    }

    .blob-wrapper p:nth-child(2) {
        animation: squishing 1s ease-in-out infinite alternate;
    }

    .blob-wrapper p:nth-child(2) span {
        width: calc(var(--size) / 4 + var(--volume) * 50px);
        height: calc(var(--size) / 4 + var(--volume) * 50px);
        top: 50%;
        left: 50%;
        margin: calc((var(--size) / 4 + var(--volume) * 50px) / -2);
        animation: skewing 2s 1.5s ease-in-out infinite;
    }

    @keyframes skewing {
        0% {
            transform: skewX(6deg);
        }
        10% {
            transform: skewX(-6deg);
        }
        20% {
            transform: skewX(4deg);
        }
        30% {
            transform: skewX(-4deg);
        }
        40% {
            transform: skewX(2deg);
        }
        50% {
            transform: skewX(-6deg);
        }
        55% {
            transform: skewX(6deg);
        }
        60% {
            transform: skewX(-5deg);
        }
        65% {
            transform: skewX(5deg);
        }
        70% {
            transform: skewX(-4deg);
        }
        75% {
            transform: skewX(4deg);
        }
        80% {
            transform: skewX(-3deg);
        }
        85% {
            transform: skewX(3deg);
        }
        90% {
            transform: skewX(-2deg);
        }
        95% {
            transform: skewX(2deg);
        }
        100% {
            transform: skewX(1deg);
        }
    }

    @keyframes skewing-child {
        0% {
            transform: skewX(-10deg);
        }
        100% {
            transform: skewX(10deg);
        }
    }

    @keyframes moving {
        0% {
            transform: translate(calc(var(--size) / -2.5));
        }
        30% {
            transform: translate(calc(var(--size) / -10));
        }
        70% {
            transform: translate(calc(var(--size) / 10));
        }
        100% {
            transform: translate(calc(var(--size) / 2.5));
        }
    }

    @keyframes squishing {
        10%,
        40%,
        80% {
            transform: scale(1, 0.9);
        }
        0%,
        30%,
        60%,
        100% {
            transform: scale(0.9, 1);
        }
    }
</style>
