/**
 * DialogueUIRenderer - Renders VN dialogue to DOM
 *
 * SOLID Principles:
 * - Single Responsibility: Only renders dialogue box and text (NOT characters)
 * - Interface Segregation: Separate from game UI and character display
 * - Dependency Inversion: Listens to EventBus, doesn't depend on DialogueSystem directly
 *
 * Note: Character display is handled by CharacterDisplay class
 */
class DialogueUIRenderer {
    /**
     * @param {EventBus} eventBus - Event bus for communication
     * @param {Object} elements - DOM element selectors
     */
    constructor(eventBus, elements = {}) {
        this._eventBus = eventBus;
        this._elements = {
            overlay: elements.overlay || 'vn-overlay',
            speakerName: elements.speakerName || 'vn-speaker',
            dialogueText: elements.dialogueText || 'vn-text',
            sceneTitle: elements.sceneTitle || 'vn-scene-title',
            choiceOverlay: elements.choiceOverlay || 'choice-overlay',
            minaTipModal: elements.minaTipModal || 'mina-tip-modal',
            minaTipText: elements.minaTipText || 'mina-tip-text',
            bgCurrent: elements.bgCurrent || 'vn-bg-current',
            bgNext: elements.bgNext || 'vn-bg-next'
        };

        this._currentScene = null;
        this._currentBackground = null;
        this._isTransitioning = false;
        this._setupEventListeners();
    }

    _setupEventListeners() {
        // Dialogue events
        this._eventBus.on(GameEvents.DIALOGUE_STARTED, this._onDialogueStarted.bind(this));
        this._eventBus.on(GameEvents.DIALOGUE_ADVANCED, this._onDialogueAdvanced.bind(this));
        this._eventBus.on(GameEvents.DIALOGUE_COMPLETED, this._onDialogueCompleted.bind(this));
        this._eventBus.on('dialogue:typing', this._onTyping.bind(this));

        // Scene events
        this._eventBus.on(GameEvents.SCENE_CHANGED, this._onSceneChanged.bind(this));
        this._eventBus.on(GameEvents.SCENE_BACKGROUND_CHANGED, this._onBackgroundChanged.bind(this));

        // Choice events
        this._eventBus.on(GameEvents.CHOICE_PRESENTED, this._onChoicePresented.bind(this));
        this._eventBus.on(GameEvents.CHOICE_SELECTED, this._onChoiceSelected.bind(this));

        // Mina tip events
        this._eventBus.on(GameEvents.MINA_TIP_SHOWN, this._onMinaTipShown.bind(this));
    }

    // ===== DOM Helpers =====

    _getElement(key) {
        const id = this._elements[key];
        return document.getElementById(id);
    }

    // ===== Event Handlers =====

    _onDialogueStarted(data) {
        const overlay = this._getElement('overlay');
        if (!overlay) return;

        overlay.classList.remove('hidden', 'vn-event-dialogue', 'vn-crisis-dialogue');

        // Add type-specific styling
        if (data.type === 'perfect') {
            overlay.classList.add('vn-event-dialogue');
        } else if (data.type === 'crisis') {
            overlay.classList.add('vn-crisis-dialogue');
        }
    }

    _onDialogueAdvanced(data) {
        const { line, character, type } = data;

        // Update speaker name (new structure with .name-text span)
        const speakerEl = this._getElement('speakerName');
        const dialogueBox = document.querySelector('.vn-dialogue-box');

        if (speakerEl && dialogueBox) {
            const nameTextEl = speakerEl.querySelector('.name-text');

            if (line.speaker === 'narrator') {
                dialogueBox.classList.add('narrator-mode');
                if (nameTextEl) nameTextEl.textContent = '';
            } else {
                dialogueBox.classList.remove('narrator-mode');
                const displayName = character ? character.name : line.speaker;
                if (nameTextEl) {
                    nameTextEl.textContent = displayName;
                } else {
                    speakerEl.textContent = displayName;
                }
            }
        }
    }

    _onDialogueCompleted(data) {
        // For event dialogues (perfect, crisis, hybrid), auto-hide the VN overlay
        // Intro dialogues are handled by their own callback system
        if (data.type === 'event' || data.type === 'perfect' || data.type === 'crisis' || data.type === 'hybrid') {
            this.hideOverlay();
        }
    }

    _onTyping(data) {
        const textEl = this._getElement('dialogueText');
        if (!textEl) return;

        if (data.isComplete) {
            textEl.innerHTML = data.text;
        } else {
            textEl.innerHTML = data.text + '<span class="typing-cursor">|</span>';
        }
    }

    _onSceneChanged(data) {
        const { title } = data;
        const titleEl = this._getElement('sceneTitle');
        if (titleEl) {
            titleEl.textContent = title || '';
        }
    }

    _onBackgroundChanged(data) {
        const { scene } = data;

        // Map scene names to background classes
        const sceneToBackground = {
            'road': 'bg-night-street',      // Opening: Fuji collapsed (食堂前夜.png)
            'rescue': 'bg-night-street',    // Rescue scene (食堂前夜.png)
            'restaurant': 'bg-diner',        // Inside diner (食堂.png)
            'kitchen': 'bg-diner',           // Kitchen scenes (食堂.png)
            'night': 'bg-night-street'       // Night scenes (食堂前夜.png)
        };

        const newBgClass = sceneToBackground[scene] || 'bg-diner';

        // Skip if same background
        if (this._currentBackground === newBgClass) return;

        this._crossfadeBackground(newBgClass);
    }

    /**
     * Crossfade to a new background with smooth transition
     * @param {string} newBgClass - New background class name
     */
    _crossfadeBackground(newBgClass) {
        if (this._isTransitioning) return;

        const bgCurrent = this._getElement('bgCurrent');
        const bgNext = this._getElement('bgNext');

        if (!bgCurrent || !bgNext) return;

        this._isTransitioning = true;

        // Set up the next background
        bgNext.className = 'vn-bg ' + newBgClass;

        // Trigger crossfade
        requestAnimationFrame(() => {
            bgNext.style.opacity = '1';
            bgCurrent.style.opacity = '0';
        });

        // After transition completes, swap the backgrounds
        setTimeout(() => {
            // Move new background to current
            bgCurrent.className = 'vn-bg ' + newBgClass;
            bgCurrent.style.opacity = '1';

            // Reset next background
            bgNext.className = 'vn-bg';
            bgNext.style.opacity = '0';

            this._currentBackground = newBgClass;
            this._isTransitioning = false;
        }, 800); // Match CSS transition duration
    }

    /**
     * Set initial background without transition
     * @param {string} bgClass - Background class name
     */
    setInitialBackground(bgClass) {
        const bgCurrent = this._getElement('bgCurrent');
        if (bgCurrent) {
            bgCurrent.className = 'vn-bg ' + bgClass;
            bgCurrent.style.opacity = '1';
            this._currentBackground = bgClass;
        }
    }

    _onChoicePresented(data) {
        // Hide VN overlay and show choice overlay
        const vnOverlay = this._getElement('overlay');
        const choiceOverlay = this._getElement('choiceOverlay');

        if (vnOverlay) vnOverlay.classList.add('hidden');
        if (choiceOverlay) {
            setTimeout(() => {
                choiceOverlay.classList.remove('hidden');
            }, 100);
        }
    }

    _onChoiceSelected(data) {
        const choiceOverlay = this._getElement('choiceOverlay');
        const vnOverlay = this._getElement('overlay');

        if (choiceOverlay) {
            choiceOverlay.classList.add('hidden');
        }
        // Re-show VN overlay for continuation
        if (vnOverlay) {
            vnOverlay.classList.remove('hidden');
        }
    }

    _onMinaTipShown(data) {
        const { message } = data;
        const modal = this._getElement('minaTipModal');
        const textEl = this._getElement('minaTipText');

        if (modal && textEl) {
            textEl.textContent = message;
            modal.classList.remove('hidden');
        }
    }

    // ===== Public Methods =====

    /**
     * Show VN overlay
     */
    showOverlay() {
        const overlay = this._getElement('overlay');
        if (overlay) overlay.classList.remove('hidden');
    }

    /**
     * Hide VN overlay
     */
    hideOverlay() {
        const overlay = this._getElement('overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    /**
     * Close Mina tip modal
     */
    closeMinaTip() {
        const modal = this._getElement('minaTipModal');
        if (modal) modal.classList.add('hidden');
    }

    /**
     * Setup click handler for dialogue advancement
     * @param {Function} advanceCallback - Function to call on click
     */
    setupClickHandler(advanceCallback) {
        // Use the dedicated click layer for reliable click handling
        const clickLayer = document.getElementById('vn-click-layer');
        const overlay = this._getElement('overlay');

        // Primary: Click layer (covers entire VN overlay)
        if (clickLayer) {
            clickLayer.addEventListener('click', (e) => {
                e.stopPropagation();
                advanceCallback();
            });
        }

        // Fallback: Also attach to overlay itself
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                // Don't advance on skip button click or if clicking on buttons
                if (e.target.classList.contains('vn-skip-btn')) return;
                if (e.target.classList.contains('vn-auto-btn')) return;
                if (e.target.classList.contains('vn-control-btn')) return;
                if (e.target.tagName === 'BUTTON') return;
                if (e.target.closest('.vn-control-buttons')) return;
                advanceCallback();
            });
        }

        // Also attach to dialogue box for extra safety
        const dialogueBox = document.querySelector('.vn-dialogue-box');
        if (dialogueBox) {
            dialogueBox.addEventListener('click', (e) => {
                e.stopPropagation();
                advanceCallback();
            });
        }
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DialogueUIRenderer };
}
