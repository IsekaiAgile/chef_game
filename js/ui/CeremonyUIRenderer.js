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
        this._eventBus.on('ceremony:judgment_failure_shown', (data) => this._showContinueScreen(data));
        this._eventBus.on('ceremony:continue_screen_hide', () => this._hideContinueScreen());
    }

    // ===== PHASE TRANSITIONS =====

    _onPhaseChanged(data) {
        const { phase, day } = data;

        // Update game container class for day/night effect
        const container = document.getElementById('game-container');
        if (container) {
            container.classList.remove('morning-transition', 'night-transition', 'day-transition');
            if (phase === 'day') {
                container.classList.add('day-transition');
            } else if (phase === 'night') {
                container.classList.add('night-transition');
            }
        }

        // Update Phase Indicator in HUD
        this._updatePhaseIndicator(phase);
        
        // Update action buttons visibility
        this._updateActionButtonsVisibility(phase);
    }

    /**
     * Update action buttons visibility based on phase
     * @private
     */
    _updateActionButtonsVisibility(phase) {
        const dayActions = document.querySelectorAll('.day-action');
        const nightActions = document.querySelectorAll('.night-action');

        if (phase === 'day') {
            dayActions.forEach(btn => btn.classList.remove('hidden'));
            nightActions.forEach(btn => btn.classList.add('hidden'));
        } else if (phase === 'night') {
            dayActions.forEach(btn => btn.classList.add('hidden'));
            nightActions.forEach(btn => btn.classList.remove('hidden'));
        }
    }

    /**
     * Update the phase indicator in the top HUD
     * @param {string} phase - 'morning', 'action', or 'night'
     */
    _updatePhaseIndicator(phase) {
        const phaseEl = document.getElementById('phase-indicator');
        const iconEl = phaseEl?.querySelector('.phase-icon');
        const textEl = phaseEl?.querySelector('.phase-text');

        if (!phaseEl) return;

        // Remove all phase classes
        phaseEl.classList.remove('phase-morning', 'phase-action', 'phase-night');

        // Set phase-specific display
        switch (phase) {
            case 'day':
                phaseEl.classList.add('phase-action');
                if (iconEl) iconEl.textContent = '☀️';
                if (textEl) textEl.textContent = '昼・業務';
                break;
            case 'night':
                phaseEl.classList.add('phase-night');
                if (iconEl) iconEl.textContent = '🌙';
                if (textEl) textEl.textContent = '夜・自習';
                break;
            default:
                if (iconEl) iconEl.textContent = '⏳';
                if (textEl) textEl.textContent = '準備中';
        }
    }

    _onTransitionStart(data) {
        const { to } = data;

        // Show telop based on phase
        if (to === 'day') {
            this._showTelop('☀️', '昼の業務', '3アクション実行可能');
        } else if (to === 'night') {
            this._showTelop('🌙', '夜の自習', '1アクション実行可能');
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

        // Update action buttons based on current phase
        this._updateActionButtons();

        // Initialize actions remaining based on phase
        const phase = this._eventBus._listeners ? 
            (this._eventBus._listeners['ceremony:phase_changed'] ? 
                this._eventBus._lastPhase : null) : null;
        const maxActions = phase === 'night' ? 1 : 3;
        this.setActionsRemaining(maxActions);
    }

    /**
     * Update action buttons based on current phase
     * @private
     */
    _updateActionButtons() {
        // This method is called from _showActionPhase
        // The actual button updates are handled by GameUIRenderer._updateActionButtonsForPhase
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
        const maxActions = 3;
        const actionsUsed = maxActions - remaining;

        // Update legacy remaining-count element
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

        // Update HUD Action Counter
        const actionCounter = document.getElementById('action-counter');
        const actionsUsedEl = document.getElementById('actions-used');
        const guidanceEl = document.getElementById('actions-guidance');

        if (actionsUsedEl) {
            actionsUsedEl.textContent = actionsUsed;
        }

        if (actionCounter) {
            // Remove all state classes
            actionCounter.classList.remove('actions-low', 'actions-depleted');

            // Add state-specific class
            if (remaining === 0) {
                actionCounter.classList.add('actions-depleted');
            } else if (remaining === 1) {
                actionCounter.classList.add('actions-low');
            }
        }

        // Show/hide guidance tooltip
        if (guidanceEl) {
            if (remaining === 0) {
                guidanceEl.classList.remove('hidden');
            } else {
                guidanceEl.classList.add('hidden');
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
        if (growthEl) growthEl.textContent = `成長: ${data.growth} / ${GameConfig.episode1.growthTarget || 50}`;

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
            continueBtn.textContent = '続ける';
            continueBtn.dataset.action = 'show-continue';
        }

        // Emit event to show continue screen after dialogue
        this._eventBus.emit('ceremony:judgment_failure_shown', data);
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

    // ===== CONTINUE SCREEN =====

    /**
     * Show Continue screen after bad end
     * @param {Object} data - Game state data
     */
    _showContinueScreen(data) {
        // Wait a bit before showing continue screen (after judgment dialogue)
        setTimeout(() => {
            const overlay = document.getElementById('continue-overlay');
            if (!overlay) return;

            // Hide judgment overlay
            this.hideJudgment();

            // Update skill displays if state is available
            if (data && data.state && data.state.skills) {
                const skills = data.state.skills;
                const cuttingEl = document.getElementById('continue-skill-cutting');
                const boilingEl = document.getElementById('continue-skill-boiling');
                const fryingEl = document.getElementById('continue-skill-frying');
                const analysisEl = document.getElementById('continue-skill-analysis');

                if (cuttingEl) cuttingEl.textContent = skills.cutting || 0;
                if (boilingEl) boilingEl.textContent = skills.boiling || 0;
                if (fryingEl) fryingEl.textContent = skills.frying || 0;
                if (analysisEl) analysisEl.textContent = skills.analysis || 0;
            }

            overlay.classList.remove('hidden');
        }, 3000); // 3秒後に表示
    }

    /**
     * Hide Continue screen
     */
    _hideContinueScreen() {
        const overlay = document.getElementById('continue-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    /**
     * Public method to hide continue screen
     */
    hideContinueScreen() {
        this._hideContinueScreen();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CeremonyUIRenderer };
}
