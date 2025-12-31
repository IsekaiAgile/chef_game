/**
 * CeremonyUIRenderer - Handles UI for Agile Ceremonies
 *
 * Renders:
 * - Phase transition telops
 * - Morning Stand-up overlay
 * - Night Retrospective overlay
 * - Actions remaining indicator
 */

class CeremonyUIRenderer {
    /**
     * @param {EventBus} eventBus
     */
    constructor(eventBus) {
        this._eventBus = eventBus;
        this._setupEventListeners();
    }

    _setupEventListeners() {
        // Phase transitions
        this._eventBus.on('ceremony:phase_changed', (data) => this._onPhaseChanged(data));
        this._eventBus.on('ceremony:transition_start', (data) => this._onTransitionStart(data));

        // Morning stand-up
        this._eventBus.on('ceremony:morning_standup', (data) => this._showMorningStandup(data));
        this._eventBus.on('ceremony:focus_selected', (data) => this._onFocusSelected(data));

        // Night retrospective
        this._eventBus.on('ceremony:night_retro', (data) => this._showNightRetro(data));
        this._eventBus.on('ceremony:pivot_executed', (data) => this._onPivotExecuted(data));
        this._eventBus.on('ceremony:pivot_declined', (data) => this._onPivotDeclined(data));
        this._eventBus.on('ceremony:day_complete', (data) => this._onDayComplete(data));

        // Action phase
        this._eventBus.on('ceremony:action_phase_start', () => this._showActionPhase());

        // Actions remaining update
        this._eventBus.on('ceremony:actions_remaining', (data) => {
            this.setActionsRemaining(data.remaining);
        });
    }

    // ===== PHASE TRANSITIONS =====

    _onPhaseChanged(data) {
        const { phase, day } = data;

        // Update game container class for day/night effect
        const container = document.getElementById('game-container');
        if (container) {
            container.classList.remove('morning-transition', 'night-transition');
            if (phase === 'morning') {
                container.classList.add('morning-transition');
            } else if (phase === 'night') {
                container.classList.add('night-transition');
            }
        }
    }

    _onTransitionStart(data) {
        const { to } = data;

        // Show telop based on phase
        if (to === 'morning') {
            this._showTelop('☀️', 'PLANNING PHASE', '毎朝の作戦会議');
        } else if (to === 'night') {
            this._showTelop('🌙', 'RETROSPECTIVE', '1日の振り返り');
        } else if (to === 'action') {
            this._showTelop('⚔️', 'KITCHEN BATTLE', '厨房の戦い');
        }
    }

    _showTelop(icon, text, subtext) {
        const telop = document.getElementById('phase-telop');
        const iconEl = document.getElementById('telop-icon');
        const textEl = document.getElementById('telop-text');
        const subtextEl = document.getElementById('telop-subtext');

        if (!telop) return;

        iconEl.textContent = icon;
        textEl.textContent = text;
        subtextEl.textContent = subtext;

        telop.classList.remove('hidden');

        // Auto-hide after 1.5s
        setTimeout(() => {
            telop.classList.add('hidden');
        }, 1500);
    }

    // ===== MORNING STAND-UP =====

    _showMorningStandup(data) {
        const { day, dialogues, focusOptions } = data;

        const overlay = document.getElementById('morning-standup');
        const dayEl = document.getElementById('standup-day');
        const dialogueContainer = document.getElementById('standup-dialogue');

        if (!overlay) return;

        // Update day
        if (dayEl) dayEl.textContent = day;

        // Render dialogues
        if (dialogueContainer) {
            dialogueContainer.innerHTML = dialogues.map(d => `
                <div class="dialogue-line">
                    <span class="dialogue-speaker">${d.speaker === 'narrator' ? '' : d.speaker + '：'}</span>
                    <span class="dialogue-text-line">${d.text}</span>
                </div>
            `).join('');
        }

        // Hide action phase elements
        this._hideActionPhase();

        // Show overlay
        overlay.classList.remove('hidden');
    }

    _onFocusSelected(data) {
        const overlay = document.getElementById('morning-standup');
        if (overlay) {
            overlay.classList.add('hidden');
        }

        // Show result notification
        this._showFocusNotification(data.message);
    }

    _showFocusNotification(message) {
        // Use floating text or result panel
        const resultPanel = document.querySelector('.pawa-result-panel');
        const resultEl = document.getElementById('result');
        if (resultEl) {
            resultEl.innerHTML = `<div class="event-box positive">${message}</div>`;
        }
    }

    // ===== ACTION PHASE =====

    _showActionPhase() {
        // Show game UI elements
        const commandMenu = document.querySelector('.pawa-command-menu');
        const actionsRemaining = document.getElementById('actions-remaining');

        if (commandMenu) commandMenu.style.display = '';
        if (actionsRemaining) actionsRemaining.classList.remove('hidden');

        // Initialize actions remaining to 3
        this.setActionsRemaining(3);
    }

    _hideActionPhase() {
        const commandMenu = document.querySelector('.pawa-command-menu');
        const actionsRemaining = document.getElementById('actions-remaining');

        if (commandMenu) commandMenu.style.display = 'none';
        if (actionsRemaining) actionsRemaining.classList.add('hidden');
    }

    /**
     * Update actions remaining display
     * @param {number} remaining
     */
    setActionsRemaining(remaining) {
        const countEl = document.getElementById('remaining-count');
        if (countEl) {
            countEl.textContent = remaining;

            // Add urgency color
            if (remaining === 1) {
                countEl.style.color = 'var(--pawa-red)';
            } else if (remaining === 2) {
                countEl.style.color = 'var(--pawa-orange)';
            } else {
                countEl.style.color = 'var(--pawa-green)';
            }
        }
    }

    // ===== NIGHT RETROSPECTIVE =====

    _showNightRetro(data) {
        const { day, summary, triggerPivot, pivotMessage } = data;

        const overlay = document.getElementById('night-retro');
        const dayEl = document.getElementById('retro-day');
        const pivotSection = document.getElementById('pivot-decision');

        if (!overlay) return;

        // Hide action phase
        this._hideActionPhase();

        // Update day
        if (dayEl) dayEl.textContent = day;

        // Update summary values
        this._updateSummaryValue('retro-growth', summary.growthChange);
        this._updateSummaryValue('retro-quality', summary.qualityChange);
        this._updateSummaryValue('retro-stagnation', summary.stagnationChange, true);
        this._updateSummaryValue('retro-mood', summary.moodChange);

        // Update focus used
        const focusEl = document.getElementById('retro-focus');
        if (focusEl) focusEl.textContent = summary.dailyFocus;

        // Show/hide pivot decision
        if (pivotSection) {
            if (triggerPivot) {
                pivotSection.classList.remove('hidden');
            } else {
                pivotSection.classList.add('hidden');
            }
        }

        // Generate lesson learned
        this._generateRetroLesson(summary);

        // Show overlay
        overlay.classList.remove('hidden');
    }

    _updateSummaryValue(elementId, value, invertColor = false) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const prefix = value >= 0 ? '+' : '';
        el.textContent = prefix + value;

        el.classList.remove('positive', 'negative');
        if (invertColor) {
            // For stagnation, lower is better
            el.classList.add(value <= 0 ? 'positive' : 'negative');
        } else {
            el.classList.add(value >= 0 ? 'positive' : 'negative');
        }
    }

    _generateRetroLesson(summary) {
        const lessonEl = document.getElementById('retro-lesson');
        if (!lessonEl) return;

        const lessons = [];

        if (summary.growthChange > 5) {
            lessons.push('「今日は大きく成長できた！」');
        } else if (summary.growthChange < 0) {
            lessons.push('「失敗から学ぶことも多い...」');
        }

        if (summary.failedActions >= 2) {
            lessons.push('「同じ失敗を繰り返さないようにしよう」');
        }

        if (summary.stagnationChange > 10) {
            lessons.push('「もっとバリエーションが必要だ」');
        }

        if (lessons.length === 0) {
            lessons.push('「明日はもっと上手くやれる」');
        }

        lessonEl.textContent = lessons[Math.floor(Math.random() * lessons.length)];
    }

    _onPivotExecuted(data) {
        const pivotSection = document.getElementById('pivot-decision');
        if (pivotSection) {
            pivotSection.innerHTML = `
                <div class="pivot-result">
                    <span class="pivot-icon">🔄</span>
                    <span class="pivot-result-text">${data.message}</span>
                </div>
            `;
        }
    }

    _onPivotDeclined(data) {
        const pivotSection = document.getElementById('pivot-decision');
        if (pivotSection) {
            pivotSection.classList.add('hidden');
        }
    }

    _onDayComplete(data) {
        // Retro will be closed by button click handler
    }

    /**
     * Hide night retrospective
     */
    hideNightRetro() {
        const overlay = document.getElementById('night-retro');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    /**
     * Hide morning standup
     */
    hideMorningStandup() {
        const overlay = document.getElementById('morning-standup');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CeremonyUIRenderer };
}
