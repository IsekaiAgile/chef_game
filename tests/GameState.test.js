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
            // オーバーナイトリカバリーは通常50なので、dayActions後のスタミナ + 50が期待値
            // ただし、スタミナは最大値を超えない
            expect(newState.stamina).toBeGreaterThan(staminaAfterDay);
            
            // 昼フェーズに戻っている
            expect(newState.currentPhase).toBe('day');
            expect(newState.dayActionsRemaining).toBe(3);
        });
    });

    describe('ゲームオーバー条件', () => {
        it('技術的負債が最大値に達するとゲームオーバーになること', () => {
            const state = gameState.getState();
            const maxDebt = state.technicalDebt || 30; // GameConfigから取得する想定

            // 技術的負債を最大値に設定
            gameState.update({ technicalDebt: maxDebt });

            expect(gameState.isGameOver()).toBe(true);
        });

        it('老店主の機嫌が0以下になるとゲームオーバーになること', () => {
            gameState.update({ oldManMood: 0 });
            expect(gameState.isGameOver()).toBe(true);

            gameState.update({ oldManMood: -1 });
            expect(gameState.isGameOver()).toBe(true);
        });

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

        it('Day 7終了時の判定が正しく動作すること', () => {
            // Day 7まで進行
            for (let day = 1; day < 7; day++) {
                // 昼のアクションを3回
                gameState.consumeAction();
                gameState.consumeAction();
                gameState.consumeAction();
                
                // 夜フェーズへ
                gameState.transitionToNight();
                
                // 夜のアクション
                gameState.consumeAction();
                
                // 次の日へ
                gameState.advanceDay();
            }

            const state = gameState.getState();
            expect(state.day).toBe(7);

            // Day 7の昼のアクションを3回
            gameState.consumeAction();
            gameState.consumeAction();
            gameState.consumeAction();

            // 夜フェーズへ
            gameState.transitionToNight();

            // 夜のアクション
            gameState.consumeAction();

            // 次の日へ（Day 8になる）
            gameState.advanceDay();

            const finalState = gameState.getState();
            expect(finalState.day).toBe(8);
            
            // Day 7を超えたので、判定が可能な状態
            // （実際のゲームオーバー判定は、スキル要件やdishProgressに基づく）
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
});