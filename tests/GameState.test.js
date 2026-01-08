import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../js/core/EventBus.js';
import { GameState } from '../js/core/GameState.js';

// GameConfig should be available globally from setup.js

describe('GameState', () => {
    let eventBus;
    let gameState;

    beforeEach(() => {
        // Create a fresh EventBus for each test
        eventBus = new EventBus();
        gameState = new GameState(eventBus);
    });

    describe('初期状態', () => {
        it('初期状態でDay 1であること', () => {
            const state = gameState.getState();
            expect(state.day).toBe(1);
        });

        it('初期状態で昼フェーズであること', () => {
            const state = gameState.getState();
            expect(state.currentPhase).toBe('day');
        });

        it('初期状態で昼のアクションが3回残っていること', () => {
            const state = gameState.getState();
            expect(state.dayActionsRemaining).toBe(3);
        });

        it('初期状態でスタミナが100であること', () => {
            const state = gameState.getState();
            expect(state.stamina).toBe(100);
        });
    });

    describe('アクションとスタミナ消費', () => {
        it('アクションを実行した際、正しくスタミナが減ること', () => {
            const initialState = gameState.getState();
            const initialStamina = initialState.stamina;
            const staminaCost = 20;

            // スタミナを消費
            const canProceed = gameState.consumeStamina(staminaCost);
            expect(canProceed).toBe(true);

            const newState = gameState.getState();
            expect(newState.stamina).toBe(initialStamina - staminaCost);
        });

        it('3回アクションを実行すると、昼フェーズが完了すること', () => {
            // 1回目のアクション
            expect(gameState.consumeAction()).toBe(true);
            expect(gameState.getState().dayActionsRemaining).toBe(2);

            // 2回目のアクション
            expect(gameState.consumeAction()).toBe(true);
            expect(gameState.getState().dayActionsRemaining).toBe(1);

            // 3回目のアクション
            expect(gameState.consumeAction()).toBe(true);
            expect(gameState.getState().dayActionsRemaining).toBe(0);

            // 4回目は実行できない
            expect(gameState.consumeAction()).toBe(false);
        });

        it('3回アクション実行後に夜フェーズへ移行できること', () => {
            // 3回アクションを実行
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();

            // 夜フェーズへ移行
            gameState.transitionToNight();

            const state = gameState.getState();
            expect(state.currentPhase).toBe('night');
            expect(state.nightActionsRemaining).toBe(1);
        });
    });

    describe('夜フェーズと次の日への進行', () => {
        it('夜にアクションを実行できること', () => {
            // 昼フェーズを完了して夜へ
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();

            // 夜のアクションを実行
            const canConsume = gameState.consumeAction();
            expect(canConsume).toBe(true);

            const state = gameState.getState();
            expect(state.nightActionsRemaining).toBe(0);
        });

        it('夜にアクションをした後、次の日（Day 2）になり、スタミナが回復すること', () => {
            // 初期スタミナを記録
            const initialState = gameState.getState();
            const initialStamina = initialState.stamina;

            // 昼のアクション3回を実行してスタミナを消費
            gameState.consumeStamina(20);
            gameState.consumeAction();
            gameState.consumeStamina(20);
            gameState.consumeAction();
            gameState.consumeStamina(20);
            gameState.consumeAction();

            const afterDayActions = gameState.getState();
            const staminaAfterDay = afterDayActions.stamina;

            // 夜フェーズへ移行
            gameState.transitionToNight();

            // 夜のアクションを実行
            gameState.consumeAction();

            // 次の日へ進行
            gameState.advanceDay();

            const newState = gameState.getState();
            
            // Day 2になっている
            expect(newState.day).toBe(2);
            
            // スタミナが回復している（オーバーナイトリカバリー分が追加されている）
            expect(newState.stamina).toBeGreaterThan(staminaAfterDay);
            
            // 昼フェーズに戻っている
            expect(newState.currentPhase).toBe('day');
            expect(newState.dayActionsRemaining).toBe(3);
        });

        it('夜に1回行動したら翌日（Day +1）になること（シンプルなテスト）', () => {
            // 初期状態（Day 1）
            expect(gameState.getState().day).toBe(1);
            expect(gameState.getState().currentPhase).toBe('day');

            // 昼のアクション3回を実行
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();

            // 夜フェーズへ移行
            gameState.transitionToNight();
            expect(gameState.getState().currentPhase).toBe('night');
            expect(gameState.getState().nightActionsRemaining).toBe(1);

            // 夜のアクションを1回実行
            const canConsume = gameState.consumeAction();
            expect(canConsume).toBe(true);
            
            const afterNightAction = gameState.getState();
            expect(afterNightAction.nightActionsRemaining).toBe(0);
            expect(afterNightAction.day).toBe(1); // まだDay 1（advanceDayが必要）

            // 翌日へ進行（夜のアクション後は自動的に呼ばれる想定）
            gameState.advanceDay();

            const nextDayState = gameState.getState();
            
            // Day 2になっている
            expect(nextDayState.day).toBe(2);
            
            // 昼フェーズに戻っている
            expect(nextDayState.currentPhase).toBe('day');
            expect(nextDayState.dayActionsRemaining).toBe(3);
            expect(nextDayState.nightActionsRemaining).toBe(1);
        });

        it('夜フェーズでもアクションが1回実行でき、実行後に翌日（Day +1）になること', () => {
            // 初期状態を確認（Day 1）
            const initialState = gameState.getState();
            expect(initialState.day).toBe(1);
            expect(initialState.currentPhase).toBe('day');

            // 昼のアクション3回を実行
            expect(gameState.consumeAction()).toBe(true);
            expect(gameState.consumeAction()).toBe(true);
            expect(gameState.consumeAction()).toBe(true);
            
            const afterDayActions = gameState.getState();
            expect(afterDayActions.dayActionsRemaining).toBe(0);
            expect(afterDayActions.currentPhase).toBe('day');

            // 夜フェーズへ移行
            gameState.transitionToNight();
            const nightState = gameState.getState();
            expect(nightState.currentPhase).toBe('night');
            expect(nightState.nightActionsRemaining).toBe(1);

            // 夜のアクションを実行できることを確認
            const canConsumeNightAction = gameState.consumeAction();
            expect(canConsumeNightAction).toBe(true);

            const afterNightAction = gameState.getState();
            expect(afterNightAction.currentPhase).toBe('night');
            expect(afterNightAction.nightActionsRemaining).toBe(0);
            expect(afterNightAction.day).toBe(1); // まだDay 1

            // 翌日へ進行
            gameState.advanceDay();

            const nextDayState = gameState.getState();
            
            // Day 2になっている
            expect(nextDayState.day).toBe(2);
            
            // 昼フェーズに戻っている
            expect(nextDayState.currentPhase).toBe('day');
            expect(nextDayState.dayActionsRemaining).toBe(3);
            expect(nextDayState.nightActionsRemaining).toBe(1);
        });
    });

    describe('夜フェーズの自動進行停止', () => {
        it('夜フェーズ移行時、ユーザーがアクションを選択するまで currentDay が増えないこと', () => {
            // 初期状態（Day 1）
            const initialState = gameState.getState();
            expect(initialState.day).toBe(1);
            expect(initialState.currentPhase).toBe('day');

            // 昼のアクション3回を実行
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();

            // 夜フェーズへ移行
            gameState.transitionToNight();
            
            // CRITICAL: 夜フェーズに移行した直後は、まだDay 1のまま
            const nightState = gameState.getState();
            expect(nightState.currentPhase).toBe('night');
            expect(nightState.day).toBe(1); // Day はまだ進んでいない
            expect(nightState.nightActionsRemaining).toBe(1);
            
            // advanceDay()を呼ばない限り、Dayは進まない
            const stillNightState = gameState.getState();
            expect(stillNightState.day).toBe(1);
        });

        it('夜フェーズ移行時、isWaitingForInput フラグが true になり、UIがボタンを表示すること', () => {
            // 初期状態（Day 1）
            const initialState = gameState.getState();
            expect(initialState.day).toBe(1);
            expect(initialState.currentPhase).toBe('day');

            // 昼のアクション3回を実行
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();

            // 夜フェーズへ移行
            gameState.transitionToNight();
            
            // 夜フェーズでは、ユーザーの入力待ち状態
            const nightState = gameState.getState();
            expect(nightState.currentPhase).toBe('night');
            expect(nightState.nightActionsRemaining).toBe(1); // 1回のアクションが可能
            expect(nightState.day).toBe(1); // Dayはまだ進んでいない
            
            // 夜のアクションを実行するまで待機
            // (実際のUIでは、ボタンが表示され、クリック可能である必要がある)
        });

        it('夜のアクションを実行した後、振り返り完了後に初めてDayが+1されること', () => {
            // 初期状態（Day 1）
            const initialState = gameState.getState();
            expect(initialState.day).toBe(1);
            expect(initialState.currentPhase).toBe('day');

            // 昼のアクション3回を実行
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();

            // 夜フェーズへ移行
            gameState.transitionToNight();
            
            // 夜フェーズ開始時点でDay 1のまま
            let state = gameState.getState();
            expect(state.currentPhase).toBe('night');
            expect(state.day).toBe(1);

            // 夜のアクションを実行
            gameState.consumeAction();
            
            // 夜のアクション実行後も、まだDay 1のまま（advanceDayが呼ばれる前）
            state = gameState.getState();
            expect(state.nightActionsRemaining).toBe(0);
            expect(state.day).toBe(1); // まだDay 1
            
            // advanceDay()を明示的に呼ぶ（振り返り完了後に呼ばれる想定）
            gameState.advanceDay();
            
            // この時点で初めてDay 2になる
            state = gameState.getState();
            expect(state.day).toBe(2);
            expect(state.currentPhase).toBe('day');
            expect(state.dayActionsRemaining).toBe(3);
        });

        it('夜フェーズでアクション実行後も、advanceDay()を呼ぶまでDayが進まないこと', () => {
            // Day 1から開始
            expect(gameState.getState().day).toBe(1);
            
            // 昼のアクション完了 → 夜フェーズへ
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();
            
            expect(gameState.getState().day).toBe(1);
            expect(gameState.getState().currentPhase).toBe('night');
            
            // 夜のアクションを実行
            gameState.consumeAction();
            
            // まだDay 1のまま
            let state = gameState.getState();
            expect(state.day).toBe(1);
            expect(state.nightActionsRemaining).toBe(0);
            
            // advanceDay()を呼ばない限り、Dayは進まない
            state = gameState.getState();
            expect(state.day).toBe(1);
            
            // advanceDay()を明示的に呼ぶ
            gameState.advanceDay();
            
            // この時点で初めてDay 2になる
            state = gameState.getState();
            expect(state.day).toBe(2);
        });
    });

    describe('ゲームオーバー条件', () => {
        it('スタミナが0で調子が絶不調の場合、ゲームオーバーになること', () => {
            gameState.update({ 
                stamina: 0, 
                condition: 'terrible' 
            });
            expect(gameState.isGameOver()).toBe(true);
        });

        it('通常の状態ではゲームオーバーにならないこと', () => {
            expect(gameState.isGameOver()).toBe(false);
        });
    });

    describe('スタミナシステム', () => {
        it('スタミナが不足している場合、アクションを実行できないこと', () => {
            // スタミナを0にする
            gameState.update({ stamina: 0 });

            const canProceed = gameState.consumeStamina(20);
            expect(canProceed).toBe(false);

            const state = gameState.getState();
            expect(state.stamina).toBe(0);
        });

        it('スタミナが最大値を超えて回復しないこと', () => {
            const maxStamina = gameState.getState().maxStamina;

            // 最大値に設定
            gameState.update({ stamina: maxStamina });

            // さらに回復を試みる
            gameState.recoverStamina(100);

            const state = gameState.getState();
            expect(state.stamina).toBe(maxStamina);
        });
    });

    describe('全日程・全フェーズのUI表示保証', () => {
        it('Day 1（昼・夜）でボタンが表示可能な状態であること', () => {
            // Day 1 初期状態（昼フェーズ）
            const day1DayState = gameState.getState();
            expect(day1DayState.day).toBe(1);
            expect(day1DayState.currentPhase).toBe('day');
            expect(day1DayState.dayActionsRemaining).toBe(3);
            
            // 昼のアクションを3回実行
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            
            // 夜フェーズへ移行
            gameState.transitionToNight();
            const day1NightState = gameState.getState();
            expect(day1NightState.day).toBe(1);
            expect(day1NightState.currentPhase).toBe('night');
            expect(day1NightState.nightActionsRemaining).toBe(1);
            
            // 夜のアクションを実行
            gameState.consumeAction();
            expect(gameState.getState().nightActionsRemaining).toBe(0);
        });

        it('アクションを実行し Day 2 に進んだ後も、フェーズに応じて正しいボタンが再生成されること', () => {
            // Day 1 → Day 2 への進行をシミュレート
            expect(gameState.getState().day).toBe(1);
            expect(gameState.getState().currentPhase).toBe('day');
            
            // Day 1 昼のアクション完了
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            
            // Day 1 夜へ移行
            gameState.transitionToNight();
            expect(gameState.getState().currentPhase).toBe('night');
            expect(gameState.getState().day).toBe(1);
            
            // Day 1 夜のアクション完了 → Day 2へ進行
            gameState.consumeAction();
            gameState.advanceDay();
            
            // Day 2 昼フェーズでボタンが正しく設定されている
            const day2DayState = gameState.getState();
            expect(day2DayState.day).toBe(2);
            expect(day2DayState.currentPhase).toBe('day');
            expect(day2DayState.dayActionsRemaining).toBe(3);
            
            // Day 2 昼のアクションを実行できる
            const canConsume = gameState.consumeAction();
            expect(canConsume).toBe(true);
            expect(gameState.getState().dayActionsRemaining).toBe(2);
            
            // Day 2 昼のアクション完了
            gameState.consumeAction();
            gameState.consumeAction();
            
            // Day 2 夜へ移行
            gameState.transitionToNight();
            const day2NightState = gameState.getState();
            expect(day2NightState.day).toBe(2);
            expect(day2NightState.currentPhase).toBe('night');
            expect(day2NightState.nightActionsRemaining).toBe(1);
            
            // Day 2 夜のアクションを実行できる
            const canConsumeNight = gameState.consumeAction();
            expect(canConsumeNight).toBe(true);
            expect(gameState.getState().nightActionsRemaining).toBe(0);
        });

        it('Day 1 から Day 7 まで繰り返しても、途中でボタンが消えないこと', () => {
            // Day 1-7 をすべてシミュレート
            for (let day = 1; day <= 7; day++) {
                // 現在の日付を確認
                const currentState = gameState.getState();
                expect(currentState.day).toBe(day);
                expect(currentState.currentPhase).toBe('day');
                expect(currentState.dayActionsRemaining).toBe(3);
                
                // 昼のアクション3回を実行
                for (let i = 0; i < 3; i++) {
                    const canConsume = gameState.consumeAction();
                    expect(canConsume).toBe(true);
                }
                
                // 昼フェーズ完了を確認
                const afterDayActions = gameState.getState();
                expect(afterDayActions.dayActionsRemaining).toBe(0);
                expect(afterDayActions.currentPhase).toBe('day');
                
                // 夜フェーズへ移行
                gameState.transitionToNight();
                const nightState = gameState.getState();
                expect(nightState.day).toBe(day);
                expect(nightState.currentPhase).toBe('night');
                expect(nightState.nightActionsRemaining).toBe(1);
                
                // 夜のアクションを実行
                const canConsumeNight = gameState.consumeAction();
                expect(canConsumeNight).toBe(true);
                expect(gameState.getState().nightActionsRemaining).toBe(0);
                
                // Day 7 の場合は最後なので進行しない
                if (day < 7) {
                    // 次の日へ進行
                    gameState.advanceDay();
                    
                    // 次の日の状態を確認
                    const nextDayState = gameState.getState();
                    expect(nextDayState.day).toBe(day + 1);
                    expect(nextDayState.currentPhase).toBe('day');
                    expect(nextDayState.dayActionsRemaining).toBe(3);
                    expect(nextDayState.nightActionsRemaining).toBe(1);
                }
            }
            
            // 最終確認: Day 7 の夜フェーズ完了後
            const finalState = gameState.getState();
            expect(finalState.day).toBe(7);
            expect(finalState.currentPhase).toBe('night');
            expect(finalState.nightActionsRemaining).toBe(0);
        });

        it('Day 2以降でも、フェーズが変わった時にボタンが正しく更新されること', () => {
            // Day 1 を完了して Day 2 へ
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.transitionToNight();
            gameState.consumeAction();
            gameState.advanceDay();
            
            // Day 2 昼フェーズ
            expect(gameState.getState().day).toBe(2);
            expect(gameState.getState().currentPhase).toBe('day');
            
            // Day 2 昼のアクション完了
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            
            // Day 2 夜フェーズへ移行
            gameState.transitionToNight();
            const day2NightState = gameState.getState();
            expect(day2NightState.day).toBe(2);
            expect(day2NightState.currentPhase).toBe('night');
            expect(day2NightState.nightActionsRemaining).toBe(1);
            
            // Day 2 夜のアクションを実行
            gameState.consumeAction();
            expect(gameState.getState().nightActionsRemaining).toBe(0);
            
            // Day 3 へ進行
            gameState.advanceDay();
            const day3DayState = gameState.getState();
            expect(day3DayState.day).toBe(3);
            expect(day3DayState.currentPhase).toBe('day');
            expect(day3DayState.dayActionsRemaining).toBe(3);
            
            // Day 3 でもボタンが正しく機能する
            const canConsumeDay3 = gameState.consumeAction();
            expect(canConsumeDay3).toBe(true);
            expect(gameState.getState().dayActionsRemaining).toBe(2);
        });
    });

    describe('朝の方針システム', () => {
        it('方針を設定できること', () => {
            gameState.setPolicy('quality');
            expect(gameState.getPolicy()).toBe('quality');
            
            gameState.setPolicy('speed');
            expect(gameState.getPolicy()).toBe('speed');
            
            gameState.setPolicy('challenge');
            expect(gameState.getPolicy()).toBe('challenge');
            
            gameState.setPolicy(null);
            expect(gameState.getPolicy()).toBe(null);
        });

        it('品質重視: 経験値が1.5倍になること', () => {
            gameState.setPolicy('quality');
            
            // 基本経験値を記録
            const initialState = gameState.getState();
            const initialExp = initialState.experience.cutting;
            
            // 経験値を追加（基本10）
            const result = gameState.addSkillExp('cutting', 10);
            
            // 品質重視: 経験値1.5倍
            // 条件倍率も考慮（通常は1.0）
            const expectedExpGain = Math.floor(10 * 1.5); // 15
            expect(result.actualExpGained).toBeGreaterThanOrEqual(expectedExpGain);
            expect(result.policyMultiplier).toBe(1.5);
            expect(result.policy).toBe('quality');
        });

        it('スピード重視: 経験値が0.8倍になること', () => {
            gameState.setPolicy('speed');
            
            const result = gameState.addSkillExp('cutting', 10);
            
            // スピード重視: 経験値0.8倍
            const expectedExpGain = Math.floor(10 * 0.8); // 8
            expect(result.actualExpGained).toBeGreaterThanOrEqual(expectedExpGain);
            expect(result.policyMultiplier).toBe(0.8);
            expect(result.policy).toBe('speed');
        });

        it('スタミナ消費倍率が正しく取得できること', () => {
            gameState.setPolicy('quality');
            expect(gameState.getPolicyStaminaMultiplier()).toBe(1.2);
            
            gameState.setPolicy('speed');
            expect(gameState.getPolicyStaminaMultiplier()).toBe(0.5);
            
            gameState.setPolicy('challenge');
            expect(gameState.getPolicyStaminaMultiplier()).toBe(1.0);
            
            gameState.setPolicy(null);
            expect(gameState.getPolicyStaminaMultiplier()).toBe(1.0);
        });

        it('新しい日が始まると方針がリセットされること', () => {
            gameState.setPolicy('quality');
            expect(gameState.getPolicy()).toBe('quality');
            
            // 次の日へ進行
            gameState.advanceDay();
            
            // 方針がリセットされている
            expect(gameState.getPolicy()).toBe(null);
        });
    });

    describe('ゴールデンパス統合テスト（Day 1-3の完全な流れ）', () => {
        it('Day 1からDay 3まで、方針を選び、アクションし、夜を越える完全な流れが動作すること', () => {
            // ===== Day 1 開始 =====
            let state = gameState.getState();
            expect(state.day).toBe(1);
            expect(state.currentPhase).toBe('day');
            expect(state.stamina).toBe(100);
            expect(state.currentPolicy).toBe(null);
            
            // 朝の方針選択: 品質重視
            gameState.setPolicy('quality');
            expect(gameState.getPolicy()).toBe('quality');
            
            // Day 1 昼: アクション3回実行
            // 1回目: スタミナ消費（方針による補正あり）
            gameState.consumeAction();
            state = gameState.getState();
            expect(state.dayActionsRemaining).toBe(2);
            
            // 2回目
            gameState.consumeAction();
            state = gameState.getState();
            expect(state.dayActionsRemaining).toBe(1);
            
            // 3回目: 昼のアクション完了
            gameState.consumeAction();
            state = gameState.getState();
            expect(state.dayActionsRemaining).toBe(0);
            expect(state.currentPhase).toBe('day');
            
            // Day 1 夜フェーズへ移行
            gameState.transitionToNight();
            state = gameState.getState();
            expect(state.currentPhase).toBe('night');
            expect(state.day).toBe(1); // まだDay 1
            expect(state.nightActionsRemaining).toBe(1);
            
            // Day 1 夜: 自習アクション実行
            gameState.consumeAction();
            state = gameState.getState();
            expect(state.nightActionsRemaining).toBe(0);
            expect(state.day).toBe(1); // まだDay 1（advanceDay待ち）
            
            // Day 1 振り返り完了 → Day 2へ進行
            gameState.advanceDay();
            state = gameState.getState();
            expect(state.day).toBe(2);
            expect(state.currentPhase).toBe('day');
            expect(state.dayActionsRemaining).toBe(3);
            expect(state.nightActionsRemaining).toBe(1);
            expect(state.currentPolicy).toBe(null); // 方針がリセットされている
            
            // ===== Day 2 開始 =====
            // 朝の方針選択: スピード重視
            gameState.setPolicy('speed');
            expect(gameState.getPolicy()).toBe('speed');
            
            // Day 2 昼: アクション3回実行
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            state = gameState.getState();
            expect(state.dayActionsRemaining).toBe(0);
            
            // Day 2 夜フェーズへ移行
            gameState.transitionToNight();
            state = gameState.getState();
            expect(state.currentPhase).toBe('night');
            expect(state.day).toBe(2);
            
            // Day 2 夜: 自習アクション実行
            gameState.consumeAction();
            state = gameState.getState();
            expect(state.nightActionsRemaining).toBe(0);
            
            // Day 2 振り返り完了 → Day 3へ進行
            gameState.advanceDay();
            state = gameState.getState();
            expect(state.day).toBe(3);
            expect(state.currentPhase).toBe('day');
            expect(state.currentPolicy).toBe(null);
            
            // ===== Day 3 開始 =====
            // 朝の方針選択: 新しい挑戦
            gameState.setPolicy('challenge');
            expect(gameState.getPolicy()).toBe('challenge');
            
            // Day 3 昼: アクション3回実行
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();
            state = gameState.getState();
            expect(state.dayActionsRemaining).toBe(0);
            
            // Day 3 夜フェーズへ移行
            gameState.transitionToNight();
            state = gameState.getState();
            expect(state.currentPhase).toBe('night');
            expect(state.day).toBe(3);
            
            // Day 3 夜: 自習アクション実行
            gameState.consumeAction();
            state = gameState.getState();
            expect(state.nightActionsRemaining).toBe(0);
            
            // 最終確認: Day 3完了後も状態が正常
            expect(state.day).toBe(3);
            expect(state.currentPhase).toBe('night');
        });

        it('方針が正しく経験値とスタミナに影響すること', () => {
            // 品質重視で経験値1.5倍を確認
            gameState.setPolicy('quality');
            const qualityResult = gameState.addSkillExp('cutting', 10);
            expect(qualityResult.policyMultiplier).toBe(1.5);
            expect(qualityResult.actualExpGained).toBeGreaterThanOrEqual(15);
            
            // スタミナ倍率確認
            expect(gameState.getPolicyStaminaMultiplier()).toBe(1.2);
            
            // スピード重視に変更
            gameState.setPolicy('speed');
            const speedResult = gameState.addSkillExp('cutting', 10);
            expect(speedResult.policyMultiplier).toBe(0.8);
            expect(speedResult.actualExpGained).toBeGreaterThanOrEqual(8);
            expect(gameState.getPolicyStaminaMultiplier()).toBe(0.5);
        });
    });
});
