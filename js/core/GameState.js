/**
 * GameState - Centralized state management
 *
 * SOLID Principles:
 * - Single Responsibility: Only manages game state
 * - Open/Closed: State structure can be extended via inheritance
 * - Dependency Inversion: Uses EventBus for notifications (injected)
 */
class GameState {
    constructor(eventBus) {
        this._eventBus = eventBus;
        this._state = this._getInitialState();
    }

    _getInitialState() {
        return {
            // Core game state
            day: 1,
            stagnation: 50,
            growth: 0,
            technicalDebt: 0,
            maxGrowth: 50,

            // Kitchen state
            oldManMood: 70,
            ingredientQuality: 50,
            currentIngredients: 3,

            // Episode state
            currentEpisode: 1,
            specialCustomer: null,
            specialChallengeSuccess: 0,
            requirementChangeActive: false,

            // Episode 1 specific
            traditionScore: 50,
            hybridMomentTriggered: false,
            hasChefKnife: false,

            // Story state
            introComplete: false,
            playerChoice: null, // 'obedient' or 'agile'

            // Action tracking
            lastAction: 0,
            actionHistory: [],
            perfectCycleCount: 0
        };
    }

    /**
     * Get current state (immutable copy)
     * @returns {Object} Current state
     */
    getState() {
        return { ...this._state };
    }

    /**
     * Get a specific state value
     * @param {string} key - State key
     * @returns {*} State value
     */
    get(key) {
        return this._state[key];
    }

    /**
     * Update state and emit change event
     * @param {Object} updates - State updates
     */
    update(updates) {
        const oldState = { ...this._state };
        this._state = { ...this._state, ...updates };

        this._eventBus.emit(GameEvents.GAME_STATE_CHANGED, {
            oldState,
            newState: this.getState(),
            changes: updates
        });
    }

    /**
     * Update a numeric state with clamping
     * @param {string} key - State key
     * @param {number} delta - Amount to change
     * @param {number} [min=0] - Minimum value
     * @param {number} [max=100] - Maximum value
     */
    adjust(key, delta, min = 0, max = 100) {
        const current = this._state[key];
        if (typeof current !== 'number') {
            console.error(`GameState.adjust: "${key}" is not a number`);
            return;
        }
        const newValue = Math.max(min, Math.min(max, current + delta));
        this.update({ [key]: newValue });
    }

    /**
     * Add action to history
     * @param {number} actionId - Action ID
     */
    recordAction(actionId) {
        const history = [...this._state.actionHistory, actionId];
        if (history.length > 3) {
            history.shift();
        }
        this.update({
            actionHistory: history,
            lastAction: actionId
        });
    }

    /**
     * Check if perfect cycle achieved
     * @returns {boolean}
     */
    isPerfectCycle() {
        const history = this._state.actionHistory;
        if (history.length < 3) return false;
        const lastThree = history.slice(-3);
        const uniqueActions = new Set(lastThree);
        return uniqueActions.size === 3;
    }

    /**
     * Get missing actions for perfect cycle
     * @returns {number[]} Missing action IDs
     */
    getMissingActions() {
        const lastTwo = this._state.actionHistory.slice(-2);
        const allActions = [1, 2, 3];
        return allActions.filter(a => !lastTwo.includes(a));
    }

    /**
     * Check if game is over
     * @returns {boolean}
     */
    isGameOver() {
        return (
            this._state.stagnation >= 90 ||
            this._state.ingredientQuality <= 0 ||
            this._state.oldManMood <= 0
        );
    }

    /**
     * Check if game is won
     * @returns {boolean}
     */
    isVictory() {
        const { currentEpisode, growth, maxGrowth, oldManMood } = this._state;
        return currentEpisode === 3 && growth >= maxGrowth && oldManMood >= 80;
    }

    /**
     * Check if tradition/innovation is balanced
     * @returns {boolean}
     */
    isBalanced() {
        const score = this._state.traditionScore;
        return score >= 35 && score <= 65;
    }

    /**
     * Reset game to initial state
     */
    reset() {
        this._state = this._getInitialState();
        this._eventBus.emit(GameEvents.GAME_STATE_CHANGED, {
            oldState: null,
            newState: this.getState(),
            changes: this._state
        });
    }

    /**
     * Advance to next episode
     * @param {number} episodeNumber - Episode number
     */
    startEpisode(episodeNumber) {
        this.update({
            currentEpisode: episodeNumber,
            specialChallengeSuccess: 0,
            traditionScore: 50,
            hybridMomentTriggered: false
        });

        this._eventBus.emit(GameEvents.EPISODE_STARTED, {
            episode: episodeNumber
        });
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameState };
}
