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
        
        // CRITICAL: Listen to action:consumed event to update UI immediately
        // This ensures buttons remain reactive after remainingActions changes
        this._eventBus.on('action:consumed', (data) => {
            console.log(`GameUIRenderer: Action consumed, remaining: ${data.remaining}, phase: ${data.phase}`);
            // The state update is already emitted by GameState.update() in consumeAction()
            // _onStateChanged will be called automatically, which triggers _renderAll()
            // No additional action needed here
        });
        this._eventBus.on(GameEvents.GAME_OVER, this._onGameOver.bind(this));
        this._eventBus.on(GameEvents.GAME_VICTORY, this._onVictory.bind(this));
        this._eventBus.on(GameEvents.EPISODE_COMPLETED, this._onEpisodeCompleted.bind(this));
        // Removed: PERFECT_CYCLE event listener
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
        
        // CRITICAL: Update UI immediately after action to ensure buttons remain reactive
        // This prevents the game from appearing "frozen" after an action
        const currentState = data.state || this._gameState?.getState();
        if (currentState) {
            // Force re-render action buttons to reflect new remainingActions
            this._renderActionButtons(currentState);
            this._updateActionButtonsForPhase(currentState);
        }
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
            messageEl.textContent = '老店主がついに成長を認めた！';
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

    // Removed: _onPerfectCycle method deleted

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
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;

        container.appendChild(el);

        setTimeout(() => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }, GameConfig.ui.floatingTextDuration);
    }

    // ===== Render Methods (with dirty-checking) =====

    _renderAll(state) {
        // Log current state for debugging
        console.log('GameUIRenderer: Rendering all UI, state:', {
            day: state.day,
            phase: state.currentPhase,
            stamina: state.stamina,
            dayActionsRemaining: state.dayActionsRemaining,
            nightActionsRemaining: state.nightActionsRemaining
        });
        
        // CRITICAL: Clear any leftover DOM elements from previous day
        // This prevents messages and UI elements from Day N-1 from persisting into Day N
        this._clearPreviousDayUI(state);
        
        this._renderScoreboard(state);
        this._renderChallenge(state);
        this._renderSkillPanel(state);
        this._renderStaminaBar(state);
        this._renderActionButtons(state);
        this._renderCondition(state);
        // CRITICAL: Always update action buttons based on current phase
        // This ensures buttons are correctly displayed for ALL days (Day 1-7)
        this._updateActionButtonsForPhase(state);
    }
    
    /**
     * Clear UI elements from previous day to prevent DOM pollution
     * @private
     */
    _clearPreviousDayUI(state) {
        // Clear result message
        const resultEl = this._getElement('result');
        if (resultEl) {
            resultEl.innerHTML = '';
        }
        
        // Clear action remaining counters if day changed
        const actionsUsedEl = document.getElementById('actions-used');
        if (actionsUsedEl && state.currentPhase === 'day') {
            // Day phase started, reset counter
            if (state.dayActionsRemaining === 3) {
                actionsUsedEl.textContent = '0';
            }
        }
        
        // Clear any floating text that might be lingering
        const floatingTextContainer = document.getElementById('floating-text-container');
        if (floatingTextContainer) {
            // Keep only recent floating texts (last 5)
            const floatingTexts = floatingTextContainer.querySelectorAll('.floating-text');
            if (floatingTexts.length > 5) {
                // Remove oldest ones
                for (let i = 0; i < floatingTexts.length - 5; i++) {
                    floatingTexts[i].remove();
                }
            }
        }
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

    // Removed: _renderMeters, _renderSecondaryStats, _renderBalanceGauge, _renderCycleDisplay methods deleted

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
        // CRITICAL: Safe access with null checks to prevent undefined errors
        const stamina = state?.stamina ?? GameConfig.stamina.initial;
        const policy = state?.currentPolicy || null;
        const phase = state?.currentPhase || 'day';
        
        // CRITICAL: Build costs object from GameConfig to prevent undefined access
        // GameConfig.actions.costs does not exist, so we build it from dayActions/nightActions
        const getActionCost = (actionId, phase) => {
            if (phase === 'day') {
                const dayActionMap = {
                    1: GameConfig.dayActions?.cleaning?.staminaCost ?? 10,  // 掃除・皿洗い
                    2: GameConfig.dayActions?.chopping?.staminaCost ?? 20,  // 下準備
                    3: GameConfig.dayActions?.heatControl?.staminaCost ?? 30 // 火の番
                };
                return dayActionMap[actionId] ?? 10;
            } else {
                const nightActionMap = {
                    1: GameConfig.nightActions?.trialCooking?.staminaCost ?? 25, // シチュー試作
                    2: GameConfig.nightActions?.study?.staminaCost ?? 15         // 研究
                };
                return nightActionMap[actionId] ?? 15;
            }
        };
        
        const costs = {
            1: getActionCost(1, phase),
            2: getActionCost(2, phase),
            3: getActionCost(3, phase),
            4: 0 // Rest action costs nothing
        };
        
        // SPECIFICATION COMPLIANCE: Clear container completely before re-rendering
        // This prevents "dead" event listeners from interfering with button clicks
        const actionsContainer = document.getElementById('actions');
        if (!actionsContainer) {
            console.error('GameUIRenderer: actions container not found');
            return;
        }
        
        // CRITICAL: Clear all existing buttons to prevent event listener duplication
        // This follows the specification: "innerHTML = '' で全消去してから再描画する"
        actionsContainer.innerHTML = '';
        
        // Calculate policy multipliers
        const getStaminaMultiplier = (policy) => {
            if (!policy) return 1.0;
            switch (policy) {
                case 'quality': return 1.2;
                case 'speed': return 0.5;
                case 'challenge': return 1.0; // 成功判定は動的
                default: return 1.0;
            }
        };
        
        const staminaMultiplier = getStaminaMultiplier(policy);
        const getPolicyLabel = (policy, baseCost) => {
            if (!policy) return '';
            const adjustedCost = Math.floor(baseCost * staminaMultiplier);
            switch (policy) {
                case 'quality':
                    return ` ※品質重視 (体力${adjustedCost})`;
                case 'speed':
                    return ` ※スピード重視 (体力${adjustedCost})`;
                case 'challenge':
                    return ` ※新しい挑戦 (成功時2倍/失敗時-30)`;
                default:
                    return '';
            }
        };

        // Re-create buttons based on current phase
        const buttons = [];
        
        if (phase === 'day') {
            // Day actions: 掃除・皿洗い, 下準備, 火の番, 休む
            const dayActionConfigs = [
                { id: 1, name: 'cleaning', icon: '&#x1F37D;', label: '掃除・皿洗い', cost: costs[1], class: 'cmd-orange', phase: 'day' },
                { id: 2, name: 'chopping', icon: '&#x1F52A;', label: '下準備', cost: costs[2], class: 'cmd-blue', phase: 'day' },
                { id: 3, name: 'heatControl', icon: '&#x1F525;', label: '火の番', cost: costs[3], class: 'cmd-green', phase: 'day' },
                { id: 4, name: 'rest', icon: '&#x1F4A4;', label: '休む', cost: 0, class: 'cmd-pink', phase: 'day' }
            ];
            
            dayActionConfigs.forEach(config => {
                let adjustedCost = config.cost;
                
                // Apply policy multiplier (except for rest)
                if (config.id !== 4 && policy) {
                    if (policy === 'challenge') {
                        adjustedCost = 30; // Challenge: show max cost (failure case)
                    } else {
                        adjustedCost = Math.floor(config.cost * staminaMultiplier);
                    }
                }
                
                const canAfford = stamina >= adjustedCost || config.id === 4;
                const policyLabel = config.id !== 4 ? getPolicyLabel(policy, config.cost) : '';
                
                const btn = document.createElement('button');
                btn.className = `pawa-cmd-btn ${config.class} day-action`;
                btn.setAttribute('data-action', config.id);
                btn.setAttribute('data-action-name', config.name);
                btn.disabled = !canAfford;
                if (!canAfford) btn.classList.add('disabled');
                
                btn.innerHTML = `
                    <span class="cmd-icon">${config.icon}</span>
                    <span class="cmd-label">${config.label}</span>
                    <span class="cmd-cost">${config.id === 4 ? `+${GameConfig.stamina.restRecovery}回復` : `体力${adjustedCost}${policyLabel}`}</span>
                `;
                
                // CRITICAL: Ensure buttons are clickable
                btn.style.pointerEvents = canAfford ? 'auto' : 'none';
                
                buttons.push(btn);
            });
        } else if (phase === 'night') {
            // Night actions: シチュー試作, 研究, 休息
            const nightActionConfigs = [
                { id: 1, name: 'trialCooking', icon: '&#x1F372;', label: 'シチュー試作', cost: costs[1] || 25, class: 'cmd-purple', phase: 'night' },
                { id: 2, name: 'study', icon: '&#x1F4D6;', label: '研究', cost: costs[2] || 15, class: 'cmd-cyan', phase: 'night' },
                { id: 3, name: 'rest', icon: '&#x1F4A4;', label: '休息', cost: 0, class: 'cmd-pink', phase: 'night' }
            ];
            
            nightActionConfigs.forEach(config => {
                const canAfford = stamina >= config.cost || config.id === 3;
                
                const btn = document.createElement('button');
                btn.className = `pawa-cmd-btn ${config.class} night-action`;
                btn.setAttribute('data-action', config.id);
                btn.setAttribute('data-action-name', config.name);
                btn.disabled = !canAfford;
                if (!canAfford) {
                    btn.classList.add('disabled');
                    btn.style.pointerEvents = 'none';
                    btn.style.opacity = '0.5';
                } else {
                    btn.style.pointerEvents = 'auto';
                    btn.style.opacity = '1';
                }
                
                btn.innerHTML = `
                    <span class="cmd-icon">${config.icon}</span>
                    <span class="cmd-label">${config.label}</span>
                    <span class="cmd-cost">${config.id === 3 ? `+${GameConfig.stamina.restRecovery}回復` : `体力${config.cost}`}</span>
                `;
                
                btn.style.zIndex = '10000'; // Ensure night buttons are on top
                
                buttons.push(btn);
            });
        }
        
        // CRITICAL: Attach event listeners directly to each button
        // This ensures buttons are reactive immediately after re-rendering
        // SPECIFICATION COMPLIANCE: "ボタンを描画するたびに、必ずイベントリスナーを登録し直す"
        buttons.forEach(btn => {
            // Attach click event listener that emits action execution event
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Don't execute if button is disabled
                if (btn.disabled || btn.classList.contains('disabled')) {
                    console.log('GameUIRenderer: Button disabled, ignoring click');
                    return;
                }
                
                const actionId = parseInt(btn.dataset.action, 10);
                const actionName = btn.dataset.actionName;
                
                console.log(`GameUIRenderer: Button clicked - actionId: ${actionId}, actionName: ${actionName}`);
                
                // CRITICAL: Emit action execution event via EventBus
                // This triggers GameApp.executeAction() -> KitchenEngine.executeAction() -> GameState.handleAction()
                this._eventBus.emit('ui:action_button_clicked', {
                    actionId,
                    actionName,
                    phase
                });
            });
            
            actionsContainer.appendChild(btn);
        });
        
        // Emit event to notify that buttons have been re-rendered
        this._eventBus.emit('ui:action_buttons_rendered', {
            phase,
            buttons
        });
        
        console.log(`GameUIRenderer: Re-rendered ${buttons.length} action buttons for phase: ${phase} with event listeners attached`);
    }

    _renderResult(message) {
        const resultEl = this._getElement('result');
        if (resultEl) {
            resultEl.innerHTML = message;
        }
    }

    // ===== Helper Methods =====

    // Removed: _isPerfectCycle, _getMissingActions methods deleted

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
        const day = state.day || 1;
        
        console.log(`GameUIRenderer: Updating action buttons for phase: ${phase}, day: ${day}`);
        
        const dayActions = document.querySelectorAll('.day-action');
        const nightActions = document.querySelectorAll('.night-action');
        
        console.log(`GameUIRenderer: Found ${dayActions.length} day actions, ${nightActions.length} night actions`);

        if (phase === 'day') {
            // Day phase: Show day actions, hide night actions
            console.log(`GameUIRenderer: Day ${day} - Showing day action buttons`);
            dayActions.forEach(btn => {
                btn.classList.remove('hidden');
                btn.style.display = 'flex';
                btn.style.visibility = 'visible';
                btn.style.pointerEvents = 'auto';
            });
            nightActions.forEach(btn => {
                btn.classList.add('hidden');
                btn.style.display = 'none';
                btn.style.pointerEvents = 'none';
            });
        } else if (phase === 'night') {
            console.log('GameUIRenderer: Night buttons rendered - Waiting for input');
            dayActions.forEach(btn => {
                btn.classList.add('hidden');
                btn.style.display = 'none';
                btn.style.pointerEvents = 'none';
            });
            nightActions.forEach(btn => {
                btn.classList.remove('hidden');
                // Force night buttons to be on top and clickable (highest z-index)
                btn.style.zIndex = '10000';
                btn.style.pointerEvents = 'auto';
                btn.style.position = 'relative';
                btn.style.display = 'flex';
                btn.style.visibility = 'visible';
                btn.disabled = false;
                btn.style.cursor = 'pointer';
                btn.style.opacity = '1';
                // Ensure button is not behind any transparent layers
                btn.style.position = 'relative';
                console.log(`GameUIRenderer: Showing night action button:`, btn.dataset.action, '- Button is clickable and waiting for input (z-index: 10000)');
            });
        }
    }

    /**
     * Handle phase changed event
     * @private
     */
    _onPhaseChanged(data) {
        const phase = data.phase || data.to || 'day';
        const day = data.day || this._prevState?.day || 1;
        
        console.log(`GameUIRenderer: Phase changed event received: phase=${phase}, day=${day}`);
        
        // Get full state from current state if available
        const state = { 
            currentPhase: phase,
            day: day
        };
        
        // Always update action buttons when phase changes
        // This ensures buttons are correctly displayed for ALL days (Day 1-7)
        this._updateActionButtonsForPhase(state);
        
        // Update action counter max
        const maxActions = phase === 'night' ? 1 : 3;
        const maxActionsEl = document.getElementById('actions-max');
        if (maxActionsEl) {
            maxActionsEl.textContent = maxActions;
            console.log(`GameUIRenderer: Updated actions-max to ${maxActions}`);
        }
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
