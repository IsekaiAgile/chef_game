/**
 * GameState - Centralized state management for the Success Mode Sim
 *
 * SUCCESS MODE STYLE (パワプロ風サクセスモード)
 * This class manages all game state following the Power Pro Success Mode
 * style of skill-based progression with:
 * - Day/Night phase system (2 slots per day)
 * - Condition (調子) system affecting performance
 * - Special Dish Progress as main victory metric
 * - Strategic training vs rest decisions
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
            maxDays: GameConfig.episode1.maxDays,

            // ===== PHASE SYSTEM =====
            /**
             * Current phase: 'day' or 'night'
             * Day has 3 actions, Night has 1 action
             */
            currentPhase: 'day',
            dayActionsRemaining: GameConfig.phases.DAY.actionsAllowed,
            nightActionsRemaining: GameConfig.phases.NIGHT.actionsAllowed,

            // ===== CONDITION SYSTEM (調子) =====
            /**
             * Player condition affecting exp gains and success rates
             * Values: 'superb', 'good', 'normal', 'bad', 'terrible'
             */
            condition: GameConfig.condition.initial,

            // ===== SKILL SYSTEM =====
            skills: {
                cutting: 0,    // 包丁さばき - Knife skills
                boiling: 0,    // 煮込み - Boiling/stewing
                frying: 0,     // 炒め - Stir-frying/sautéing
                analysis: 0    // 食材分析 - Ingredient analysis
            },
            experience: {
                cutting: 0,
                boiling: 0,
                frying: 0,
                analysis: 0
            },

            // ===== SPECIAL DISH PROGRESS =====
            /**
             * Progress toward completing the signature dish (0-100)
             * This is the main victory metric for Episode 1
             */
            dishProgress: GameConfig.dishProgress.initial,

            // ===== STAMINA SYSTEM =====
            stamina: GameConfig.stamina.initial,
            maxStamina: GameConfig.stamina.max,

            // ===== TECH DEBT =====
            technicalDebt: GameConfig.techDebt.initial,

            // ===== LEGACY/KITCHEN STATE =====
            growth: 0,
            maxGrowth: GameConfig.growth.max,
            oldManMood: 70,
            ingredientQuality: 50,
            currentIngredients: 3,
            stagnation: 30,

            // ===== EPISODE STATE =====
            currentEpisode: 1,
            chimeraStewRequirements: { ...GameConfig.episode1.chimeraStewRequirements },

            // Episode 1 specific
            spiceCrisisActive: false,
            judgmentTriggered: false,

            // Story state
            introComplete: false,

            // Action tracking
            lastAction: null,
            actionHistory: [],
            todayActions: []
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
     * @returns {*} State value
     */
    get(key) {
        return this._state[key];
    }

    // ===== STATE MUTATION (Validated) =====

    /**
     * Update state and emit change event
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
     * @param {string} key - State key
     * @param {number} delta - Amount to change
     * @param {number} [min=0] - Minimum allowed value
     * @param {number} [max=100] - Maximum allowed value
     * @returns {number} The new clamped value
     */
    adjust(key, delta, min = 0, max = 100) {
        const current = this._state[key];
        if (typeof current !== 'number') {
            console.error(`GameState.adjust: "${key}" is not a number`);
            return current;
        }
        if (typeof delta !== 'number' || isNaN(delta)) {
            console.error(`GameState.adjust: delta must be a number`);
            return current;
        }
        const newValue = Math.max(min, Math.min(max, current + delta));
        this.update({ [key]: newValue });
        return newValue;
    }

    // ===== PHASE SYSTEM =====

    /**
     * Get current phase info from config
     * @returns {Object} Phase configuration object
     */
    getCurrentPhaseInfo() {
        const phaseId = this._state.currentPhase;
        return phaseId === 'day' ? GameConfig.phases.DAY : GameConfig.phases.NIGHT;
    }

    /**
     * Get remaining actions for current phase
     * @returns {number} Actions remaining
     */
    getActionsRemaining() {
        return this._state.currentPhase === 'day'
            ? this._state.dayActionsRemaining
            : this._state.nightActionsRemaining;
    }

    /**
     * Consume an action in the current phase
     * @returns {boolean} True if action was consumed, false if none remaining
     */
    consumeAction() {
        const phaseKey = this._state.currentPhase === 'day'
            ? 'dayActionsRemaining'
            : 'nightActionsRemaining';

        if (this._state[phaseKey] <= 0) {
            return false;
        }

        this.update({ [phaseKey]: this._state[phaseKey] - 1 });
        return true;
    }

    /**
     * Transition from day to night phase
     */
    transitionToNight() {
        this.update({
            currentPhase: 'night',
            nightActionsRemaining: GameConfig.phases.NIGHT.actionsAllowed
        });

        this._eventBus.emit('phase:changed', {
            from: 'day',
            to: 'night',
            day: this._state.day
        });
    }

    /**
     * Advance to next day (called after night phase)
     */
    advanceDay() {
        const newDay = this._state.day + 1;

        // Apply overnight recovery
        this.recoverStamina(GameConfig.stamina.overnightRecovery);

        // Daily tech debt increase (entropy)
        this.adjust('technicalDebt', GameConfig.techDebt.dailyIncrease, 0, GameConfig.techDebt.max);

        // Possible condition decay
        if (Math.random() < GameConfig.condition.dailyDecayChance) {
            this._decayCondition();
        }

        this.update({
            day: newDay,
            currentPhase: 'day',
            dayActionsRemaining: GameConfig.phases.DAY.actionsAllowed,
            nightActionsRemaining: GameConfig.phases.NIGHT.actionsAllowed,
            todayActions: []
        });

        this._eventBus.emit('day:advanced', { day: newDay });
        this._eventBus.emit('phase:changed', {
            from: 'night',
            to: 'day',
            day: newDay
        });
    }

    // ===== CONDITION SYSTEM =====

    /**
     * Get current condition info from config
     * @returns {Object} Condition configuration object
     */
    getConditionInfo() {
        const conditionId = this._state.condition;
        const levels = GameConfig.condition.levels;

        switch (conditionId) {
            case 'superb': return levels.SUPERB;
            case 'good': return levels.GOOD;
            case 'bad': return levels.BAD;
            case 'terrible': return levels.TERRIBLE;
            default: return levels.NORMAL;
        }
    }

    /**
     * Get exp multiplier based on current condition
     * @returns {number} Multiplier (0.5 - 1.5)
     */
    getExpMultiplier() {
        return this.getConditionInfo().expMultiplier;
    }

    /**
     * Get success rate bonus/penalty based on condition
     * @returns {number} Bonus (can be negative)
     */
    getConditionSuccessBonus() {
        return this.getConditionInfo().successBonus;
    }

    /**
     * Attempt to improve condition (called during rest)
     * Uses probability transition matrix from config
     */
    tryImproveCondition() {
        const current = this._state.condition;
        const transitions = GameConfig.condition.restTransitions[current];
        const roll = Math.random();

        let cumulative = 0;
        for (const [newCondition, probability] of Object.entries(transitions)) {
            cumulative += probability;
            if (roll < cumulative) {
                if (newCondition !== current) {
                    const oldInfo = this.getConditionInfo();
                    this.update({ condition: newCondition });
                    const newInfo = this.getConditionInfo();

                    this._eventBus.emit('condition:changed', {
                        from: current,
                        to: newCondition,
                        fromInfo: oldInfo,
                        toInfo: newInfo
                    });
                }
                return newCondition;
            }
        }
        return current;
    }

    /**
     * Decay condition by one level (called on daily decay)
     * @private
     */
    _decayCondition() {
        const order = ['superb', 'good', 'normal', 'bad', 'terrible'];
        const currentIndex = order.indexOf(this._state.condition);

        if (currentIndex < order.length - 1) {
            const newCondition = order[currentIndex + 1];
            const oldInfo = this.getConditionInfo();
            this.update({ condition: newCondition });
            const newInfo = this.getConditionInfo();

            this._eventBus.emit('condition:changed', {
                from: this._state.condition,
                to: newCondition,
                fromInfo: oldInfo,
                toInfo: newInfo,
                reason: 'decay'
            });
        }
    }

    // ===== SKILL & EXPERIENCE SYSTEM =====

    /**
     * Add experience to a skill with condition multiplier
     * @param {string} skillName - Skill key
     * @param {number} baseExp - Base experience amount
     * @returns {Object} Result with levelUp status
     */
    addSkillExp(skillName, baseExp) {
        const skills = { ...this._state.skills };
        const experience = { ...this._state.experience };

        if (!(skillName in experience)) {
            console.error(`GameState.addSkillExp: Unknown skill "${skillName}"`);
            return { levelUp: false, levelsGained: 0, newLevel: 0, newExp: 0 };
        }

        if (typeof baseExp !== 'number' || baseExp < 0) {
            console.error(`GameState.addSkillExp: baseExp must be positive number`);
            return {
                levelUp: false,
                levelsGained: 0,
                newLevel: skills[skillName],
                newExp: experience[skillName]
            };
        }

        // Apply condition multiplier
        const multiplier = this.getExpMultiplier();
        const actualExp = Math.floor(baseExp * multiplier);

        const maxLevel = GameConfig.skills.maxLevel;
        const expPerLevel = GameConfig.skills.expPerLevel;

        experience[skillName] += actualExp;
        let levelUp = false;
        let levelsGained = 0;

        // Process level-ups
        while (experience[skillName] >= expPerLevel && skills[skillName] < maxLevel) {
            experience[skillName] -= expPerLevel;
            skills[skillName]++;
            levelUp = true;
            levelsGained++;
        }

        // Cap exp at max level
        if (skills[skillName] >= maxLevel) {
            experience[skillName] = Math.min(experience[skillName], expPerLevel - 1);
        }

        this.update({ skills, experience });
        this._recalculateGrowth();

        return {
            levelUp,
            levelsGained,
            newLevel: skills[skillName],
            newExp: experience[skillName],
            actualExpGained: actualExp,
            multiplier
        };
    }

    /**
     * Recalculate growth from skills (legacy compatibility)
     * @private
     */
    _recalculateGrowth() {
        const skills = this._state.skills;
        const totalSkills = skills.cutting + skills.boiling + skills.frying + skills.analysis;
        const growth = Math.floor(totalSkills * GameConfig.growth.scaleFactor);
        this.update({ growth: Math.min(growth, this._state.maxGrowth) });
    }

    /**
     * Get skill letter grade
     * @param {number} level - Skill level
     * @returns {string} Letter grade
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

    // ===== DISH PROGRESS SYSTEM =====

    /**
     * Calculate dish progress increase from trial cooking
     * Higher skills = faster progress
     * @returns {number} Progress amount to add
     */
    calculateDishProgressGain() {
        const skills = this._state.skills;
        const weights = GameConfig.dishProgress.skillWeights;
        const conditionBonus = this.getConditionInfo().dishProgressBonus;

        // Base progress + skill contributions
        let progress = GameConfig.dishProgress.baseProgressPerTrial;

        progress += skills.cutting * weights.cutting;
        progress += skills.boiling * weights.boiling;
        progress += skills.frying * weights.frying;
        progress += skills.analysis * weights.analysis;

        // Apply condition modifier
        progress = Math.floor(progress * conditionBonus);

        return progress;
    }

    /**
     * Add progress to the special dish
     * @param {number} amount - Progress to add
     * @returns {Object} Result with new progress value
     */
    addDishProgress(amount) {
        const oldProgress = this._state.dishProgress;
        const newProgress = Math.min(
            GameConfig.dishProgress.max,
            oldProgress + amount
        );

        this.update({ dishProgress: newProgress });

        this._eventBus.emit('dish:progress', {
            oldProgress,
            newProgress,
            gained: newProgress - oldProgress
        });

        return { oldProgress, newProgress, gained: newProgress - oldProgress };
    }

    /**
     * Check if dish progress meets victory threshold
     * @returns {boolean} True if ready for judgment
     */
    isDishComplete() {
        return this._state.dishProgress >= GameConfig.dishProgress.victoryThreshold;
    }

    // ===== STAMINA SYSTEM =====

    /**
     * Consume stamina for an action
     * @param {number} amount - Stamina cost
     * @returns {boolean} True if action can proceed
     */
    consumeStamina(amount) {
        if (typeof amount !== 'number' || amount < 0) {
            console.error(`GameState.consumeStamina: amount must be positive number`);
            return false;
        }
        if (this._state.stamina < amount) {
            return false;
        }
        this.adjust('stamina', -amount, 0, this._state.maxStamina);
        return true;
    }

    /**
     * Recover stamina
     * @param {number} amount - Amount to recover
     */
    recoverStamina(amount = GameConfig.stamina.overnightRecovery) {
        if (typeof amount !== 'number' || amount < 0) {
            console.error(`GameState.recoverStamina: amount must be positive number`);
            return;
        }
        this.adjust('stamina', amount, 0, this._state.maxStamina);
    }

    // ===== TECH DEBT =====

    /**
     * Reduce technical debt
     * @param {number} amount - Amount to reduce
     */
    reduceTechDebt(amount) {
        this.adjust('technicalDebt', -amount, 0, GameConfig.techDebt.max);
    }

    /**
     * Increase technical debt (on failure)
     * @param {number} amount - Amount to increase
     */
    increaseTechDebt(amount) {
        this.adjust('technicalDebt', amount, 0, GameConfig.techDebt.max);
    }

    // ===== GAME STATE CHECKS =====

    /**
     * Check skill requirements for Day 7 Judgment
     * @returns {Object} Pass/fail status with details
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
            analysis: {
                current: skills.analysis,
                required: reqs.analysis,
                passed: skills.analysis >= reqs.analysis
            }
        };

        const allPassed = results.cutting.passed && results.boiling.passed &&
                          results.frying.passed && results.analysis.passed;

        // Also check dish progress
        const dishComplete = this.isDishComplete();

        return {
            passed: allPassed && dishComplete,
            skillsPassed: allPassed,
            dishComplete,
            dishProgress: this._state.dishProgress,
            details: results
        };
    }

    /**
     * Check if game is over
     * @returns {boolean} True if game should end in defeat
     */
    isGameOver() {
        const state = this._state;
        if (state.technicalDebt >= GameConfig.techDebt.max) return true;
        if (state.oldManMood <= 0) return true;
        if (state.stamina <= 0 && state.condition === 'terrible') return true;
        return false;
    }

    /**
     * Check if game is won (Episode 1 only on Day 7 judgment)
     * @returns {boolean}
     */
    isVictory() {
        // Victory is determined by Day 7 Judgment scene
        return false;
    }

    // ===== ACTION TRACKING =====

    /**
     * Record an action taken
     * @param {string} actionId - Action identifier
     */
    recordAction(actionId) {
        const history = [...this._state.actionHistory, actionId];
        if (history.length > 10) history.shift();

        const todayActions = [...this._state.todayActions, actionId];

        this.update({
            actionHistory: history,
            todayActions,
            lastAction: actionId
        });
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
     * Retry from Day 1 while preserving skills
     * Simple reset for continue functionality
     */
    retryFromDayOne() {
        // Preserve skills (not reset)
        this.update({
            day: 1,
            stamina: 100,
            currentPhase: 'day',
            dayActionsRemaining: GameConfig.phases.DAY.actionsAllowed,
            nightActionsRemaining: GameConfig.phases.NIGHT.actionsAllowed,
            dishProgress: 0,
            technicalDebt: GameConfig.techDebt.initial,
            growth: 0,
            oldManMood: 70,
            condition: GameConfig.condition.initial,
            todayActions: [],
            spiceCrisisActive: false,
            judgmentTriggered: false
        });

        this._eventBus.emit('game:retry_from_day_one', {
            newState: this.getState()
        });
    }

    /**
     * Retry sprint while preserving skills (continue mode)
     * Resets day to 1, recovers stamina, but keeps skill levels
     */
    retrySprint() {
        const currentSkills = { ...this._state.skills };
        const currentExperience = { ...this._state.experience };
        
        // Apply slight skill decay (optional - makes retry a bit harder but not too punishing)
        const decayFactor = 0.95; // 5% reduction
        const decayedSkills = {};
        const decayedExperience = {};
        
        for (const [skill, level] of Object.entries(currentSkills)) {
            // Keep levels but reduce exp a bit
            decayedSkills[skill] = level;
            decayedExperience[skill] = Math.floor((currentExperience[skill] || 0) * decayFactor);
        }

        // Reset to day 1 but keep skills
        this.update({
            day: 1,
            currentPhase: 'day',
            dayActionsRemaining: GameConfig.phases.DAY.actionsAllowed,
            nightActionsRemaining: GameConfig.phases.NIGHT.actionsAllowed,
            stamina: GameConfig.stamina.max, // Full stamina
            maxStamina: GameConfig.stamina.max,
            skills: decayedSkills,
            experience: decayedExperience,
            dishProgress: 0, // Reset dish progress
            technicalDebt: GameConfig.techDebt.initial,
            growth: 0, // Reset growth
            oldManMood: 70, // Reset mood
            condition: GameConfig.condition.initial,
            todayActions: [],
            actionHistory: [], // Keep history or reset? Resetting for now
            spiceCrisisActive: false,
            judgmentTriggered: false
        });

        // Recalculate growth from skills
        this._recalculateGrowth();

        this._eventBus.emit('game:retry_sprint', {
            preservedSkills: decayedSkills,
            newState: this.getState()
        });
    }

    /**
     * Start an episode
     * @param {number} episodeNumber - Episode to start
     */
    startEpisode(episodeNumber) {
        const updates = {
            currentEpisode: episodeNumber,
            day: 1,
            currentPhase: 'day',
            dayActionsRemaining: GameConfig.phases.DAY.actionsAllowed,
            nightActionsRemaining: GameConfig.phases.NIGHT.actionsAllowed,
            condition: GameConfig.condition.initial,
            stamina: GameConfig.stamina.initial,
            technicalDebt: GameConfig.techDebt.initial,
            dishProgress: GameConfig.dishProgress.initial,
            skills: { cutting: 0, boiling: 0, frying: 0, analysis: 0 },
            experience: { cutting: 0, boiling: 0, frying: 0, analysis: 0 },
            growth: 0,
            oldManMood: 70,
            todayActions: [],
            actionHistory: []
        };

        if (episodeNumber === 1) {
            updates.maxDays = GameConfig.episode1.maxDays;
            updates.spiceCrisisActive = false;
            updates.judgmentTriggered = false;
        }

        this.update(updates);
        this._eventBus.emit(GameEvents.EPISODE_STARTED, { episode: episodeNumber });
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameState };
}
