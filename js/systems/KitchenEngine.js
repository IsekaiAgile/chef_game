/**
 * KitchenEngine - Core game mechanics
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles game action logic
 * - Open/Closed: New actions can be added via action handlers
 * - Dependency Inversion: Uses EventBus and GameState abstractions
 */

/**
 * @typedef {Object} ActionResult
 * @property {boolean} success - Whether action succeeded
 * @property {string} message - Result message HTML
 * @property {Object} stateChanges - State changes to apply
 */

class KitchenEngine {
    /**
     * @param {EventBus} eventBus - Event bus for communication
     * @param {GameState} gameState - Game state manager
     * @param {EpisodeManager} episodeManager - Episode manager (optional)
     */
    constructor(eventBus, gameState, episodeManager = null) {
        this._eventBus = eventBus;
        this._gameState = gameState;
        this._episodeManager = episodeManager;

        // Action handlers (Open/Closed: can be extended)
        this._actionHandlers = new Map();
        this._registerDefaultActions();

        // Event handlers
        this._eventHandlers = [];
        this._registerDefaultEvents();
    }

    /**
     * Set episode manager reference (for late binding)
     * @param {EpisodeManager} episodeManager
     */
    setEpisodeManager(episodeManager) {
        this._episodeManager = episodeManager;
    }

    /**
     * Get current episode modifiers
     * @returns {Object}
     */
    _getEpisodeModifiers() {
        if (this._episodeManager) {
            return this._episodeManager.getEpisodeModifiers();
        }
        return {
            qualityDecayRate: 1.0,
            orderFrequency: 1.0,
            ingredientConsumption: 1
        };
    }

    // ===== Action Registration (Open/Closed Principle) =====

    /**
     * Register an action handler
     * @param {number} actionId - Action ID
     * @param {Function} handler - Handler function (state) => ActionResult
     */
    registerAction(actionId, handler) {
        this._actionHandlers.set(actionId, handler);
    }

    /**
     * Register a random event
     * @param {Object} event - Event definition
     */
    registerEvent(event) {
        this._eventHandlers.push(event);
    }

    _registerDefaultActions() {
        // ===== PARAMETRIC TRAINING SYSTEM (Power Pro Style) =====
        // Each action costs stamina and grants skill experience
        // Skills: cutting (包丁), boiling (煮込み), frying (炒め), plating (盛り付け)
        // All balancing values are loaded from GameConfig

        /**
         * Action 1: 皿洗い (Dishwashing) - Low effort, foundation work
         * Teaches: Cutting basics through prep work
         * Stamina cost: Low (from GameConfig.actions.costs[1])
         */
        this.registerAction(1, (state, successRate, isCritical) => {
            const staminaCost = GameConfig.actions.costs[1];
            const expRewards = GameConfig.actions.expRewards[1];
            const failureExp = GameConfig.actions.failureExp[1];
            const success = Math.random() < successRate;
            let message = '';
            const changes = {};

            // Check stamina
            if (state.stamina < staminaCost) {
                return {
                    success: false,
                    message: '<div class="result-item failure">体力が足りない！休憩が必要だ。</div>',
                    stateChanges: {},
                    isCritical: false
                };
            }

            // Consume stamina
            changes.stamina = state.stamina - staminaCost;

            if (success) {
                // Grant cutting experience (from config)
                const cuttingExp = isCritical ? expRewards.cutting.critical : expRewards.cutting.base;
                const boilingExp = isCritical ? expRewards.boiling.critical : expRewards.boiling.base;

                message += `<div class="result-item success">皿洗い：包丁さばき経験 +${cuttingExp}</div>`;
                if (isCritical) {
                    message = `<div class="result-item critical">🌟 クリティカル！ 完璧な皿洗いで集中力UP！ 包丁 +${cuttingExp}、煮込み +${boilingExp}</div>`;
                    changes.stagnation = Math.max(0, state.stagnation - 10);
                }

                // Store exp gains for GameState to process
                changes._skillExpGains = { cutting: cuttingExp, boiling: boilingExp };
                changes.oldManMood = Math.min(100, state.oldManMood + (isCritical ? 5 : 2));
            } else {
                message = '<div class="result-item failure">皿洗い：お皿を割ってしまった…店主の機嫌が悪くなった。</div>';
                changes.oldManMood = Math.max(0, state.oldManMood - 5);
                changes._skillExpGains = { cutting: failureExp.cutting }; // Still learn from mistakes
            }

            return { success, message, stateChanges: changes, isCritical: success && isCritical };
        });

        /**
         * Action 2: 下準備 (Prep Work / Chopping) - Medium effort, builds foundation
         * Teaches: Cutting (primary) + Boiling (secondary)
         * Stamina cost: Medium (from GameConfig.actions.costs[2])
         */
        this.registerAction(2, (state, successRate, isCritical) => {
            const staminaCost = GameConfig.actions.costs[2];
            const expRewards = GameConfig.actions.expRewards[2];
            const failureExp = GameConfig.actions.failureExp[2];
            const success = Math.random() < successRate;
            let message = '';
            const changes = {};

            // Check stamina
            if (state.stamina < staminaCost) {
                return {
                    success: false,
                    message: '<div class="result-item failure">体力が足りない！休憩が必要だ。</div>',
                    stateChanges: {},
                    isCritical: false
                };
            }

            // Consume stamina
            changes.stamina = state.stamina - staminaCost;

            // Uses ingredients
            changes.currentIngredients = Math.max(0, state.currentIngredients - 1);

            if (success) {
                // Grant cutting and boiling experience (from config)
                const cuttingExp = isCritical ? expRewards.cutting.critical : expRewards.cutting.base;
                const boilingExp = isCritical ? expRewards.boiling.critical : expRewards.boiling.base;

                message += `<div class="result-item success">下準備：包丁 +${cuttingExp}、煮込み +${boilingExp}</div>`;
                if (isCritical) {
                    message = `<div class="result-item critical">🌟 クリティカル！ 完璧な下ごしらえ！ 包丁 +${cuttingExp}、煮込み +${boilingExp}</div>`;
                    changes.ingredientQuality = Math.min(100, state.ingredientQuality + 10);
                }

                changes._skillExpGains = { cutting: cuttingExp, boiling: boilingExp };
                changes.oldManMood = Math.min(100, state.oldManMood + (isCritical ? 8 : 3));
                changes.stagnation = Math.max(0, state.stagnation - (isCritical ? 15 : 5));
            } else {
                message = '<div class="result-item failure">下準備：食材の切り方が雑だった…品質が少し下がった。</div>';
                changes.ingredientQuality = Math.max(0, state.ingredientQuality - 5);
                changes._skillExpGains = { cutting: failureExp.cutting, boiling: failureExp.boiling };
            }

            return { success, message, stateChanges: changes, isCritical: success && isCritical };
        });

        /**
         * Action 3: 火の番 (Stovework) - High effort, advanced cooking
         * Teaches: Frying (primary) + Plating (secondary)
         * Stamina cost: High (from GameConfig.actions.costs[3])
         */
        this.registerAction(3, (state, successRate, isCritical) => {
            const staminaCost = GameConfig.actions.costs[3];
            const expRewards = GameConfig.actions.expRewards[3];
            const failureExp = GameConfig.actions.failureExp[3];
            const success = Math.random() < successRate;
            let message = '';
            const changes = {};

            // Check stamina
            if (state.stamina < staminaCost) {
                return {
                    success: false,
                    message: '<div class="result-item failure">体力が足りない！休憩が必要だ。</div>',
                    stateChanges: {},
                    isCritical: false
                };
            }

            // Consume stamina
            changes.stamina = state.stamina - staminaCost;

            // Uses ingredients
            changes.currentIngredients = Math.max(0, state.currentIngredients - 1);

            if (success) {
                // Grant frying and plating experience (from config)
                const fryingExp = isCritical ? expRewards.frying.critical : expRewards.frying.base;
                const platingExp = isCritical ? expRewards.plating.critical : expRewards.plating.base;

                message += `<div class="result-item success">火の番：炒め +${fryingExp}、盛り付け +${platingExp}</div>`;
                if (isCritical) {
                    message = `<div class="result-item critical">🌟 クリティカル！ 見事な火加減！ 炒め +${fryingExp}、盛り付け +${platingExp}</div>`;
                    changes.oldManMood = Math.min(100, state.oldManMood + 15);
                }

                changes._skillExpGains = { frying: fryingExp, plating: platingExp };
                changes.oldManMood = Math.min(100, state.oldManMood + (isCritical ? 15 : 5));
                changes.stagnation = Math.max(0, state.stagnation - (isCritical ? 20 : 8));
            } else {
                message = '<div class="result-item failure">火の番：火加減を間違えた…焦がしてしまった。</div>';
                changes.oldManMood = Math.max(0, state.oldManMood - 8);
                changes._skillExpGains = { frying: failureExp.frying, plating: failureExp.plating };
            }

            return { success, message, stateChanges: changes, isCritical: success && isCritical };
        });

        /**
         * Action 4: 休憩 (Rest) - Recover stamina
         * Recovery amount from GameConfig.stamina.restRecovery
         */
        this.registerAction(4, (state, successRate, isCritical) => {
            const staminaRecovery = GameConfig.stamina.restRecovery;
            const message = `<div class="result-item buff">休憩：体力が${staminaRecovery}回復した！</div>`;

            return {
                success: true,
                message,
                stateChanges: {
                    stamina: Math.min(state.maxStamina || GameConfig.stamina.max, state.stamina + staminaRecovery)
                },
                isCritical: false
            };
        });
    }

    _registerDefaultEvents() {
        // Negative events (60% chance when event triggers)
        this._negativeEvents = [
            {
                type: 'quality_drop',
                message: '設備劣化！品質が低下しました。',
                effect: (state) => ({ ingredientQuality: Math.max(0, state.ingredientQuality - 10) })
            },
            {
                type: 'oldman_grumble',
                message: '老店主がブツブツ言っている…',
                effect: (state) => ({ oldManMood: Math.max(0, state.oldManMood - 10) })
            },
            {
                type: 'slow_day',
                message: '閑散とした時間帯。やる気が少し落ちる。',
                effect: (state) => ({ stagnation: Math.min(100, state.stagnation + 5) })
            },
            {
                type: 'tech_debt',
                message: '古い設備が少し邪魔をする。',
                effect: (state) => ({ technicalDebt: state.technicalDebt + 2 })
            }
        ];

        // Positive events (40% chance when event triggers)
        this._positiveEvents = [
            {
                type: 'quality_bonus',
                message: '新鮮な食材が届いた！品質アップ！',
                effect: (state) => ({ ingredientQuality: Math.min(100, state.ingredientQuality + 15) })
            },
            {
                type: 'oldman_smile',
                message: '老店主が懐かしそうに微笑んでいる。',
                effect: (state) => ({ oldManMood: Math.min(100, state.oldManMood + 10) })
            },
            {
                type: 'busy_day',
                message: '活気のある日！お客様の笑顔が励みになる。',
                effect: (state) => ({ stagnation: Math.max(0, state.stagnation - 5), growth: state.growth + 2 })
            },
            {
                type: 'mina_help',
                message: 'ミナが手伝ってくれた！効率アップ！',
                effect: (state) => ({ technicalDebt: Math.max(0, state.technicalDebt - 2) })
            },
            {
                type: 'regular_customer',
                message: '常連さんが来店！「いつもありがとう！」',
                effect: (state) => ({ oldManMood: Math.min(100, state.oldManMood + 5), growth: state.growth + 1 })
            }
        ];

        // Keep legacy event handlers for compatibility
        this._eventHandlers = this._negativeEvents;
    }

    // ===== Main Action Execution =====

    /**
     * Execute a kitchen action
     * @param {number} actionId - Action ID (1, 2, or 3)
     * @returns {boolean} Whether action was executed
     */
    executeAction(actionId) {
        const state = this._gameState.getState();

        // Check if game can continue
        if (this._gameState.isGameOver() || this._gameState.isVictory()) {
            return false;
        }

        // Build result message (use current day, NOT incremented)
        let message = `<div class="day-header">DAY ${state.day} アクション</div>`;

        // Record action (day advances AFTER Night Retrospective, not here!)
        this._gameState.recordAction(actionId);
        // REMOVED: this._gameState.update({ day: state.day + 1 });
        // Day now advances in CeremonyManager._endRetrospective()

        // Apply technical debt effect
        if (state.technicalDebt > 0) {
            this._gameState.adjust('stagnation', Math.floor(state.technicalDebt / 5), 0, 100);
        }

        // Handle tradition score for Episode 1
        if (state.currentEpisode === 1) {
            this._updateTraditionScore(actionId);
        }

        // Check for stagnation (same action repeated)
        const stagnationResult = this._checkStagnation(actionId, state.lastAction);
        message += stagnationResult.message;

        // Check for perfect cycle
        const cycleResult = this._checkPerfectCycle();
        message += cycleResult.message;

        // Calculate success rate and check for critical
        const successRate = this._calculateSuccessRate(state, actionId);
        const isCritical = this._isCriticalSuccess();

        // Execute action
        const handler = this._actionHandlers.get(actionId);
        let actionResult = null;
        if (handler) {
            actionResult = handler(this._gameState.getState(), successRate, isCritical);
            message += actionResult.message;

            // Extract skill exp gains before updating state
            const skillExpGains = actionResult.stateChanges._skillExpGains;
            delete actionResult.stateChanges._skillExpGains;

            // Update regular state changes
            this._gameState.update(actionResult.stateChanges);

            // Process skill experience gains
            if (skillExpGains) {
                let levelUpMessage = '';
                for (const [skill, exp] of Object.entries(skillExpGains)) {
                    if (exp > 0) {
                        const result = this._gameState.addSkillExp(skill, exp);
                        if (result.levelUp) {
                            const skillNames = {
                                cutting: '包丁さばき',
                                boiling: '煮込み',
                                frying: '炒め',
                                plating: '盛り付け'
                            };
                            const grade = this._gameState.getSkillGrade(result.newLevel);
                            levelUpMessage += `<div class="result-item level-up">🎉 ${skillNames[skill]}がレベルアップ！ Lv.${result.newLevel} (${grade})</div>`;

                            // Emit level up event for UI effects
                            this._eventBus.emit('skill:level_up', {
                                skill,
                                newLevel: result.newLevel,
                                grade
                            });
                        }
                    }
                }
                if (levelUpMessage) {
                    message += levelUpMessage;
                }
            }

            // Emit critical success event for UI effects
            if (actionResult.isCritical) {
                this._eventBus.emit('action:critical_success', { actionId });
            }
        }

        // Apply end-of-turn effects with episode modifiers
        const modifiers = this._getEpisodeModifiers();
        const qualityDecay = Math.floor(-5 * modifiers.qualityDecayRate);
        this._gameState.adjust('ingredientQuality', qualityDecay, 0, 100);

        // Episode-specific end-of-turn effects
        const episodeEffects = this._applyEpisodeEffects(actionResult?.success);
        if (episodeEffects.message) {
            message += episodeEffects.message;
        }

        // Trigger random events
        const eventMessage = this._triggerEvents();
        message += eventMessage;

        // Add narrative end-of-turn comment
        const narrativeComment = this._getNarrativeComment(actionResult?.success, actionResult?.isCritical);
        if (narrativeComment) {
            message += narrativeComment;
        }

        // Cap growth
        const currentGrowth = this._gameState.get('growth');
        if (currentGrowth > state.maxGrowth) {
            this._gameState.update({ growth: state.maxGrowth });
        }

        // Emit action executed event
        this._eventBus.emit(GameEvents.ACTION_EXECUTED, {
            actionId,
            message,
            state: this._gameState.getState()
        });

        // NOTE: Game end and episode progress checks are now handled by CeremonyManager
        // after the Night Retrospective closes, not immediately after each action.
        // This ensures the player always sees the retrospective before victory/defeat.

        return true;
    }

    // ===== Helper Methods =====

    _updateTraditionScore(actionId) {
        const state = this._gameState.getState();
        let change = 0;

        if (actionId === 1) change = -8;      // Innovation
        else if (actionId === 2) change = 3;   // Slight tradition
        else if (actionId === 3) change = -5;  // Innovation

        this._gameState.adjust('traditionScore', change, 0, 100);
    }

    /**
     * Check for stagnation due to repeating the same action
     * Uses stagnation config values from GameConfig
     * @param {number} currentAction - Current action ID
     * @param {number} lastAction - Previous action ID
     * @returns {Object} Result with message and triggered status
     */
    _checkStagnation(currentAction, lastAction) {
        const stagnationConfig = GameConfig.stagnation;

        if (currentAction === lastAction) {
            this._gameState.adjust('stagnation', stagnationConfig.repeatPenalty, 0, 100);
            this._gameState.adjust('oldManMood', -5, 0, 100);
            this._gameState.adjust('technicalDebt', 2, 0, 100);
            this._gameState.adjust('traditionScore', 5, 0, 100);
            this._gameState.update({ perfectCycleCount: 0 });

            this._eventBus.emit('stagnation:crisis', {});

            return {
                message: '<div class="result-item negative">同じアクションの繰り返し！停滞度上昇、信頼低下。技術的負債 +2</div>',
                triggered: true
            };
        } else {
            this._gameState.adjust('stagnation', stagnationConfig.varietyReward, 0, 100);
            return {
                message: '<div class="result-item positive">新しいアプローチ！ルーティンを打破。</div>',
                triggered: false
            };
        }
    }

    /**
     * Check for and apply perfect cycle bonus
     * Uses perfect cycle bonuses from GameConfig
     * @returns {Object} Result with message and isPerfect status
     */
    _checkPerfectCycle() {
        if (this._gameState.isPerfectCycle()) {
            const count = this._gameState.get('perfectCycleCount') + 1;
            const pcConfig = GameConfig.stagnation.perfectCycle;

            const bonusGrowth = pcConfig.growthBonus + (count > 1 ? pcConfig.streakBonus : 0);
            const bonusStagnation = pcConfig.stagnationReduction + (count > 1 ? pcConfig.streakStagnationBonus : 0);
            const debtReduction = Math.min(this._gameState.get('technicalDebt'), pcConfig.debtReduction);

            this._gameState.adjust('growth', bonusGrowth, 0, 100);
            this._gameState.adjust('stagnation', -bonusStagnation, 0, 100);
            this._gameState.adjust('oldManMood', pcConfig.moodBonus, 0, 100);
            this._gameState.adjust('technicalDebt', -debtReduction, 0, 100);
            this._gameState.update({ perfectCycleCount: count });

            this._eventBus.emit(GameEvents.PERFECT_CYCLE, { count });

            let message = `<div class="result-item perfect">パーフェクトサイクル！ 成長 +${bonusGrowth}、停滞 -${bonusStagnation}、負債 -${debtReduction}</div>`;
            if (count > 1) {
                message += `<div class="result-item streak">${count}連続ボーナス！</div>`;
            }

            return { message, isPerfect: true };
        } else {
            this._gameState.update({ perfectCycleCount: 0 });
            return { message: '', isPerfect: false };
        }
    }

    /**
     * Calculate action success rate based on game state and modifiers
     * All rates and modifiers loaded from GameConfig.successRate
     *
     * @param {Object} state - Current game state
     * @param {number} actionId - Action being performed
     * @returns {number} Success rate (0.0 - 1.0)
     */
    _calculateSuccessRate(state, actionId) {
        const srConfig = GameConfig.successRate;
        let rate = srConfig.base;

        // Apply penalties from config
        if (state.ingredientQuality < 30) rate += srConfig.penalties.lowQuality;
        if (state.oldManMood < 30) rate += srConfig.penalties.lowMood;
        if (state.currentIngredients === 0 && actionId !== 2) rate += srConfig.penalties.noIngredients;
        if (state.technicalDebt > 10) rate += srConfig.penalties.highDebt;

        // Spice Crisis modifiers (Episode 1, Day 3-4)
        if (state.spiceCrisisActive) {
            if (actionId === 1) {
                rate += srConfig.spiceCrisisPenalty;
            }
        }

        // Daily Focus buffs (from Morning Stand-up)
        const focusEffect = state.dailyFocusEffect;
        if (focusEffect) {
            // Quality focus: success bonus for affected action
            if (focusEffect.successBonus && focusEffect.affectedAction === actionId) {
                rate += focusEffect.successBonus;
            }
            // Experiment focus: risk bonus
            // During Spice Crisis: Experiment gets bonus instead of penalty
            if (focusEffect.riskBonus) {
                if (state.spiceCrisisActive) {
                    rate += srConfig.bonuses.spiceCrisisExperiment;
                } else {
                    rate -= 0.10;
                }
            }
        }

        // Pivot bonus from previous day's retrospective
        if (state.pivotBonus) {
            rate += srConfig.bonuses.pivotBonus;
        }

        return Math.max(srConfig.minimum, rate);
    }

    /**
     * Check for Critical Success
     * Chance loaded from GameConfig.successRate.criticalChance
     * @returns {boolean} True if critical success triggered
     */
    _isCriticalSuccess() {
        return Math.random() < GameConfig.successRate.criticalChance;
    }

    _triggerEvents() {
        const state = this._gameState.getState();
        let message = '';

        // Special customer requirement change (Episode 2)
        if (state.specialCustomer && state.specialCustomer.canChangeReq && Math.random() < 0.3) {
            const newRequirements = [
                'やっぱりカリカリにして！',
                '待って、冷たいのがいい！',
                'キラキラを追加できる？'
            ];
            const newReq = newRequirements[Math.floor(Math.random() * newRequirements.length)];

            this._gameState.update({
                requirementChangeActive: true,
                specialCustomer: { ...state.specialCustomer, requirement: newReq },
                technicalDebt: state.technicalDebt + 5
            });

            this._eventBus.emit(GameEvents.REQUIREMENT_CHANGED, { newReq });
            message += `<div class="event-box scope-change">仕様変更！ ${state.specialCustomer.name}：「${newReq}」（技術的負債 +5）</div>`;
        }

        // Random events (balanced: 60% negative, 40% positive)
        if (Math.random() < 0.35) {
            const isNegative = Math.random() < 0.60;
            const eventPool = isNegative ? this._negativeEvents : this._positiveEvents;
            const event = eventPool[Math.floor(Math.random() * eventPool.length)];
            const eventClass = isNegative ? 'negative' : 'positive';
            message += `<div class="event-box ${eventClass}">${event.message}</div>`;

            const changes = event.effect(this._gameState.getState());
            this._gameState.update(changes);
        }

        // Special customer arrival (Episode 2)
        if (state.currentEpisode === 2 && !state.specialCustomer && Math.random() < 0.25) {
            const customers = [
                { name: 'スライム', requirement: 'プニプニ感を増したゲル', bonus: 15, canChangeReq: true },
                { name: 'ドラゴン', requirement: '炎を吐くスパイスブレンド', bonus: 25, canChangeReq: false }
            ];
            const customer = customers[Math.floor(Math.random() * customers.length)];

            this._gameState.update({ specialCustomer: customer });
            this._eventBus.emit(GameEvents.SPECIAL_CUSTOMER_ARRIVED, { customer });
            message += `<div class="event-box special">新規顧客：${customer.name}が「${customer.requirement}」を注文！</div>`;
        }

        return message;
    }

    /**
     * Get narrative end-of-turn comment from Owner or Mina
     * @param {boolean} wasSuccess - Whether the action succeeded
     * @param {boolean} wasCritical - Whether it was a critical success
     * @returns {string} HTML comment or empty string
     */
    _getNarrativeComment(wasSuccess, wasCritical) {
        const state = this._gameState.getState();

        // Critical success always gets a special comment
        if (wasCritical) {
            const criticalComments = [
                { speaker: 'ミナ', text: 'すごいすごい！フジくん天才！✨' },
                { speaker: '老店主', text: '…ふん、悪くないじゃないか。' },
                { speaker: 'ミナ', text: 'これがアジャイルの力だね！' }
            ];
            const comment = criticalComments[Math.floor(Math.random() * criticalComments.length)];
            return `<div class="narrative-comment critical"><span class="speaker">${comment.speaker}：</span>${comment.text}</div>`;
        }

        // 40% chance to show a narrative comment
        if (Math.random() > 0.40) return '';

        // Choose comment based on game state
        let comments = [];

        if (state.growth >= 15) {
            comments.push({ speaker: 'ミナ', text: '順調だよ、フジくん！' });
            comments.push({ speaker: '老店主', text: '…少しはマシになってきたか。' });
        }

        if (state.oldManMood >= 70) {
            comments.push({ speaker: '老店主', text: '今日の味は…まあ、認めてやろう。' });
        } else if (state.oldManMood <= 30) {
            comments.push({ speaker: 'ミナ', text: '店主さん、ちょっと機嫌悪いね…頑張ろう！' });
        }

        if (state.stagnation >= 25) {
            comments.push({ speaker: 'ミナ', text: '何か新しいこと試してみない？' });
        }

        if (wasSuccess) {
            comments.push({ speaker: 'ミナ', text: 'いい感じ！この調子！' });
            comments.push({ speaker: '老店主', text: '…続けろ。' });
        } else {
            comments.push({ speaker: 'ミナ', text: '大丈夫、次がある！' });
            comments.push({ speaker: '老店主', text: '失敗は経験だ。次に活かせ。' });
        }

        // Default encouraging comments
        comments.push({ speaker: 'ミナ', text: 'ファイトだよ、フジくん！' });
        comments.push({ speaker: '老店主', text: '…まだまだだな。' });

        const comment = comments[Math.floor(Math.random() * comments.length)];
        return `<div class="narrative-comment"><span class="speaker">${comment.speaker}：</span>${comment.text}</div>`;
    }

    /**
     * Apply episode-specific effects (Rival AI, Goblin orders, Princess demands)
     * @param {boolean} actionSuccess - Whether the action succeeded
     * @returns {Object} { message: string }
     */
    _applyEpisodeEffects(actionSuccess) {
        const state = this._gameState.getState();
        let message = '';

        switch (state.currentEpisode) {
            case 2: // Goblin - Track orders completed
                if (actionSuccess) {
                    this._gameState.update({ ordersCompleted: state.ordersCompleted + 1 });
                    message += `<div class="event-box positive">ゴブリンの注文完了！（${state.ordersCompleted + 1}/10）</div>`;
                } else {
                    // Failed order - goblin gets angry, consumes extra ingredients
                    const modifiers = this._getEpisodeModifiers();
                    const extraConsumption = modifiers.ingredientConsumption - 1;
                    if (extraConsumption > 0) {
                        this._gameState.adjust('currentIngredients', -extraConsumption, 0, 100);
                        message += `<div class="event-box negative">ゴブリンが怒って食材を追加消費！（-${extraConsumption}）</div>`;
                    }
                }
                break;

            case 4: // Rival battle - Srimon's AI
                const rivalResult = this._updateRivalAI();
                message += rivalResult.message;
                break;

            case 5: // Elf Princess - Demand system
                const princessResult = this._updatePrincessDemands(actionSuccess);
                message += princessResult.message;
                break;
        }

        return { message };
    }

    /**
     * Update Rival AI (Episode 4 - Srimon)
     * @returns {Object} { message: string }
     */
    _updateRivalAI() {
        const state = this._gameState.getState();
        const config = this._episodeManager?.getRivalConfig();

        if (!config) {
            return { message: '' };
        }

        // Rival grows each turn with some variability
        let rivalGrowth = config.baseGrowthPerTurn;

        // Add variability (-1 to +1)
        rivalGrowth += Math.floor(Math.random() * (config.variability * 2 + 1)) - config.variability;

        // Catch-up bonus if rival is behind
        if (state.rivalGrowth < state.growth) {
            rivalGrowth = Math.ceil(rivalGrowth * (1 + config.catchUpBonus));
        }

        const newRivalGrowth = state.rivalGrowth + rivalGrowth;
        this._gameState.update({ rivalGrowth: newRivalGrowth });

        // Emit rival update event
        this._eventBus.emit('rival:growth_update', {
            rivalGrowth: newRivalGrowth,
            playerGrowth: state.growth
        });

        const diff = state.growth - newRivalGrowth;
        let statusText = '';
        if (diff > 5) {
            statusText = 'リード中！';
        } else if (diff > 0) {
            statusText = 'わずかにリード';
        } else if (diff === 0) {
            statusText = '同点！';
        } else if (diff > -5) {
            statusText = 'やや劣勢...';
        } else {
            statusText = '追い上げろ！';
        }

        return {
            message: `<div class="event-box rival">スリモン成長: +${rivalGrowth}（${statusText}）</div>`
        };
    }

    /**
     * Update Princess demands (Episode 5)
     * @param {boolean} actionSuccess
     * @returns {Object} { message: string }
     */
    _updatePrincessDemands(actionSuccess) {
        const state = this._gameState.getState();
        const modifiers = this._getEpisodeModifiers();
        let message = '';

        if (actionSuccess) {
            // Success increases satisfaction
            const satisfactionGain = 10;
            this._gameState.adjust('princessSatisfaction', satisfactionGain, 0, 100);
            message += `<div class="event-box positive">姫の満足度 +${satisfactionGain}!</div>`;
        } else {
            // Failure increases anger
            const angerGain = 15;
            this._gameState.adjust('princessAnger', angerGain, 0, 100);
            message += `<div class="event-box negative">姫が不機嫌に！怒り +${angerGain}</div>`;
        }

        // Random demand change (40% chance)
        if (Math.random() < (modifiers.demandChangeChance || 0)) {
            const demands = [
                'もっとキラキラした感じにして！',
                'これじゃ物足りないわ。やり直し！',
                '...やっぱり最初のがいい。戻して。',
                'なんか違う。もっと...こう...エレガントに！'
            ];
            const newDemand = demands[Math.floor(Math.random() * demands.length)];
            this._gameState.update({ currentDemand: newDemand });
            message += `<div class="event-box scope-change">姫の要求変更：「${newDemand}」</div>`;
        }

        return { message };
    }

    _checkGameEnd() {
        if (this._gameState.isGameOver()) {
            this._eventBus.emit(GameEvents.GAME_OVER, {
                state: this._gameState.getState()
            });
        } else if (this._gameState.isVictory()) {
            this._eventBus.emit(GameEvents.GAME_VICTORY, {
                state: this._gameState.getState()
            });
        }
    }

    _checkEpisodeProgress() {
        const state = this._gameState.getState();

        // Episode 1 completion
        if (state.currentEpisode === 1 && state.growth >= 20 && this._gameState.isBalanced()) {
            this._eventBus.emit(GameEvents.EPISODE_COMPLETED, { episode: 1 });
        }

        // Episode 2 completion
        if (state.currentEpisode === 2 && state.specialChallengeSuccess >= 2) {
            this._gameState.startEpisode(3);
            this._eventBus.emit(GameEvents.EPISODE_COMPLETED, { episode: 2 });
        }

        // Hybrid moment trigger (Day 6)
        if (state.currentEpisode === 1 && state.day === 6 && !state.hybridMomentTriggered) {
            this._gameState.update({ hybridMomentTriggered: true });
            this._eventBus.emit('episode1:hybrid_moment', {});
        }
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { KitchenEngine };
}
