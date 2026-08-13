(function() {
    const appId = "quantum-residences";
    if (window.__quantumResidencesLandingBooted) return;
    window.__quantumResidencesLandingBooted = true;

    // --- CONFIG ---
    const accentColor = "#E7A025";
    const creamText = "#F3EEE6";
    const btnGradient = "linear-gradient(90deg, #E7A025 0%, #B2564A 50%, #742C7B 100%)";

    const FederalLogo = "https://github.com/virtual-sudo/Quantum-Residences/blob/main/Image_8BCE092B_CDA2_33CA_41E2_ADE5FAF0FCDB_en.png?raw=true";
    const quantumLogo = "https://github.com/angelinesev/Quantum-Residences/blob/main/qr-logo.png?raw=true";

    const slideImg1 = "https://github.com/angelinesev/Quantum-Residences/blob/aa139655ccf8f2b6a6faf2830f92a2fd2bc5b10f/QR%20FACADE%20RENDERS.png?raw=true";
    const slideImg2 = "https://github.com/angelinesev/Quantum-Residences/blob/aa139655ccf8f2b6a6faf2830f92a2fd2bc5b10f/04_Cinematic_Semi_Aerial_Dusk_01.jpg?raw=true";

    const existing = document.getElementById(appId);
    if (existing) existing.remove();

    const injectStyles = () => {
        const styleId = appId + "-style";
        const prev = document.getElementById(styleId);
        if (prev) prev.remove();
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #${appId} {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                z-index: 2147483647;
                position: fixed; inset: 0;
                color: ${creamText};
                height: 100dvh; overflow: hidden;
                background: #07060a;
                -webkit-font-smoothing: antialiased;
                transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1);
            }
            #${appId} * { box-sizing: border-box; }

            @media (prefers-reduced-motion: reduce) {
                #${appId} *, #${appId} *::before, #${appId} *::after {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                }
            }

            /* --- CINEMATIC BACKGROUND SLIDER --- */
            .slider-container {
                position: absolute; inset: 0; z-index: -1;
                opacity: 0; transition: opacity 1.1s ease;
            }
            .slider-container.ready { opacity: 1; }
            .slide {
                position: absolute; inset: 0;
                background-size: cover; background-position: center;
                opacity: 0;
                transition: opacity 2.2s cubic-bezier(0.4, 0, 0.2, 1), filter 2.6s ease;
                transform: scale(1.06);
                filter: blur(4px) brightness(0.94);
                will-change: opacity, filter;
            }
            .slide.active {
                opacity: 1; z-index: 2;
                filter: blur(0) brightness(1);
                animation: kenBurns 20s ease-out forwards;
            }
            @keyframes kenBurns { from { transform: scale(1.02); } to { transform: scale(1.08); } }

            .slider-overlay {
                position: absolute; inset: 0; z-index: 5; pointer-events: none;
                background:
                    radial-gradient(ellipse at 18% 45%, rgba(7,5,3,0.9) 0%, rgba(7,5,3,0.55) 46%, rgba(7,5,3,0.14) 76%),
                    linear-gradient(112deg, rgba(6,5,4,0.95) 0%, rgba(6,5,4,0.4) 58%, rgba(6,5,4,0.08) 100%),
                    linear-gradient(to top, rgba(6,5,4,0.7) 0%, transparent 32%);
            }

            /* --- AMBIENT PARTICLES --- */
            .particle {
                position: absolute; bottom: -4%; z-index: 6; pointer-events: none;
                width: 3px; height: 3px; border-radius: 50%;
                background: ${accentColor};
                box-shadow: 0 0 6px rgba(231,160,37,0.7);
                opacity: 0;
                animation: driftUp linear infinite;
            }
            @keyframes driftUp {
                0% { transform: translate(0, 0); opacity: 0; }
                10% { opacity: 0.55; }
                88% { opacity: 0.25; }
                100% { transform: translate(24px, -108vh); opacity: 0; }
            }
            .p1 { left: 9%;  animation-duration: 23s; animation-delay: 0s; }
            .p2 { left: 24%; animation-duration: 27s; animation-delay: 4s; }
            .p3 { left: 43%; animation-duration: 19s; animation-delay: 9s; }
            .p4 { left: 66%; animation-duration: 25s; animation-delay: 2s; }
            .p5 { left: 81%; animation-duration: 31s; animation-delay: 12s; }
            .p6 { left: 93%; animation-duration: 21s; animation-delay: 6s; }

            /* --- BRANDING --- */
            .hero-branding {
                display: flex; flex-wrap: wrap; align-items: center; gap: 2em;
                margin-bottom: 2.6em;
            }
            .hero-branding img {
                display: block; height: clamp(3.2rem, 5vw, 4.8rem); width: auto;
                filter: drop-shadow(0 4px 14px rgba(0,0,0,0.55));
                opacity: 0.95;
            }
            .brand-divider { width: 1px; height: 2em; background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.3), transparent); }

            .crest-mark {
                position: absolute; top: 5.5dvh; right: 6vw; z-index: 10;
                border: 1px solid rgba(231,160,37,0.5);
                background: rgba(7,6,4,0.25);
                -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
                padding: 0.65em 0.95em;
                font-family: 'Playfair Display', serif;
                font-size: 1rem; letter-spacing: 0.12em;
                color: ${accentColor};
            }

            .edge-tag {
                position: absolute; left: 2.4vw; top: 50%; z-index: 10;
                writing-mode: vertical-rl; transform: translateY(-50%) rotate(180deg);
                display: flex; align-items: center; gap: 1.1em;
                font-size: 0.64rem; letter-spacing: 0.3em; text-transform: uppercase;
                color: rgba(255,255,255,0.42); font-weight: 400;
            }
            .edge-tag::after { content: ''; width: 1px; height: 3.2em; background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.35), transparent); }

            /* --- HERO CONTENT --- */
            #hero-view { position: absolute; inset: 0; display: flex; align-items: center; padding: clamp(1.5rem, 4vw, 5rem); padding-left: clamp(3rem, 7vw, 9rem); padding-right: clamp(1.5rem, 4vw, 5rem); z-index: 8; }
            .hero-content { max-width: min(620px, 100%); width: 100%; text-align: left; padding-left: clamp(0.2rem, 0.8vw, 1rem); }

            .hero-eyebrow {
                font-weight: 400; font-size: 0.80rem;
                letter-spacing: 0.5em; text-transform: uppercase;
                color: ${accentColor};
                margin: 0 0 1.3em 0;
            }

            .hero-title {
                font-family: 'Lato', sans-serif;
                font-size: clamp(6.1rem, 4.3vw, 4rem);
                font-weight: 700; line-height: 1.02;
                letter-spacing: 0.04em;
                color: #fff; text-transform: uppercase; margin: 0;
            }
            .hero-title-accent {
                display: block;
                font-family: 'Lato', sans-serif;
                font-weight: 700; line-height: 1.02;
                text-transform: uppercase; letter-spacing: 0;
                font-size: clamp(6.1rem, 4.3vw, 4rem);
                margin-top: 0.12em;
                background: ${btnGradient};
                -webkit-background-clip: text; background-clip: text;
                -webkit-text-fill-color: transparent;
            }

            .title-divider {
                width: 0; height: 1px;
                border-radius: 999px;
                background: linear-gradient(90deg,
                    rgba(255,255,255,0.08) 0%,
                    rgba(231,160,37,0.85) 18%,
                    rgba(255,255,255,0.8) 52%,
                    rgba(255,255,255,0.12) 100%
                );
                margin: 26px 0 30px 0;
                box-shadow: 0 0 10px rgba(231,160,37,0.18);
                opacity: 0.9;
                transition: width 1.3s cubic-bezier(0.16, 1, 0.3, 1) 0.35s;
            }
            #${appId}.animate-text .title-divider { width: clamp(112px, 16vw, 170px); }

            .hero-desc {
                font-weight: 300; font-size: clamp(0.95rem, 1.05vw, 1.1rem);
                line-height: 1.85; letter-spacing: 0.015em;
                color: rgba(243,238,230,0.75);
                max-width: 32em; margin: 0 0 2.6em 0;
                text-shadow: 0 2px 10px rgba(0,0,0,0.6);
            }

            .anim-1, .anim-2, .anim-3, .anim-4 { opacity: 0; }
            #${appId}.animate-text .anim-1 { animation: revealUp 1s cubic-bezier(0.16,1,0.3,1) forwards 0.05s; }
            #${appId}.animate-text .anim-2 { animation: revealUp 1s cubic-bezier(0.16,1,0.3,1) forwards 0.2s; }
            #${appId}.animate-text .anim-3 { animation: revealUp 1s cubic-bezier(0.16,1,0.3,1) forwards 0.55s; }
            #${appId}.animate-text .anim-4 { animation: revealUp 1s cubic-bezier(0.16,1,0.3,1) forwards 0.75s; }
            @keyframes revealUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }

            /* --- CTA: GHOST BUTTON, GRADIENT FILL ON HOVER --- */
            .btn-enter {
                position: relative; cursor: pointer; overflow: hidden;
                font-family: 'Inter', sans-serif; font-weight: 500;
                font-size: 0.90rem; letter-spacing: 0.34em; text-transform: uppercase;
                color: #fff; background: rgba(231,160,37,0.05);
                border: 1px solid rgba(255,255,255,0.3);
                padding: 1.80em 3.50em;
                box-shadow: 0 0 0 rgba(231,160,37,0.0), 0 0 24px rgba(183, 86, 74, 0.16);
                animation: btnPulse 2.8s ease-in-out infinite;
                transition: border-color 0.4s ease, transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease;
            }
            @keyframes btnPulse {
                0%, 100% {
                    box-shadow: 0 0 0 rgba(231,160,37,0), 0 0 18px rgba(183, 86, 74, 0.18), 0 0 32px rgba(231,160,37,0.12);
                    transform: translateY(0);
                }
                50% {
                    box-shadow: 0 0 0 rgba(231,160,37,0), 0 0 28px rgba(231,160,37,0.42), 0 0 48px rgba(116,44,123,0.28);
                    transform: translateY(-1px);
                }
            }
            .btn-enter::before {
                content: ''; position: absolute; inset: 0; z-index: -1;
                background: ${btnGradient};
                opacity: 0; transition: opacity 0.45s ease;
            }
            .btn-enter:hover {
                border-color: transparent;
                transform: translateY(-2px);
                box-shadow: 0 16px 34px rgba(231,160,37,0.28), 0 0 30px rgba(231,160,37,0.38);
                animation: none;
            }
            .btn-enter:hover::before { opacity: 1; }
            .btn-enter:active { transform: translateY(0); }
            .btn-enter:focus-visible { outline: 2px solid ${accentColor}; outline-offset: 3px; }

            @media (max-width: 760px) {
                .edge-tag, .crest-mark { display: none; }
                .hero-branding { gap: 1.2em; margin-bottom: 1.8em; }
                .hero-branding img { height: 4.4rem; }
                .hero-content { max-width: 100%; }
                .hero-title { font-size: clamp(3rem, 8vw, 4rem); }
                .hero-desc { font-size: 1rem; }
                .btn-enter { width: 100%; text-align: center; }
            }
        `;
        document.head.appendChild(style);
    };

    const createUI = () => {
        if (document.getElementById(appId)) return;

        const overlay = document.createElement('div');
        overlay.id = appId;
        overlay.innerHTML = `
            <div class="slider-container" id="slider">
                <div class="slide active" style="background-image:url('${slideImg1}')"></div>
                <div class="slide" style="background-image:url('${slideImg2}')"></div>
                <div class="particle p1"></div><div class="particle p2"></div><div class="particle p3"></div>
                <div class="particle p4"></div><div class="particle p5"></div><div class="particle p6"></div>
                <div class="slider-overlay"></div>
            </div>

            <div id="hero-view">
                <div class="hero-content">
                    <div class="hero-branding anim-1">
                    <img src="${quantumLogo}" alt="Quantum Residences">
                        <div class="brand-divider"></div>
                         <img src="${FederalLogo}" alt="Federal Land">
                    </div>
                    <p class="hero-eyebrow anim-2">Taft Avenue, Pasay City</p>
                    <h1 class="hero-title anim-2">Quantum<span class="hero-title-accent">Residences</span></h1>
                    <div class="title-divider"></div>
                    <p class="hero-desc anim-3">Strategically located near the intersection of Taft and Buendia, Quantum Residences provides a central location and full set of amenities to help motivated young professionals reach their peak potential.</p>
                    <button class="btn-enter anim-4" id="enter-btn">Experience Quantum Residences</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const slider = document.getElementById('slider');
        const preload = new Image();
        preload.onload = ready;
        preload.src = slideImg1;
        function ready() {
            slider.classList.add('ready');
            overlay.classList.add('animate-text');
        }
        if (preload.complete) ready();

        const slides = overlay.querySelectorAll('.slide');
        let current = 0;
        setInterval(() => {
            const next = (current + 1) % slides.length;
            slides[next].style.zIndex = '3';
            slides[current].style.zIndex = '2';
            slides[next].classList.add('active');
            setTimeout(() => {
                slides[current].classList.remove('active');
                slides[current].style.zIndex = '1';
                current = next;
            }, 2200);
        }, 8000);

        const enterBtn = document.getElementById('enter-btn');
        if (enterBtn) {
            enterBtn.addEventListener('click', () => {
                overlay.style.opacity = '0';
                setTimeout(() => {
                    if (overlay && overlay.parentNode) overlay.remove();
                }, 800);
            }, { once: true });
        }
    };

    if (!document.getElementById(appId + "-fonts")) {
        const preconnect1 = document.createElement('link');
        preconnect1.rel = 'preconnect';
        preconnect1.href = 'https://fonts.googleapis.com';
        const preconnect2 = document.createElement('link');
        preconnect2.rel = 'preconnect';
        preconnect2.href = 'https://fonts.gstatic.com';
        preconnect2.crossOrigin = 'anonymous';
        const fonts = document.createElement('link');
        fonts.id = appId + "-fonts";
        fonts.rel = 'stylesheet';
        fonts.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;500&family=Lato:wght@700&family=Playfair+Display:ital,wght@1,500&display=swap';
        document.head.append(preconnect1, preconnect2, fonts);
    }

    injectStyles();
    if (document.readyState === 'complete' || document.readyState === 'interactive') createUI();
    else window.addEventListener('DOMContentLoaded', createUI);
})();
