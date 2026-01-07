/**
 * KitchenEngine - Core game mechanics for Success Mode
 *
 * SUCCESS MODE STYLE (パワプロ風サクセスモード)
 * Handles action execution with:
 * - Day actions: Chopping, Heat Control, Cleaning
 * - Night actions: Trial Cooking, Study, Rest
 * - Condition-based exp multipliers
 * - Dish Progress calculation
 *
 * @class KitchenEngine
 */
class KitchenEngine {
    /**
     * @param {EventBus} eventBus - Event bus for communication
     * @param {GameState} gameState - Game state manager
     */
    constructor(eventBus, gameState) {
        this._eventBus = eventBus;
        this._gameState = gameState;
        this._episodeManager = null;

        // Action handlers
        this._dayActionHandlers = new Map();
        this._nightActionHandlers = new Map();

        this._registerDayActions();
        this._registerNightActions();
    }

    // ===== EPISODE MANAGER =====

    /**
     * Set EpisodeManager reference for episode modifiers
     * @param {EpisodeManager} episodeManager - Episode manager instance
     */
    setEpisodeManager(episodeManager) {
        this._episodeManager = episodeManager;
    }

    // ===== ACTION REGISTRATION =====

    /**
     * Register daytime action handlers
     * @private
     */
    _registerDayActions() {
        const dayActions = GameConfig.dayActions;

        // 下準備 (Chopping) - Build cutting skill
        this._dayActionHandlers.set('chopping', (state) => {
            const config = dayActions.chopping;
            return this._executeDayAction(state, config, 'chopping');
        });

        // 火の番 (Heat Control) - Build boiling and frying
        this._dayActionHandlers.set('heatControl', (state) => {
            const config = dayActions.heatControl;
            return this._executeDayAction(state, config, 'heatControl');
        });

        // 掃除・皿洗い (Cleaning) - Reduce tech debt
        this._dayActionHandlers.set('cleaning', (state) => {
            const config = dayActions.cleaning;
            return this._executeCleaningAction(state, config);
        });
    }

    /**
     * Register nighttime action handlers
     * @private
     */
    _registerNightActions() {
        const nightActions = GameConfig.nightActions;

        // シチュー試作 (Trial Cooking) - Increase dish progress
        this._nightActionHandlers.set('trialCooking', (state) => {
            const config = nightActions.trialCooking;
            return this._executeTrialCooking(state, config);
        });

        // 研究 (Study) - Boost specific skill
        this._nightActionHandlers.set('study', (state, targetSkill) => {
            const config = nightActions.study;
            return this._executeStudy(state, config, targetSkill);
        });

        // 休息 (Rest) - Recover stamina, improve condition
        this._nightActionHandlers.set('rest', (state) => {
            const config = nightActions.rest;
            return this._executeRest(state, config);
        });
    }

    // ===== MAIN ACTION EXECUTION =====

    /**
     * Execute an action based on current phase
     * @param {number|string} actionId - Action identifier (1-4 for buttons, or action name string)
     * @param {Object} options - Additional options (e.g., targetSkill for study)
     * @returns {Object} Action result
     */
    executeAction(actionId, options = {}) {
        const state = this._gameState.getState();
        const phase = state.currentPhase;

        // Check game over
        if (this._gameState.isGameOver()) {
            return { success: false, message: 'ゲームオーバー' };
        }

        // Check actions remaining
        if (this._gameState.getActionsRemaining() <= 0) {
            return { success: false, message: 'アクションがありません' };
        }

        // Map button IDs to action names
        let actionName = null;
        if (typeof actionId === 'number') {
            // Legacy button IDs (1-4) -> map to action names
            if (phase === 'day') {
                const dayActionMap = {
                    1: 'cleaning',      // 皿洗い -> 掃除・皿洗い
                    2: 'chopping',      // 下準備
                    3: 'heatControl'    // 火の番
                };
                actionName = dayActionMap[actionId];
            } else if (phase === 'night') {
                const nightActionMap = {
                    1: 'trialCooking',  // シチュー試作
                    2: 'study',         // 研究
                    3: 'rest'           // 休息
                };
                actionName = nightActionMap[actionId];
            }
        } else {
            // Already an action name string
            actionName = actionId;
        }

        if (!actionName) {
            console.error(`KitchenEngine: Unknown action ID "${actionId}" for phase "${phase}"`);
            return { success: false, message: '不明なアクション' };
        }

        // Get appropriate handler
        const handlers = phase === 'day' ? this._dayActionHandlers : this._nightActionHandlers;
        const handler = handlers.get(actionName);

        if (!handler) {
            console.error(`KitchenEngine: Unknown action "${actionName}" for phase "${phase}"`);
            return { success: false, message: '不明なアクション' };
        }

        // Execute action
        const result = handler(state, options.targetSkill);

        if (result.success) {
            // Consume action
            this._gameState.consumeAction();

            // Record action (use action name, not button ID)
            this._gameState.recordAction(actionName);

            // Process skill exp gains
            if (result.expGains) {
                this._processExpGains(result.expGains, result);
            }

            // Emit action executed event
            this._eventBus.emit(GameEvents.ACTION_EXECUTED, {
                actionId: actionName,
                phase,
                message: result.message,
                result,
                state: this._gameState.getState()
            });
        }

        return result;
    }

    // ===== DAY ACTION HANDLERS =====

    /**
     * Execute a standard day action (chopping or heat control)
     * @private
     */
    _executeDayAction(state, config, actionType) {
        // Check stamina
        if (state.stamina < config.staminaCost) {
            return {
                success: false,
                message: `<div class="result-item failure">体力が足りない！（必要: ${config.staminaCost}）</div>`
            };
        }

        // Consume stamina
        this._gameState.consumeStamina(config.staminaCost);

        // Calculate success
        const successRate = this._calculateSuccessRate(state);
        const isCritical = this._isCriticalSuccess();
        const success = Math.random() < successRate;

        let message = '';
        const expGains = {};
        const conditionInfo = this._gameState.getConditionInfo();

        if (success) {
            // Calculate exp gains
            for (const [skill, rewards] of Object.entries(config.expRewards)) {
                const baseExp = isCritical ? rewards.bonus : rewards.base;
                expGains[skill] = baseExp;
            }

            message = `<div class="result-item success">${config.icon} ${config.name}成功！</div>`;

            if (isCritical) {
                message = `<div class="result-item critical">🌟 クリティカル！ ${config.name}が大成功！</div>`;
                this._eventBus.emit('action:critical_success', { actionType });
            }

            // Show exp gains
            for (const [skill, exp] of Object.entries(expGains)) {
                const skillName = GameConfig.skills.names[skill];
                const multiplier = conditionInfo.expMultiplier;
                const actualExp = Math.floor(exp * multiplier);
                message += `<div class="result-item exp-gain">${skillName} +${actualExp} EXP</div>`;
            }

            // Mood boost
            this._gameState.adjust('oldManMood', isCritical ? 8 : 3, 0, 100);

        } else {
            // Failure
            message = `<div class="result-item failure">${config.icon} ${config.name}失敗...</div>`;

            // Small exp even on failure (learning from mistakes)
            for (const [skill] of Object.entries(config.expRewards)) {
                expGains[skill] = 5;
            }

            // Add tech debt on failure
            this._gameState.increaseTechDebt(GameConfig.techDebt.failurePenalty);
            message += `<div class="result-item negative">技術的負債 +${GameConfig.techDebt.failurePenalty}</div>`;
        }

        // Show condition effect
        if (conditionInfo.expMultiplier !== 1.0) {
            const conditionText = conditionInfo.expMultiplier > 1
                ? `${conditionInfo.name}で経験値UP！ (x${conditionInfo.expMultiplier})`
                : `${conditionInfo.name}で経験値DOWN... (x${conditionInfo.expMultiplier})`;
            message += `<div class="result-item condition">${conditionInfo.icon} ${conditionText}</div>`;
        }

        return {
            success: true,
            actionSuccess: success,
            isCritical,
            message,
            expGains
        };
    }

    /**
     * Execute cleaning action (reduces tech debt)
     * @private
     */
    _executeCleaningAction(state, config) {
        // Check stamina
        if (state.stamina < config.staminaCost) {
            return {
                success: false,
                message: `<div class="result-item failure">体力が足りない！（必要: ${config.staminaCost}）</div>`
            };
        }

        // Consume stamina
        this._gameState.consumeStamina(config.staminaCost);

        // Always succeeds
        const reduction = config.techDebtReduction;
        const oldDebt = state.technicalDebt;
        this._gameState.reduceTechDebt(reduction);
        const newDebt = this._gameState.get('technicalDebt');
        const actualReduction = oldDebt - newDebt;

        let message = `<div class="result-item success">${config.icon} ${config.name}完了！</div>`;

        if (actualReduction > 0) {
            message += `<div class="result-item positive">技術的負債 -${actualReduction}</div>`;
        } else {
            message += `<div class="result-item neutral">厨房はすでにピカピカです</div>`;
        }

        // Small mood boost for keeping kitchen clean
        this._gameState.adjust('oldManMood', 2, 0, 100);
        message += `<div class="result-item positive">老店主の機嫌 +2</div>`;

        return {
            success: true,
            actionSuccess: true,
            message,
            expGains: {}
        };
    }

    // ===== NIGHT ACTION HANDLERS =====

    /**
     * Execute trial cooking (increases dish progress)
     * @private
     */
    _executeTrialCooking(state, config) {
        // Check stamina
        if (state.stamina < config.staminaCost) {
            return {
                success: false,
                message: `<div class="result-item failure">体力が足りない！（必要: ${config.staminaCost}）</div>`
            };
        }

        // Consume stamina
        this._gameState.consumeStamina(config.staminaCost);

        // Calculate dish progress gain
        const progressGain = this._gameState.calculateDishProgressGain();
        const conditionInfo = this._gameState.getConditionInfo();

        // Add progress
        const result = this._gameState.addDishProgress(progressGain);

        let message = `<div class="result-item success">${config.icon} ${config.name}完了！</div>`;
        message += `<div class="result-item dish-progress">名物料理の完成度 +${result.gained}%</div>`;
        message += `<div class="result-item dish-total">完成度: ${result.newProgress}% / ${GameConfig.dishProgress.victoryThreshold}%</div>`;

        // Show skill contribution breakdown
        const skills = state.skills;
        const weights = GameConfig.dishProgress.skillWeights;
        message += `<div class="result-item skill-contribution">スキル貢献: 包丁${Math.floor(skills.cutting * weights.cutting)} + 煮込み${Math.floor(skills.boiling * weights.boiling)} + 炒め${Math.floor(skills.frying * weights.frying)}</div>`;

        // Show condition effect
        if (conditionInfo.dishProgressBonus !== 1.0) {
            message += `<div class="result-item condition">${conditionInfo.icon} ${conditionInfo.name}効果 (x${conditionInfo.dishProgressBonus})</div>`;
        }

        // Analysis exp gain
        const expGains = {};
        for (const [skill, rewards] of Object.entries(config.expRewards)) {
            expGains[skill] = rewards.base;
        }

        // Check if dish is near completion
        if (result.newProgress >= GameConfig.dishProgress.victoryThreshold) {
            message += `<div class="result-item perfect">名物料理が完成レベルに達した！</div>`;
            this._eventBus.emit('dish:complete', { progress: result.newProgress });
        } else if (result.newProgress >= GameConfig.dishProgress.victoryThreshold - 20) {
            message += `<div class="result-item hint">もう少しで完成...</div>`;
        }

        return {
            success: true,
            actionSuccess: true,
            message,
            expGains,
            progressGain: result.gained
        };
    }

    /**
     * Execute study action (boost specific skill)
     * @private
     */
    _executeStudy(state, config, targetSkill) {
        // Validate target skill
        const validSkills = ['cutting', 'boiling', 'frying', 'analysis'];
        if (!validSkills.includes(targetSkill)) {
            return {
                success: false,
                message: `<div class="result-item failure">研究対象を選んでください</div>`
            };
        }

        // Check stamina
        if (state.stamina < config.staminaCost) {
            return {
                success: false,
                message: `<div class="result-item failure">体力が足りない！（必要: ${config.staminaCost}）</div>`
            };
        }

        // Consume stamina
        this._gameState.consumeStamina(config.staminaCost);

        // Calculate enhanced exp gain
        const baseExp = 30; // Base study exp
        const multipliedExp = Math.floor(baseExp * config.expMultiplier);

        const expGains = {
            [targetSkill]: multipliedExp
        };

        const skillName = GameConfig.skills.names[targetSkill];
        const conditionInfo = this._gameState.getConditionInfo();
        const actualExp = Math.floor(multipliedExp * conditionInfo.expMultiplier);

        let message = `<div class="result-item success">${config.icon} ${skillName}の研究完了！</div>`;
        message += `<div class="result-item exp-gain">${skillName} +${actualExp} EXP (研究ボーナス x${config.expMultiplier})</div>`;

        if (conditionInfo.expMultiplier !== 1.0) {
            message += `<div class="result-item condition">${conditionInfo.icon} ${conditionInfo.name}効果 (x${conditionInfo.expMultiplier})</div>`;
        }

        return {
            success: true,
            actionSuccess: true,
            message,
            expGains,
            targetSkill
        };
    }

    /**
     * Execute rest action (recover stamina, improve condition)
     * @private
     */
    _executeRest(state, config) {
        // Rest always succeeds and costs no stamina
        const recovery = config.staminaRecovery;
        const oldStamina = state.stamina;

        this._gameState.recoverStamina(recovery);
        const newStamina = this._gameState.get('stamina');
        const actualRecovery = newStamina - oldStamina;

        let message = `<div class="result-item success">${config.icon} ${config.name}完了！</div>`;
        message += `<div class="result-item positive">体力 +${actualRecovery}</div>`;

        // Try to improve condition
        const conditionImproved = Math.random() < config.conditionImproveChance;
        if (conditionImproved) {
            const oldCondition = state.condition;
            const newCondition = this._gameState.tryImproveCondition();

            if (newCondition !== oldCondition) {
                const newInfo = this._gameState.getConditionInfo();
                message += `<div class="result-item condition-up">${newInfo.icon} 調子が ${newInfo.name} になった！</div>`;
            } else {
                message += `<div class="result-item neutral">ゆっくり休めた</div>`;
            }
        } else {
            message += `<div class="result-item neutral">体力は回復したが、調子は変わらず</div>`;
        }

        return {
            success: true,
            actionSuccess: true,
            message,
            expGains: {},
            staminaRecovered: actualRecovery
        };
    }

    // ===== HELPER METHODS =====

    /**
     * Process exp gains and emit level up events
     * @private
     */
    _processExpGains(expGains, result) {
        let levelUpMessage = '';

        for (const [skill, baseExp] of Object.entries(expGains)) {
            if (baseExp > 0) {
                const expResult = this._gameState.addSkillExp(skill, baseExp);

                if (expResult.levelUp) {
                    const skillName = GameConfig.skills.names[skill];
                    const grade = this._gameState.getSkillGrade(expResult.newLevel);

                    levelUpMessage += `<div class="result-item level-up">🎉 ${skillName} LEVEL UP! Lv.${expResult.newLevel} (${grade})</div>`;

                    this._eventBus.emit('skill:level_up', {
                        skill,
                        newLevel: expResult.newLevel,
                        grade,
                        levelsGained: expResult.levelsGained
                    });
                }
            }
        }

        if (levelUpMessage) {
            result.message += levelUpMessage;
            result.hadLevelUp = true;
        }
    }

    /**
     * Calculate success rate based on state and condition
     * @private
     */
    _calculateSuccessRate(state) {
        const srConfig = GameConfig.successRate;
        let rate = srConfig.base;

        // Condition bonus/penalty
        rate += this._gameState.getConditionSuccessBonus();

        // Stamina penalties
        if (state.stamina < GameConfig.stamina.lowThreshold) {
            rate += srConfig.penalties.lowStamina;
        } else if (state.stamina > 80) {
            rate += srConfig.bonuses.highStamina;
        }

        // Tech debt penalty
        if (state.technicalDebt > GameConfig.techDebt.warningThreshold) {
            rate += srConfig.penalties.highDebt;
        } else if (state.technicalDebt < 5) {
            rate += srConfig.bonuses.lowDebt;
        }

        // Mood penalty
        if (state.oldManMood < 30) {
            rate += srConfig.penalties.lowMood;
        }

        return Math.max(srConfig.minimum, Math.min(srConfig.maximum, rate));
    }

    /**
     * Check for critical success
     * @private
     */
    _isCriticalSuccess() {
        return Math.random() < GameConfig.successRate.criticalChance;
    }

    /**
     * Get available actions for current phase
     * @returns {Object} Actions available
     */
    getAvailableActions() {
        const phase = this._gameState.get('currentPhase');

        if (phase === 'day') {
            return {
                chopping: GameConfig.dayActions.chopping,
                heatControl: GameConfig.dayActions.heatControl,
                cleaning: GameConfig.dayActions.cleaning
            };
        } else {
            return {
                trialCooking: GameConfig.nightActions.trialCooking,
                study: GameConfig.nightActions.study,
                rest: GameConfig.nightActions.rest
            };
        }
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { KitchenEngine };
}
