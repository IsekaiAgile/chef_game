/**
 * CharacterDisplay - Manages VN character sprite display with anime.js animations
 *
 * Features:
 * - Slide-in character entry animations
 * - "Talk-and-Jump" effect for active speaker
 * - Brightness dimming for non-speaking characters
 * - Smooth transitions using anime.js
 */

class CharacterDisplay {
    /**
     * @param {EventBus} eventBus - Event bus for communication
     * @param {Object} config - Configuration options
     */
    constructor(eventBus, config = {}) {
        this._eventBus = eventBus;
        this._config = {
            containerSelector: config.containerSelector || '.vn-stage',
            transitionDuration: config.transitionDuration || 400,
            dimOpacity: config.dimOpacity || 0.7,
            speakerScale: config.speakerScale || 1.02
        };

        // Character registry
        this._characters = new Map();
        this._activeCharacters = new Set();
        this._speakingCharacter = null;
        this._talkingAnimation = null;

        // Register default characters
        this._registerDefaultCharacters();

        // Setup event listeners
        this._setupEventListeners();
    }

    // ===== Character Registration =====

    registerCharacter(character) {
        this._characters.set(character.id, {
            ...character,
            visible: false,
            hasEntered: false
        });
    }

    getCharacter(id) {
        return this._characters.get(id) || null;
    }

    _registerDefaultCharacters() {
        // === IMAGE PATH CONSTANTS ===
        const SPRITES = {
            FUJI: 'fuji1.png',
            MINA: 'ミナ.png',
            OWNER: '親父.png'
        };

        // Fuji - Main character (center position when speaking)
        this.registerCharacter({
            id: 'fuji',
            name: 'フジ',
            image: SPRITES.FUJI,
            position: 'center',
            elementId: 'vn-char-fuji',
            entryDirection: 'left'
        });

        // Mina - Owner's daughter (left position)
        this.registerCharacter({
            id: 'mina',
            name: 'ミナ',
            image: SPRITES.MINA,
            position: 'left',
            elementId: 'vn-char-mina',
            entryDirection: 'left'
        });

        // Owner - Old chef (right position)
        this.registerCharacter({
            id: 'owner',
            name: '老店主',
            image: SPRITES.OWNER,
            position: 'right',
            elementId: 'vn-char-owner',
            entryDirection: 'right'
        });

        // Narrator - No sprite
        this.registerCharacter({
            id: 'narrator',
            name: 'ナレーター',
            image: null,
            position: null,
            elementId: null,
            entryDirection: null
        });
    }

    _setupEventListeners() {
        // CHARACTER_SHOWN - for multi-character scenes
        this._eventBus.on(GameEvents.CHARACTER_SHOWN, (data) => {
            this.showCharacter(data.characterId);
        });

        this._eventBus.on(GameEvents.CHARACTER_HIDDEN, (data) => {
            this.hideCharacter(data.characterId);
        });

        // CHARACTER_SPEAKING - highlight and animate speaker
        this._eventBus.on(GameEvents.CHARACTER_SPEAKING, (data) => {
            this.focusOnCharacter(data.characterId);
        });

        // Scene changes - hide all
        this._eventBus.on(GameEvents.SCENE_CHANGED, () => {
            this.hideAllCharacters();
        });

        // Dialogue completion
        this._eventBus.on(GameEvents.DIALOGUE_COMPLETED, () => {
            this._stopTalkingAnimation();
            this._speakingCharacter = null;
            this.hideAllCharacters();
        });
    }

    // ===== Animation Methods =====

    /**
     * Animate character entry with slide-in effect
     */
    _animateEntry(element, direction = 'left') {
        if (typeof anime === 'undefined') return;

        const startX = direction === 'left' ? -150 : 150;

        // Reset element state
        anime.remove(element);
        element.style.opacity = '0';
        element.style.transform = `translateX(${startX}px)`;

        // Slide in with bounce
        anime({
            targets: element,
            translateX: [startX, 0],
            opacity: [0, 1],
            scale: [0.9, 1],
            duration: 600,
            easing: 'easeOutBack'
        });

        // Play entry sound
        if (typeof gameEffects !== 'undefined') {
            gameEffects.playSound('click');
        }
    }

    /**
     * Animate character exit with fade-out
     */
    _animateExit(element, direction = 'left') {
        if (typeof anime === 'undefined') return;

        const endX = direction === 'left' ? -100 : 100;

        anime({
            targets: element,
            translateX: [0, endX],
            opacity: [1, 0],
            scale: [1, 0.9],
            duration: 400,
            easing: 'easeInQuad',
            complete: () => {
                element.classList.add('hidden');
            }
        });
    }

    /**
     * Start "Talk-and-Jump" animation for speaking character
     */
    _startTalkingAnimation(element) {
        if (typeof anime === 'undefined') return;

        // Stop any existing animation
        this._stopTalkingAnimation();

        // Subtle bouncing animation while talking
        this._talkingAnimation = anime({
            targets: element,
            translateY: [0, -8, 0],
            scale: [1, 1.02, 1],
            duration: 600,
            easing: 'easeInOutSine',
            loop: true
        });
    }

    /**
     * Stop talking animation
     */
    _stopTalkingAnimation() {
        if (this._talkingAnimation) {
            this._talkingAnimation.pause();
            this._talkingAnimation = null;
        }
    }

    /**
     * Animate brightness change
     */
    _animateBrightness(element, brightness) {
        if (typeof anime === 'undefined') {
            element.style.filter = `brightness(${brightness})`;
            return;
        }

        anime({
            targets: element,
            filter: `brightness(${brightness})`,
            duration: 300,
            easing: 'easeOutQuad'
        });
    }

    // ===== Display Methods =====

    /**
     * Show a character with entry animation
     */
    showCharacter(characterId, options = {}) {
        const character = this._characters.get(characterId);
        if (!character || !character.elementId) return;

        const element = document.getElementById(character.elementId);
        if (!element) return;

        // Update image
        const img = element.querySelector('.vn-sprite-img');
        if (img && character.image) {
            img.src = character.image;
            img.alt = character.name;
        }

        // Show element
        element.classList.remove('hidden', 'char-exit');

        // Play entry animation if first time
        if (!character.hasEntered) {
            this._animateEntry(element, character.entryDirection);
            character.hasEntered = true;
        } else {
            // Fade in if already entered before
            if (typeof anime !== 'undefined') {
                anime({
                    targets: element,
                    opacity: [0, 1],
                    duration: 300,
                    easing: 'easeOutQuad'
                });
            }
        }

        character.visible = true;
        this._activeCharacters.add(characterId);
    }

    /**
     * Hide a character with exit animation
     */
    hideCharacter(characterId) {
        const character = this._characters.get(characterId);
        if (!character || !character.elementId) return;

        const element = document.getElementById(character.elementId);
        if (!element) return;

        // Stop talking animation if this character was speaking
        if (this._speakingCharacter === characterId) {
            this._stopTalkingAnimation();
        }

        this._animateExit(element, character.entryDirection);

        character.visible = false;
        this._activeCharacters.delete(characterId);

        if (this._speakingCharacter === characterId) {
            this._speakingCharacter = null;
        }
    }

    /**
     * Hide all characters
     */
    hideAllCharacters() {
        this._stopTalkingAnimation();
        this._characters.forEach((char, id) => {
            if (char.visible) {
                this.hideCharacter(id);
            }
            // Reset entry state for next scene
            char.hasEntered = false;
        });
    }

    /**
     * Focus on speaking character with Talk-and-Jump effect
     */
    focusOnCharacter(characterId) {
        const character = this._characters.get(characterId);

        // Narrator has no sprite
        if (characterId === 'narrator' || !character || !character.elementId) {
            // Dim all visible characters for narrator
            this._activeCharacters.forEach(id => {
                const char = this._characters.get(id);
                if (char && char.elementId) {
                    const el = document.getElementById(char.elementId);
                    if (el) {
                        this._animateBrightness(el, 0.6);
                        this._stopTalkingAnimation();
                    }
                }
            });
            this._speakingCharacter = null;
            return;
        }

        // Stop previous talking animation
        this._stopTalkingAnimation();
        this._speakingCharacter = characterId;

        // Update all characters
        this._characters.forEach((char, id) => {
            if (!char.elementId) return;

            const element = document.getElementById(char.elementId);
            if (!element) return;

            if (id === characterId) {
                // Show speaking character if not visible
                if (!char.visible) {
                    element.classList.remove('hidden');
                    this._animateEntry(element, char.entryDirection);
                    char.visible = true;
                    char.hasEntered = true;
                    this._activeCharacters.add(id);
                }

                // Brighten and start talking animation
                element.classList.add('speaking');
                element.classList.remove('dimmed');
                this._animateBrightness(element, 1);
                this._startTalkingAnimation(element);

                // Bring to front
                element.style.zIndex = '10';

            } else if (char.visible) {
                // Dim non-speaking characters
                element.classList.remove('speaking');
                element.classList.add('dimmed');
                this._animateBrightness(element, 0.7);
                element.style.zIndex = '5';

                // Move slightly back
                if (typeof anime !== 'undefined') {
                    anime({
                        targets: element,
                        scale: 0.95,
                        duration: 300,
                        easing: 'easeOutQuad'
                    });
                }
            }
        });
    }

    /**
     * Set speaking character (alternative method)
     */
    setSpeaking(characterId) {
        this.focusOnCharacter(characterId);
    }

    /**
     * Clear speaking state
     */
    clearSpeaking() {
        this._stopTalkingAnimation();
        this._speakingCharacter = null;

        this._activeCharacters.forEach(id => {
            const character = this._characters.get(id);
            if (!character || !character.elementId) return;

            const element = document.getElementById(character.elementId);
            if (element) {
                element.classList.remove('speaking', 'dimmed');
                this._animateBrightness(element, 1);

                if (typeof anime !== 'undefined') {
                    anime({
                        targets: element,
                        scale: 1,
                        duration: 300,
                        easing: 'easeOutQuad'
                    });
                }
            }
        });
    }

    /**
     * Move character to position
     */
    moveCharacter(characterId, position) {
        const character = this._characters.get(characterId);
        if (!character || !character.elementId) return;

        const element = document.getElementById(character.elementId);
        if (!element) return;

        element.classList.remove('position-left', 'position-right', 'position-center', 'position-center-left');
        element.classList.add(`position-${position}`);
        character.position = position;
    }

    /**
     * Get visible characters
     */
    getVisibleCharacters() {
        return Array.from(this._activeCharacters);
    }

    /**
     * Check if character is visible
     */
    isVisible(characterId) {
        return this._activeCharacters.has(characterId);
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CharacterDisplay };
}
