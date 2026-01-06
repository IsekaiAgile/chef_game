/**
 * GameUIRenderer - Renders game state to DOM (Tokimeki/PowerPro Style)
 *
 * SOLID Principles:
 * - Single Responsibility: Only renders game UI elements
 * - Interface Segregation: Separate from dialogue UI rendering
 * - Dependency Inversion: Listens to EventBus, doesn't depend on GameState directly
 */
class GameUIRenderer {
    /**
     * @param {EventBus} eventBus - Event bus for communication
     * @param {Object} config - Configuration
     */
    constructor(eventBus, config = {}) {
        this._eventBus = eventBus;
        this._config = {
            maxGrowth: config.maxGrowth || 50,
            actionNames: config.actionNames || {
                1: '試食',
                2: '整備',
                3: '傾聴'
            },
            actionIcons: config.actionIcons || {
                1: '🍳',
                2: '🔧',
                3: '👂'
            }
        };

        // Track previous state for floating text effects
        this._prevState = null;

        this._setupEventListeners();
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
        const messageEl = document.getElementById('message');

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
            const messageEl = document.getElementById('message');
            if (messageEl) {
                messageEl.textContent = '第2話クリア！ 変化への対応力を身につけた！';
            }
        }
    }

    _onPerfectCycle(data) {
        // Screen shake effect
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.classList.add('screen-shake');
            setTimeout(() => gameContainer.classList.remove('screen-shake'), 500);
        }

        // Show PERFECT AGILE overlay
        const overlay = document.getElementById('perfect-agile-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.add('hidden'), 2500);
        }

        // Make all cycle steps pulse with perfect state
        const steps = document.querySelectorAll('.cycle-step');
        steps.forEach(step => {
            step.classList.add('perfect');
            setTimeout(() => step.classList.remove('perfect'), 2000);
        });

        // Trigger Mina's cheer
        this._eventBus.emit('mina:cheer_perfect_cycle', {
            message: 'すごい、フジくん！完璧なアジャイルサイクルだよ！'
        });
    }

    _onCriticalSuccess(data) {
        // Screen shake for critical success
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.classList.add('screen-shake');
            setTimeout(() => gameContainer.classList.remove('screen-shake'), 400);
        }

        // Show critical success floating text
        this._spawnFloatingText('🌟 CRITICAL!', 'perfect', window.innerWidth / 2, window.innerHeight / 3);

        // Add glow effect to result panel
        const resultPanel = document.querySelector('.pawa-result-panel');
        if (resultPanel) {
            resultPanel.classList.add('critical-glow');
            setTimeout(() => resultPanel.classList.remove('critical-glow'), 1500);
        }
    }

    // ===== Floating Text Effects =====

    _showStatChanges(prevState, newState) {
        const changes = [
            { key: 'growth', label: '成長', element: 'growth-meter' },
            { key: 'stagnation', label: '停滞', element: 'stagnation-meter', invert: true },
            { key: 'oldManMood', label: '機嫌', element: 'mood-val' },
            { key: 'ingredientQuality', label: '品質', element: 'quality-val' }
        ];

        changes.forEach(({ key, label, element, invert }) => {
            const diff = newState[key] - prevState[key];
            if (diff !== 0) {
                const el = document.getElementById(element);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    const isPositive = invert ? diff < 0 : diff > 0;
                    const text = diff > 0 ? `+${diff}` : `${diff}`;
                    this._spawnFloatingText(text, isPositive ? 'positive' : 'negative', rect.left + rect.width / 2, rect.top);
                }
            }
        });
    }

    _spawnFloatingText(text, type, x, y) {
        const container = document.getElementById('floating-text-container');
        if (!container) return;

        const el = document.createElement('div');
        el.className = `floating-text ${type}`;
        el.textContent = text;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;

        container.appendChild(el);

        // Remove after animation
        setTimeout(() => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }, 2000);
    }

    // ===== Render Methods =====

    _renderAll(state) {
        this._renderScoreboard(state);
        this._renderMeters(state);
        this._renderSecondaryStats(state);
        this._renderBalanceGauge(state);
        this._renderCycleDisplay(state);
        this._renderChallenge(state);
    }

    _renderScoreboard(state) {
        const dayEl = document.getElementById('day');
        const maxDayEl = document.getElementById('max-day');
        const episodeNumEl = document.getElementById('episode-num');
        const episodeTitleEl = document.getElementById('episode-title');

        // Show Day X / MaxDays format
        if (dayEl) dayEl.textContent = state.day;
        if (maxDayEl) maxDayEl.textContent = state.maxDays || 7;
        if (episodeNumEl) episodeNumEl.textContent = state.currentEpisode;

        const episodeTitles = {
            1: '7日間の試用期間',
            2: 'ゴブリン襲来',
            3: 'ドラゴンの猛攻',
            4: 'ライバル対決',
            5: 'エルフ姫の宴'
        };
        if (episodeTitleEl) {
            episodeTitleEl.textContent = episodeTitles[state.currentEpisode] || '';
        }
    }

    _renderMeters(state) {
        // Growth gauge
        const growthValEl = document.getElementById('growth-val');
        const growthMeterEl = document.getElementById('growth-meter');
        const growthGaugeBlock = document.querySelector('.growth-gauge-block');

        if (growthValEl) growthValEl.textContent = state.growth;
        if (growthMeterEl) {
            growthMeterEl.style.width = `${(state.growth / this._config.maxGrowth) * 100}%`;
        }

        // Add near-goal class when growth is >= 40 (80% of target)
        if (growthGaugeBlock) {
            if (state.growth >= 40) {
                growthGaugeBlock.classList.add('near-goal');
            } else {
                growthGaugeBlock.classList.remove('near-goal');
            }
        }

        // Reputation gauge (oldManMood)
        const moodValEl = document.getElementById('mood-val');
        const reputationMeterEl = document.getElementById('reputation-meter');
        if (moodValEl) moodValEl.textContent = state.oldManMood;
        if (reputationMeterEl) {
            reputationMeterEl.style.width = `${state.oldManMood}%`;
        }

        // Stagnation display
        const stagnationValEl = document.getElementById('stagnation-val');
        const stagnationWarning = document.getElementById('stagnation-warning');
        if (stagnationValEl) stagnationValEl.textContent = state.stagnation;

        // Show/hide stagnation warning based on level
        if (stagnationWarning) {
            if (state.stagnation >= 30) {
                stagnationWarning.style.display = 'flex';
            } else {
                stagnationWarning.style.display = 'none';
            }
        }
    }

    _renderSecondaryStats(state) {
        const moodEl = document.getElementById('mood-val');
        const qualityEl = document.getElementById('quality-val');
        const ingredientsEl = document.getElementById('ingredients-val');
        const debtEl = document.getElementById('debt-val');

        if (moodEl) moodEl.textContent = state.oldManMood;
        if (qualityEl) qualityEl.textContent = state.ingredientQuality;
        if (ingredientsEl) ingredientsEl.textContent = state.currentIngredients;
        if (debtEl) debtEl.textContent = state.technicalDebt;
    }

    _renderBalanceGauge(state) {
        const indicator = document.getElementById('balance-indicator');
        const status = document.getElementById('balance-status');
        if (!indicator || !status) return;

        // Position: 0 = full tradition (left), 100 = full innovation (right)
        const position = 100 - state.traditionScore;
        indicator.style.left = `${position}%`;

        if (state.traditionScore >= 60) {
            status.textContent = '伝統寄り：革新が必要！';
            status.style.color = 'var(--sim-purple)';
        } else if (state.traditionScore <= 40) {
            status.textContent = '革新寄り：伝統を尊重せよ！';
            status.style.color = 'var(--sim-cyan)';
        } else {
            status.textContent = '調和達成！バランス良好！';
            status.style.color = 'var(--sim-yellow)';
        }
    }

    _renderCycleDisplay(state) {
        const { actionHistory, perfectCycleCount } = state;
        const isPerfect = this._isPerfectCycle(actionHistory);
        const missingActions = this._getMissingActions(actionHistory);

        // Get last 3 actions to determine which steps are completed
        const lastThree = actionHistory.slice(-3);
        const completedActions = new Set(lastThree);
        const uniqueCount = completedActions.size;

        // Update step indicators (1=調理, 2=分析, 3=対話)
        for (let i = 1; i <= 3; i++) {
            const stepEl = document.getElementById(`cycle-step-${i}`);
            if (stepEl) {
                stepEl.classList.remove('completed', 'perfect');
                if (completedActions.has(i)) {
                    stepEl.classList.add('completed');
                    if (isPerfect) {
                        stepEl.classList.add('perfect');
                    }
                }
            }
        }

        // Update counter display
        const cycleCountEl = document.getElementById('cycle-count');
        if (cycleCountEl) {
            cycleCountEl.textContent = uniqueCount;
        }

        // Update hint text
        const hintEl = document.getElementById('cycle-hint');
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
    }

    _renderChallenge(state) {
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
    }

    _renderResult(message) {
        const resultEl = document.getElementById('result');
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
        const messageEl = document.getElementById('message');

        if (clearEl) clearEl.classList.remove('hidden');
        if (messageEl) {
            messageEl.textContent = '第1話クリア：革新の第一歩';
        }
    }

    // ===== Public Methods =====

    /**
     * Show game UI elements (Pawapuro-style panels)
     */
    showGameUI() {
        const panels = [
            'pawa-top-hud',
            'pawa-hero-layer',
            'pawa-command-menu',
            'pawa-cycle-float',
            'pawa-balance-float',
            'pawa-bottom-hud',
            'pawa-dialogue-box',
            'pawa-result-panel'
        ];

        // Show by class name
        panels.forEach(className => {
            const el = document.querySelector('.' + className);
            if (el) el.style.display = '';
        });

        // Also show by ID for legacy compatibility
        const legacyIds = ['status-card', 'challenge-card', 'actions-card', 'result-card'];
        legacyIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = '';
        });
    }

    /**
     * Hide game UI elements (Pawapuro-style panels)
     */
    hideGameUI() {
        const panels = [
            'pawa-top-hud',
            'pawa-hero-layer',
            'pawa-command-menu',
            'pawa-cycle-float',
            'pawa-balance-float',
            'pawa-bottom-hud',
            'pawa-dialogue-box',
            'pawa-result-panel'
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
     * Update all UI with given state
     * @param {Object} state - Game state
     */
    update(state) {
        this._prevState = { ...state };
        this._renderAll(state);
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameUIRenderer };
}
