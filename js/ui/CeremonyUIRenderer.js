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

        // ===== EPISODE 1: 7-DAY SPRINT EVENTS =====

        // Spice Crisis (Day 3)
        this._eventBus.on('ceremony:spice_crisis', (data) => this._showSpiceCrisis(data));
        this._eventBus.on('ceremony:crisis_ended', (data) => this._showCrisisEnded(data));

        // Day 7 Judgment
        this._eventBus.on('ceremony:judgment_success', (data) => this._showJudgmentSuccess(data));
        this._eventBus.on('ceremony:judgment_failure', (data) => this._showJudgmentFailure(data));
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
        const { day, maxDays, dialogues, focusOptions, isSpiceCrisis } = data;

        const overlay = document.getElementById('morning-standup');
        const dayEl = document.getElementById('standup-day');
        const maxDayEl = document.getElementById('standup-max-day');
        const dialogueContainer = document.getElementById('standup-dialogue');
        const crisisIndicator = document.getElementById('crisis-indicator');

        if (!overlay) return;

        // Update day counter (Day X / 7 format)
        if (dayEl) dayEl.textContent = day;
        if (maxDayEl) maxDayEl.textContent = maxDays || 7;

        // Show/hide crisis indicator
        if (crisisIndicator) {
            if (isSpiceCrisis) {
                crisisIndicator.classList.remove('hidden');
            } else {
                crisisIndicator.classList.add('hidden');
            }
        }

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
        const { day, maxDays, summary, triggerPivot, pivotMessage, isSpiceCrisis } = data;

        const overlay = document.getElementById('night-retro');
        const dayEl = document.getElementById('retro-day');
        const maxDayEl = document.getElementById('retro-max-day');
        const pivotSection = document.getElementById('pivot-decision');

        if (!overlay) return;

        // Update max days counter
        if (maxDayEl) maxDayEl.textContent = maxDays || 7;

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

    // ===== EPISODE 1: SPICE CRISIS =====

    /**
     * Show Spice Crisis event (Day 3)
     */
    _showSpiceCrisis(data) {
        const overlay = document.getElementById('spice-crisis-overlay');
        if (!overlay) return;

        const titleEl = document.getElementById('crisis-title');
        const messageEl = document.getElementById('crisis-message');
        const effectEl = document.getElementById('crisis-effect');
        const dialogueEl = document.getElementById('crisis-dialogue');

        if (titleEl) titleEl.textContent = data.title;
        if (messageEl) messageEl.textContent = data.message;
        if (effectEl) effectEl.textContent = data.effect;

        if (dialogueEl && data.dialogues) {
            dialogueEl.innerHTML = data.dialogues.map(d => `
                <div class="crisis-dialogue-line">
                    <span class="crisis-speaker">${d.speaker === 'narrator' ? '' : d.speaker + '：'}</span>
                    <span class="crisis-text">${d.text}</span>
                </div>
            `).join('');
        }

        // Hide action phase
        this._hideActionPhase();

        overlay.classList.remove('hidden');
    }

    /**
     * Hide Spice Crisis overlay and continue to morning standup
     */
    hideSpiceCrisis() {
        const overlay = document.getElementById('spice-crisis-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    /**
     * Show crisis ended notification
     */
    _showCrisisEnded(data) {
        const resultEl = document.getElementById('result');
        if (resultEl) {
            resultEl.innerHTML = `<div class="event-box positive">${data.message}</div>`;
        }
    }

    // ===== EPISODE 1: DAY 7 JUDGMENT =====

    /**
     * Show Judgment Success scene
     */
    _showJudgmentSuccess(data) {
        const overlay = document.getElementById('judgment-overlay');
        if (!overlay) return;

        // Hide action phase
        this._hideActionPhase();

        const resultEl = document.getElementById('judgment-result');
        const growthEl = document.getElementById('judgment-growth');
        const dialogueEl = document.getElementById('judgment-dialogue');
        const rewardEl = document.getElementById('judgment-reward');
        const continueBtn = document.getElementById('judgment-continue');

        overlay.classList.remove('hidden');
        overlay.classList.add('success');
        overlay.classList.remove('failure');

        if (resultEl) resultEl.textContent = '採用決定！';
        if (growthEl) growthEl.textContent = `成長: ${data.growth} / ${data.requiredGrowth}`;

        if (dialogueEl && data.dialogues) {
            dialogueEl.innerHTML = data.dialogues.map(d => `
                <div class="judgment-dialogue-line">
                    <span class="judgment-speaker">${d.speaker === 'narrator' ? '' : d.speaker + '：'}</span>
                    <span class="judgment-text">${d.text}</span>
                </div>
            `).join('');
        }

        if (rewardEl && data.reward) {
            rewardEl.innerHTML = `
                <div class="reward-badge">
                    <span class="reward-icon">🔪</span>
                    <span class="reward-name">${data.reward.item}</span>
                    <span class="reward-desc">${data.reward.description}</span>
                </div>
            `;
            rewardEl.classList.remove('hidden');
        }

        if (continueBtn) {
            continueBtn.textContent = '第2話へ進む';
            continueBtn.dataset.action = 'next-episode';
        }
    }

    /**
     * Show Judgment Failure scene
     */
    _showJudgmentFailure(data) {
        const overlay = document.getElementById('judgment-overlay');
        if (!overlay) return;

        // Hide action phase
        this._hideActionPhase();

        const resultEl = document.getElementById('judgment-result');
        const growthEl = document.getElementById('judgment-growth');
        const dialogueEl = document.getElementById('judgment-dialogue');
        const rewardEl = document.getElementById('judgment-reward');
        const continueBtn = document.getElementById('judgment-continue');

        overlay.classList.remove('hidden');
        overlay.classList.add('failure');
        overlay.classList.remove('success');

        if (resultEl) resultEl.textContent = '不採用...';
        if (growthEl) growthEl.textContent = `成長: ${data.growth} / ${data.requiredGrowth}`;

        if (dialogueEl && data.dialogues) {
            dialogueEl.innerHTML = data.dialogues.map(d => `
                <div class="judgment-dialogue-line">
                    <span class="judgment-speaker">${d.speaker === 'narrator' ? '' : d.speaker + '：'}</span>
                    <span class="judgment-text">${d.text}</span>
                </div>
            `).join('');
        }

        if (rewardEl) {
            rewardEl.classList.add('hidden');
        }

        if (continueBtn) {
            continueBtn.textContent = '再挑戦';
            continueBtn.dataset.action = 'restart';
        }
    }

    /**
     * Hide Judgment overlay
     */
    hideJudgment() {
        const overlay = document.getElementById('judgment-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CeremonyUIRenderer };
}
