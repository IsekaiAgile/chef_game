/**
 * Main Application Entry Point
 *
 * This file initializes and wires together all game modules.
 * Following Dependency Inversion Principle: High-level modules
 * depend on abstractions (EventBus), not on low-level modules.
 */

/**
 * @class GameApp
 * Main application container that manages all game systems
 */
class GameApp {
    constructor() {
        // Core systems (initialized in order of dependency)
        this._eventBus = null;
        this._gameState = null;
        this._dialogueSystem = null;
        this._kitchenEngine = null;
        this._episodeManager = null;
        this._ceremonyManager = null;

        // UI Renderers
        this._characterDisplay = null;
        this._gameUIRenderer = null;
        this._dialogueUIRenderer = null;
        this._ceremonyUIRenderer = null;

        // State flags
        this._isInitialized = false;
        this._autoMode = false;
        this._autoInterval = null;
    }

    /**
     * Initialize all game systems
     */
    init() {
        if (this._isInitialized) {
            console.warn('GameApp: Already initialized');
            return;
        }

        // 1. Create EventBus (foundation for all communication)
        this._eventBus = new EventBus();

        // 2. Create GameState (depends on EventBus)
        this._gameState = new GameState(this._eventBus);

        // 3. Create DialogueSystem (depends on EventBus)
        this._dialogueSystem = new DialogueSystem(this._eventBus, {
            typingSpeed: 30,
            characters: DEFAULT_CHARACTERS
        });

        // 4. Create game engine (depends on EventBus, GameState)
        this._kitchenEngine = new KitchenEngine(this._eventBus, this._gameState);

        // 5. Create EpisodeManager (depends on EventBus, DialogueSystem, GameState)
        this._episodeManager = new EpisodeManager(
            this._eventBus,
            this._dialogueSystem,
            this._gameState
        );

        // 5b. Wire EpisodeManager to KitchenEngine for episode modifiers
        this._kitchenEngine.setEpisodeManager(this._episodeManager);

        // 5c. Create CeremonyManager (depends on EventBus, GameState)
        this._ceremonyManager = new CeremonyManager(this._eventBus, this._gameState);

        // 6. Create UI Renderers (depend on EventBus)
        // CharacterDisplay handles sprite showing/hiding/dimming (SRP)
        this._characterDisplay = new CharacterDisplay(this._eventBus);

        this._gameUIRenderer = new GameUIRenderer(this._eventBus, {
            maxGrowth: this._gameState.get('maxGrowth')
        });

        // DialogueUIRenderer only handles dialogue box (SRP)
        this._dialogueUIRenderer = new DialogueUIRenderer(this._eventBus);

        // CeremonyUIRenderer handles ceremony overlays
        this._ceremonyUIRenderer = new CeremonyUIRenderer(this._eventBus);

        // 7. Setup global event handlers
        this._setupGlobalEvents();

        // 8. Setup DOM event listeners
        this._setupDOMListeners();

        this._isInitialized = true;
        console.log('GameApp: Initialized successfully');
    }

    /**
     * Setup global event handlers
     */
    _setupGlobalEvents() {
        // VN dialogue started - hide game HUD for immersion
        this._eventBus.on(GameEvents.DIALOGUE_STARTED, () => {
            document.body.classList.add('vn-active');
        });

        // Perfect cycle - play celebration effect
        this._eventBus.on(GameEvents.PERFECT_CYCLE, () => {
            if (typeof gameEffects !== 'undefined') {
                gameEffects.playPerfectCycle();
            }
        });

        // Mina cheer on perfect cycle
        this._eventBus.on('mina:cheer_perfect_cycle', (data) => {
            this._dialogueUIRenderer.showMinaTip(data.message);
        });

        // Intro completion - start first day with Morning Stand-up
        this._eventBus.on(GameEvents.INTRO_COMPLETED, () => {
            document.body.classList.remove('vn-active');
            this._dialogueUIRenderer.hideOverlay();
            this._characterDisplay.hideAllCharacters();
            this._gameUIRenderer.showGameUI();
            this._gameUIRenderer.update(this._gameState.getState());

            // Start the ceremony system with Day 1 Morning Stand-up
            setTimeout(() => {
                this._ceremonyManager.startNewDay();
            }, 500);
        });

        // Action phase start - show action buttons
        this._eventBus.on('ceremony:action_phase_start', () => {
            const commandMenu = document.querySelector('.pawa-command-menu');
            if (commandMenu) commandMenu.style.display = '';
        });

        // Dialogue completion during gameplay - restore HUD
        this._eventBus.on(GameEvents.DIALOGUE_COMPLETED, (data) => {
            if (data.type !== 'intro') {
                document.body.classList.remove('vn-active');
            }
        });

        // Game over handling
        this._eventBus.on(GameEvents.GAME_OVER, (data) => {
            console.log('Game Over:', data.state);
        });

        // Victory handling
        this._eventBus.on(GameEvents.GAME_VICTORY, (data) => {
            console.log('Victory:', data.state);
        });
    }

    /**
     * Setup DOM event listeners
     */
    _setupDOMListeners() {
        // Action buttons
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const actionId = parseInt(e.currentTarget.dataset.action, 10);
                this.executeAction(actionId);
            });
        });

        // Choice buttons
        const choiceA = document.getElementById('choice-a');
        const choiceB = document.getElementById('choice-b');

        if (choiceA) {
            choiceA.addEventListener('click', () => this.selectChoice('obedient'));
        }
        if (choiceB) {
            choiceB.addEventListener('click', () => this.selectChoice('agile'));
        }

        // Mina tip button
        const minaTipBtn = document.getElementById('mina-tip-btn');
        if (minaTipBtn) {
            minaTipBtn.addEventListener('click', () => this._episodeManager.showMinaTip());
        }

        // Mina tip close button
        const minaTipClose = document.getElementById('mina-tip-close');
        if (minaTipClose) {
            minaTipClose.addEventListener('click', () => this._dialogueUIRenderer.closeMinaTip());
        }

        // VN overlay click (advance dialogue)
        this._dialogueUIRenderer.setupClickHandler(() => {
            this._dialogueSystem.advance();
        });

        // Skip button
        const skipBtn = document.querySelector('.vn-skip-btn');
        if (skipBtn) {
            skipBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._dialogueSystem.skip();
            });
        }

        // Auto button
        const autoBtn = document.getElementById('vn-auto-btn');
        if (autoBtn) {
            autoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleAutoMode(autoBtn);
            });
        }

        // Restart buttons
        document.querySelectorAll('[data-restart]').forEach(btn => {
            btn.addEventListener('click', () => this.restart());
        });

        // Continue to Episode 2 button
        const continueBtn = document.getElementById('continue-ep2');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => this.startEpisode(2));
        }

        // ===== CEREMONY SYSTEM BUTTONS =====

        // Daily Focus selection buttons (Morning Stand-up)
        document.querySelectorAll('[data-focus]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const focusId = e.currentTarget.dataset.focus;
                this._ceremonyManager.selectDailyFocus(focusId);
            });
        });

        // Pivot decision buttons (Night Retrospective)
        const pivotYes = document.getElementById('pivot-yes');
        const pivotNo = document.getElementById('pivot-no');

        if (pivotYes) {
            pivotYes.addEventListener('click', () => {
                this._ceremonyManager.handlePivotChoice(true);
            });
        }
        if (pivotNo) {
            pivotNo.addEventListener('click', () => {
                this._ceremonyManager.handlePivotChoice(false);
            });
        }

        // Retrospective continue button
        const retroContinue = document.getElementById('retro-continue');
        if (retroContinue) {
            retroContinue.addEventListener('click', () => {
                this._ceremonyUIRenderer.hideNightRetro();
                // Start next day's morning stand-up
                setTimeout(() => {
                    this._ceremonyManager.proceedToNextDay();
                }, 300);
            });
        }

        // ===== EPISODE 1: 7-DAY SPRINT BUTTONS =====

        // Spice Crisis continue button
        const crisisContinue = document.getElementById('crisis-continue');
        if (crisisContinue) {
            crisisContinue.addEventListener('click', () => {
                this._ceremonyUIRenderer.hideSpiceCrisis();
                // Continue to morning standup after crisis acknowledged
                setTimeout(() => {
                    this._ceremonyManager.startNewDay();
                }, 300);
            });
        }

        // Judgment continue button (handles both success and failure)
        const judgmentContinue = document.getElementById('judgment-continue');
        if (judgmentContinue) {
            judgmentContinue.addEventListener('click', () => {
                const action = judgmentContinue.dataset.action;
                this._ceremonyUIRenderer.hideJudgment();

                if (action === 'next-episode') {
                    // Success: Advance to Episode 2
                    this.startEpisode(2);
                } else {
                    // Failure: Restart Episode 1
                    this.restart();
                }
            });
        }
    }

    /**
     * Start the game
     */
    start() {
        if (!this._isInitialized) {
            this.init();
        }

        // Hide game UI initially
        this._gameUIRenderer.hideGameUI();

        // Hide all characters initially
        this._characterDisplay.hideAllCharacters();

        // Set initial background (night street for opening scene)
        this._dialogueUIRenderer.setInitialBackground('bg-night-street');

        // Add VN active state
        document.body.classList.add('vn-active');

        // Play episode 1 intro
        this._episodeManager.playEpisodeIntro(1, () => {
            // Intro complete, game UI will be shown via event
            this._eventBus.emit(GameEvents.UI_UPDATE_REQUESTED, {
                state: this._gameState.getState()
            });
        });
    }

    /**
     * Toggle auto-advance mode for dialogue
     * @param {HTMLElement} btn - Auto button element
     */
    _toggleAutoMode(btn) {
        this._autoMode = !this._autoMode;

        if (btn) {
            btn.classList.toggle('active', this._autoMode);
        }

        if (this._autoMode) {
            this._startAutoAdvance();
        } else {
            this._stopAutoAdvance();
        }
    }

    _startAutoAdvance() {
        if (this._autoInterval) return;

        this._autoInterval = setInterval(() => {
            if (this._dialogueSystem.isActive() && !this._dialogueSystem.isTyping()) {
                this._dialogueSystem.advance();
            }
        }, 2500); // Auto-advance every 2.5 seconds
    }

    _stopAutoAdvance() {
        if (this._autoInterval) {
            clearInterval(this._autoInterval);
            this._autoInterval = null;
        }
    }

    /**
     * Execute a game action
     * @param {number} actionId - Action ID (1, 2, or 3)
     */
    executeAction(actionId) {
        // Don't execute during dialogue
        if (this._dialogueSystem.isActive()) {
            return;
        }

        this._kitchenEngine.executeAction(actionId);
    }

    /**
     * Handle player choice selection
     * @param {string} choiceId - 'obedient' or 'agile'
     */
    selectChoice(choiceId) {
        this._episodeManager.handleChoice(choiceId);
    }

    /**
     * Start a specific episode
     * @param {number} episodeId - Episode ID
     */
    startEpisode(episodeId) {
        this._gameState.startEpisode(episodeId);

        // Hide episode clear modal if visible
        const clearEl = document.getElementById('episode1-clear');
        if (clearEl) clearEl.classList.add('hidden');

        this._gameUIRenderer.update(this._gameState.getState());
    }

    /**
     * Restart the game
     */
    restart() {
        // Reset state
        this._gameState.reset();

        // Stop auto mode
        this._stopAutoAdvance();
        this._autoMode = false;
        const autoBtn = document.getElementById('vn-auto-btn');
        if (autoBtn) autoBtn.classList.remove('active');

        // Hide end screens
        const gameover = document.getElementById('gameover');
        const ending = document.getElementById('ending');
        const ep1Clear = document.getElementById('episode1-clear');

        if (gameover) gameover.classList.add('hidden');
        if (ending) ending.classList.add('hidden');
        if (ep1Clear) ep1Clear.classList.add('hidden');

        // Show actions
        const actions = document.getElementById('actions');
        if (actions) actions.style.display = '';

        // Reset VN state
        document.body.classList.remove('vn-active');

        // Restart from intro
        this.start();
    }

    // ===== Getters for external access =====

    get eventBus() {
        return this._eventBus;
    }

    get gameState() {
        return this._gameState;
    }

    get dialogueSystem() {
        return this._dialogueSystem;
    }

    get kitchenEngine() {
        return this._kitchenEngine;
    }

    get episodeManager() {
        return this._episodeManager;
    }

    get characterDisplay() {
        return this._characterDisplay;
    }
}

// ===== Global instance and initialization =====

let gameApp = null;

/**
 * Initialize and start the game when DOM is ready
 */
function initGame() {
    gameApp = new GameApp();
    gameApp.start();
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}

// Export for ES6 modules and testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameApp, initGame };
}
