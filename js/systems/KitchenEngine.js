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
     */
    constructor(eventBus, gameState) {
        this._eventBus = eventBus;
        this._gameState = gameState;

        // Action handlers (Open/Closed: can be extended)
        this._actionHandlers = new Map();
        this._registerDefaultActions();

        // Event handlers
        this._eventHandlers = [];
        this._registerDefaultEvents();
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
        // Action 1: イテレーション試食
        this.registerAction(1, (state, successRate) => {
            const success = Math.random() < successRate;
            let message = '';
            const changes = { currentIngredients: Math.max(0, state.currentIngredients - 1) };

            if (state.specialCustomer && success) {
                changes.growth = state.growth + state.specialCustomer.bonus;
                changes.specialChallengeSuccess = state.specialChallengeSuccess + 1;
                changes.specialCustomer = null;
                message = `<div class="result-item success">イテレーション試食：${state.specialCustomer.name}の要求をクリア！ 成長 +${state.specialCustomer.bonus}</div>`;
            } else if (success) {
                changes.growth = state.growth + 15;
                changes.stagnation = Math.max(0, state.stagnation - 15);
                changes.oldManMood = Math.min(100, state.oldManMood + 10);
                message = '<div class="result-item success">イテレーション試食：新しい味の組み合わせが成功！ 成長 +15</div>';
            } else {
                changes.oldManMood = Math.max(0, state.oldManMood - 15);
                changes.technicalDebt = state.technicalDebt + 1;
                message = '<div class="result-item failure">イテレーション試食：失敗！老店主が不満。技術的負債 +1</div>';
            }

            return { success, message, stateChanges: changes };
        });

        // Action 2: CI/CDメンテナンス
        this.registerAction(2, (state, successRate) => {
            const success = Math.random() < successRate;
            let message = '';
            const changes = {};

            if (success) {
                changes.ingredientQuality = Math.min(100, state.ingredientQuality + 30);
                changes.stagnation = Math.max(0, state.stagnation - 5);
                changes.currentIngredients = Math.min(5, state.currentIngredients + 2);
                changes.technicalDebt = Math.max(0, state.technicalDebt - 2);
                message = '<div class="result-item success">CI/CDメンテナンス：厨房を最適化！ 品質 +30、食材 +2、負債 -2</div>';
            } else {
                changes.ingredientQuality = Math.max(0, state.ingredientQuality - 10);
                message = '<div class="result-item failure">CI/CDメンテナンス：自動化失敗。品質が低下。</div>';
            }

            return { success, message, stateChanges: changes };
        });

        // Action 3: ユーザーフィードバック
        this.registerAction(3, (state, successRate) => {
            const success = Math.random() < successRate;
            let message = '';
            const changes = {};

            if (success) {
                changes.growth = state.growth + 20;
                changes.oldManMood = Math.min(100, state.oldManMood + 5);
                message = '<div class="result-item success">ユーザーの声：顧客から貴重な洞察を得た！ 成長 +20</div>';
            } else {
                message = '<div class="result-item neutral">ユーザーの声：顧客は「いつもの」を注文。特に収穫なし。</div>';
            }

            return { success, message, stateChanges: changes };
        });
    }

    _registerDefaultEvents() {
        this._eventHandlers = [
            {
                type: 'quality_drop',
                message: '設備劣化！品質が急低下しました。',
                effect: (state) => ({ ingredientQuality: Math.max(0, state.ingredientQuality - 20) })
            },
            {
                type: 'oldman_anger',
                message: '老店主の圧力：「なぜレシピ通りにやらん！」',
                effect: (state) => ({ oldManMood: Math.max(0, state.oldManMood - 20) })
            },
            {
                type: 'slow_day',
                message: '閑散とした日。革新を求める声がない。停滞度上昇。',
                effect: (state) => ({ stagnation: Math.min(100, state.stagnation + 10) })
            },
            {
                type: 'tech_debt',
                message: 'レガシーコード！古い厨房の習慣が足を引っ張る。',
                effect: (state) => ({ technicalDebt: state.technicalDebt + 3 })
            }
        ];
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

        // Calculate success rate
        const successRate = this._calculateSuccessRate(state, actionId);

        // Execute action
        const handler = this._actionHandlers.get(actionId);
        if (handler) {
            const result = handler(this._gameState.getState(), successRate);
            message += result.message;
            this._gameState.update(result.stateChanges);
        }

        // Apply end-of-turn effects
        this._gameState.adjust('ingredientQuality', -5, 0, 100);

        // Trigger random events
        const eventMessage = this._triggerEvents();
        message += eventMessage;

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
        let rate = 0.45;

        if (state.ingredientQuality < 30) rate -= 0.3;
        if (state.oldManMood < 30) rate -= 0.15;
        if (state.currentIngredients === 0 && actionId !== 2) rate -= 0.2;
        if (state.technicalDebt > 10) rate -= 0.1;

        return Math.max(0, rate);
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

        // Random events
        if (Math.random() < 0.35) {
            const event = this._eventHandlers[Math.floor(Math.random() * this._eventHandlers.length)];
            message += `<div class="event-box negative">${event.message}</div>`;

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
