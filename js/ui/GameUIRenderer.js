/**
 * GameUIRenderer - Renders game state to DOM
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
                2: 'CI/CD',
                3: '傾聴'
            },
            actionIcons: config.actionIcons || {
                1: '🍳',
                2: '🔧',
                3: '👥'
            }
        };

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this._eventBus.on(GameEvents.GAME_STATE_CHANGED, this._onStateChanged.bind(this));
        this._eventBus.on(GameEvents.UI_UPDATE_REQUESTED, this._onUpdateRequested.bind(this));
        this._eventBus.on(GameEvents.ACTION_EXECUTED, this._onActionExecuted.bind(this));
        this._eventBus.on(GameEvents.GAME_OVER, this._onGameOver.bind(this));
        this._eventBus.on(GameEvents.GAME_VICTORY, this._onVictory.bind(this));
        this._eventBus.on(GameEvents.EPISODE_COMPLETED, this._onEpisodeCompleted.bind(this));
    }

    // ===== Event Handlers =====

    _onStateChanged(data) {
        this._renderMeters(data.newState);
        this._renderStatus(data.newState);
        this._renderComboDisplay(data.newState);
        this._renderBalanceGauge(data.newState);
        this._renderEpisodeStatus(data.newState);
    }

    _onUpdateRequested(data) {
        if (data && data.state) {
            this._renderAll(data.state);
        }
    }

    _onActionExecuted(data) {
        this._triggerFujiBounce();
        this._renderResult(data.message);
    }

    _onGameOver(data) {
        const actionsEl = document.getElementById('actions');
        const gameoverEl = document.getElementById('gameover');

        if (actionsEl) actionsEl.style.display = 'none';
        if (gameoverEl) gameoverEl.classList.remove('hidden');
    }

    _onVictory(data) {
        const actionsEl = document.getElementById('actions');
        const endingEl = document.getElementById('ending');
        const messageEl = document.getElementById('message');

        if (actionsEl) actionsEl.style.display = 'none';
        if (endingEl) endingEl.classList.remove('hidden');
        if (messageEl) {
            messageEl.innerHTML = '<span class="victory">老店主がついにアジャイルを認めた！</span>';
        }
    }

    _onEpisodeCompleted(data) {
        const { episode } = data;
        if (episode === 1) {
            this._showEpisode1Clear();
        } else if (episode === 2) {
            const messageEl = document.getElementById('message');
            if (messageEl) {
                messageEl.innerHTML = '<span class="episode-clear">第2話クリア！</span> 変化への対応力を身につけた！';
            }
        }
    }

    // ===== Render Methods =====

    _renderAll(state) {
        this._renderMeters(state);
        this._renderStatus(state);
        this._renderComboDisplay(state);
        this._renderBalanceGauge(state);
        this._renderEpisodeStatus(state);
        this._renderChallenge(state);
    }

    _renderMeters(state) {
        const dayEl = document.getElementById('day');
        const stagnationValEl = document.getElementById('stagnation-val');
        const stagnationMeterEl = document.getElementById('stagnation-meter');
        const growthValEl = document.getElementById('growth-val');
        const growthMeterEl = document.getElementById('growth-meter');

        if (dayEl) dayEl.textContent = state.day;
        if (stagnationValEl) stagnationValEl.textContent = state.stagnation;
        if (stagnationMeterEl) stagnationMeterEl.style.width = `${state.stagnation}%`;
        if (growthValEl) growthValEl.textContent = state.growth;
        if (growthMeterEl) {
            growthMeterEl.style.width = `${(state.growth / this._config.maxGrowth) * 100}%`;
        }
    }

    _renderStatus(state) {
        const statusEl = document.getElementById('status-additional');
        if (!statusEl) return;

        let html = `
            <div class="status-row">
                <span class="status-label">老店主の機嫌</span>
                <span class="status-value">${state.oldManMood}/100</span>
            </div>
            <div class="status-row">
                <span class="status-label">食材の品質</span>
                <span class="status-value">${state.ingredientQuality}/100</span>
            </div>
            <div class="status-row">
                <span class="status-label">手持ち食材</span>
                <span class="status-value">${state.currentIngredients}個</span>
            </div>
        `;

        if (state.technicalDebt > 0) {
            html += `
                <div class="status-row warning">
                    <span class="status-label">技術的負債</span>
                    <span class="status-value debt">停滞度 +${state.technicalDebt}</span>
                </div>
            `;
        }

        if (state.stagnation >= 80) {
            html += '<div class="alert-box danger">停滞度が危険域！老店主の忍耐が限界に…</div>';
        } else if (state.ingredientQuality < 30) {
            html += '<div class="alert-box warning">品質警告！食材が劣化しています</div>';
        }

        statusEl.innerHTML = html;
    }

    _renderComboDisplay(state) {
        const comboEl = document.getElementById('combo-display');
        if (!comboEl) return;

        const { actionHistory, perfectCycleCount } = state;
        const isPerfect = this._isPerfectCycle(actionHistory);
        const missingActions = this._getMissingActions(actionHistory);

        let html = '<div class="combo-header">スプリントサイクル</div>';
        html += '<div class="combo-slots">';

        for (let i = 0; i < 3; i++) {
            const actualIndex = Math.max(0, actionHistory.length - 3) + i;
            if (actualIndex < actionHistory.length && actionHistory.length > i) {
                const act = actionHistory[actualIndex];
                html += `<div class="combo-slot filled">${this._config.actionIcons[act]}<span>${this._config.actionNames[act]}</span></div>`;
            } else {
                html += '<div class="combo-slot empty">?</div>';
            }
        }
        html += '</div>';

        if (isPerfect) {
            html += '<div class="combo-perfect">パーフェクトサイクル！</div>';
            if (perfectCycleCount > 1) {
                html += `<div class="combo-streak">${perfectCycleCount}連続！</div>`;
            }
        } else if (actionHistory.length >= 2 && missingActions.length === 1) {
            html += `<div class="combo-hint">次は「${this._config.actionNames[missingActions[0]]}」でパーフェクト！</div>`;
        }

        comboEl.innerHTML = html;
    }

    _renderBalanceGauge(state) {
        const indicator = document.getElementById('balance-indicator');
        const status = document.getElementById('balance-status');
        if (!indicator || !status) return;

        const position = 100 - state.traditionScore;
        indicator.style.left = `${position}%`;

        indicator.classList.remove('tradition-heavy', 'innovation-heavy', 'balanced');
        status.classList.remove('tradition', 'innovation', 'balanced');

        if (state.traditionScore >= 60) {
            indicator.classList.add('tradition-heavy');
            status.classList.add('tradition');
            status.textContent = '伝統寄り：革新が必要';
        } else if (state.traditionScore <= 40) {
            indicator.classList.add('innovation-heavy');
            status.classList.add('innovation');
            status.textContent = '革新寄り：伝統を尊重せよ';
        } else {
            indicator.classList.add('balanced');
            status.classList.add('balanced');
            status.textContent = '調和：伝統と革新のバランス';
        }
    }

    _renderEpisodeStatus(state) {
        const epStatusEl = document.getElementById('episode-status');
        if (!epStatusEl) return;

        const episodeGoals = {
            1: { goalGrowth: 20, goalBalance: true, message: '第1話：伝統を守りながら、変化を受け入れろ' },
            2: { goalSuccess: 2, message: '第2話：無理難題！異世界の顧客に対応せよ' },
            3: { goalGrowth: 50, goalMood: 80, message: '最終話：老店主にアジャイルを認めさせろ！' }
        };

        const epData = episodeGoals[state.currentEpisode];
        let html = `<div class="episode-title">${epData.message}</div>`;

        if (state.currentEpisode === 1) {
            const isBalanced = state.traditionScore >= 35 && state.traditionScore <= 65;
            const balanceStatus = isBalanced ? '達成' : '未達成';
            html += `<div class="episode-goal">目標：成長度 ${state.growth}/${epData.goalGrowth} ＆ バランス（${balanceStatus}）</div>`;
        } else if (state.currentEpisode === 2) {
            html += `<div class="episode-goal">目標：特殊客対応 ${state.specialChallengeSuccess}/${epData.goalSuccess}回</div>`;
        } else if (state.currentEpisode === 3) {
            html += `<div class="episode-goal">目標：成長度 ${state.growth}/${epData.goalGrowth} ＆ 店主機嫌 ${state.oldManMood}/${epData.goalMood}以上</div>`;
        }

        epStatusEl.innerHTML = html;
    }

    _renderChallenge(state) {
        const challengeEl = document.getElementById('todays-challenge');
        if (!challengeEl) return;

        const challenges = [
            '客足が多い日。迅速な対応（CI/CD）が重要！',
            '老店主が監視中。大きな変更（イテレーション試食）は控えめに。',
            '仕入れ問題発生。リソースを節約せよ！',
            '曖昧な注文が多い。ユーザーの声を聴く絶好の機会！',
            '古い設備（技術的負債）に注意。CI/CDに集中すべき日。'
        ];

        let html = '<div class="challenge-label">今日のスプリント目標</div>';

        if (state.specialCustomer) {
            html += `<div class="challenge-text urgent">緊急：${state.specialCustomer.name}の要求に対応せよ！</div>`;
        } else if (state.requirementChangeActive) {
            html += '<div class="challenge-text urgent">仕様変更：顧客が注文を変更しました！</div>';
        } else {
            const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];
            html += `<div class="challenge-text">${randomChallenge}</div>`;
        }

        challengeEl.innerHTML = html;
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
            messageEl.innerHTML = '<span class="episode-clear">第1話クリア：革新の第一歩</span>';
        }
    }

    // ===== Public Methods =====

    /**
     * Show game UI elements
     */
    showGameUI() {
        const elements = ['episode-card', 'challenge-card', 'status-card', 'actions-card', 'result-card'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = '';
        });
    }

    /**
     * Hide game UI elements
     */
    hideGameUI() {
        const elements = ['episode-card', 'challenge-card', 'status-card', 'actions-card', 'result-card'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    /**
     * Update all UI with given state
     * @param {Object} state - Game state
     */
    update(state) {
        this._renderAll(state);
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameUIRenderer };
}
