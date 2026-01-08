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
// NOTE: Using GameState's phase system ('day'/'night')
// 'day' = 昼の業務 (3 actions), 'night' = 夜の自習 (1 action)
const GAME_PHASES = {
    DAY: 'day',              // 昼の業務（3アクション）
    NIGHT: 'night',          // 夜の自習（1アクション）
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

        // Phase tracking now uses GameState's remainingActions (unified for all days)

        // Daily state
        this._dailyFocus = null;
        this._failedActions = [];
        this._dayStartState = null;

        // Episode 1: 7-Day Sprint tracking
        this._maxDays = 7;

        // Guard flags to prevent double-triggering
        this._isTransitioningToNight = false;

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
        // Reset action counters
        this._actionsThisDay = 0;
        this._actionsThisNight = 0;
        this._failedActions = [];
        this._isTransitioningToNight = false;  // Reset guard flag
        this._dayStartState = { ...this._gameState.getState() };

        const currentDay = this._gameState.get('day');
        const currentPhase = this._gameState.get('currentPhase');

        // Ensure we start in 'day' phase
        if (currentPhase !== 'day') {
            this._gameState.update({ 
                currentPhase: 'day',
                dayActionsRemaining: GameConfig.phases.DAY.actionsAllowed,
                nightActionsRemaining: GameConfig.phases.NIGHT.actionsAllowed
            });
        }

        // CRITICAL: Force UI update by emitting state change
        this._eventBus.emit(GameEvents.UI_UPDATE_REQUESTED, {
            state: this._gameState.getState()
        });

        // Emit phase change (using GameState's phase)
        this._eventBus.emit('ceremony:phase_changed', {
            phase: 'day',
            day: currentDay
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
        const maxDays = state.maxDays || this._maxDays;

        // No spice crisis system (removed)

        // Generate contextual morning dialogue
        const dialogues = this._getMorningDialogue(state);

        this._eventBus.emit('ceremony:morning_standup', {
            day,
            maxDays,
            dialogues,
            focusOptions: Object.values(DAILY_FOCUS_OPTIONS)
        });
    }

    // Spice crisis system removed

    /**
     * Get contextual morning dialogue based on game state
     * Features grumpy Master lines that reflect current stats
     */
    _getMorningDialogue(state) {
        const dialogues = [];
        const maxDays = state.maxDays || 7;
        const daysRemaining = maxDays - state.day + 1;

        // ===== GRUMPY MASTER MORNING LINE (Based on stats) =====
        const masterLine = this._getMasterMorningLine(state, daysRemaining);
        dialogues.push(masterLine);

        // ===== MINA'S ENCOURAGEMENT =====
        // Unified logic: No day-specific branches (Day 1-7 all use same logic)
        if (daysRemaining <= 2) {
            dialogues.push({ speaker: 'ミナ', text: `あと${daysRemaining}日...ラストスパートだね！` });
        } else if (state.growth >= 40) {
            dialogues.push({ speaker: 'ミナ', text: 'いい感じ！合格ラインが見えてきたよ！' });
        } else {
            const minaLines = [
                { speaker: 'ミナ', text: `${state.day}日目！今日の作戦は？` },
                { speaker: 'ミナ', text: '新しい発見があるかも...挑戦してみよう！' },
                { speaker: 'ミナ', text: 'お父さんを唸らせる味を見つけよう！' }
            ];
            dialogues.push(minaLines[Math.floor(Math.random() * minaLines.length)]);
        }

        // ===== CONTEXTUAL ADVICE (Stat warnings) =====
        if (state.ingredientQuality < 40) {
            dialogues.push({ speaker: 'ミナ', text: '厨房の状態が良くないね...レシピ改善が必要かも。' });
        }
        if (state.stagnation >= 60) {
            dialogues.push({ speaker: 'ミナ', text: '同じやり方だと限界がきてる...新しい挑戦を！' });
        }
        if (state.technicalDebt >= 5) {
            dialogues.push({ speaker: 'ミナ', text: '技術的負債が溜まってるね...整理した方がいいかも。' });
        }

        return dialogues;
    }

    /**
     * Generate grumpy Master morning line based on stats
     */
    _getMasterMorningLine(state, daysRemaining) {
        // Priority-based grumpy comments
        if (state.technicalDebt >= 8) {
            return { speaker: '老店主', text: '...厨房がぐちゃぐちゃだ。こんな状態で料理ができると思うな。' };
        }
        // Unified logic: No day-specific branches
        if (state.growth < 10) {
            return { speaker: '老店主', text: 'ふん...まだ素人の味だな。ワシを舐めているのか？' };
        }
        if (state.stagnation >= 70) {
            return { speaker: '老店主', text: '同じことの繰り返しか...お前に才能はないのかもしれん。' };
        }
        if (state.ingredientQuality < 30) {
            return { speaker: '老店主', text: '品質が落ちている。こんな食材で客に出せるか！' };
        }
        if (state.oldManMood < 40) {
            return { speaker: '老店主', text: '...まだ諦めてないのか。しつこいヤツだ。' };
        }
        if (daysRemaining <= 2 && state.growth < 40) {
            return { speaker: '老店主', text: '残り時間は少ない...このままでは不合格だぞ。' };
        }
        if (state.growth >= 40) {
            return { speaker: '老店主', text: '...悪くない。だが、まだ足りん。' };
        }

        // Default grumpy lines by day
        const defaultLines = [
            { speaker: '老店主', text: '今日も無駄にするつもりか？考えて動け。' },
            { speaker: '老店主', text: '口より手を動かせ。結果で示せ。' },
            { speaker: '老店主', text: 'キメラシチューは一朝一夕でできるものではない...わかっているな？' },
            { speaker: '老店主', text: '...何をボーッとしている。時間は待ってくれんぞ。' }
        ];
        return defaultLines[Math.floor(Math.random() * defaultLines.length)];
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
        // Also clear pivotBonus after it's been "used" for this day's success calculation
        this._gameState.update({
            dailyFocus: focusId,
            dailyFocusEffect: focus.effect,
            pivotBonus: false  // Clear pivot bonus after morning stand-up
        });

        // Emit selection event
        this._eventBus.emit('ceremony:focus_selected', {
            focus,
            message: `今日の方針：${focus.name}（${focus.description}）`
        });

        // Transition to day phase (昼の業務)
        this._transitionToPhase('day');
    }

    /**
     * Transition between phases with animation
     */
    _transitionToPhase(newPhase) {
        const currentPhase = this._gameState.get('currentPhase');

        // Emit transition start
        this._eventBus.emit('ceremony:transition_start', {
            from: currentPhase,
            to: newPhase
        });

        // After transition animation, set new phase in GameState
        setTimeout(() => {
            // Update GameState phase
            if (newPhase === 'day') {
                this._gameState.update({
                    currentPhase: 'day',
                    dayActionsRemaining: GameConfig.phases.DAY.actionsAllowed,
                    nightActionsRemaining: GameConfig.phases.NIGHT.actionsAllowed
                });
                this._eventBus.emit('ceremony:action_phase_start', {});
            } else if (newPhase === 'night') {
                this._gameState.update({
                    currentPhase: 'night',
                    nightActionsRemaining: GameConfig.phases.NIGHT.actionsAllowed
                });
                // CRITICAL: Do NOT automatically show retrospective here!
                // Wait for user to click a night action button first.
                // The retrospective will ONLY be called from _onActionExecuted() after a night action is executed.
                console.log('CeremonyManager: Night phase transitioned - WAITING for user to click night action button (retrospective will NOT start automatically)');
            }

            this._eventBus.emit('ceremony:phase_changed', {
                phase: newPhase,
                day: this._gameState.get('day')
            });
        }, 1500); // 1.5s transition animation
    }

    /**
     * Called when an action is executed
     */
    _onActionExecuted(data) {
        const currentPhase = this._gameState.get('currentPhase');

        // GUARD: Only process if in day or night phase
        if (currentPhase !== 'day' && currentPhase !== 'night') return;

        // GUARD: Prevent double-counting if somehow called twice
        if (this._isTransitioningToNight) return;

        if (currentPhase === 'day') {
            // 昼の業務フェーズ
            // Track failed actions for Adapt/Pivot logic
            if (data.message && data.message.includes('failure')) {
                this._failedActions.push(data.actionId);
            }

            // Use GameState's remainingActions as source of truth
            const remainingActions = this._gameState.getActionsRemaining();
            
            // Emit remaining actions update
            this._eventBus.emit('ceremony:actions_remaining', { remaining: remainingActions });

            // Check if day phase should end (remainingActions === 0)
            // Unified logic: Works the same for Day 1, Day 2, ..., Day 7
            if (remainingActions <= 0) {
                // Set guard flag to prevent double-triggering
                this._isTransitioningToNight = true;

                // Small delay before transitioning to night
                setTimeout(() => {
                    this._transitionToPhase('night');
                    this._isTransitioningToNight = false;
                }, 1500);
            }
        } else if (currentPhase === 'night') {
            // 夜の自習フェーズ
            // Use GameState's remainingActions as source of truth
            const remainingActions = this._gameState.getActionsRemaining();
            
            // Emit remaining actions update
            this._eventBus.emit('ceremony:actions_remaining', { remaining: remainingActions });

            // Check if night phase should end (remainingActions === 0)
            // Unified logic: Works the same for Day 1, Day 2, ..., Day 7
            if (remainingActions <= 0) {
                // Night phase complete, proceed to retrospective
                setTimeout(() => {
                    this._showNightRetrospective();
                }, 1500);
            }
        }
    }

    /**
     * Force end the day phase and go to night
     */
    endActionPhase() {
        const currentPhase = this._gameState.get('currentPhase');
        if (currentPhase === 'day') {
            this._transitionToPhase('night');
        }
    }

    // ===== NIGHT RETROSPECTIVE =====

    /**
     * Show Night Retrospective summary
     */
    _showNightRetrospective() {
        // CRITICAL: Error handling to ensure retrospective always shows
        try {
            const state = this._gameState.getState();
            const daySummary = this._calculateDaySummary(state);
            const maxDays = state?.maxDays || this._maxDays || 7;

            // Check for Day 7 Judgment (Episode 1 final evaluation)
            // Triggers when we've completed the LAST day's actions (Day 7)
            if (state?.currentEpisode === 1 && state?.day === maxDays) {
                try {
                    this._triggerJudgmentScene(state);
                    return;
                } catch (error) {
                    console.error('CeremonyManager: Error triggering judgment scene:', error);
                    // Fall through to show regular retrospective as fallback
                }
            }

            // Check for Adapt/Pivot trigger (same action failed twice)
            const shouldTriggerPivot = this._checkPivotTrigger();

            this._eventBus.emit('ceremony:night_retro', {
                day: state?.day || 1,
                maxDays,
                summary: daySummary || {},
                triggerPivot: shouldTriggerPivot,
                pivotMessage: shouldTriggerPivot ?
                    'このやり方は上手くいってない…アプローチを変えるべき？' : null
            });
        } catch (error) {
            // CRITICAL: Fallback to show basic retrospective even on error
            console.error('CeremonyManager: Error in _showNightRetrospective:', error);
            const state = this._gameState.getState();
            this._eventBus.emit('ceremony:night_retro', {
                day: state?.day || 1,
                maxDays: state?.maxDays || 7,
                summary: {},
                triggerPivot: false,
                pivotMessage: null
            });
        }
    }

    /**
     * Trigger the Day 7 Judgment Scene (Episode 1 finale)
     * The Master tastes the Chimera Stew to determine if Fuji passes
     * Now uses checkChimeraStewRequirements() for skill-based evaluation
     */
    _triggerJudgmentScene(state) {
        // CRITICAL: Defensive programming - handle undefined skillCheck
        let skillCheck;
        try {
            skillCheck = this._gameState.checkChimeraStewRequirements();
        } catch (error) {
            console.error('CeremonyManager: Error checking requirements:', error);
            // Fallback: Create default skillCheck structure
            skillCheck = {
                passed: false,
                skillsPassed: false,
                dishComplete: false,
                dishProgress: state?.dishProgress || 0,
                details: {
                    cutting: { passed: false, current: 0, required: 10 },
                    boiling: { passed: false, current: 0, required: 10 },
                    frying: { passed: false, current: 0, required: 10 },
                    analysis: { passed: false, current: 0, required: 10 }
                }
            };
        }

        // CRITICAL: Safe access with null checks
        const isSuccess = skillCheck?.passed || false;
        const skillDetails = skillCheck?.details || {};

        this._gameState.update({ judgmentTriggered: true });

        // Build skill report for dialogue with safe data
        const skillReport = this._buildSkillReport(skillDetails);

        if (isSuccess) {
            this._eventBus.emit('ceremony:judgment_success', {
                growth: state.growth,
                skillCheck: skillCheck.details,
                dialogues: [
                    { speaker: 'narrator', text: '7日目の夜。ついに審判の時が来た。' },
                    { speaker: 'narrator', text: 'フジが作った「キメラシチュー」が、老店主の前に置かれる。' },
                    { speaker: '老店主', text: '...ふむ。' },
                    { speaker: 'narrator', text: '老店主は無言でスプーンを手に取り、一口すくった。' },
                    { speaker: 'ミナ', text: '（ドキドキ...）' },
                    { speaker: 'narrator', text: '長い沈黙。店内に緊張が走る。' },
                    { speaker: '老店主', text: '......。' },
                    { speaker: '老店主', text: skillReport.masterComment },
                    { speaker: 'fuji', text: '...！' },
                    { speaker: '老店主', text: 'まだ荒削りだ。だが...芯は捉えている。' },
                    { speaker: '老店主', text: 'お前の「やり方」...認めてやる。明日から正式に働け。' },
                    { speaker: 'ミナ', text: 'やったー！フジくん合格だよ！' },
                    { speaker: 'fuji', text: 'ありがとうございます...！必ず期待に応えます！' },
                    { speaker: '老店主', text: 'ふん...調子に乗るな。これからが本番だ。' },
                    { speaker: 'narrator', text: '「アジャイル」の力で不可能を可能にしたフジ。' },
                    { speaker: 'narrator', text: 'こうして、「ネコノヒゲ亭」での本当の修行が始まる...' }
                ],
                reward: {
                    item: '老店主の包丁',
                    description: '正式採用の証として、年季の入った包丁を受け取った'
                }
            });
        } else {
            // Generate failure dialogue based on which skills were lacking
            // CRITICAL: Safe access with fallback
            const failureComment = this._getFailureComment(skillDetails);

            this._eventBus.emit('ceremony:judgment_failure', {
                growth: state?.growth || 0,
                skillCheck: skillDetails,
                state: state, // Include full state for continue screen
                dialogues: [
                    { speaker: 'narrator', text: '7日目の夜。審判の時が来た。' },
                    { speaker: 'narrator', text: 'フジが作った「キメラシチュー」が、老店主の前に置かれる。' },
                    { speaker: '老店主', text: '...。' },
                    { speaker: 'narrator', text: '老店主は一口含み、すぐにスプーンを置いた。' },
                    { speaker: '老店主', text: '...話にならん。' },
                    { speaker: 'fuji', text: 'そんな...！' },
                    { speaker: '老店主', text: failureComment },
                    { speaker: '老店主', text: '約束通りだ...出て行け。' },
                    { speaker: 'ミナ', text: 'お父さん...！もう少しだけ...！' },
                    { speaker: '老店主', text: '甘やかすな、ミナ。ここは厨房だ。結果が全てだ。' },
                    { speaker: 'fuji', text: '...すみませんでした。' },
                    { speaker: 'narrator', text: skillReport.failureSummary },
                    { speaker: 'narrator', text: 'フジは「ネコノヒゲ亭」を後にした。しかし...' }
                ]
            });
        }
    }

    /**
     * Build skill report for judgment dialogue
     */
    _buildSkillReport(details) {
        // CRITICAL: Defensive programming - handle undefined details
        if (!details || typeof details !== 'object') {
            console.warn('CeremonyManager._buildSkillReport: Invalid details, using defaults');
            return {
                masterComment: '...判定に必要なデータが不足している。',
                failureSummary: 'データ不足により判定できませんでした。',
                passedSkills: [],
                failedSkills: []
            };
        }

        const skillNames = {
            cutting: '包丁さばき',
            boiling: '煮込み',
            frying: '炒め',
            analysis: '食材分析'
        };

        const passedSkills = [];
        const failedSkills = [];

        Object.entries(details).forEach(([skill, data]) => {
            // CRITICAL: Safe access with null checks
            if (data && typeof data === 'object' && data.passed) {
                passedSkills.push(skillNames[skill] || skill);
            } else if (data && typeof data === 'object') {
                failedSkills.push({
                    name: skillNames[skill] || skill,
                    current: data.current || 0,
                    required: data.required || 0
                });
            }
        });

        // Master's comment based on performance
        let masterComment = '...ワシが2年かけた味を、7日で再現しおったか。';
        if (passedSkills.length === 4) {
            masterComment = '...完璧だ。この味...ワシを超える日も近いかもしれん。';
        } else if (details?.boiling?.passed && details?.cutting?.passed) {
            masterComment = '...煮込みと包丁さばき...キメラシチューの核を理解している。';
        }

        // Failure summary
        const failureSummary = failedSkills.length > 0
            ? `${failedSkills.map(s => s.name).join('、')}の技術が足りなかった...`
            : '7日間では足りなかった...';

        return { masterComment, failureSummary, passedSkills, failedSkills };
    }

    /**
     * Get failure comment based on which skills were lacking
     */
    _getFailureComment(details) {
        // CRITICAL: Defensive programming - handle undefined details
        if (!details || typeof details !== 'object') {
            console.warn('CeremonyManager._getFailureComment: Invalid details, using default');
            return '判定データが不足している。基本ができていない。';
        }

        const failedSkills = [];

        // CRITICAL: Safe access with null checks
        if (!details?.boiling?.passed) failedSkills.push('煮込み');
        if (!details?.cutting?.passed) failedSkills.push('包丁');
        if (!details?.frying?.passed) failedSkills.push('炒め');
        if (!details?.analysis?.passed) failedSkills.push('食材分析');

        if (failedSkills.includes('煮込み')) {
            return 'この煮込み...全く火加減がなっておらん。基本ができていない。';
        } else if (failedSkills.includes('包丁')) {
            return '食材の切り方が雑だ。これでは味が均一にならん。';
        } else if (failedSkills.length >= 2) {
            return `${failedSkills.join('も')}も...何も身についておらんじゃないか。`;
        } else {
            return 'ワシの料理を舐めていたようだな。2年の重みがわかるか？';
        }
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
        // CRITICAL: Error handling to ensure day advancement always happens
        try {
            const currentDay = this._gameState.get('day') || 1;

            // Clear daily state (but keep pivotBonus - it should apply to NEXT day)
            this._dailyFocus = null;
            this._gameState.update({
                dailyFocus: null,
                dailyFocusEffect: null
                // NOTE: pivotBonus is cleared in selectDailyFocus() after being used
            });

            // Overnight stamina recovery is handled by advanceDay()
            // (advanceDay() recovers +40 stamina, so we don't need to call recoverStamina here)

            // Also replenish some ingredients overnight (daily delivery)
            const currentIngredients = this._gameState.get('currentIngredients');
            if (currentIngredients !== undefined && currentIngredients < 3) {
                this._gameState.update({ currentIngredients: Math.min(5, currentIngredients + 2) });
            }

            // CRITICAL: NOW advance the day counter (after retrospective is complete)
            // SPECIFICATION COMPLIANCE: This ensures next morning's "policy selection" is shown
            const nextDay = currentDay + 1;
            this._gameState.advanceDay(); // This handles overnight recovery (+40) and day increment

            this._eventBus.emit('ceremony:day_complete', {
                completedDay: currentDay,
                nextDay: nextDay
            });

            // Check for game end conditions AFTER day advances
            this._checkGameEndConditions();
        } catch (error) {
            // CRITICAL: Even if there's an error, try to advance the day
            console.error('CeremonyManager: Error in _endRetrospective:', error);
            try {
                this._gameState.advanceDay();
            } catch (advanceError) {
                console.error('CeremonyManager: Failed to advance day:', advanceError);
            }
        }
    }

    /**
     * Check game end conditions after retrospective
     */
    _checkGameEndConditions() {
        const state = this._gameState.getState();

        // Check for game over (stagnation, mood, etc.)
        if (this._gameState.isGameOver()) {
            this._eventBus.emit(GameEvents.GAME_OVER, {
                state: state,
                reason: this._getGameOverReason(state)
            });
            return;
        }

        // Check for episode victory (only for non-Episode-1 or after Day 7)
        if (this._gameState.isVictory()) {
            this._eventBus.emit(GameEvents.GAME_VICTORY, {
                state: state
            });
            return;
        }

        // Episode 1 specific: Check if we've completed the 7-day sprint successfully
        if (state.currentEpisode === 1 && state.day > (state.maxDays || 7)) {
            if (state.growth >= 50) {
                this._eventBus.emit(GameEvents.EPISODE_COMPLETED, { episode: 1 });
            }
        }
    }

    /**
     * Get reason for game over
     */
    _getGameOverReason(state) {
        if (state.stagnation >= 100) return 'stagnation';
        if (state.oldManMood <= 0) return 'mood';
        if (state.ingredientQuality <= 0) return 'quality';
        if (state.currentIngredients <= 0) return 'ingredients';
        return 'unknown';
    }

    /**
     * Start next day (called from UI after retro is dismissed)
     * This is called when user clicks "Continue" button on Night Retrospective
     */
    proceedToNextDay() {
        // CRITICAL: End the retrospective first to advance the day counter
        // This handles the case where there was no Pivot decision
        const currentPhase = this._gameState.get('currentPhase');
        if (currentPhase === 'night') {
            this._endRetrospective();
        }

        // Start the new day's morning ceremony
        this.startNewDay();
    }

    /**
     * Reset for new episode
     */
    _resetDay() {
        this._actionsThisDay = 0;
        this._actionsThisNight = 0;
        this._failedActions = [];
        this._dailyFocus = null;
        this._dayStartState = null;
        this._isTransitioningToNight = false;
    }

    // ===== PUBLIC GETTERS =====

    getCurrentPhase() {
        return this._gameState.get('currentPhase');
    }

    getDailyFocus() {
        return this._dailyFocus;
    }

    getActionsRemaining() {
        const currentPhase = this._gameState.get('currentPhase');
        if (currentPhase === 'day') {
            return this._maxActionsPerDay - this._actionsThisDay;
        } else if (currentPhase === 'night') {
            return this._maxActionsPerNight - this._actionsThisNight;
        }
        return 0;
    }

    isActionPhase() {
        const currentPhase = this._gameState.get('currentPhase');
        return currentPhase === 'day' || currentPhase === 'night';
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CeremonyManager, DAILY_FOCUS_OPTIONS, GAME_PHASES };
}
