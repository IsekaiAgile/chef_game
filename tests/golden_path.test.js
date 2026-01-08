/**
 * Golden Path Integration Test
 *
 * このテストは以下のゴールデンパスを厳格に検証する:
 *
 * 1. 全日程（Day 1-7）で共通の handleAction ロジックが動くこと
 * 2. アクション実行ごとに remainingActions が 1 減り、0 で夜に移行すること
 * 3. 就寝（advanceDay）での回復は 現在のスタミナ +40（上限100） であること
 * 4. 「休む」での回復は 現在のスタミナ +60（上限100） であること
 * 5. 夜フェーズではユーザーの入力があるまで日付が進まないこと
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus } from '../js/core/EventBus.js';
import { GameState } from '../js/core/GameState.js';
import { KitchenEngine } from '../js/systems/KitchenEngine.js';
import { DialogueSystem } from '../js/systems/DialogueSystem.js';

describe('Golden Path: ゴールデンパス厳格検証', () => {
    let eventBus;
    let gameState;
    let kitchenEngine;

    beforeEach(() => {
        eventBus = new EventBus();
        gameState = new GameState(eventBus);
        kitchenEngine = new KitchenEngine(eventBus, gameState);
    });

    // =========================================================================
    // 1. 全日程（Day 1-7）で共通の handleAction ロジックが動くこと
    // =========================================================================
    describe('1. 全日程（Day 1-7）で共通の handleAction ロジック', () => {
        it('Day 1 で handleAction が正常に動作すること', () => {
            expect(gameState.getState().day).toBe(1);

            // handleAction を呼び出し
            const result = gameState.handleAction();
            expect(result).toBe(true);
            expect(gameState.getState().dayActionsRemaining).toBe(2);
        });

        it('Day 2 で handleAction が Day 1 と同じロジックで動作すること', () => {
            // Day 1 を完了させて Day 2 へ
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();
            gameState.consumeAction();
            gameState.advanceDay();

            expect(gameState.getState().day).toBe(2);

            // Day 2 で handleAction を呼び出し（Day 1 と同じ挙動）
            const result = gameState.handleAction();
            expect(result).toBe(true);
            expect(gameState.getState().dayActionsRemaining).toBe(2);
        });

        it('Day 1 から Day 7 まで handleAction が同一ロジックで動作すること', () => {
            for (let day = 1; day <= 7; day++) {
                const state = gameState.getState();
                expect(state.day).toBe(day);
                expect(state.dayActionsRemaining).toBe(3);

                // handleAction を3回実行（すべて同じロジック）
                for (let action = 1; action <= 3; action++) {
                    const beforeActions = gameState.getState().dayActionsRemaining;
                    const result = gameState.handleAction();
                    expect(result).toBe(true);
                    expect(gameState.getState().dayActionsRemaining).toBe(beforeActions - 1);
                }

                expect(gameState.getState().dayActionsRemaining).toBe(0);

                // 夜フェーズへ移行
                gameState.transitionToNight();
                expect(gameState.getState().currentPhase).toBe('night');

                // 夜の handleAction も同一ロジック
                const nightResult = gameState.handleAction();
                expect(nightResult).toBe(true);
                expect(gameState.getState().nightActionsRemaining).toBe(0);

                // Day 7 以外は次の日へ進む
                if (day < 7) {
                    gameState.advanceDay();
                }
            }

            // 最終的に Day 7 夜で終了
            expect(gameState.getState().day).toBe(7);
            expect(gameState.getState().currentPhase).toBe('night');
        });
    });

    // =========================================================================
    // 2. アクション実行ごとに remainingActions が 1 減り、0 で夜に移行すること
    // =========================================================================
    describe('2. アクション実行で remainingActions が 1 減少', () => {
        it('昼フェーズで consumeAction するたびに dayActionsRemaining が 1 減ること', () => {
            expect(gameState.getState().dayActionsRemaining).toBe(3);

            gameState.consumeAction();
            expect(gameState.getState().dayActionsRemaining).toBe(2);

            gameState.consumeAction();
            expect(gameState.getState().dayActionsRemaining).toBe(1);

            gameState.consumeAction();
            expect(gameState.getState().dayActionsRemaining).toBe(0);
        });

        it('夜フェーズで consumeAction するたびに nightActionsRemaining が 1 減ること', () => {
            // 昼を完了
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();

            expect(gameState.getState().nightActionsRemaining).toBe(1);

            gameState.consumeAction();
            expect(gameState.getState().nightActionsRemaining).toBe(0);
        });

        it('dayActionsRemaining が 0 になっても自動で夜に移行しないこと（transitionToNight 呼び出し必要）', () => {
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();

            // dayActionsRemaining は 0 だが、まだ day フェーズ
            expect(gameState.getState().dayActionsRemaining).toBe(0);
            expect(gameState.getState().currentPhase).toBe('day');

            // transitionToNight を呼ぶと night になる
            gameState.transitionToNight();
            expect(gameState.getState().currentPhase).toBe('night');
        });

        it('remainingActions が 0 のときに consumeAction を呼んでも false を返すこと', () => {
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();

            expect(gameState.getState().dayActionsRemaining).toBe(0);

            // 0 の状態で consumeAction を呼ぶ
            const result = gameState.consumeAction();
            expect(result).toBe(false);
            expect(gameState.getState().dayActionsRemaining).toBe(0); // 変化なし
        });
    });

    // =========================================================================
    // 3. 就寝（advanceDay）での回復は 現在のスタミナ +40（上限100） であること
    // =========================================================================
    describe('3. advanceDay でのスタミナ回復は +40（上限100）', () => {
        it('スタミナ 20 → advanceDay → 60 になること', () => {
            gameState.update({ stamina: 20 });
            expect(gameState.getState().stamina).toBe(20);

            gameState.advanceDay();

            expect(gameState.getState().stamina).toBe(60); // 20 + 40 = 60
        });

        it('スタミナ 50 → advanceDay → 90 になること', () => {
            gameState.update({ stamina: 50 });
            expect(gameState.getState().stamina).toBe(50);

            gameState.advanceDay();

            expect(gameState.getState().stamina).toBe(90); // 50 + 40 = 90
        });

        it('スタミナ 70 → advanceDay → 100（上限）になること', () => {
            gameState.update({ stamina: 70 });
            expect(gameState.getState().stamina).toBe(70);

            gameState.advanceDay();

            expect(gameState.getState().stamina).toBe(100); // 70 + 40 = 110 → 上限100
        });

        it('スタミナ 100 → advanceDay → 100（上限維持）になること', () => {
            gameState.update({ stamina: 100 });
            expect(gameState.getState().stamina).toBe(100);

            gameState.advanceDay();

            expect(gameState.getState().stamina).toBe(100); // 100 + 40 = 140 → 上限100
        });

        it('スタミナ 61 → advanceDay → 100（上限）になること（境界値テスト）', () => {
            gameState.update({ stamina: 61 });
            expect(gameState.getState().stamina).toBe(61);

            gameState.advanceDay();

            expect(gameState.getState().stamina).toBe(100); // 61 + 40 = 101 → 上限100
        });

        it('スタミナ 60 → advanceDay → 100 になること（ちょうど上限）', () => {
            gameState.update({ stamina: 60 });
            expect(gameState.getState().stamina).toBe(60);

            gameState.advanceDay();

            expect(gameState.getState().stamina).toBe(100); // 60 + 40 = 100
        });

        it('スタミナ 0 → advanceDay → 40 になること', () => {
            gameState.update({ stamina: 0 });
            expect(gameState.getState().stamina).toBe(0);

            gameState.advanceDay();

            expect(gameState.getState().stamina).toBe(40); // 0 + 40 = 40
        });

        it('Day 1-6 の各日で +40 回復ロジックが一貫していること', () => {
            const testCases = [
                { initial: 10, expected: 50 },
                { initial: 30, expected: 70 },
                { initial: 55, expected: 95 },
                { initial: 80, expected: 100 },
                { initial: 95, expected: 100 },
            ];

            for (let day = 1; day <= 6; day++) {
                const testCase = testCases[(day - 1) % testCases.length];
                gameState.update({ stamina: testCase.initial });

                const beforeStamina = gameState.getState().stamina;
                gameState.advanceDay();
                const afterStamina = gameState.getState().stamina;

                expect(afterStamina).toBe(testCase.expected);
                expect(afterStamina).toBe(Math.min(100, beforeStamina + 40));
            }
        });
    });

    // =========================================================================
    // 4. 「休む」での回復は 現在のスタミナ +60（上限100） であること
    // =========================================================================
    describe('4.「休む」アクションでのスタミナ回復は +60（上限100）', () => {
        it('スタミナ 20 → 休む → 80 になること', () => {
            gameState.update({ stamina: 20 });
            // 夜フェーズに移行
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();

            expect(gameState.getState().stamina).toBe(20);

            // 休むアクションを実行
            const result = kitchenEngine.executeAction('rest');
            expect(result.success).toBe(true);

            expect(gameState.getState().stamina).toBe(80); // 20 + 60 = 80
        });

        it('スタミナ 50 → 休む → 100（上限）になること', () => {
            gameState.update({ stamina: 50 });
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();

            const result = kitchenEngine.executeAction('rest');
            expect(result.success).toBe(true);

            expect(gameState.getState().stamina).toBe(100); // 50 + 60 = 110 → 上限100
        });

        it('スタミナ 40 → 休む → 100 になること（ちょうど上限）', () => {
            gameState.update({ stamina: 40 });
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();

            const result = kitchenEngine.executeAction('rest');
            expect(result.success).toBe(true);

            expect(gameState.getState().stamina).toBe(100); // 40 + 60 = 100
        });

        it('スタミナ 41 → 休む → 100（上限）になること（境界値テスト）', () => {
            gameState.update({ stamina: 41 });
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();

            const result = kitchenEngine.executeAction('rest');
            expect(result.success).toBe(true);

            expect(gameState.getState().stamina).toBe(100); // 41 + 60 = 101 → 上限100
        });

        it('スタミナ 100 → 休む → 100（上限維持）になること', () => {
            gameState.update({ stamina: 100 });
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();

            const result = kitchenEngine.executeAction('rest');
            expect(result.success).toBe(true);

            expect(gameState.getState().stamina).toBe(100); // 100 + 60 = 160 → 上限100
        });

        it('スタミナ 0 → 休む → 60 になること', () => {
            gameState.update({ stamina: 0 });
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();

            const result = kitchenEngine.executeAction('rest');
            expect(result.success).toBe(true);

            expect(gameState.getState().stamina).toBe(60); // 0 + 60 = 60
        });

        it('休むアクションの結果に staminaRecovered が含まれること', () => {
            gameState.update({ stamina: 30 });
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();

            const result = kitchenEngine.executeAction('rest');

            expect(result.success).toBe(true);
            expect(result.staminaRecovered).toBe(60); // 実際の回復量
        });

        it('上限に達した場合、staminaRecovered は実際の回復量になること', () => {
            gameState.update({ stamina: 70 });
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();

            const result = kitchenEngine.executeAction('rest');

            expect(result.success).toBe(true);
            expect(result.staminaRecovered).toBe(30); // 70 + 60 = 130 → 100、実際の回復量は30
        });
    });

    // =========================================================================
    // 5. 夜フェーズではユーザーの入力があるまで日付が進まないこと
    // =========================================================================
    describe('5. 夜フェーズでユーザー入力まで日付が進まない', () => {
        it('夜フェーズに移行しても自動で日付が進まないこと', () => {
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();

            expect(gameState.getState().currentPhase).toBe('night');
            expect(gameState.getState().day).toBe(1);

            // 何もしない状態で再度確認
            expect(gameState.getState().day).toBe(1);
            expect(gameState.getState().currentPhase).toBe('night');
        });

        it('夜アクションを実行しても自動で日付が進まないこと', () => {
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();

            // 夜アクションを実行
            gameState.consumeAction();

            expect(gameState.getState().nightActionsRemaining).toBe(0);
            expect(gameState.getState().day).toBe(1); // まだ Day 1
            expect(gameState.getState().currentPhase).toBe('night');
        });

        it('advanceDay を明示的に呼ばないと日付が進まないこと', () => {
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();
            gameState.consumeAction();

            // この時点で day は 1 のまま
            expect(gameState.getState().day).toBe(1);

            // 複数回 getState を呼んでも変わらない
            for (let i = 0; i < 10; i++) {
                expect(gameState.getState().day).toBe(1);
            }

            // advanceDay を呼ぶと初めて day が 2 になる
            gameState.advanceDay();
            expect(gameState.getState().day).toBe(2);
        });

        it('KitchenEngine の休むアクション後も自動で日付が進まないこと', () => {
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();

            // KitchenEngine で休むアクションを実行
            kitchenEngine.executeAction('rest');

            // nightActionsRemaining は 0 だが、まだ Day 1
            expect(gameState.getState().nightActionsRemaining).toBe(0);
            expect(gameState.getState().day).toBe(1);
            expect(gameState.getState().currentPhase).toBe('night');
        });

        it('Day 1-6 すべてで夜フェーズの待機動作が一貫していること', () => {
            for (let day = 1; day <= 6; day++) {
                expect(gameState.getState().day).toBe(day);

                // 昼アクション完了
                gameState.consumeAction();
                gameState.consumeAction();
                gameState.consumeAction();

                // 夜フェーズへ
                gameState.transitionToNight();
                expect(gameState.getState().currentPhase).toBe('night');
                expect(gameState.getState().day).toBe(day); // まだ同じ日

                // 夜アクション完了
                gameState.consumeAction();
                expect(gameState.getState().nightActionsRemaining).toBe(0);
                expect(gameState.getState().day).toBe(day); // まだ同じ日（ユーザー入力待ち）

                // advanceDay を呼んで初めて次の日へ
                gameState.advanceDay();
                expect(gameState.getState().day).toBe(day + 1);
            }
        });
    });

    // =========================================================================
    // 追加: 統合テスト - 完全なゴールデンパス
    // =========================================================================
    describe('統合テスト: Day 1-7 完全シミュレーション', () => {
        it('Day 1-7 を通して全ロジックが正常に動作すること', () => {
            const staminaLog = [];

            for (let day = 1; day <= 7; day++) {
                const state = gameState.getState();
                expect(state.day).toBe(day);
                expect(state.currentPhase).toBe('day');
                expect(state.dayActionsRemaining).toBe(3);
                expect(state.nightActionsRemaining).toBe(1);

                staminaLog.push({ day, phase: 'morning', stamina: state.stamina });

                // 昼: handleAction を3回
                for (let i = 0; i < 3; i++) {
                    const result = gameState.handleAction();
                    expect(result).toBe(true);
                }
                expect(gameState.getState().dayActionsRemaining).toBe(0);

                // 夜へ移行
                gameState.transitionToNight();
                expect(gameState.getState().currentPhase).toBe('night');
                expect(gameState.getState().day).toBe(day); // 日付は変わらない

                // 夜: handleAction を1回
                const nightResult = gameState.handleAction();
                expect(nightResult).toBe(true);
                expect(gameState.getState().nightActionsRemaining).toBe(0);
                expect(gameState.getState().day).toBe(day); // まだ日付は変わらない

                staminaLog.push({ day, phase: 'night', stamina: gameState.getState().stamina });

                // Day 7 以外は就寝
                if (day < 7) {
                    const beforeSleep = gameState.getState().stamina;
                    gameState.advanceDay();
                    const afterSleep = gameState.getState().stamina;

                    // +40 回復（上限100）の検証
                    expect(afterSleep).toBe(Math.min(100, beforeSleep + 40));
                }
            }

            // 最終状態確認
            const finalState = gameState.getState();
            expect(finalState.day).toBe(7);
            expect(finalState.currentPhase).toBe('night');
            expect(finalState.dayActionsRemaining).toBe(0);
            expect(finalState.nightActionsRemaining).toBe(0);
        });
    });

    // =========================================================================
    // 6. Autoモード: フラグがtrueの時に advance が呼ばれること
    // =========================================================================
    describe('6. Autoモード: isAutoMode フラグで advance が自動実行される', () => {
        let dialogueSystem;

        beforeEach(() => {
            vi.useFakeTimers();
            dialogueSystem = new DialogueSystem(eventBus, gameState, {
                typingSpeed: 1, // 高速タイピングでテストを速く
                autoAdvanceDelay: 2000
            });
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('初期状態で isAutoMode は false であること', () => {
            expect(gameState.getAutoMode()).toBe(false);
            expect(gameState.getState().isAutoMode).toBe(false);
        });

        it('toggleAutoMode() で isAutoMode が true になること', () => {
            const result = gameState.toggleAutoMode();
            expect(result).toBe(true);
            expect(gameState.getAutoMode()).toBe(true);
            expect(gameState.getState().isAutoMode).toBe(true);
        });

        it('toggleAutoMode() を2回呼ぶと isAutoMode が false に戻ること', () => {
            gameState.toggleAutoMode(); // true
            gameState.toggleAutoMode(); // false
            expect(gameState.getAutoMode()).toBe(false);
        });

        it('Autoモードがオンの時、タイピング完了後に advance() がスケジュールされること', () => {
            // Autoモードをオン
            gameState.toggleAutoMode();
            expect(gameState.getAutoMode()).toBe(true);

            // advance をスパイ
            const advanceSpy = vi.spyOn(dialogueSystem, 'advance');

            // ダイアログを開始
            dialogueSystem.start([
                { speaker: 'test', text: 'Hello' },
                { speaker: 'test', text: 'World' }
            ]);

            // タイピング完了まで進める
            vi.advanceTimersByTime(500);

            // 2秒（autoAdvanceDelay）待機
            vi.advanceTimersByTime(2000);

            // advance が呼ばれたことを確認
            expect(advanceSpy).toHaveBeenCalled();
        });

        it('Autoモードがオフの時、タイピング完了後に advance() が自動呼び出しされないこと', () => {
            // Autoモードはオフのまま
            expect(gameState.getAutoMode()).toBe(false);

            // advance をスパイ
            const advanceSpy = vi.spyOn(dialogueSystem, 'advance');

            // ダイアログを開始
            dialogueSystem.start([
                { speaker: 'test', text: 'Hello' },
                { speaker: 'test', text: 'World' }
            ]);

            // タイピング完了まで進める
            vi.advanceTimersByTime(500);

            // 2秒（autoAdvanceDelay）待機
            vi.advanceTimersByTime(2000);

            // advance が自動で呼ばれていないことを確認
            expect(advanceSpy).not.toHaveBeenCalled();
        });

        it('Autoモードオン中に途中でオフにすると、advance() は呼ばれないこと', () => {
            // Autoモードをオン
            gameState.toggleAutoMode();
            expect(gameState.getAutoMode()).toBe(true);

            const advanceSpy = vi.spyOn(dialogueSystem, 'advance');

            // ダイアログを開始
            dialogueSystem.start([
                { speaker: 'test', text: 'Hello' },
                { speaker: 'test', text: 'World' }
            ]);

            // タイピング完了まで進める
            vi.advanceTimersByTime(500);

            // タイマー発火前にAutoモードをオフ
            gameState.toggleAutoMode();
            expect(gameState.getAutoMode()).toBe(false);

            // 2秒待機
            vi.advanceTimersByTime(2000);

            // advance が呼ばれていないことを確認（Autoモードがオフになったため）
            expect(advanceSpy).not.toHaveBeenCalled();
        });

        it('reset() で isAutoMode が false にリセットされること', () => {
            gameState.toggleAutoMode();
            expect(gameState.getAutoMode()).toBe(true);

            gameState.reset();

            expect(gameState.getAutoMode()).toBe(false);
            expect(gameState.getState().isAutoMode).toBe(false);
        });

        it('Autoモード有効時、advance() が繰り返し呼ばれて次のダイアログへ進むこと', () => {
            // Autoモードをオン
            gameState.toggleAutoMode();

            const advanceSpy = vi.spyOn(dialogueSystem, 'advance');

            // 3つのダイアログを開始
            dialogueSystem.start([
                { speaker: 'test', text: 'A' },
                { speaker: 'test', text: 'B' },
                { speaker: 'test', text: 'C' }
            ]);

            // 最初のダイアログ開始を確認
            expect(dialogueSystem.isActive()).toBe(true);

            // タイピング完了 + auto advance delay を繰り返す
            // 1文字 = 1ms (typingSpeed: 1) + 2000ms (autoAdvanceDelay)
            vi.advanceTimersByTime(100); // タイピング完了
            vi.advanceTimersByTime(2000); // auto advance

            // advance が呼ばれたことを確認
            expect(advanceSpy).toHaveBeenCalledTimes(1);

            // 次のダイアログへ
            vi.advanceTimersByTime(100);
            vi.advanceTimersByTime(2000);

            expect(advanceSpy).toHaveBeenCalledTimes(2);
        });
    });
});
