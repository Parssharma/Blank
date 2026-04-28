/* ============================================================
   animations.js — BudgetWise Premium Animation Suite
   ============================================================
   Modules:
     1. PageLoader        – animated intro loader with progress arc
     2. Tilt3D            – CSS-transform hover tilt on cards / panels
     3. ScrollReveal      – IntersectionObserver-based reveal
     4. MagneticCursor    – custom cursor with magnetic pull on buttons
     5. PageTransition    – fade/slide between virtual pages
     6. MicroParticles    – lightweight click-burst micro-effect
   ============================================================ */

/* ─────────────────────────────────────────────────────────────
   1.  PAGE LOADER
   ─────────────────────────────────────────────────────────────
   Injects a full-screen loader overlay that fades out smoothly
   once the app signals readiness via PageLoader.dismiss().
   ───────────────────────────────────────────────────────────── */
export class PageLoader {
    constructor() {
        this._overlay = null;
        this._rafId   = null;
        this._start   = null;
        this._DURATION = 1800; // ms until auto-dismiss minimum
    }

    /** Mount the loader DOM node and kick off the arc animation */
    mount() {
        // Prevent double-mount
        if (document.getElementById('bw-loader')) return;

        const overlay = document.createElement('div');
        overlay.id = 'bw-loader';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-label', 'Loading BudgetWise');
        overlay.innerHTML = `
            <div class="bw-loader-inner">
                <!-- Glowing logo mark -->
                <div class="bw-loader-logo">
                    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="bw-loader-icon">
                        <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#lgGrad)" opacity="0.15"/>
                        <path d="M12 28 L20 12 L28 28" stroke="url(#lgGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="20" cy="24" r="3" fill="url(#lgGrad)"/>
                        <defs>
                            <linearGradient id="lgGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stop-color="#7c3aed"/>
                                <stop offset="100%" stop-color="#8b5cf6"/>
                            </linearGradient>
                        </defs>
                    </svg>
                </div>

                <!-- Orbital spinner ring -->
                <div class="bw-loader-ring" aria-hidden="true">
                    <svg viewBox="0 0 120 120" class="bw-ring-svg">
                        <!-- Track -->
                        <circle cx="60" cy="60" r="50"
                                stroke="rgba(255,255,255,0.06)"
                                stroke-width="3" fill="none"/>
                        <!-- Progress arc (animated via CSS) -->
                        <circle cx="60" cy="60" r="50"
                                stroke="url(#ringGrad)"
                                stroke-width="3" fill="none"
                                stroke-linecap="round"
                                stroke-dasharray="314"
                                stroke-dashoffset="314"
                                class="bw-ring-arc"/>
                        <defs>
                            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stop-color="#7c3aed"/>
                                <stop offset="100%" stop-color="#10b981"/>
                            </linearGradient>
                        </defs>
                    </svg>
                </div>

                <!-- Text -->
                <p class="bw-loader-title">BudgetWise</p>
                <p class="bw-loader-sub">Initialising secure session…</p>

                <!-- Progress bar -->
                <div class="bw-loader-bar-track" aria-hidden="true">
                    <div class="bw-loader-bar-fill" id="bw-loader-bar"></div>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        this._overlay = overlay;
        this._start   = performance.now();

        // Animate progress bar
        this._animateBar();
    }

    /** Animate the thin progress bar with eased motion */
    _animateBar() {
        const bar = document.getElementById('bw-loader-bar');
        if (!bar) return;

        const tick = (now) => {
            const elapsed = now - this._start;
            // Ease-out cubic: fast at start, slows towards 85%
            const t    = Math.min(elapsed / this._DURATION, 1);
            const pct  = Math.round((1 - Math.pow(1 - t, 3)) * 85);
            bar.style.width = `${pct}%`;
            if (t < 1) this._rafId = requestAnimationFrame(tick);
        };
        this._rafId = requestAnimationFrame(tick);
    }

    /**
     * Call this once the app is ready to show.
     * Completes the bar to 100% then fades the overlay out.
     */
    dismiss() {
        if (this._rafId) cancelAnimationFrame(this._rafId);

        const bar = document.getElementById('bw-loader-bar');
        if (bar) bar.style.width = '100%';

        const overlay = this._overlay;
        if (!overlay) return;

        // Small delay so user sees 100%, then fade
        setTimeout(() => {
            overlay.classList.add('bw-loader-exit');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
        }, 350);
    }
}

/* ─────────────────────────────────────────────────────────────
   2.  3-D TILT EFFECT
   ─────────────────────────────────────────────────────────────
   Applies a hardware-accelerated perspective tilt + gloss
   sheen on hover for any element with [data-tilt] attribute.
   Call Tilt3D.init() once after DOM is ready; it uses a
   MutationObserver to pick up dynamically injected cards.
   ───────────────────────────────────────────────────────────── */
export class Tilt3D {
    /**
     * @param {string}  selector   – CSS selector of tilt targets
     * @param {object}  options    – max: tilt degrees, glare: bool
     */
    constructor(selector = '[data-tilt]', options = {}) {
        this.selector = selector;
        this.max      = options.max   ?? 8;          // ° tilt
        this.glare    = options.glare ?? true;
        this._bound   = new WeakMap();
        this._observer = null;
    }

    init() {
        this._applyToAll();

        // Watch for new elements injected by the SPA router
        this._observer = new MutationObserver(() => this._applyToAll());
        this._observer.observe(document.body, { childList: true, subtree: true });
    }

    destroy() {
        this._observer?.disconnect();
    }

    _applyToAll() {
        document.querySelectorAll(this.selector).forEach(el => {
            if (this._bound.has(el)) return; // already wired
            this._wire(el);
        });
    }

    _wire(el) {
        // Inject glare overlay
        if (this.glare && !el.querySelector('.tilt-glare')) {
            const glare = document.createElement('div');
            glare.className = 'tilt-glare';
            el.style.position = 'relative';
            el.style.overflow = 'hidden';
            el.appendChild(glare);
        }

        const onMove = (e) => this._onMove(e, el);
        const onLeave = ()  => this._onLeave(el);

        el.addEventListener('mousemove',  onMove);
        el.addEventListener('mouseleave', onLeave);
        el.addEventListener('touchmove',  onMove, { passive: true });
        el.addEventListener('touchend',   onLeave);

        this._bound.set(el, { onMove, onLeave });
    }

    _onMove(e, el) {
        const rect  = el.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const xRel = (clientX - rect.left) / rect.width;  // 0→1
        const yRel = (clientY - rect.top)  / rect.height; // 0→1

        const rotX =  (yRel - 0.5) * -this.max * 2;  // tilt top/bottom
        const rotY =  (xRel - 0.5) *  this.max * 2;  // tilt left/right

        el.style.transform = `
            perspective(800px)
            rotateX(${rotX}deg)
            rotateY(${rotY}deg)
            scale3d(1.02, 1.02, 1.02)
        `;
        el.style.transition = 'transform 0.1s ease';

        // Move glare
        const glare = el.querySelector('.tilt-glare');
        if (glare) {
            const angle = Math.atan2(clientY - rect.top - rect.height / 2,
                                     clientX - rect.left  - rect.width  / 2)
                          * (180 / Math.PI) + 90;
            glare.style.transform  = `rotate(${angle}deg)`;
            glare.style.opacity    = `${0.10 + xRel * 0.12}`;
        }
    }

    _onLeave(el) {
        el.style.transform  = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
        el.style.transition = 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
        const glare = el.querySelector('.tilt-glare');
        if (glare) glare.style.opacity = '0';
    }
}

/* ─────────────────────────────────────────────────────────────
   3.  SCROLL REVEAL
   ─────────────────────────────────────────────────────────────
   Watches elements with [data-reveal] and adds .revealed
   when they enter the viewport. Pure CSS handles the
   actual animation via the .revealed class.
   ───────────────────────────────────────────────────────────── */
export class ScrollReveal {
    constructor(selector = '[data-reveal]', options = {}) {
        this.selector  = selector;
        this.threshold = options.threshold ?? 0.15;
        this._io       = null;
    }

    init() {
        this._io = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('revealed');
                        // Once revealed, stop watching (performance)
                        this._io.unobserve(entry.target);
                    }
                });
            },
            { threshold: this.threshold }
        );

        this._observe();

        // Re-observe after SPA navigation
        this._mutObs = new MutationObserver(() => this._observe());
        this._mutObs.observe(document.body, { childList: true, subtree: true });
    }

    _observe() {
        document.querySelectorAll(this.selector).forEach(el => {
            if (!el.classList.contains('revealed')) {
                this._io.observe(el);
            }
        });
    }

    destroy() {
        this._io?.disconnect();
        this._mutObs?.disconnect();
    }
}

/* ─────────────────────────────────────────────────────────────
   4.  MAGNETIC CURSOR
   ─────────────────────────────────────────────────────────────
   Renders a custom dot + ring cursor. Buttons with the
   [data-magnetic] attribute attract the cursor like a magnet.
   Automatically hidden on touch devices.
   ───────────────────────────────────────────────────────────── */
export class MagneticCursor {
    constructor() {
        this._dot  = null;
        this._ring = null;
        this._mx   = 0; this._my = 0; // raw mouse
        this._rx   = 0; this._ry = 0; // ring (lagging)
        this._raf  = null;
        this._active = false;
    }

    init() {
        // Skip on touch-only devices
        if (window.matchMedia('(hover: none)').matches) return;

        // Build DOM nodes
        this._dot  = this._createNode('bw-cursor-dot');
        this._ring = this._createNode('bw-cursor-ring');
        document.body.appendChild(this._dot);
        document.body.appendChild(this._ring);

        document.addEventListener('mousemove', e => {
            this._mx = e.clientX;
            this._my = e.clientY;
            if (!this._active) {
                this._active = true;
                this._dot.style.opacity  = '1';
                this._ring.style.opacity = '1';
            }
        });

        document.addEventListener('mouseleave', () => {
            this._dot.style.opacity  = '0';
            this._ring.style.opacity = '0';
            this._active = false;
        });

        // Magnetic pull on interactive elements
        document.addEventListener('mouseover', e => {
            const target = e.target.closest('[data-magnetic], .btn, button, a');
            if (target) {
                this._ring.classList.add('bw-cursor-expand');
            }
        });
        document.addEventListener('mouseout', e => {
            const target = e.target.closest('[data-magnetic], .btn, button, a');
            if (target) {
                this._ring.classList.remove('bw-cursor-expand');
            }
        });

        document.addEventListener('mousedown', () => this._dot.classList.add('bw-cursor-click'));
        document.addEventListener('mouseup',   () => this._dot.classList.remove('bw-cursor-click'));

        // RAF loop for smooth lagging ring
        this._loop();
    }

    _createNode(cls) {
        const el = document.createElement('div');
        el.className = cls;
        el.setAttribute('aria-hidden', 'true');
        return el;
    }

    _loop() {
        // Lerp ring towards mouse position
        this._rx += (this._mx - this._rx) * 0.12;
        this._ry += (this._my - this._ry) * 0.12;

        if (this._dot)  { this._dot.style.transform  = `translate(${this._mx - 4}px, ${this._my - 4}px)`; }
        if (this._ring) { this._ring.style.transform = `translate(${this._rx - 20}px, ${this._ry - 20}px)`; }

        this._raf = requestAnimationFrame(() => this._loop());
    }

    destroy() {
        if (this._raf) cancelAnimationFrame(this._raf);
        this._dot?.remove();
        this._ring?.remove();
    }
}

/* ─────────────────────────────────────────────────────────────
   5.  PAGE TRANSITION
   ─────────────────────────────────────────────────────────────
   Wraps the main-content area in a fade+slide transition
   whenever navigating between virtual pages. Call
   PageTransition.play() before injecting new HTML,
   and PageTransition.done() after.
   ───────────────────────────────────────────────────────────── */
export class PageTransition {
    constructor(contentSelector = '#main-content') {
        this._el = null;
        this._selector = contentSelector;
    }

    /** Fade the content region out */
    async play() {
        this._el = document.querySelector(this._selector);
        if (!this._el) return;
        this._el.classList.add('page-exit');
        await this._wait(180);
    }

    /** Fade the content region back in */
    async done() {
        if (!this._el) return;
        this._el.classList.remove('page-exit');
        this._el.classList.add('page-enter');
        await this._wait(20); // micro-tick so class is applied
        this._el.classList.add('page-enter-active');
        await this._wait(400);
        this._el.classList.remove('page-enter', 'page-enter-active');
    }

    _wait(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}

/* ─────────────────────────────────────────────────────────────
   6.  MICRO PARTICLES (click burst)
   ─────────────────────────────────────────────────────────────
   Spawns tiny colored dots on every click, simulating a
   satisfying "burst" micro-interaction. Zero dependencies.
   ───────────────────────────────────────────────────────────── */
export class MicroParticles {
    constructor(options = {}) {
        this._count  = options.count  ?? 8;
        this._colors = options.colors ?? ['#7c3aed', '#8b5cf6', '#10b981', '#3b82f6'];
    }

    init() {
        document.addEventListener('click', e => {
            // Skip if clicking inside forms / modals
            if (e.target.closest('input, select, textarea, #modal-container')) return;
            this._burst(e.clientX, e.clientY);
        });
    }

    _burst(x, y) {
        for (let i = 0; i < this._count; i++) {
            const particle = document.createElement('div');
            particle.className = 'bw-particle';
            const color  = this._colors[Math.floor(Math.random() * this._colors.length)];
            const size   = 4 + Math.random() * 5;
            const angle  = (Math.PI * 2 * i) / this._count + (Math.random() - 0.5) * 0.5;
            const radius = 30 + Math.random() * 40;
            const tx     = Math.cos(angle) * radius;
            const ty     = Math.sin(angle) * radius;

            Object.assign(particle.style, {
                left:            `${x}px`,
                top:             `${y}px`,
                width:           `${size}px`,
                height:          `${size}px`,
                background:       color,
                '--tx':          `${tx}px`,
                '--ty':          `${ty}px`,
            });

            document.body.appendChild(particle);
            // Remove after animation finishes
            particle.addEventListener('animationend', () => particle.remove(), { once: true });
        }
    }
}

/* ─────────────────────────────────────────────────────────────
   MASTER INIT — call this once at app boot
   ─────────────────────────────────────────────────────────────
   Returns { loader, tilt, scrollReveal, cursor, transition }
   so callers can interact with individual modules.
   ───────────────────────────────────────────────────────────── */
export function initAnimations() {
    const loader       = new PageLoader();
    const tilt         = new Tilt3D('[data-tilt]', { max: 7, glare: true });
    const scrollReveal = new ScrollReveal('[data-reveal]');
    const cursor       = new MagneticCursor();
    const transition   = new PageTransition('#main-content');
    const particles    = new MicroParticles();

    loader.mount();
    tilt.init();
    scrollReveal.init();
    cursor.init();
    particles.init();

    return { loader, tilt, scrollReveal, cursor, transition };
}
