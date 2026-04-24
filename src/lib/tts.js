export function speak(text, options = {}) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || 0.95;
    utterance.pitch = options.pitch || 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha'));
    if (preferred) utterance.voice = preferred;

    const keepAlive = setInterval(() => {
        if (window.speechSynthesis.speaking) window.speechSynthesis.pause();
        window.speechSynthesis.resume();
    }, 10000);

    utterance.onend = () => {
        clearInterval(keepAlive);
        if (options.onEnd) options.onEnd();
    };

    window.speechSynthesis.speak(utterance);
}

export function stop() {
    window.speechSynthesis.cancel();
}
