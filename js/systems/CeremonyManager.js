/**
 * CeremonyManager - Manages Agile Ceremonies (Morning Stand-up & Night Retro)
 *
 * Power Pro Success Mode Style:
 * - Morning Phase: Daily Stand-up with focus selection
 * - Action Phase: Kitchen Battle (3-button loop)
 * - Night Phase: Retrospective with Adapt/Pivot options
 */

// ===== DAILY FOCUS OPTIONS =====
const DAILY_FOCUS_OPTIONS = {
    quality: {
        id: 'quality',
        name: '品質重視',
        icon: '✨',
        description: '調理の成功率+10%',
        effect: { successBonus: 0.10, affectedAction: 1 }
    },
    speed: {
        id: 'speed',
        name: 'スピード重視',
        icon: '⚡',
        description: '調理で食材消費なし',
        effect: { noIngredientCost: true, affectedAction: 1 }
    },
    experiment: {
        id: 'experiment',
        name: '新しい挑戦',
        icon: '🔬',
        description: '停滞リセット、ただしリスクあり',
        effect: { resetStagnation: true, riskBonus: true }
    }
};

// ===== GAME PHASE DEFINITIONS =====
const GAME_PHASES = {
    MORNING: 'morning',      // Daily Stand-up
    ACTION: 'action',        // Kitchen Battle
    NIGHT: 'night',          // Retrospective
    TRANSITION: 'transition' // Between phases
};

class CeremonyManager {
    /**
     * @param {EventBus} eventBus
     * @param {GameState} gameState
     */
    constructor(eventBus, gameState) {
        this._eventBus = eventBus;
        this._gameState = gameState;

        // Current phase tracking
        this._currentPhase = GAME_PHASES.MORNING;
        this._actionsThisDay = 0;
        this._maxActionsPerDay = 3;

        // Daily state
        this._dailyFocus = null;
        this._failedActions = [];
        this._dayStartState = null;

        this._setupEventListeners();
    }

    _setupEventListeners() {
        // Listen for action execution to track progress
        this._eventBus.on(GameEvents.ACTION_EXECUTED, (data) => {
            this._onActionExecuted(data);
        });

        // Listen for game state changes
        this._eventBus.on(GameEvents.EPISODE_STARTED, () => {
            this._resetDay();
        });

        // Listen for game over/victory to stop ceremony
        this._eventBus.on(GameEvents.GAME_OVER, () => {
            this._currentPhase = 'gameover';
        });

        this._eventBus.on(GameEvents.GAME_VICTORY, () => {
            this._currentPhase = 'victory';
        });
    }

    // ===== PHASE MANAGEMENT =====

    /**
     * Start a new day with Morning Stand-up
     */
    startNewDay() {
        this._currentPhase = GAME_PHASES.MORNING;
        this._actionsThisDay = 0;
        this._failedActions = [];
        this._dayStartState = { ...this._gameState.getState() };

        // Emit phase change
        this._eventBus.emit('ceremony:phase_changed', {
            phase: GAME_PHASES.MORNING,
            day: this._gameState.get('day')
        });

        // Show morning stand-up UI
        this._showMorningStandup();
    }

    /**
     * Show Morning Stand-up dialogue and focus selection
     */
    _showMorningStandup() {
        const state = this._gameState.getState();
        const day = state.day;

        // Generate contextual morning dialogue
        const dialogues = this._getMorningDialogue(state);

        this._eventBus.emit('ceremony:morning_standup', {
            day,
            dialogues,
            focusOptions: Object.values(DAILY_FOCUS_OPTIONS)
        });
    }

    /**
     * Get contextual morning dialogue based on game state
     */
    _getMorningDialogue(state) {
        const dialogues = [];

        // Opening line
        if (state.day === 1) {
            dialogues.push({ speaker: 'ミナ', text: 'フジくん、今日から頑張ろうね！' });
            dialogues.push({ speaker: '老店主', text: '…まずは作戦を立てろ。何も考えずに動くな。' });
        } else {
            const greetings = [
                { speaker: 'ミナ', text: `${state.day}日目の朝だよ！今日の作戦は？` },
                { speaker: 'ミナ', text: '新しい一日が始まるよ！何に集中する？' },
                { speaker: '老店主', text: '今日は何を優先する？考えてから動け。' }
            ];
            dialogues.push(greetings[Math.floor(Math.random() * greetings.length)]);
        }

        // Add contextual advice based on state
        if (state.ingredientQuality < 40) {
            dialogues.push({ speaker: 'ミナ', text: '品質が下がってるね…整備が必要かも。' });
        }
        if (state.stagnation >= 60) {
            dialogues.push({ speaker: '老店主', text: '停滞が溜まっておる。新しいことを試すべきか？' });
        }
        if (state.currentIngredients <= 1) {
            dialogues.push({ speaker: 'ミナ', text: '食材が少ないよ！節約するか補充するか…' });
        }

        return dialogues;
    }

    /**
     * Player selects daily focus
     * @param {string} focusId - 'quality', 'speed', or 'experiment'
     */
    selectDailyFocus(focusId) {
        const focus = DAILY_FOCUS_OPTIONS[focusId];
        if (!focus) return;

        this._dailyFocus = focus;

        // Apply immediate effects (like stagnation reset)
        if (focus.effect.resetStagnation) {
            this._gameState.update({ stagnation: 20 });
        }

        // Store in game state for KitchenEngine to use
        this._gameState.update({
            dailyFocus: focusId,
            dailyFocusEffect: focus.effect
        });

        // Emit selection event
        this._eventBus.emit('ceremony:focus_selected', {
            focus,
            message: `今日の方針：${focus.name}（${focus.description}）`
        });

        // Transition to action phase
        this._transitionToPhase(GAME_PHASES.ACTION);
    }

    /**
     * Transition between phases with animation
     */
    _transitionToPhase(newPhase) {
        this._currentPhase = GAME_PHASES.TRANSITION;

        // Emit transition start
        this._eventBus.emit('ceremony:transition_start', {
            from: this._currentPhase,
            to: newPhase
        });

        // After transition animation, set new phase
        setTimeout(() => {
            this._currentPhase = newPhase;
            this._eventBus.emit('ceremony:phase_changed', {
                phase: newPhase,
                day: this._gameState.get('day')
            });

            if (newPhase === GAME_PHASES.ACTION) {
                this._eventBus.emit('ceremony:action_phase_start', {});
            } else if (newPhase === GAME_PHASES.NIGHT) {
                this._showNightRetrospective();
            }
        }, 1500); // 1.5s transition animation
    }

    /**
     * Called when an action is executed
     */
    _onActionExecuted(data) {
        if (this._currentPhase !== GAME_PHASES.ACTION) return;

        this._actionsThisDay++;

        // Track failed actions for Adapt/Pivot logic
        // Check result message for failure indicators
        if (data.message && data.message.includes('failure')) {
            this._failedActions.push(data.actionId);
        }

        // Emit remaining actions update
        const remaining = this._maxActionsPerDay - this._actionsThisDay;
        this._eventBus.emit('ceremony:actions_remaining', { remaining });

        // Check if day should end (3 actions completed)
        if (this._actionsThisDay >= this._maxActionsPerDay) {
            // Small delay before transitioning to night
            setTimeout(() => {
                this._transitionToPhase(GAME_PHASES.NIGHT);
            }, 1500);
        }
    }

    /**
     * Force end the action phase and go to night
     */
    endActionPhase() {
        if (this._currentPhase === GAME_PHASES.ACTION) {
            this._transitionToPhase(GAME_PHASES.NIGHT);
        }
    }

    // ===== NIGHT RETROSPECTIVE =====

    /**
     * Show Night Retrospective summary
     */
    _showNightRetrospective() {
        const state = this._gameState.getState();
        const daySummary = this._calculateDaySummary(state);

        // Check for Adapt/Pivot trigger (same action failed twice)
        const shouldTriggerPivot = this._checkPivotTrigger();

        this._eventBus.emit('ceremony:night_retro', {
            day: state.day,
            summary: daySummary,
            triggerPivot: shouldTriggerPivot,
            pivotMessage: shouldTriggerPivot ?
                'このやり方は上手くいってない…アプローチを変えるべき？' : null
        });
    }

    /**
     * Calculate day summary for retrospective
     */
    _calculateDaySummary(currentState) {
        const start = this._dayStartState || currentState;

        return {
            growthChange: currentState.growth - (start.growth || 0),
            qualityChange: currentState.ingredientQuality - (start.ingredientQuality || 0),
            stagnationChange: currentState.stagnation - (start.stagnation || 0),
            moodChange: currentState.oldManMood - (start.oldManMood || 0),
            actionsCompleted: this._actionsThisDay,
            failedActions: this._failedActions.length,
            dailyFocus: this._dailyFocus ? this._dailyFocus.name : 'なし'
        };
    }

    /**
     * Check if Adapt/Pivot should be triggered
     */
    _checkPivotTrigger() {
        // Count occurrences of each failed action
        const failCounts = {};
        this._failedActions.forEach(actionId => {
            failCounts[actionId] = (failCounts[actionId] || 0) + 1;
        });

        // Trigger if any action failed twice
        return Object.values(failCounts).some(count => count >= 2);
    }

    /**
     * Player chooses to pivot/adapt
     * @param {boolean} doPivot - True if player chooses to change approach
     */
    handlePivotChoice(doPivot) {
        if (doPivot) {
            // "Stop/Change" - Lose growth, gain debt reduction and success buff
            const state = this._gameState.getState();
            const growthLoss = Math.min(5, state.growth);
            const debtReduction = Math.min(10, state.technicalDebt);

            this._gameState.update({
                growth: state.growth - growthLoss,
                technicalDebt: Math.max(0, state.technicalDebt - debtReduction),
                pivotBonus: true,  // +15% success rate next day
                stagnation: Math.max(0, state.stagnation - 20)
            });

            this._eventBus.emit('ceremony:pivot_executed', {
                message: `アプローチを変更！成長-${growthLoss}、負債-${debtReduction}、明日の成功率UP!`
            });
        } else {
            this._eventBus.emit('ceremony:pivot_declined', {
                message: 'このまま続行する…'
            });
        }

        // End retrospective
        this._endRetrospective();
    }

    /**
     * End retrospective and prepare for next day
     */
    _endRetrospective() {
        // Clear daily state
        this._dailyFocus = null;
        this._gameState.update({
            dailyFocus: null,
            dailyFocusEffect: null
        });

        this._eventBus.emit('ceremony:day_complete', {
            day: this._gameState.get('day')
        });
    }

    /**
     * Start next day (called from UI after retro is dismissed)
     */
    proceedToNextDay() {
        // Advance day counter happens in KitchenEngine, just start new day ceremony
        this.startNewDay();
    }

    /**
     * Reset for new episode
     */
    _resetDay() {
        this._currentPhase = GAME_PHASES.MORNING;
        this._actionsThisDay = 0;
        this._failedActions = [];
        this._dailyFocus = null;
        this._dayStartState = null;
    }

    // ===== PUBLIC GETTERS =====

    getCurrentPhase() {
        return this._currentPhase;
    }

    getDailyFocus() {
        return this._dailyFocus;
    }

    getActionsRemaining() {
        return this._maxActionsPerDay - this._actionsThisDay;
    }

    isActionPhase() {
        return this._currentPhase === GAME_PHASES.ACTION;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CeremonyManager, DAILY_FOCUS_OPTIONS, GAME_PHASES };
}
