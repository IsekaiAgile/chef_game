/**
 * GameEffects - Handles animations and sound effects
 *
 * Uses anime.js for bouncy console-game-style animations
 * and Web Audio API for sound effects
 */

class GameEffects {
    constructor() {
        // Audio context for sound effects
        this._audioContext = null;
        this._sounds = new Map();
        this._isMuted = false;
        this._volume = 0.5;

        // Initialize
        this._initAudio();
        this._initButtonAnimations();
    }

    // ===== Audio System =====

    _initAudio() {
        // Create audio context on first user interaction
        const initContext = () => {
            if (!this._audioContext) {
                this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this._generateSounds();
            }
            document.removeEventListener('click', initContext);
            document.removeEventListener('touchstart', initContext);
        };

        document.addEventListener('click', initContext);
        document.addEventListener('touchstart', initContext);
    }

    /**
     * Generate synthesized sound effects (no external files needed)
     */
    _generateSounds() {
        // Command button click - bouncy "pop" sound
        this._sounds.set('command', {
            frequency: 440,
            type: 'sine',
            duration: 0.1,
            attack: 0.01,
            decay: 0.09,
            pitchBend: 1.5
        });

        // Success sound - ascending cheerful tone
        this._sounds.set('success', {
            frequency: 523.25, // C5
            type: 'sine',
            duration: 0.15,
            attack: 0.01,
            decay: 0.14,
            pitchBend: 1.2,
            sequence: [523.25, 659.25, 783.99] // C5, E5, G5
        });

        // Error/failure sound - descending tone
        this._sounds.set('error', {
            frequency: 330,
            type: 'sawtooth',
            duration: 0.2,
            attack: 0.01,
            decay: 0.19,
            pitchBend: 0.7
        });

        // Perfect cycle - triumphant sound
        this._sounds.set('perfect', {
            frequency: 523.25,
            type: 'sine',
            duration: 0.4,
            attack: 0.02,
            decay: 0.38,
            sequence: [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
        });

        // UI click - soft click
        this._sounds.set('click', {
            frequency: 800,
            type: 'sine',
            duration: 0.05,
            attack: 0.005,
            decay: 0.045,
            pitchBend: 0.8
        });

        // Dialogue advance - soft pop
        this._sounds.set('dialogue', {
            frequency: 600,
            type: 'sine',
            duration: 0.08,
            attack: 0.01,
            decay: 0.07,
            pitchBend: 1.1
        });

        // Menu hover - subtle tone
        this._sounds.set('hover', {
            frequency: 500,
            type: 'sine',
            duration: 0.04,
            attack: 0.005,
            decay: 0.035,
            pitchBend: 1.05
        });
    }

    /**
     * Play a synthesized sound effect
     * @param {string} soundName - Name of the sound to play
     */
    playSound(soundName) {
        if (this._isMuted || !this._audioContext) return;

        const sound = this._sounds.get(soundName);
        if (!sound) return;

        try {
            if (sound.sequence) {
                // Play sequence of notes
                sound.sequence.forEach((freq, i) => {
                    setTimeout(() => {
                        this._playTone(freq, sound.type, sound.duration / sound.sequence.length, sound.attack, sound.decay);
                    }, i * (sound.duration / sound.sequence.length) * 1000);
                });
            } else {
                this._playTone(sound.frequency, sound.type, sound.duration, sound.attack, sound.decay, sound.pitchBend);
            }
        } catch (e) {
            console.warn('GameEffects: Could not play sound', e);
        }
    }

    _playTone(frequency, type, duration, attack, decay, pitchBend = 1) {
        const ctx = this._audioContext;
        const now = ctx.currentTime;

        // Create oscillator
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, now);

        // Apply pitch bend
        if (pitchBend !== 1) {
            osc.frequency.exponentialRampToValueAtTime(frequency * pitchBend, now + duration);
        }

        // Create gain node for envelope
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(this._volume, now + attack);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

        // Connect and play
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration + 0.1);
    }

    // ===== Animation System =====

    _initButtonAnimations() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._setupButtonAnimations());
        } else {
            this._setupButtonAnimations();
        }
    }

    _setupButtonAnimations() {
        // Command buttons - bouncy press effect
        document.querySelectorAll('.pawa-cmd-btn').forEach(btn => {
            this._addBouncyEffect(btn, 'command');
        });

        // Primary buttons (overlays)
        document.querySelectorAll('.pawa-btn-primary').forEach(btn => {
            this._addBouncyEffect(btn, 'click');
        });

        // Choice buttons
        document.querySelectorAll('.choice-btn').forEach(btn => {
            this._addBouncyEffect(btn, 'click');
        });

        // VN control buttons
        document.querySelectorAll('.vn-control-btn').forEach(btn => {
            this._addBouncyEffect(btn, 'click');
        });

        // Hover effects for command buttons
        document.querySelectorAll('.pawa-cmd-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                this.playSound('hover');
                this.animateHover(btn);
            });
        });
    }

    /**
     * Add bouncy click effect to a button
     * @param {HTMLElement} element - Button element
     * @param {string} soundName - Sound to play on click
     */
    _addBouncyEffect(element, soundName) {
        element.addEventListener('mousedown', () => {
            this.playSound(soundName);
            this.animatePress(element);
        });

        element.addEventListener('mouseup', () => {
            this.animateRelease(element);
        });

        element.addEventListener('mouseleave', () => {
            this.animateRelease(element);
        });

        // Touch support
        element.addEventListener('touchstart', (e) => {
            this.playSound(soundName);
            this.animatePress(element);
        }, { passive: true });

        element.addEventListener('touchend', () => {
            this.animateRelease(element);
        }, { passive: true });
    }

    /**
     * Animate button press (scale down)
     * @param {HTMLElement} element - Element to animate
     */
    animatePress(element) {
        anime.remove(element);
        anime({
            targets: element,
            scale: 0.9,
            duration: 100,
            easing: 'easeOutQuad'
        });
    }

    /**
     * Animate button release (bouncy return)
     * @param {HTMLElement} element - Element to animate
     */
    animateRelease(element) {
        anime.remove(element);
        anime({
            targets: element,
            scale: [0.9, 1.05, 1],
            duration: 400,
            easing: 'easeOutElastic(1, 0.5)'
        });
    }

    /**
     * Animate hover effect
     * @param {HTMLElement} element - Element to animate
     */
    animateHover(element) {
        anime({
            targets: element,
            translateY: -3,
            duration: 200,
            easing: 'easeOutQuad'
        });
    }

    /**
     * Animate success effect (for perfect cycles, etc.)
     * @param {HTMLElement} element - Element to animate
     */
    animateSuccess(element) {
        this.playSound('success');
        anime({
            targets: element,
            scale: [1, 1.2, 1],
            rotate: [0, 5, -5, 0],
            duration: 600,
            easing: 'easeOutElastic(1, 0.5)'
        });
    }

    /**
     * Animate error/shake effect
     * @param {HTMLElement} element - Element to animate
     */
    animateError(element) {
        this.playSound('error');
        anime({
            targets: element,
            translateX: [-10, 10, -10, 10, 0],
            duration: 400,
            easing: 'easeInOutQuad'
        });
    }

    /**
     * Animate floating text (for +5, -3 effects)
     * @param {HTMLElement} element - Element to animate
     * @param {boolean} isPositive - Whether the effect is positive
     */
    animateFloatingText(element, isPositive = true) {
        const sound = isPositive ? 'success' : 'error';
        this.playSound(sound);

        anime({
            targets: element,
            translateY: -80,
            opacity: [1, 0],
            scale: [1, 1.2],
            duration: 1500,
            easing: 'easeOutExpo'
        });
    }

    /**
     * Animate dialogue box appearance
     * @param {HTMLElement} element - Dialogue box element
     */
    animateDialogueAppear(element) {
        anime({
            targets: element,
            translateY: [30, 0],
            opacity: [0, 1],
            duration: 300,
            easing: 'easeOutQuad'
        });
    }

    /**
     * Animate overlay appear
     * @param {HTMLElement} element - Overlay element
     */
    animateOverlayAppear(element) {
        anime({
            targets: element,
            opacity: [0, 1],
            scale: [0.95, 1],
            duration: 400,
            easing: 'easeOutQuad'
        });
    }

    /**
     * Animate character entrance
     * @param {HTMLElement} element - Character element
     * @param {string} direction - 'left' or 'right'
     */
    animateCharacterEnter(element, direction = 'left') {
        const startX = direction === 'left' ? -100 : 100;
        anime({
            targets: element,
            translateX: [startX, 0],
            opacity: [0, 1],
            duration: 500,
            easing: 'easeOutQuad'
        });
    }

    /**
     * Pulse animation for attention
     * @param {HTMLElement} element - Element to pulse
     */
    animatePulse(element) {
        anime({
            targets: element,
            scale: [1, 1.1, 1],
            duration: 800,
            loop: true,
            easing: 'easeInOutSine'
        });
    }

    /**
     * Stop pulse animation
     * @param {HTMLElement} element - Element to stop
     */
    stopPulse(element) {
        anime.remove(element);
        anime({
            targets: element,
            scale: 1,
            duration: 200
        });
    }

    // ===== Public Methods =====

    /**
     * Mute/unmute all sounds
     * @param {boolean} muted - Whether to mute
     */
    setMuted(muted) {
        this._isMuted = muted;
    }

    /**
     * Set volume
     * @param {number} volume - Volume level (0-1)
     */
    setVolume(volume) {
        this._volume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Play perfect cycle celebration
     */
    playPerfectCycle() {
        this.playSound('perfect');

        // Animate all command buttons
        document.querySelectorAll('.pawa-cmd-btn').forEach((btn, i) => {
            setTimeout(() => {
                anime({
                    targets: btn,
                    scale: [1, 1.15, 1],
                    rotate: [0, 10, -10, 0],
                    duration: 500,
                    easing: 'easeOutElastic(1, 0.5)'
                });
            }, i * 100);
        });

        // Flash effect on HUD
        const hud = document.querySelector('.pawa-bottom-hud');
        if (hud) {
            anime({
                targets: hud,
                boxShadow: ['0 0 0 rgba(255,215,0,0)', '0 0 30px rgba(255,215,0,0.8)', '0 0 0 rgba(255,215,0,0)'],
                duration: 800,
                easing: 'easeOutQuad'
            });
        }
    }

    /**
     * Play dialogue advance sound
     */
    playDialogueAdvance() {
        this.playSound('dialogue');
    }
}

// Global instance
const gameEffects = new GameEffects();

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameEffects, gameEffects };
}
