document.addEventListener('DOMContentLoaded', () => {
    gsap.registerPlugin(ScrollTrigger);

    // Fade in reveals on scroll
    const reveals = document.querySelectorAll('.reveal');
    reveals.forEach((el) => {
        gsap.to(el, {
            scrollTrigger: {
                trigger: el,
                start: "top 85%",
                toggleActions: "play none none none"
            },
            opacity: 1,
            y: 0,
            duration: 1,
            ease: "expo.out",
            stagger: 0.1
        });
    });

    // Hero Floating Animation
    gsap.to(".preview-card", {
        y: -20,
        rotation: 1,
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
    });

    // Logo hover effect
    const logo = document.querySelector('.logo-text');
    logo.addEventListener('mouseenter', () => {
        gsap.to(logo, { scale: 1.05, duration: 0.3, ease: "back.out(2)" });
    });
    logo.addEventListener('mouseleave', () => {
        gsap.to(logo, { scale: 1, duration: 0.3, ease: "power2.out" });
    });
});
