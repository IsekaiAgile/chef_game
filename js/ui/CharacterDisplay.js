/**
 * CharacterDisplay - Manages VN character sprite display
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles character sprite display/positioning
 * - Open/Closed: New characters can be added via registerCharacter()
 * - Dependency Inversion: Uses EventBus for communication
 */

/**
 * @typedef {Object} CharacterSprite
 * @property {string} id - Character ID
 * @property {string} name - Display name
 * @property {string} image - Image file path
 * @property {string} position - 'left' | 'right' | 'center'
 * @property {string} elementId - DOM element ID
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
            transitionDuration: config.transitionDuration || 300,
            dimOpacity: config.dimOpacity || 0.5
        };

        // Character registry
        this._characters = new Map();
        this._activeCharacters = new Set();
        this._speakingCharacter = null;

        // Register default characters
        this._registerDefaultCharacters();

        // Setup event listeners
        this._setupEventListeners();
    }

    // ===== Character Registration (Open/Closed Principle) =====

    /**
     * Register a character sprite
     * @param {CharacterSprite} character - Character definition
     */
    registerCharacter(character) {
        this._characters.set(character.id, {
            ...character,
            visible: false
        });
    }

    /**
     * Get character by ID
     * @param {string} id - Character ID
     * @returns {CharacterSprite|null}
     */
    getCharacter(id) {
        return this._characters.get(id) || null;
    }

    _registerDefaultCharacters() {
        // Fuji - Main character (center-left position)
        this.registerCharacter({
            id: 'fuji',
            name: 'フジ',
            image: 'fuji1.jpg',
            position: 'center-left',
            elementId: 'vn-char-fuji'
        });

        // Mina - Owner's daughter (left position)
        this.registerCharacter({
            id: 'mina',
            name: 'ミナ',
            image: 'ミナ.png',
            position: 'left',
            elementId: 'vn-char-mina'
        });

        // Owner - Old chef (right position)
        this.registerCharacter({
            id: 'owner',
            name: '老店主',
            image: '親父.png',
            position: 'right',
            elementId: 'vn-char-owner'
        });

        // Narrator - No sprite
        this.registerCharacter({
            id: 'narrator',
            name: 'ナレーター',
            image: null,
            position: null,
            elementId: null
        });
    }

    _setupEventListeners() {
        // Listen for character events
        this._eventBus.on(GameEvents.CHARACTER_SHOWN, (data) => {
            this.showCharacter(data.characterId, data.options);
        });

        this._eventBus.on(GameEvents.CHARACTER_HIDDEN, (data) => {
            this.hideCharacter(data.characterId);
        });

        this._eventBus.on(GameEvents.CHARACTER_SPEAKING, (data) => {
            this.setSpeaking(data.characterId);
        });

        // Listen for scene changes to reset characters
        this._eventBus.on(GameEvents.SCENE_CHANGED, () => {
            // Don't hide all on scene change, let the scene control it
        });

        // Listen for dialogue completion
        this._eventBus.on(GameEvents.DIALOGUE_COMPLETED, () => {
            this._speakingCharacter = null;
        });
    }

    // ===== Display Methods =====

    /**
     * Show a character on screen
     * @param {string} characterId - Character ID
     * @param {Object} options - Display options
     */
    showCharacter(characterId, options = {}) {
        const character = this._characters.get(characterId);
        if (!character || !character.elementId) return;

        const element = document.getElementById(character.elementId);
        if (!element) return;

        // Update image if needed
        const img = element.querySelector('.vn-sprite-img');
        if (img && character.image) {
            img.src = character.image;
            img.alt = character.name;
        }

        // Reset all state classes first
        element.classList.remove('hidden', 'char-exit', 'char-enter', 'speaking', 'dimmed');

        // Force reflow to ensure animation plays
        void element.offsetWidth;

        // Show element with animation
        element.classList.add('char-enter');

        // Update character state
        character.visible = true;
        this._activeCharacters.add(characterId);

        // Remove animation class after completion
        setTimeout(() => {
            element.classList.remove('char-enter');
        }, this._config.transitionDuration);
    }

    /**
     * Hide a character from screen
     * @param {string} characterId - Character ID
     */
    hideCharacter(characterId) {
        const character = this._characters.get(characterId);
        if (!character || !character.elementId) return;

        const element = document.getElementById(character.elementId);
        if (!element) return;

        // Animate out
        element.classList.add('char-exit');

        setTimeout(() => {
            element.classList.add('hidden');
            element.classList.remove('char-exit');
        }, this._config.transitionDuration);

        // Update character state
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
        this._characters.forEach((char, id) => {
            if (char.visible) {
                this.hideCharacter(id);
            }
        });
    }

    /**
     * Set which character is speaking (highlights them, dims others)
     * @param {string} characterId - Speaking character ID
     */
    setSpeaking(characterId) {
        this._speakingCharacter = characterId;

        // Update all visible characters
        this._activeCharacters.forEach(id => {
            const character = this._characters.get(id);
            if (!character || !character.elementId) return;

            const element = document.getElementById(character.elementId);
            if (!element) return;

            if (id === characterId) {
                // Highlight speaking character
                element.classList.add('speaking');
                element.classList.remove('dimmed');
            } else {
                // Dim non-speaking characters
                element.classList.remove('speaking');
                element.classList.add('dimmed');
            }
        });

        // Handle narrator (no character highlighted)
        if (characterId === 'narrator') {
            this._activeCharacters.forEach(id => {
                const character = this._characters.get(id);
                if (!character || !character.elementId) return;
                const element = document.getElementById(character.elementId);
                if (element) {
                    element.classList.remove('speaking', 'dimmed');
                }
            });
        }
    }

    /**
     * Clear speaking state from all characters
     */
    clearSpeaking() {
        this._speakingCharacter = null;
        this._activeCharacters.forEach(id => {
            const character = this._characters.get(id);
            if (!character || !character.elementId) return;
            const element = document.getElementById(character.elementId);
            if (element) {
                element.classList.remove('speaking', 'dimmed');
            }
        });
    }

    /**
     * Move character to a specific position
     * @param {string} characterId - Character ID
     * @param {string} position - 'left' | 'right' | 'center'
     */
    moveCharacter(characterId, position) {
        const character = this._characters.get(characterId);
        if (!character || !character.elementId) return;

        const element = document.getElementById(character.elementId);
        if (!element) return;

        // Update position classes
        element.classList.remove('position-left', 'position-right', 'position-center');
        element.classList.add(`position-${position}`);

        // Update character data
        character.position = position;
    }

    /**
     * Get list of currently visible characters
     * @returns {string[]}
     */
    getVisibleCharacters() {
        return Array.from(this._activeCharacters);
    }

    /**
     * Check if character is currently visible
     * @param {string} characterId - Character ID
     * @returns {boolean}
     */
    isVisible(characterId) {
        return this._activeCharacters.has(characterId);
    }

    /**
     * Create character DOM elements dynamically
     * @param {HTMLElement} container - Container element
     */
    createCharacterElements(container) {
        if (!container) return;

        this._characters.forEach((char, id) => {
            if (!char.elementId || !char.image) return;

            // Check if element already exists
            if (document.getElementById(char.elementId)) return;

            const charEl = document.createElement('div');
            charEl.id = char.elementId;
            charEl.className = `vn-character position-${char.position} hidden`;

            const img = document.createElement('img');
            img.className = 'vn-sprite-img';
            img.src = char.image;
            img.alt = char.name;

            const nameEl = document.createElement('span');
            nameEl.className = 'vn-char-name';
            nameEl.textContent = char.name;

            charEl.appendChild(img);
            charEl.appendChild(nameEl);
            container.appendChild(charEl);
        });
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CharacterDisplay };
}
