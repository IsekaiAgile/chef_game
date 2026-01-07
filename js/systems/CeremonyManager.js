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

        // Current phase tracking (sync with GameState)
        this._actionsThisDay = 0;
        this._maxActionsPerDay = 3;
        this._actionsThisNight = 0;
        this._maxActionsPerNight = 1;

        // Daily state
        this._dailyFocus = null;
        this._failedActions = [];
        this._dayStartState = null;

        // Episode 1: 7-Day Sprint tracking
        this._maxDays = 7;
        this._spiceCrisisShown = false;

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
        this._eventBus.on(GameEvents.GAME_OVER, (data) => {
            this._currentPhase = 'gameover';
            // Show reset button after a delay to ensure game over screen is displayed
            setTimeout(() => {
                this._showResetButton();
            }, 1000);
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

        // Check for Spice Crisis (Day 3 of Episode 1)
        if (state.currentEpisode === 1 && day === 3 && !this._spiceCrisisShown) {
            this._triggerSpiceCrisis();
            return;
        }

        // Check if spice crisis should end (Day 5+)
        if (state.currentEpisode === 1 && day >= 5 && state.spiceCrisisActive) {
            this._gameState.update({ spiceCrisisActive: false });
            this._eventBus.emit('ceremony:crisis_ended', {
                message: 'スパイスの配達が到着！通常営業に戻る'
            });
        }

        // Generate contextual morning dialogue
        const dialogues = this._getMorningDialogue(state);

        this._eventBus.emit('ceremony:morning_standup', {
            day,
            maxDays,
            dialogues,
            focusOptions: Object.values(DAILY_FOCUS_OPTIONS),
            isSpiceCrisis: state.spiceCrisisActive
        });
    }

    /**
     * Trigger the Spice Crisis event on Day 3
     */
    _triggerSpiceCrisis() {
        this._spiceCrisisShown = true;
        this._gameState.update({ spiceCrisisActive: true });

        this._eventBus.emit('ceremony:spice_crisis', {
            title: 'スパイス危機発生！',
            message: 'スパイスの配達が遅れている！店の在庫が空っぽだ！',
            effect: 'Day 3-4: 調理の成功率-20%、実験の成功率+20%',
            dialogues: [
                { speaker: 'ミナ', text: '大変！クミンが届いてないよ！' },
                { speaker: '老店主', text: 'なんだと...！配達業者め...！' },
                { speaker: 'ミナ', text: 'フジくん、今日は工夫が必要だね...' },
                { speaker: 'narrator', text: 'スパイス不足の中、どう乗り越える？' }
            ]
        });
    }

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
        if (state.day === 1) {
            dialogues.push({ speaker: 'ミナ', text: 'キメラシチュー完成まで7日間...頑張ろう、フジくん！' });
        } else if (daysRemaining <= 2) {
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
        if (state.growth < 10 && state.day >= 3) {
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
                this._showNightRetrospective();
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
            this._actionsThisDay++;

            // Track failed actions for Adapt/Pivot logic
            if (data.message && data.message.includes('failure')) {
                this._failedActions.push(data.actionId);
            }

            // Emit remaining actions update
            const remaining = this._maxActionsPerDay - this._actionsThisDay;
            this._eventBus.emit('ceremony:actions_remaining', { remaining });

            // Check if day phase should end (3 actions completed)
            if (this._actionsThisDay >= this._maxActionsPerDay) {
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
            this._actionsThisNight++;

            // Emit remaining actions update
            const remaining = this._maxActionsPerNight - this._actionsThisNight;
            this._eventBus.emit('ceremony:actions_remaining', { remaining });

            // Check if night phase should end (1 action completed)
            if (this._actionsThisNight >= this._maxActionsPerNight) {
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
        const state = this._gameState.getState();
        const daySummary = this._calculateDaySummary(state);
        const maxDays = state.maxDays || this._maxDays;

        // Check for Day 7 Judgment (Episode 1 final evaluation)
        // Triggers when we've completed the LAST day's actions (Day 7)
        if (state.currentEpisode === 1 && state.day === maxDays) {
            this._triggerJudgmentScene(state);
            return;
        }

        // Check for Adapt/Pivot trigger (same action failed twice)
        const shouldTriggerPivot = this._checkPivotTrigger();

        this._eventBus.emit('ceremony:night_retro', {
            day: state.day,
            maxDays,
            summary: daySummary,
            triggerPivot: shouldTriggerPivot,
            pivotMessage: shouldTriggerPivot ?
                'このやり方は上手くいってない…アプローチを変えるべき？' : null,
            isSpiceCrisis: state.spiceCrisisActive
        });
    }

    /**
     * Trigger the Day 7 Judgment Scene (Episode 1 finale)
     * The Master tastes the Chimera Stew to determine if Fuji passes
     * Now uses checkChimeraStewRequirements() for skill-based evaluation
     */
    _triggerJudgmentScene(state) {
        // Use the parametric skill check system
        const skillCheck = this._gameState.checkChimeraStewRequirements();
        const isSuccess = skillCheck.passed;

        this._gameState.update({ judgmentTriggered: true });

        // Build skill report for dialogue
        const skillReport = this._buildSkillReport(skillCheck.details);

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
            const failureComment = this._getFailureComment(skillCheck.details);

            this._eventBus.emit('ceremony:judgment_failure', {
                growth: state.growth,
                skillCheck: skillCheck.details,
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

            // Force show retry button after a delay (ensure dialogue is rendered first)
            setTimeout(() => {
                this._forceShowRetryButton();
            }, 500);
        }
    }

    /**
     * Build skill report for judgment dialogue
     */
    _buildSkillReport(details) {
        const skillNames = {
            cutting: '包丁さばき',
            boiling: '煮込み',
            frying: '炒め',
            plating: '盛り付け'
        };

        const passedSkills = [];
        const failedSkills = [];

        Object.entries(details).forEach(([skill, data]) => {
            if (data.passed) {
                passedSkills.push(skillNames[skill]);
            } else {
                failedSkills.push({
                    name: skillNames[skill],
                    current: data.current,
                    required: data.required
                });
            }
        });

        // Master's comment based on performance
        let masterComment = '...ワシが2年かけた味を、7日で再現しおったか。';
        if (passedSkills.length === 4) {
            masterComment = '...完璧だ。この味...ワシを超える日も近いかもしれん。';
        } else if (details.boiling.passed && details.cutting.passed) {
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
        const failedSkills = [];

        if (!details.boiling.passed) failedSkills.push('煮込み');
        if (!details.cutting.passed) failedSkills.push('包丁');
        if (!details.frying.passed) failedSkills.push('炒め');
        if (!details.plating.passed) failedSkills.push('盛り付け');

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
        const currentDay = this._gameState.get('day');

        // Clear daily state (but keep pivotBonus - it should apply to NEXT day)
        this._dailyFocus = null;
        this._gameState.update({
            dailyFocus: null,
            dailyFocusEffect: null
            // NOTE: pivotBonus is cleared in selectDailyFocus() after being used
        });

        // Overnight stamina recovery (Power Pro style)
        // Recover stamina at night for the next day
        this._gameState.recoverStamina(40);

        // Also replenish some ingredients overnight (daily delivery)
        const currentIngredients = this._gameState.get('currentIngredients');
        if (currentIngredients < 3) {
            this._gameState.update({ currentIngredients: Math.min(5, currentIngredients + 2) });
        }

        // NOW advance the day counter (after retrospective is complete)
        const nextDay = currentDay + 1;
        this._gameState.advanceDay(); // This handles overnight recovery and day increment

        this._eventBus.emit('ceremony:day_complete', {
            completedDay: currentDay,
            nextDay: nextDay
        });

        // Check for game end conditions AFTER day advances
        this._checkGameEndConditions();
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
     * Force show retry button in judgment dialogue
     * @private
     */
    _forceShowRetryButton() {
        const dialogueEl = document.getElementById('judgment-dialogue');
        if (!dialogueEl) {
            console.warn('CeremonyManager: judgment-dialogue element not found');
            return;
        }

        // Check if button already exists
        if (document.getElementById('judgment-retry-btn')) {
            return;
        }

        // Create retry button with inline styles for visibility
        const retryButton = document.createElement('button');
        retryButton.id = 'judgment-retry-btn';
        retryButton.innerHTML = '🔄 修行をやり直す（Day 1へ）';
        
        // Mobile-responsive styles
        const isMobile = window.innerWidth <= 480;
        const buttonPadding = isMobile ? '15px' : '20px';
        const buttonFontSize = isMobile ? '1rem' : '1.3rem';
        
        retryButton.setAttribute('style', `
            width: 100%;
            max-width: 100%;
            padding: ${buttonPadding};
            margin-top: 30px;
            font-size: ${buttonFontSize};
            font-weight: 700;
            background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
            color: white;
            border: 3px solid #FFF;
            border-radius: 12px;
            cursor: pointer;
            box-shadow: 0 6px 20px rgba(76, 175, 80, 0.6);
            transition: all 0.3s ease;
            box-sizing: border-box;
        `);

        // Add hover effect
        retryButton.addEventListener('mouseenter', () => {
            retryButton.style.transform = 'translateY(-3px)';
            retryButton.style.boxShadow = '0 8px 25px rgba(76, 175, 80, 0.8)';
        });
        retryButton.addEventListener('mouseleave', () => {
            retryButton.style.transform = 'translateY(0)';
            retryButton.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.6)';
        });

        // Add click handler
        retryButton.addEventListener('click', () => {
            // Reset state
            this._gameState.update({
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

            // Reload page
            location.reload();
        });

        // Append button to dialogue container
        dialogueEl.appendChild(retryButton);
    }

    /**
     * Show reset button for game over
     * @private
     */
    _showResetButton() {
        // Check if button already exists
        if (document.getElementById('gameover-reset-btn')) {
            return;
        }

        // Create reset button with inline styles (mobile-responsive)
        const resetButton = document.createElement('button');
        resetButton.id = 'gameover-reset-btn';
        resetButton.textContent = '最初からやり直す（RESET）';
        
        // Mobile-responsive styles
        const isMobile = window.innerWidth <= 480;
        const buttonPadding = isMobile ? '15px 30px' : '15px 40px';
        const buttonFontSize = isMobile ? '1rem' : '1.2rem';
        const buttonWidth = isMobile ? '90%' : 'auto';
        const buttonMaxWidth = isMobile ? '90%' : 'none';
        
        resetButton.setAttribute('style', `
            position: fixed;
            bottom: 20%;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            padding: ${buttonPadding};
            width: ${buttonWidth};
            max-width: ${buttonMaxWidth};
            background: #333;
            color: #fff;
            border: 2px solid #fff;
            font-weight: bold;
            font-size: ${buttonFontSize};
            cursor: pointer;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
            transition: all 0.3s ease;
            box-sizing: border-box;
        `);

        // Add hover effect
        resetButton.addEventListener('mouseenter', () => {
            resetButton.style.background = '#555';
            resetButton.style.transform = 'translateX(-50%) translateY(-3px)';
            resetButton.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.7)';
        });
        resetButton.addEventListener('mouseleave', () => {
            resetButton.style.background = '#333';
            resetButton.style.transform = 'translateX(-50%) translateY(0)';
            resetButton.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.5)';
        });

        // Add click handler - complete reset
        resetButton.addEventListener('click', () => {
            // Clear all localStorage
            localStorage.clear();
            // Reload page for complete reset
            location.reload();
        });

        // Append to body
        document.body.appendChild(resetButton);
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
        this._spiceCrisisShown = false;
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
