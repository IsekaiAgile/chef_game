/**
 * GameUIRenderer - Renders game state to DOM (Tokimeki/PowerPro Style)
 *
 * This renderer implements several performance optimizations:
 * - Dirty-checking: Only updates DOM elements when values actually change
 * - DOM caching: Caches element references to avoid repeated querySelector calls
 * - Debounced updates: Batches rapid state changes
 *
 * SOLID Principles:
 * - Single Responsibility: Only renders game UI elements
 * - Interface Segregation: Separate from dialogue UI rendering
 * - Dependency Inversion: Listens to EventBus, doesn't depend on GameState directly
 *
 * @class GameUIRenderer
 */
class GameUIRenderer {
    /**
     * @param {EventBus} eventBus - Event bus for communication
     * @param {Object} config - Configuration overrides
     */
    constructor(eventBus, config = {}) {
        this._eventBus = eventBus;
        this._config = {
            maxGrowth: config.maxGrowth || GameConfig.growth.max,
            actionNames: config.actionNames || {
                1: '皿洗い',
                2: '下準備',
                3: '火の番'
            },
            actionIcons: config.actionIcons || {
                1: '🍽',
                2: '🔪',
                3: '🔥'
            }
        };

        /**
         * Cache of previous state values for dirty-checking
         * @private
         * @type {Object}
         */
        this._cachedValues = {};

        /**
         * Cache of DOM element references
         * @private
         * @type {Map<string, HTMLElement>}
         */
        this._elementCache = new Map();

        /**
         * Track previous state for floating text effects
         * @private
         * @type {Object|null}
         */
        this._prevState = null;

        this._setupEventListeners();
        this._cacheElements();
    }

    /**
     * Cache DOM element references to avoid repeated lookups
     * @private
     */
    _cacheElements() {
        const elementIds = [
            'day', 'max-day', 'episode-num', 'episode-title',
            'growth-val', 'growth-meter', 'mood-val', 'reputation-meter',
            'stagnation-val', 'stagnation-warning',
            'quality-val', 'ingredients-val', 'debt-val',
            'balance-indicator', 'balance-status',
            'stamina-fill', 'stamina-val',
            'skill-cutting-level', 'skill-cutting-grade', 'skill-cutting-exp',
            'skill-boiling-level', 'skill-boiling-grade', 'skill-boiling-exp',
            'skill-frying-level', 'skill-frying-grade', 'skill-frying-exp',
            'skill-plating-level', 'skill-plating-grade', 'skill-plating-exp',
            'cycle-count', 'cycle-hint',
            'result', 'message', 'game-container', 'floating-text-container',
            'condition-icon', 'condition-text', 'condition-indicator', 'condition-value'
        ];

        elementIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) this._elementCache.set(id, el);
        });
    }

    /**
     * Get cached element or query DOM
     * @private
     * @param {string} id - Element ID
     * @returns {HTMLElement|null}
     */
    _getElement(id) {
        if (!this._elementCache.has(id)) {
            const el = document.getElementById(id);
            if (el) this._elementCache.set(id, el);
            return el;
        }
        return this._elementCache.get(id);
    }

    /**
     * Update element only if value changed (dirty-check)
     * @private
     * @param {string} cacheKey - Key for cached value
     * @param {*} newValue - New value to set
     * @param {Function} updateFn - Function to call if value changed
     * @returns {boolean} True if value was updated
     */
    _updateIfChanged(cacheKey, newValue, updateFn) {
        if (this._cachedValues[cacheKey] === newValue) {
            return false;
        }
        this._cachedValues[cacheKey] = newValue;
        updateFn(newValue);
        return true;
    }

    _setupEventListeners() {
        this._eventBus.on(GameEvents.GAME_STATE_CHANGED, this._onStateChanged.bind(this));
        this._eventBus.on(GameEvents.UI_UPDATE_REQUESTED, this._onUpdateRequested.bind(this));
        this._eventBus.on(GameEvents.ACTION_EXECUTED, this._onActionExecuted.bind(this));
        this._eventBus.on(GameEvents.GAME_OVER, this._onGameOver.bind(this));
        this._eventBus.on(GameEvents.GAME_VICTORY, this._onVictory.bind(this));
        this._eventBus.on(GameEvents.EPISODE_COMPLETED, this._onEpisodeCompleted.bind(this));
        this._eventBus.on(GameEvents.PERFECT_CYCLE, this._onPerfectCycle.bind(this));
        this._eventBus.on('action:critical_success', this._onCriticalSuccess.bind(this));
        this._eventBus.on('skill:level_up', this._onSkillLevelUp.bind(this));
        this._eventBus.on('ceremony:phase_changed', this._onPhaseChanged.bind(this));
        this._eventBus.on('condition:changed', this._onConditionChanged.bind(this));
    }

    // ===== Event Handlers =====

    _onStateChanged(data) {
        // Show floating text for stat changes
        if (this._prevState) {
            this._showStatChanges(this._prevState, data.newState);
        }
        this._prevState = { ...data.newState };

        this._renderAll(data.newState);
    }

    _onUpdateRequested(data) {
        if (data && data.state) {
            this._prevState = { ...data.state };
            // Force full re-render by clearing cache
            this._cachedValues = {};
            this._renderAll(data.state);
        }
    }

    _onActionExecuted(data) {
        this._triggerFujiBounce();
        this._renderResult(data.message);
    }

    _onGameOver(data) {
        const commandMenu = document.querySelector('.pawa-command-menu');
        const gameoverEl = document.getElementById('gameover');

        if (commandMenu) commandMenu.style.display = 'none';
        if (gameoverEl) gameoverEl.classList.remove('hidden');
    }

    _onVictory(data) {
        const commandMenu = document.querySelector('.pawa-command-menu');
        const endingEl = document.getElementById('ending');
        const messageEl = this._getElement('message');

        if (commandMenu) commandMenu.style.display = 'none';
        if (endingEl) endingEl.classList.remove('hidden');
        if (messageEl) {
            messageEl.textContent = '老店主がついにアジャイルを認めた！';
        }
    }

    _onEpisodeCompleted(data) {
        const { episode } = data;
        if (episode === 1) {
            this._showEpisode1Clear();
            this._spawnFloatingText('EPISODE 1 CLEAR!', 'perfect', window.innerWidth / 2, window.innerHeight / 3);
        } else if (episode === 2) {
            const messageEl = this._getElement('message');
            if (messageEl) {
                messageEl.textContent = '第2話クリア！ 変化への対応力を身につけた！';
            }
        }
    }

    _onPerfectCycle(data) {
        const gameContainer = this._getElement('game-container');
        if (gameContainer) {
            gameContainer.classList.add('screen-shake');
            setTimeout(() => gameContainer.classList.remove('screen-shake'),
                       GameConfig.ui.screenShakeDuration + 100);
        }

        const overlay = document.getElementById('perfect-agile-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.add('hidden'),
                       GameConfig.ui.perfectOverlayDuration);
        }

        const steps = document.querySelectorAll('.cycle-step');
        steps.forEach(step => {
            step.classList.add('perfect');
            setTimeout(() => step.classList.remove('perfect'), 2000);
        });

        this._eventBus.emit('mina:cheer_perfect_cycle', {
            message: 'すごい、フジくん！完璧なアジャイルサイクルだよ！'
        });
    }

    _onCriticalSuccess(data) {
        const gameContainer = this._getElement('game-container');
        if (gameContainer) {
            gameContainer.classList.add('screen-shake');
            setTimeout(() => gameContainer.classList.remove('screen-shake'),
                       GameConfig.ui.screenShakeDuration);
        }

        this._spawnFloatingText('🌟 CRITICAL!', 'perfect', window.innerWidth / 2, window.innerHeight / 3);

        const resultPanel = document.querySelector('.pawa-result-panel');
        if (resultPanel) {
            resultPanel.classList.add('critical-glow');
            setTimeout(() => resultPanel.classList.remove('critical-glow'),
                       GameConfig.ui.criticalGlowDuration);
        }
    }

    /**
     * Handle skill level up event
     * Shows celebratory notification
     * @param {Object} data - Event data with skill, newLevel, grade
     */
    _onSkillLevelUp(data) {
        const { skill, newLevel, grade } = data;
        const skillName = GameConfig.skills.names[skill] || skill;

        this._showLevelUpNotification(skillName, newLevel, grade);

        const skillItem = document.querySelector(`.skill-item[data-skill="${skill}"]`);
        if (skillItem) {
            skillItem.classList.add('level-up-glow');
            setTimeout(() => skillItem.classList.remove('level-up-glow'),
                       GameConfig.ui.levelUpDuration);
        }

        const gameContainer = this._getElement('game-container');
        if (gameContainer) {
            gameContainer.classList.add('screen-shake');
            setTimeout(() => gameContainer.classList.remove('screen-shake'), 300);
        }
    }

    /**
     * Show level-up notification overlay
     * @private
     */
    _showLevelUpNotification(skillName, newLevel, grade) {
        const notification = document.createElement('div');
        notification.className = 'level-up-notification';
        notification.innerHTML = `
            <div class="level-up-content">
                <div class="level-up-icon">🎉</div>
                <div class="level-up-title">LEVEL UP!</div>
                <div class="level-up-skill">${skillName}</div>
                <div class="level-up-detail">
                    <span class="level-up-level">Lv.${newLevel}</span>
                    <span class="level-up-grade grade-${grade.toLowerCase()}">${grade}</span>
                </div>
            </div>
        `;

        const container = this._getElement('game-container');
        if (container) {
            container.appendChild(notification);
        }

        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        setTimeout(() => {
            notification.classList.add('hide');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 500);
        }, GameConfig.ui.levelUpDuration);
    }

    // ===== Floating Text Effects =====

    _showStatChanges(prevState, newState) {
        const changes = [
            { key: 'growth', label: '成長', element: 'growth-meter' },
            { key: 'stagnation', label: '停滞', element: 'stagnation-val', invert: true },
            { key: 'oldManMood', label: '機嫌', element: 'mood-val' },
            { key: 'ingredientQuality', label: '品質', element: 'quality-val' }
        ];

        changes.forEach(({ key, label, element, invert }) => {
            const diff = newState[key] - prevState[key];
            if (diff !== 0) {
                const el = this._getElement(element);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    const isPositive = invert ? diff < 0 : diff > 0;
                    const text = diff > 0 ? `+${diff}` : `${diff}`;
                    this._spawnFloatingText(text, isPositive ? 'positive' : 'negative',
                                           rect.left + rect.width / 2, rect.top);
                }
            }
        });
    }

    _spawnFloatingText(text, type, x, y) {
        const container = this._getElement('floating-text-container');
        if (!container) return;

        const el = document.createElement('div');
        el.className = `floating-text ${type}`;
        el.textContent = text;
        
        // Clamp x/y to viewport bounds for mobile
        const clampedX = Math.max(10, Math.min(window.innerWidth - 50, x));
        const clampedY = Math.max(10, Math.min(window.innerHeight - 50, y));
        
        el.style.left = `${clampedX}px`;
        el.style.top = `${clampedY}px`;

        container.appendChild(el);

        setTimeout(() => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }, GameConfig.ui.floatingTextDuration);
    }

    // ===== Render Methods (with dirty-checking) =====

    _renderAll(state) {
        this._renderScoreboard(state);
        this._renderMeters(state);
        this._renderSecondaryStats(state);
        this._renderBalanceGauge(state);
        this._renderCycleDisplay(state);
        this._renderChallenge(state);
        this._renderSkillPanel(state);
        this._renderStaminaBar(state);
        this._renderActionButtons(state);
        this._renderCondition(state);
        this._updateActionButtonsForPhase(state);
    }

    _renderScoreboard(state) {
        this._updateIfChanged('day', state.day, (val) => {
            const el = this._getElement('day');
            if (el) el.textContent = val;
        });

        this._updateIfChanged('maxDays', state.maxDays || 7, (val) => {
            const el = this._getElement('max-day');
            if (el) el.textContent = val;
        });

        this._updateIfChanged('currentEpisode', state.currentEpisode, (val) => {
            const el = this._getElement('episode-num');
            if (el) el.textContent = val;

            const titleEl = this._getElement('episode-title');
            const episodeTitles = {
                1: '7日間の試用期間',
                2: 'ゴブリン襲来',
                3: 'ドラゴンの猛攻',
                4: 'ライバル対決',
                5: 'エルフ姫の宴'
            };
            if (titleEl) titleEl.textContent = episodeTitles[val] || '';
        });
    }

    _renderMeters(state) {
        // Growth gauge
        this._updateIfChanged('growth', state.growth, (val) => {
            const valEl = this._getElement('growth-val');
            const meterEl = this._getElement('growth-meter');

            if (valEl) valEl.textContent = val ?? 0;
            if (meterEl) {
                const maxGrowth = this._config.maxGrowth ?? GameConfig.growth?.max ?? 50;
                meterEl.style.width = `${((val ?? 0) / maxGrowth) * 100}%`;
            }
        });

        // Near-goal class
        const growthGaugeBlock = document.querySelector('.growth-gauge-block');
        if (growthGaugeBlock) {
            const nearGoal = state.growth >= 40;
            if (nearGoal !== this._cachedValues.nearGoal) {
                this._cachedValues.nearGoal = nearGoal;
                growthGaugeBlock.classList.toggle('near-goal', nearGoal);
            }
        }

        // Reputation gauge
        this._updateIfChanged('oldManMood', state.oldManMood, (val) => {
            const valEl = this._getElement('mood-val');
            const meterEl = this._getElement('reputation-meter');

            if (valEl) valEl.textContent = val;
            if (meterEl) meterEl.style.width = `${val}%`;
        });

        // Stagnation display
        this._updateIfChanged('stagnation', state.stagnation, (val) => {
            const valEl = this._getElement('stagnation-val');
            const warningEl = this._getElement('stagnation-warning');

            if (valEl) valEl.textContent = val ?? 0;
            if (warningEl) {
                const threshold = GameConfig.stagnation?.warningThreshold ?? 60;
                warningEl.style.display = (val ?? 0) >= threshold ? 'flex' : 'none';
            }
        });
    }

    _renderSecondaryStats(state) {
        this._updateIfChanged('ingredientQuality', state.ingredientQuality, (val) => {
            const el = this._getElement('quality-val');
            if (el) el.textContent = val;
        });

        this._updateIfChanged('currentIngredients', state.currentIngredients, (val) => {
            const el = this._getElement('ingredients-val');
            if (el) el.textContent = val;
        });

        this._updateIfChanged('technicalDebt', state.technicalDebt, (val) => {
            const el = this._getElement('debt-val');
            if (el) el.textContent = val;
        });
    }

    _renderBalanceGauge(state) {
        this._updateIfChanged('traditionScore', state.traditionScore, (val) => {
            const indicator = this._getElement('balance-indicator');
            const status = this._getElement('balance-status');

            if (indicator) {
                const position = 100 - val;
                indicator.style.left = `${position}%`;
            }

            if (status) {
                if (val >= 60) {
                    status.textContent = '伝統寄り：革新が必要！';
                    status.style.color = 'var(--sim-purple)';
                } else if (val <= 40) {
                    status.textContent = '革新寄り：伝統を尊重せよ！';
                    status.style.color = 'var(--sim-cyan)';
                } else {
                    status.textContent = '調和達成！バランス良好！';
                    status.style.color = 'var(--sim-yellow)';
                }
            }
        });
    }

    _renderCycleDisplay(state) {
        const { actionHistory, perfectCycleCount } = state;
        const historyKey = actionHistory.join(',');

        this._updateIfChanged('actionHistory', historyKey, () => {
            const isPerfect = this._isPerfectCycle(actionHistory);
            const missingActions = this._getMissingActions(actionHistory);
            const lastThree = actionHistory.slice(-3);
            const completedActions = new Set(lastThree);
            const uniqueCount = completedActions.size;

            // Update step indicators
            for (let i = 1; i <= 3; i++) {
                const stepEl = document.getElementById(`cycle-step-${i}`);
                if (stepEl) {
                    stepEl.classList.remove('completed', 'perfect');
                    if (completedActions.has(i)) {
                        stepEl.classList.add('completed');
                        if (isPerfect) stepEl.classList.add('perfect');
                    }
                }
            }

            // Update counter
            const cycleCountEl = this._getElement('cycle-count');
            if (cycleCountEl) cycleCountEl.textContent = uniqueCount;

            // Update hint
            const hintEl = this._getElement('cycle-hint');
            if (hintEl) {
                if (isPerfect) {
                    hintEl.innerHTML = `<span class="hint-perfect">パーフェクト！${perfectCycleCount > 1 ? ` ${perfectCycleCount}連続！` : ''}</span>`;
                } else if (uniqueCount >= 2 && missingActions.length === 1) {
                    hintEl.innerHTML = `次は「<strong>${this._config.actionNames[missingActions[0]]}</strong>」でパーフェクト！`;
                } else if (uniqueCount === 1) {
                    hintEl.textContent = 'あと2種類のアクションでサイクル完成！';
                } else {
                    hintEl.textContent = '3種類のアクションで完璧なサイクル！';
                }
            }
        });
    }

    _renderChallenge(state) {
        // Challenge changes less frequently, so dirty-check with composite key
        const challengeKey = `${state.day}-${state.specialCustomer?.name || ''}-${state.requirementChangeActive}`;

        this._updateIfChanged('challenge', challengeKey, () => {
            const challengeEl = document.getElementById('todays-challenge');
            if (!challengeEl) return;

            const challenges = [
                '客足が多い日。迅速な対応が重要！',
                '老店主が監視中。慎重に行動せよ。',
                '仕入れ問題発生。リソースを節約！',
                '曖昧な注文多し。傾聴の好機！',
                '設備劣化注意。整備に集中すべし。'
            ];

            let labelText = '今日の目標';
            let challengeText = '';

            if (state.specialCustomer) {
                labelText = '緊急依頼';
                challengeText = `${state.specialCustomer.name}の要求に対応せよ！`;
            } else if (state.requirementChangeActive) {
                labelText = '仕様変更';
                challengeText = '顧客が注文を変更しました！';
            } else {
                challengeText = challenges[state.day % challenges.length];
            }

            challengeEl.innerHTML = `
                <span class="event-label">${labelText}</span>
                <span class="event-text">${challengeText}</span>
            `;
        });
    }

    /**
     * Render skill panel (Power Pro style)
     * Uses dirty-checking to avoid unnecessary DOM updates
     * @private
     */
    _renderSkillPanel(state) {
        if (!state.skills || !state.experience) return;

        const skillKeys = ['cutting', 'boiling', 'frying', 'plating'];

        skillKeys.forEach((key) => {
            const level = state.skills[key] || 0;
            const exp = state.experience[key] || 0;
            const cacheKey = `skill-${key}`;
            const valueKey = `${level}-${exp}`;

            this._updateIfChanged(cacheKey, valueKey, () => {
                const grade = this._getSkillGrade(level);

                // Update level display
                const levelEl = this._getElement(`skill-${key}-level`);
                if (levelEl) levelEl.textContent = level;

                // Update grade display
                const gradeEl = this._getElement(`skill-${key}-grade`);
                if (gradeEl) {
                    gradeEl.textContent = grade;
                    gradeEl.className = `skill-grade grade-${grade.toLowerCase()}`;
                }

                // Update experience bar
                const expEl = this._getElement(`skill-${key}-exp`);
                if (expEl) {
                    expEl.style.width = `${exp}%`;
                }
            });
        });
    }

    /**
     * Get letter grade for skill level
     * @private
     */
    _getSkillGrade(level) {
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

    /**
     * Render stamina bar with color states
     * @private
     */
    _renderStaminaBar(state) {
        const stamina = state.stamina ?? GameConfig.stamina.initial;
        const maxStamina = state.maxStamina ?? GameConfig.stamina.max;
        const percentage = (stamina / maxStamina) * 100;
        const cacheKey = `stamina-${stamina}-${maxStamina}`;

        this._updateIfChanged('staminaBar', cacheKey, () => {
            const staminaFill = this._getElement('stamina-fill');
            if (staminaFill) {
                staminaFill.style.width = `${percentage}%`;

                // Update color class
                const thresholds = GameConfig.stamina.colorThresholds;
                staminaFill.classList.remove('stamina-high', 'stamina-medium', 'stamina-low', 'stamina-critical');

                if (percentage > thresholds.high) {
                    staminaFill.classList.add('stamina-high');
                } else if (percentage > thresholds.medium) {
                    staminaFill.classList.add('stamina-medium');
                } else if (percentage > thresholds.low) {
                    staminaFill.classList.add('stamina-low');
                } else {
                    staminaFill.classList.add('stamina-critical');
                }
            }

            const staminaVal = this._getElement('stamina-val');
            if (staminaVal) {
                staminaVal.textContent = Math.floor(stamina);
            }
        });
    }

    /**
     * Render action buttons with stamina costs and availability
     * @private
     */
    _renderActionButtons(state) {
        const stamina = state.stamina ?? GameConfig.stamina?.initial ?? 100;
        const costs = GameConfig.actions?.costs ?? { 1: 10, 2: 20, 3: 30, 4: 0 };

        // Only update if stamina changed
        this._updateIfChanged('actionButtons', stamina, () => {
            for (let actionId = 1; actionId <= 4; actionId++) {
                const btn = document.querySelector(`[data-action="${actionId}"]`);
                if (!btn) continue;

                const cost = costs[actionId] ?? 0;
                const canAfford = stamina >= cost || actionId === 4;

                btn.classList.toggle('disabled', !canAfford);
                btn.disabled = !canAfford;

                const costEl = btn.querySelector('.cmd-cost');
                if (costEl) {
                    const restRecovery = GameConfig.stamina?.restRecovery ?? 40;
                    costEl.textContent = actionId === 4
                        ? `+${restRecovery}回復`
                        : `体力${cost}`;
                }
            }

            // Highlight rest button if stamina is low
            const restBtn = document.getElementById('rest-btn');
            if (restBtn) {
                const lowThreshold = GameConfig.stamina?.lowThreshold ?? 25;
                restBtn.classList.toggle('recommended', stamina <= lowThreshold);
            }
        });
    }

    _renderResult(message) {
        const resultEl = this._getElement('result');
        if (resultEl) {
            resultEl.innerHTML = message;
        }
    }

    // ===== Helper Methods =====

    _isPerfectCycle(history) {
        if (history.length < 3) return false;
        const lastThree = history.slice(-3);
        return new Set(lastThree).size === 3;
    }

    _getMissingActions(history) {
        const lastTwo = history.slice(-2);
        return [1, 2, 3].filter(a => !lastTwo.includes(a));
    }

    _triggerFujiBounce() {
        const fujiImage = document.getElementById('fuji-image');
        if (fujiImage) {
            fujiImage.classList.add('action-bounce');
            setTimeout(() => fujiImage.classList.remove('action-bounce'), 600);
        }
    }

    _showEpisode1Clear() {
        const clearEl = document.getElementById('episode1-clear');
        const messageEl = this._getElement('message');

        if (clearEl) clearEl.classList.remove('hidden');
        if (messageEl) {
            messageEl.textContent = '第1話クリア：革新の第一歩';
        }
    }

    // ===== Public Methods =====

    /**
     * Show game UI elements
     */
    showGameUI() {
        const panels = [
            'pawa-top-hud', 'pawa-hero-layer', 'pawa-command-menu',
            'pawa-cycle-float', 'pawa-balance-float', 'pawa-bottom-hud',
            'pawa-dialogue-box', 'pawa-result-panel', 'pawa-skill-panel'
        ];

        panels.forEach(className => {
            const el = document.querySelector('.' + className);
            if (el) el.style.display = '';
        });

        const legacyIds = ['status-card', 'challenge-card', 'actions-card', 'result-card'];
        legacyIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = '';
        });
    }

    /**
     * Hide game UI elements
     */
    hideGameUI() {
        const panels = [
            'pawa-top-hud', 'pawa-hero-layer', 'pawa-command-menu',
            'pawa-cycle-float', 'pawa-balance-float', 'pawa-bottom-hud',
            'pawa-dialogue-box', 'pawa-result-panel', 'pawa-skill-panel'
        ];

        panels.forEach(className => {
            const el = document.querySelector('.' + className);
            if (el) el.style.display = 'none';
        });

        const legacyIds = ['status-card', 'challenge-card', 'actions-card', 'result-card'];
        legacyIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    /**
     * Update all UI with given state (forces full render)
     * @param {Object} state - Game state
     */
    update(state) {
        this._prevState = { ...state };
        this._cachedValues = {}; // Clear cache to force full update
        this._renderAll(state);
    }

    /**
     * Render condition (調子) indicator
     * @private
     */
    _renderCondition(state) {
        if (!state.condition) return;

        const conditionInfo = this._getConditionInfo(state.condition);
        const cacheKey = `condition-${state.condition}`;

        this._updateIfChanged('condition', cacheKey, () => {
            const iconEl = document.getElementById('condition-icon');
            const textEl = document.getElementById('condition-text');
            const conditionEl = document.getElementById('condition-indicator');

            if (iconEl) iconEl.textContent = conditionInfo.icon;
            if (textEl) textEl.textContent = conditionInfo.name;
            if (conditionEl) {
                conditionEl.className = `hud-block hud-condition condition-${state.condition}`;
            }
        });
    }

    /**
     * Get condition info
     * @private
     */
    _getConditionInfo(conditionId) {
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
     * Update action buttons based on current phase
     * @private
     */
    _updateActionButtonsForPhase(state) {
        const phase = state.currentPhase || 'day';
        const dayActions = document.querySelectorAll('.day-action');
        const nightActions = document.querySelectorAll('.night-action');

        if (phase === 'day') {
            dayActions.forEach(btn => btn.classList.remove('hidden'));
            nightActions.forEach(btn => btn.classList.add('hidden'));
        } else if (phase === 'night') {
            dayActions.forEach(btn => btn.classList.add('hidden'));
            nightActions.forEach(btn => btn.classList.remove('hidden'));
        }
        
        // Mobile: Ensure command menu is responsive
        const commandMenu = document.querySelector('.pawa-command-menu');
        if (commandMenu && window.innerWidth <= 480) {
            commandMenu.style.width = '95%';
            commandMenu.style.maxWidth = '95%';
        }
    }

    /**
     * Handle phase changed event
     * @private
     */
    _onPhaseChanged(data) {
        const state = { currentPhase: data.phase };
        this._updateActionButtonsForPhase(state);
        
        // Update action counter max
        const maxActions = data.phase === 'night' ? 1 : 3;
        const maxActionsEl = document.getElementById('actions-max');
        if (maxActionsEl) maxActionsEl.textContent = maxActions;
    }

    /**
     * Handle condition changed event
     * @private
     */
    _onConditionChanged(data) {
        const state = { condition: data.to };
        this._renderCondition(state);
    }

    /**
     * Clear element cache (useful after DOM changes)
     */
    clearCache() {
        this._elementCache.clear();
        this._cachedValues = {};
        this._cacheElements();
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameUIRenderer };
}
