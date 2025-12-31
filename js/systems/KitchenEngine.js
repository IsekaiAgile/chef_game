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
        // Action 1: イテレーション試食 (Iteration Tasting / Cooking)
        this.registerAction(1, (state, successRate, isCritical) => {
            const success = Math.random() < successRate;
            let message = '';
            const changes = {};

            // Speed focus: No ingredient consumption
            const focusEffect = state.dailyFocusEffect;
            if (focusEffect && focusEffect.noIngredientCost) {
                message += '<div class="result-item buff">⚡ スピード重視：食材消費なし！</div>';
            } else {
                changes.currentIngredients = Math.max(0, state.currentIngredients - 1);
            }

            // Experiment focus: Extra rewards if successful
            const experimentBonus = (focusEffect && focusEffect.riskBonus && success) ? 1.5 : 1;

            if (state.specialCustomer && success) {
                const bonus = isCritical ? state.specialCustomer.bonus * 2 : state.specialCustomer.bonus;
                changes.growth = state.growth + bonus;
                changes.specialChallengeSuccess = state.specialChallengeSuccess + 1;
                changes.specialCustomer = null;
                if (isCritical) {
                    changes.technicalDebt = 0;  // Critical resets debt!
                    message = `<div class="result-item critical">🌟 クリティカル！ ${state.specialCustomer.name}が大絶賛！ 成長 +${bonus}、負債リセット！</div>`;
                } else {
                    message = `<div class="result-item success">イテレーション試食：${state.specialCustomer.name}の要求をクリア！ 成長 +${bonus}</div>`;
                }
            } else if (success) {
                const baseGrowth = isCritical ? 30 : 15;
                const growthGain = Math.floor(baseGrowth * experimentBonus);
                const stagnationReduce = isCritical ? 30 : 15;
                const moodGain = isCritical ? 20 : 10;
                changes.growth = state.growth + growthGain;
                changes.stagnation = Math.max(0, state.stagnation - stagnationReduce);
                changes.oldManMood = Math.min(100, state.oldManMood + moodGain);
                if (isCritical) {
                    changes.technicalDebt = 0;  // Critical resets debt!
                    message += `<div class="result-item critical">🌟 クリティカル！ 完璧な新味！ 成長 +${growthGain}、負債リセット！</div>`;
                } else {
                    const bonusText = experimentBonus > 1 ? ' (挑戦ボーナス!)' : '';
                    message += `<div class="result-item success">調理：新しい味が成功！ 成長 +${growthGain}${bonusText}</div>`;
                }
            } else {
                changes.oldManMood = Math.max(0, state.oldManMood - 10);  // Reduced from -15
                changes.technicalDebt = state.technicalDebt + 1;
                message = '<div class="result-item failure">イテレーション試食：うーん、もう少し工夫が必要かも。技術的負債 +1</div>';
            }

            return { success, message, stateChanges: changes, isCritical: success && isCritical };
        });

        // Action 2: CI/CDメンテナンス (Maintenance)
        this.registerAction(2, (state, successRate, isCritical) => {
            const success = Math.random() < successRate;
            let message = '';
            const changes = {};

            if (success) {
                const qualityGain = isCritical ? 50 : 30;
                const ingredientGain = isCritical ? 4 : 2;
                const debtReduce = isCritical ? state.technicalDebt : 2;  // Critical clears all debt
                changes.ingredientQuality = Math.min(100, state.ingredientQuality + qualityGain);
                changes.stagnation = Math.max(0, state.stagnation - (isCritical ? 15 : 5));
                changes.currentIngredients = Math.min(5, state.currentIngredients + ingredientGain);
                changes.technicalDebt = Math.max(0, state.technicalDebt - debtReduce);
                if (isCritical) {
                    message = `<div class="result-item critical">🌟 クリティカル！ 厨房が完璧に最適化！ 品質 +${qualityGain}、食材 +${ingredientGain}、負債リセット！</div>`;
                } else {
                    message = `<div class="result-item success">CI/CDメンテナンス：厨房を最適化！ 品質 +${qualityGain}、食材 +${ingredientGain}、負債 -2</div>`;
                }
            } else {
                changes.ingredientQuality = Math.max(0, state.ingredientQuality - 5);  // Reduced from -10
                message = '<div class="result-item failure">CI/CDメンテナンス：少し手間取った。品質 -5</div>';
            }

            return { success, message, stateChanges: changes, isCritical: success && isCritical };
        });

        // Action 3: ユーザーフィードバック (User Feedback)
        this.registerAction(3, (state, successRate, isCritical) => {
            const success = Math.random() < successRate;
            let message = '';
            const changes = {};

            if (success) {
                const growthGain = isCritical ? 40 : 20;
                const moodGain = isCritical ? 15 : 5;
                changes.growth = state.growth + growthGain;
                changes.oldManMood = Math.min(100, state.oldManMood + moodGain);
                if (isCritical) {
                    changes.technicalDebt = 0;  // Critical resets debt!
                    changes.stagnation = Math.max(0, state.stagnation - 20);
                    message = `<div class="result-item critical">🌟 クリティカル！ 顧客が大ファンに！ 成長 +${growthGain}、負債リセット！</div>`;
                } else {
                    message = `<div class="result-item success">ユーザーの声：顧客から貴重な洞察を得た！ 成長 +${growthGain}</div>`;
                }
            } else {
                // Neutral outcome instead of pure failure - less punishing
                changes.oldManMood = Math.min(100, state.oldManMood + 2);  // Small consolation
                message = '<div class="result-item neutral">ユーザーの声：顧客は満足げに「いつもの」を注文。安定した日。</div>';
            }

            return { success, message, stateChanges: changes, isCritical: success && isCritical };
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

        // Build result message
        let message = `<div class="day-header">DAY ${state.day} 振り返り</div>`;

        // Record action and advance day
        this._gameState.recordAction(actionId);
        this._gameState.update({ day: state.day + 1 });

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
            this._gameState.update(actionResult.stateChanges);

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

        // Check game end conditions
        this._checkGameEnd();

        // Check episode progress
        this._checkEpisodeProgress();

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

    _checkStagnation(currentAction, lastAction) {
        if (currentAction === lastAction) {
            this._gameState.adjust('stagnation', 12, 0, 100);
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
            this._gameState.adjust('stagnation', -7, 0, 100);
            return {
                message: '<div class="result-item positive">新しいアプローチ！ルーティンを打破。</div>',
                triggered: false
            };
        }
    }

    _checkPerfectCycle() {
        if (this._gameState.isPerfectCycle()) {
            const count = this._gameState.get('perfectCycleCount') + 1;
            const bonusGrowth = 10 + (count > 1 ? 5 : 0);
            const bonusStagnation = 15 + (count > 1 ? 5 : 0);
            const debtReduction = Math.min(this._gameState.get('technicalDebt'), 3);

            this._gameState.adjust('growth', bonusGrowth, 0, 100);
            this._gameState.adjust('stagnation', -bonusStagnation, 0, 100);
            this._gameState.adjust('oldManMood', 5, 0, 100);
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

    _calculateSuccessRate(state, actionId) {
        // GAME DESIGN OVERHAUL: Increased from 0.45 to 0.65 for "Feel-Good" experience
        let rate = 0.65;

        // Penalties are now less harsh to maintain fun factor
        if (state.ingredientQuality < 30) rate -= 0.20;
        if (state.oldManMood < 30) rate -= 0.10;
        if (state.currentIngredients === 0 && actionId !== 2) rate -= 0.15;
        if (state.technicalDebt > 10) rate -= 0.05;

        // Daily Focus buffs (from Morning Stand-up)
        const focusEffect = state.dailyFocusEffect;
        if (focusEffect) {
            // Quality focus: +10% success for cooking (Action 1)
            if (focusEffect.successBonus && focusEffect.affectedAction === actionId) {
                rate += focusEffect.successBonus;
            }
            // Experiment focus: risk bonus (-10% but more reward)
            if (focusEffect.riskBonus) {
                rate -= 0.10;
            }
        }

        // Pivot bonus from previous day's retrospective (+15%)
        if (state.pivotBonus) {
            rate += 0.15;
        }

        return Math.max(0.15, rate);  // Minimum 15% chance
    }

    /**
     * Check for Critical Success (10% chance)
     * @returns {boolean}
     */
    _isCriticalSuccess() {
        return Math.random() < 0.10;
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
