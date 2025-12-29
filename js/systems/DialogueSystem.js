/**
 * DialogueSystem - Visual Novel dialogue engine
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles dialogue flow and text display
 * - Open/Closed: New dialogue types can be added via configuration
 * - Liskov Substitution: Can be replaced with any IDialogueSystem implementation
 * - Interface Segregation: Only exposes dialogue-related methods
 * - Dependency Inversion: Depends on EventBus abstraction, not UI directly
 */

/**
 * @typedef {Object} DialogueLine
 * @property {string} speaker - Character ID
 * @property {string} text - Dialogue text
 */

/**
 * @typedef {Object} Character
 * @property {string} name - Display name
 * @property {string} position - 'left' | 'right' | 'center'
 */

class DialogueSystem {
    /**
     * @param {EventBus} eventBus - Event bus for communication
     * @param {Object} config - Configuration options
     */
    constructor(eventBus, config = {}) {
        this._eventBus = eventBus;
        this._config = {
            typingSpeed: config.typingSpeed || 30,
            characters: config.characters || {}
        };

        // Internal state
        this._queue = [];
        this._currentIndex = 0;
        this._isTyping = false;
        this._currentText = '';
        this._charIndex = 0;
        this._typingInterval = null;
        this._onComplete = null;
        this._dialogueType = 'default';

        // Bind methods for event handling
        this._boundAdvance = this.advance.bind(this);
    }

    /**
     * Register a character
     * @param {string} id - Character ID
     * @param {Character} character - Character data
     */
    registerCharacter(id, character) {
        this._config.characters[id] = character;
    }

    /**
     * Get character by ID
     * @param {string} id - Character ID
     * @returns {Character|null}
     */
    getCharacter(id) {
        return this._config.characters[id] || null;
    }

    /**
     * Start a dialogue sequence
     * @param {DialogueLine[]} dialogues - Array of dialogue lines
     * @param {string} [type='default'] - Dialogue type for styling
     * @param {Function} [onComplete] - Callback when sequence ends
     */
    start(dialogues, type = 'default', onComplete = null) {
        if (!dialogues || dialogues.length === 0) {
            console.warn('DialogueSystem: Empty dialogue array');
            if (onComplete) onComplete();
            return;
        }

        this._queue = [...dialogues];
        this._currentIndex = 0;
        this._onComplete = onComplete;
        this._dialogueType = type;

        this._eventBus.emit(GameEvents.DIALOGUE_STARTED, {
            type,
            totalLines: dialogues.length
        });

        this._showCurrentLine();
    }

    /**
     * Advance to next dialogue line
     */
    advance() {
        if (this._isTyping) {
            this._completeTyping();
            return;
        }

        this._currentIndex++;

        if (this._currentIndex >= this._queue.length) {
            this._complete();
        } else {
            this._showCurrentLine();
        }
    }

    /**
     * Skip entire dialogue sequence
     */
    skip() {
        this._stopTyping();
        this._currentIndex = this._queue.length;

        this._eventBus.emit(GameEvents.DIALOGUE_SKIPPED, {
            type: this._dialogueType
        });

        this._complete();
    }

    /**
     * Check if dialogue is active
     * @returns {boolean}
     */
    isActive() {
        return this._queue.length > 0 && this._currentIndex < this._queue.length;
    }

    /**
     * Check if currently typing
     * @returns {boolean}
     */
    isTyping() {
        return this._isTyping;
    }

    /**
     * Get current dialogue line
     * @returns {DialogueLine|null}
     */
    getCurrentLine() {
        if (this._currentIndex < this._queue.length) {
            return this._queue[this._currentIndex];
        }
        return null;
    }

    /**
     * Get current dialogue type
     * @returns {string}
     */
    getDialogueType() {
        return this._dialogueType;
    }

    /**
     * Get progress info
     * @returns {Object}
     */
    getProgress() {
        return {
            current: this._currentIndex + 1,
            total: this._queue.length,
            percentage: this._queue.length > 0
                ? ((this._currentIndex + 1) / this._queue.length) * 100
                : 0
        };
    }

    // ===== Private Methods =====

    _showCurrentLine() {
        const line = this._queue[this._currentIndex];
        if (!line) return;

        const character = this._config.characters[line.speaker];

        this._eventBus.emit(GameEvents.DIALOGUE_ADVANCED, {
            line,
            character,
            index: this._currentIndex,
            total: this._queue.length,
            type: this._dialogueType
        });

        if (character) {
            this._eventBus.emit(GameEvents.CHARACTER_SPEAKING, {
                characterId: line.speaker,
                character
            });
        }

        this._startTyping(line.text);
    }

    _startTyping(text) {
        this._isTyping = true;
        this._currentText = text;
        this._charIndex = 0;

        this._stopTyping(); // Clear any existing interval

        this._typingInterval = setInterval(() => {
            if (this._charIndex < this._currentText.length) {
                this._charIndex++;

                this._eventBus.emit('dialogue:typing', {
                    text: this._currentText.substring(0, this._charIndex),
                    fullText: this._currentText,
                    isComplete: false
                });
            } else {
                this._completeTyping();
            }
        }, this._config.typingSpeed);
    }

    _completeTyping() {
        this._stopTyping();
        this._isTyping = false;

        this._eventBus.emit('dialogue:typing', {
            text: this._currentText,
            fullText: this._currentText,
            isComplete: true
        });
    }

    _stopTyping() {
        if (this._typingInterval) {
            clearInterval(this._typingInterval);
            this._typingInterval = null;
        }
    }

    _complete() {
        this._stopTyping();

        const callback = this._onComplete;
        this._onComplete = null;

        this._eventBus.emit(GameEvents.DIALOGUE_COMPLETED, {
            type: this._dialogueType
        });

        // Reset state
        this._queue = [];
        this._currentIndex = 0;
        this._dialogueType = 'default';

        // Execute callback after emitting event
        if (callback) {
            callback();
        }
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this._stopTyping();
        this._queue = [];
        this._onComplete = null;
    }
}

// Character definitions (can be extended)
const DEFAULT_CHARACTERS = {
    fuji: { name: 'フジ', position: 'left' },
    owner: { name: '老店主', position: 'right' },
    mina: { name: 'ミナ', position: 'center' },
    narrator: { name: 'ナレーター', position: 'center' }
};

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DialogueSystem, DEFAULT_CHARACTERS };
}
