/**
 * GameState - Centralized state management for the Parametric Training Sim
 *
 * This class manages all game state following the Power Pro / Tokimeki Memorial
 * style of skill-based progression. It provides:
 * - Immutable state access via getState()
 * - Validated mutations via update() and adjust()
 * - Skill experience and leveling system
 * - Stamina management
 *
 * SOLID Principles:
 * - Single Responsibility: Only manages game state
 * - Open/Closed: State structure can be extended via inheritance
 * - Dependency Inversion: Uses EventBus for notifications (injected)
 *
 * @class GameState
 */
class GameState {
    /**
     * Create a new GameState instance
     * @param {EventBus} eventBus - Event bus for state change notifications
     */
    constructor(eventBus) {
        this._eventBus = eventBus;
        this._state = this._getInitialState();
    }

    /**
     * Generate the initial game state
     * Uses GameConfig for all balancing parameters
     * @private
     * @returns {Object} Initial state object
     */
    _getInitialState() {
        return {
            // Core game state
            day: 1,
            stagnation: GameConfig.stagnation.initial,
            growth: 0,  // Computed from skills for backward compatibility
            technicalDebt: 0,
            maxGrowth: GameConfig.growth.max,
            maxDays: GameConfig.episode1.maxDays,

            // ===== PARAMETRIC TRAINING SIM (Power Pro Style) =====
            /**
             * Skill Levels (0-20 each, displayed as letter grades)
             * @type {Object.<string, number>}
             */
            skills: {
                cutting: 0,    // 包丁さばき - Knife skills
                boiling: 0,    // 煮込み - Boiling/stewing
                frying: 0,     // 炒め - Stir-frying/sautéing
                plating: 0     // 盛り付け - Plating/presentation
            },

            /**
             * Experience points toward next skill level (0-99)
             * When exp reaches 100, level increases and exp resets
             * @type {Object.<string, number>}
             */
            experience: {
                cutting: 0,
                boiling: 0,
                frying: 0,
                plating: 0
            },

            /**
             * Stamina (体力) - Resource consumed by actions
             * Recovers partially overnight, fully via rest action
             * @type {number}
             */
            stamina: GameConfig.stamina.initial,
            maxStamina: GameConfig.stamina.max,

            /**
             * Chimera Stew requirements loaded from config
             * Used for Day 7 Judgment skill check
             * @type {Object.<string, number>}
             */
            chimeraStewRequirements: { ...GameConfig.episode1.chimeraStewRequirements },

            // Kitchen state
            oldManMood: 70,
            ingredientQuality: 50,
            currentIngredients: GameConfig.ingredients.initial,

            // Episode state
            currentEpisode: 1,
            specialCustomer: null,
            specialChallengeSuccess: 0,
            requirementChangeActive: false,

            // Episode 1 specific: 7-Day Sprint
            traditionScore: 50,
            hybridMomentTriggered: false,
            hasChefKnife: false,
            spiceCrisisActive: false,
            judgmentTriggered: false,

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
            playerChoice: null,

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

    // ===== STATE ACCESS (Immutable) =====

    /**
     * Get current state (immutable shallow copy)
     * @returns {Object} Current state snapshot
     */
    getState() {
        return { ...this._state };
    }

    /**
     * Get a specific state value
     * @param {string} key - State key
     * @returns {*} State value (may be mutable if object/array)
     */
    get(key) {
        return this._state[key];
    }

    // ===== STATE MUTATION (Validated) =====

    /**
     * Update state and emit change event
     * Performs shallow merge of updates into current state
     * @param {Object} updates - State updates to apply
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
     * Update a numeric state with clamping and validation
     * Ensures values stay within valid bounds
     *
     * @param {string} key - State key
     * @param {number} delta - Amount to change (positive or negative)
     * @param {number} [min=0] - Minimum allowed value
     * @param {number} [max=100] - Maximum allowed value
     * @returns {number} The new clamped value
     */
    adjust(key, delta, min = 0, max = 100) {
        const current = this._state[key];

        // Validation: ensure key exists and is numeric
        if (typeof current !== 'number') {
            console.error(`GameState.adjust: "${key}" is not a number (got ${typeof current})`);
            return current;
        }

        // Validation: ensure delta is numeric
        if (typeof delta !== 'number' || isNaN(delta)) {
            console.error(`GameState.adjust: delta must be a number (got ${delta})`);
            return current;
        }

        const newValue = Math.max(min, Math.min(max, current + delta));
        this.update({ [key]: newValue });
        return newValue;
    }

    // ===== ACTION TRACKING =====

    /**
     * Add action to history (keeps last 3 actions)
     * Used for Perfect Cycle detection
     * @param {number} actionId - Action ID (1, 2, or 3)
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
     * Check if perfect cycle achieved (all 3 different actions in last 3)
     * @returns {boolean} True if perfect cycle
     */
    isPerfectCycle() {
        const history = this._state.actionHistory;
        if (history.length < 3) return false;
        const lastThree = history.slice(-3);
        const uniqueActions = new Set(lastThree);
        return uniqueActions.size === 3;
    }

    /**
     * Get missing actions for perfect cycle hint
     * @returns {number[]} Array of action IDs not in last 2 actions
     */
    getMissingActions() {
        const lastTwo = this._state.actionHistory.slice(-2);
        const allActions = [1, 2, 3];
        return allActions.filter(a => !lastTwo.includes(a));
    }

    // ===== GAME STATE CHECKS =====

    /**
     * Check if game is over (episode-specific loss conditions)
     * @returns {boolean} True if game should end in defeat
     */
    isGameOver() {
        const state = this._state;

        // Universal loss conditions
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
     * Check if game is won (episode-specific victory conditions)
     * @returns {boolean} True if game should end in victory
     */
    isVictory() {
        const state = this._state;

        switch (state.currentEpisode) {
            case 1:
                // Episode 1: Victory determined by Day 7 Judgment scene
                // Prevents false victory popups during days 1-6
                return false;
            case 2:
                return state.ordersCompleted >= 10;
            case 3:
                return state.day >= 12 && state.ingredientQuality >= 30;
            case 4:
                return state.day >= 15 && state.growth > state.rivalGrowth;
            case 5:
                return state.growth >= 50 && state.princessSatisfaction >= 100;
            default:
                return false;
        }
    }

    /**
     * Check if tradition/innovation score is balanced
     * @returns {boolean} True if in balanced range (35-65)
     */
    isBalanced() {
        const score = this._state.traditionScore;
        return score >= 35 && score <= 65;
    }

    // ===== PARAMETRIC TRAINING SYSTEM =====

    /**
     * Add experience to a skill and handle level ups
     *
     * This is the core of the Power Pro-style progression system.
     * Experience accumulates until reaching the threshold (100 by default),
     * then converts to a level increase. Multiple level-ups can occur
     * from a single large exp gain.
     *
     * @param {string} skillName - Skill key: 'cutting', 'boiling', 'frying', or 'plating'
     * @param {number} expAmount - Amount of experience to add (must be positive)
     * @returns {Object} Result object with levelUp status and new values
     * @returns {boolean} result.levelUp - Whether at least one level was gained
     * @returns {number} result.levelsGained - Total levels gained
     * @returns {number} result.newLevel - Current skill level after update
     * @returns {number} result.newExp - Current exp after update (0-99)
     *
     * @example
     * const result = gameState.addSkillExp('cutting', 50);
     * if (result.levelUp) {
     *   console.log(`Level up! Now Lv.${result.newLevel}`);
     * }
     */
    addSkillExp(skillName, expAmount) {
        // Validate skill name
        const skills = { ...this._state.skills };
        const experience = { ...this._state.experience };

        if (!(skillName in experience)) {
            console.error(`GameState.addSkillExp: Unknown skill "${skillName}"`);
            return { levelUp: false, levelsGained: 0, newLevel: 0, newExp: 0 };
        }

        // Validate exp amount
        if (typeof expAmount !== 'number' || expAmount < 0) {
            console.error(`GameState.addSkillExp: expAmount must be a positive number`);
            return {
                levelUp: false,
                levelsGained: 0,
                newLevel: skills[skillName],
                newExp: experience[skillName]
            };
        }

        const maxLevel = GameConfig.skills.maxLevel;
        const expPerLevel = GameConfig.skills.expPerLevel;

        experience[skillName] += expAmount;
        let levelUp = false;
        let levelsGained = 0;

        // Process level-ups (can gain multiple levels from large exp gains)
        while (experience[skillName] >= expPerLevel && skills[skillName] < maxLevel) {
            experience[skillName] -= expPerLevel;
            skills[skillName]++;
            levelUp = true;
            levelsGained++;
        }

        // Cap experience at expPerLevel - 1 if max level reached
        if (skills[skillName] >= maxLevel) {
            experience[skillName] = Math.min(experience[skillName], expPerLevel - 1);
        }

        // Update state
        this.update({ skills, experience });

        // Recalculate growth from skills (for backward compatibility)
        this._recalculateGrowth();

        return {
            levelUp,
            levelsGained,
            newLevel: skills[skillName],
            newExp: experience[skillName]
        };
    }

    /**
     * Recalculate growth based on total skill levels
     *
     * Growth serves as a legacy compatibility value and simplified
     * progress indicator. It's derived from the sum of all skill levels.
     *
     * Formula: growth = floor(totalSkills * scaleFactor)
     * Where scaleFactor = 50/26 ≈ 1.92
     *
     * This means ~26 total skill levels = growth of 50 (Episode 1 target)
     *
     * @private
     */
    _recalculateGrowth() {
        const skills = this._state.skills;
        const totalSkills = skills.cutting + skills.boiling + skills.frying + skills.plating;
        const growth = Math.floor(totalSkills * GameConfig.growth.scaleFactor);
        this.update({ growth: Math.min(growth, this._state.maxGrowth) });
    }

    /**
     * Consume stamina for an action
     *
     * @param {number} amount - Stamina cost (must be positive)
     * @returns {boolean} True if action can be performed (had enough stamina)
     *
     * @example
     * if (gameState.consumeStamina(25)) {
     *   // Execute action
     * } else {
     *   // Show "not enough stamina" message
     * }
     */
    consumeStamina(amount) {
        // Validate amount
        if (typeof amount !== 'number' || amount < 0) {
            console.error(`GameState.consumeStamina: amount must be a positive number`);
            return false;
        }

        if (this._state.stamina < amount) {
            return false; // Not enough stamina
        }

        this.adjust('stamina', -amount, 0, this._state.maxStamina);
        return true;
    }

    /**
     * Recover stamina (at night or from rest action)
     *
     * @param {number} [amount] - Amount to recover (default from config)
     */
    recoverStamina(amount = GameConfig.stamina.overnightRecovery) {
        // Validate amount
        if (typeof amount !== 'number' || amount < 0) {
            console.error(`GameState.recoverStamina: amount must be a positive number`);
            return;
        }

        this.adjust('stamina', amount, 0, this._state.maxStamina);
    }

    /**
     * Check if Chimera Stew skill requirements are met
     *
     * This is used for the Day 7 Judgment scene to determine
     * if Fuji has trained enough to create the signature dish.
     *
     * @returns {Object} Result object with pass/fail and detailed breakdown
     * @returns {boolean} result.passed - True if all requirements met
     * @returns {Object} result.details - Per-skill breakdown
     *
     * @example
     * const check = gameState.checkChimeraStewRequirements();
     * if (check.passed) {
     *   // Show success dialogue
     * } else {
     *   // Show which skills were lacking
     *   Object.entries(check.details).forEach(([skill, data]) => {
     *     if (!data.passed) console.log(`${skill}: ${data.current}/${data.required}`);
     *   });
     * }
     */
    checkChimeraStewRequirements() {
        const skills = this._state.skills;
        const reqs = this._state.chimeraStewRequirements;

        const results = {
            cutting: {
                current: skills.cutting,
                required: reqs.cutting,
                passed: skills.cutting >= reqs.cutting
            },
            boiling: {
                current: skills.boiling,
                required: reqs.boiling,
                passed: skills.boiling >= reqs.boiling
            },
            frying: {
                current: skills.frying,
                required: reqs.frying,
                passed: skills.frying >= reqs.frying
            },
            plating: {
                current: skills.plating,
                required: reqs.plating,
                passed: skills.plating >= reqs.plating
            }
        };

        const allPassed = results.cutting.passed && results.boiling.passed &&
                          results.frying.passed && results.plating.passed;

        return { passed: allPassed, details: results };
    }

    /**
     * Get skill letter grade from level
     *
     * Power Pro style grading:
     * - S: Exceptional (18-20)
     * - A: Excellent (15-17)
     * - B: Very Good (12-14)
     * - C: Good (9-11)
     * - D: Average (6-8)
     * - E: Below Average (3-5)
     * - F: Poor (1-2)
     * - G: Untrained (0)
     *
     * @param {number} level - Skill level (0-20)
     * @returns {string} Letter grade (G, F, E, D, C, B, A, or S)
     */
    getSkillGrade(level) {
        const grades = GameConfig.skills.grades;
        if (level >= grades.S) return 'S';
        if (level >= grades.A) return 'A';
        if (level >= grades.B) return 'B';
        if (level >= grades.C) return 'C';
        if (level >= grades.D) return 'D';
        if (level >= grades.E) return 'E';
        if (level >= grades.F) return 'F';
        return 'G';
    }

    // ===== GAME LIFECYCLE =====

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
     * Advance to a new episode
     * Resets most values while preserving some progression
     *
     * @param {number} episodeNumber - Episode to start (1-5)
     */
    startEpisode(episodeNumber) {
        // Base episode reset
        const updates = {
            currentEpisode: episodeNumber,
            day: 1,
            specialChallengeSuccess: 0,
            traditionScore: 50,
            hybridMomentTriggered: false,
            stagnation: GameConfig.stagnation.initial,
            growth: 0,
            technicalDebt: 0,
            oldManMood: 70,
            ingredientQuality: 50,
            currentIngredients: GameConfig.ingredients.initial,
            stamina: GameConfig.stamina.initial,
            // Reset skills for new episode (could be made persistent in future)
            skills: { cutting: 0, boiling: 0, frying: 0, plating: 0 },
            experience: { cutting: 0, boiling: 0, frying: 0, plating: 0 }
        };

        // Episode-specific initialization
        switch (episodeNumber) {
            case 1:
                updates.maxDays = GameConfig.episode1.maxDays;
                updates.spiceCrisisActive = false;
                updates.judgmentTriggered = false;
                break;
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
