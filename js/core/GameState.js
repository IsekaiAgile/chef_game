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
            maxDays: 7,  // Episode 1: 7-day sprint

            // Kitchen state
            oldManMood: 70,
            ingredientQuality: 50,
            currentIngredients: 3,

            // Episode state
            currentEpisode: 1,
            specialCustomer: null,
            specialChallengeSuccess: 0,
            requirementChangeActive: false,

            // Episode 1 specific: 7-Day Sprint
            traditionScore: 50,
            hybridMomentTriggered: false,
            hasChefKnife: false,
            spiceCrisisActive: false,  // Day 3-4 crisis event
            judgmentTriggered: false,  // Day 7 final evaluation

            // Episode 2 specific (Goblin - orders)
            ordersCompleted: 0,

            // Episode 4 specific (Rival battle)
            rivalGrowth: 0,
            rivalName: 'スリモン',

            // Episode 5 specific (Elf Princess)
            princessSatisfaction: 0,
            princessAnger: 0,
            currentDemand: null,

            // Story state
            introComplete: false,
            playerChoice: null, // 'obedient' or 'agile'

            // Action tracking
            lastAction: 0,
            actionHistory: [],
            perfectCycleCount: 0,

            // Ceremony system
            dailyFocus: null,
            dailyFocusEffect: null,
            pivotBonus: false
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
     * Check if game is over (episode-specific)
     * @returns {boolean}
     */
    isGameOver() {
        const state = this._state;

        // Universal conditions
        if (state.stagnation >= 100) return true;
        if (state.oldManMood <= 0) return true;

        // Episode-specific loss conditions
        switch (state.currentEpisode) {
            case 2: // Goblin - Ingredients = 0 is instant game over
                if (state.currentIngredients <= 0) return true;
                break;
            case 3: // Dragonoid - Quality = 0 is instant game over
                if (state.ingredientQuality <= 0) return true;
                break;
            case 4: // Rival battle - Rival 15+ ahead = loss
                if ((state.rivalGrowth - state.growth) >= 15) return true;
                break;
            case 5: // Elf Princess - Princess anger = 100 is game over
                if (state.princessAnger >= 100) return true;
                break;
            default: // Episode 1 - Standard quality check
                if (state.ingredientQuality <= 0) return true;
        }

        return false;
    }

    /**
     * Check if game is won (episode-specific)
     * @returns {boolean}
     */
    isVictory() {
        const state = this._state;

        switch (state.currentEpisode) {
            case 1:
                // Episode 1: 7-Day Sprint - Victory is ONLY determined by Day 7 Judgment
                // The Judgment scene in CeremonyManager handles success/failure
                // This prevents false "Victory" popups during days 1-6
                return false;
            case 2: // Complete 10 orders
                return state.ordersCompleted >= 10;
            case 3: // Survive 12 days with quality >= 30
                return state.day >= 12 && state.ingredientQuality >= 30;
            case 4: // After 15 turns, be ahead of rival
                return state.day >= 15 && state.growth > state.rivalGrowth;
            case 5: // Final victory - Growth 50+ and princess satisfied
                return state.growth >= 50 && state.princessSatisfaction >= 100;
            default:
                return false;
        }
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
        // Base episode reset
        const updates = {
            currentEpisode: episodeNumber,
            day: 1,
            specialChallengeSuccess: 0,
            traditionScore: 50,
            hybridMomentTriggered: false,
            stagnation: 50,
            growth: 0,
            technicalDebt: 0,
            oldManMood: 70,
            ingredientQuality: 50,
            currentIngredients: 3
        };

        // Episode-specific initialization
        switch (episodeNumber) {
            case 2: // Goblin - more starting ingredients
                updates.currentIngredients = 5;
                updates.ordersCompleted = 0;
                break;
            case 3: // Dragonoid - higher starting quality
                updates.ingredientQuality = 70;
                break;
            case 4: // Rival battle - reset rival score
                updates.rivalGrowth = 0;
                break;
            case 5: // Elf Princess - reset satisfaction/anger
                updates.princessSatisfaction = 0;
                updates.princessAnger = 0;
                updates.currentDemand = null;
                break;
        }

        this.update(updates);

        this._eventBus.emit(GameEvents.EPISODE_STARTED, {
            episode: episodeNumber
        });
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameState };
}
