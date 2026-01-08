/**
 * GameConfig - Centralized configuration for all game balancing parameters
 *
 * This file contains all "magic numbers" used throughout the game.
 * Centralizing these values makes balancing easier and prevents
 * scattered constants that are hard to maintain.
 *
 * SUCCESS MODE STYLE (パワプロ風サクセスモード)
 * - Day/Night phase system with strategic choices
 * - Condition (調子) system affecting exp gains and success rates
 * - Special Dish Progress as the main victory metric
 *
 * @module GameConfig
 */

const GameConfig = {
    // ===== SKILL SYSTEM (Power Pro Style) =====
    skills: {
        /** Maximum level any skill can reach */
        maxLevel: 20,

        /** Experience points required to level up */
        expPerLevel: 100,

        /** Skill names for display */
        names: {
            cutting: '包丁さばき',
            boiling: '煮込み',
            frying: '炒め',
            analysis: '食材分析'
        },

        /** Grade thresholds (level → grade) */
        grades: {
            S: 18,  // Level 18+ = S rank
            A: 15,  // Level 15+ = A rank
            B: 12,  // Level 12+ = B rank
            C: 9,   // Level 9+ = C rank
            D: 6,   // Level 6+ = D rank
            E: 3,   // Level 3+ = E rank
            F: 1,   // Level 1+ = F rank
            G: 0    // Level 0 = G rank
        }
    },

    // ===== CONDITION SYSTEM (調子) =====
    condition: {
        /** Condition levels with their effects */
        levels: {
            SUPERB: {    // 絶好調
                id: 'superb',
                name: '絶好調',
                icon: '🔥',
                expMultiplier: 1.5,
                successBonus: 0.15,
                dishProgressBonus: 1.3,
                color: '#FF6B6B'
            },
            GOOD: {      // 好調
                id: 'good',
                name: '好調',
                icon: '😊',
                expMultiplier: 1.2,
                successBonus: 0.08,
                dishProgressBonus: 1.15,
                color: '#4ECDC4'
            },
            NORMAL: {    // 普通
                id: 'normal',
                name: '普通',
                icon: '😐',
                expMultiplier: 1.0,
                successBonus: 0,
                dishProgressBonus: 1.0,
                color: '#95A5A6'
            },
            BAD: {       // 不調
                id: 'bad',
                name: '不調',
                icon: '😓',
                expMultiplier: 0.8,
                successBonus: -0.10,
                dishProgressBonus: 0.85,
                color: '#F39C12'
            },
            TERRIBLE: {  // 絶不調
                id: 'terrible',
                name: '絶不調',
                icon: '😵',
                expMultiplier: 0.5,
                successBonus: -0.20,
                dishProgressBonus: 0.6,
                color: '#8E44AD'
            }
        },

        /** Probability weights for condition change on rest */
        restTransitions: {
            // Current condition → probabilities for new condition
            superb:   { superb: 0.4, good: 0.5, normal: 0.1, bad: 0, terrible: 0 },
            good:     { superb: 0.2, good: 0.5, normal: 0.25, bad: 0.05, terrible: 0 },
            normal:   { superb: 0.1, good: 0.35, normal: 0.4, bad: 0.1, terrible: 0.05 },
            bad:      { superb: 0.05, good: 0.25, normal: 0.45, bad: 0.2, terrible: 0.05 },
            terrible: { superb: 0.02, good: 0.15, normal: 0.43, bad: 0.3, terrible: 0.1 }
        },

        /** Natural condition decay probability per day */
        dailyDecayChance: 0.15,

        /** Initial condition */
        initial: 'normal'
    },

    // ===== PHASE SYSTEM (Day/Night) =====
    phases: {
        /** Phase definitions */
        DAY: {
            id: 'day',
            name: '昼・仕事',
            icon: '☀️',
            actionsAllowed: 3,
            description: '厨房での実践練習'
        },
        NIGHT: {
            id: 'night',
            name: '夜・自主練',
            icon: '🌙',
            actionsAllowed: 1,
            description: '自分だけの時間'
        }
    },

    // ===== STAMINA SYSTEM =====
    stamina: {
        /** Maximum stamina value */
        max: 100,

        /** Initial stamina at game start */
        initial: 100,

        /** Stamina recovered overnight */
        overnightRecovery: 50,

        /** Stamina recovered from Night Rest action */
        restRecovery: 40,

        /** Threshold for showing "low stamina" warning */
        lowThreshold: 25,

        /** UI color thresholds (percentage) */
        colorThresholds: {
            high: 60,      // Green
            medium: 35,    // Yellow
            low: 15,       // Orange
            critical: 0    // Red + pulsing
        }
    },

    // ===== DAYTIME ACTIONS =====
    dayActions: {
        /** 下準備 (Chopping/Prep) - Builds cutting skill */
        chopping: {
            id: 'chopping',
            name: '下準備',
            icon: '🔪',
            staminaCost: 20,
            expRewards: {
                cutting: { base: 25, bonus: 40 }
            },
            techDebtReduction: 0,
            description: '食材の仕込みで包丁さばきを磨く'
        },
        /** 火の番 (Heat Control) - Builds boiling and frying */
        heatControl: {
            id: 'heatControl',
            name: '火の番',
            icon: '🔥',
            staminaCost: 30,
            expRewards: {
                boiling: { base: 20, bonus: 35 },
                frying: { base: 18, bonus: 30 }
            },
            techDebtReduction: 0,
            description: '火加減を学び煮込みと炒めの技術を習得'
        },
        /** 掃除/皿洗い (Cleaning) - Reduces tech debt */
        cleaning: {
            id: 'cleaning',
            name: '掃除・皿洗い',
            icon: '🧹',
            staminaCost: 10,
            expRewards: {},
            techDebtReduction: 8,
            description: '厨房を清潔に保ち、技術的負債を減らす'
        }
    },

    // ===== NIGHT ACTIONS =====
    nightActions: {
        /** シチュー試作 (Trial Cooking) - Increases dish progress */
        trialCooking: {
            id: 'trialCooking',
            name: 'シチュー試作',
            icon: '🍲',
            staminaCost: 25,
            expRewards: {
                analysis: { base: 10, bonus: 20 }
            },
            description: '名物料理の完成度を上げる実践練習'
        },
        /** 研究 (Study) - Significant skill exp gain */
        study: {
            id: 'study',
            name: '研究',
            icon: '📖',
            staminaCost: 15,
            /** Study targets a specific skill chosen by player */
            expMultiplier: 1.8,
            description: '集中して特定のスキルを強化'
        },
        /** 休息 (Rest) - Recover stamina, improve condition */
        rest: {
            id: 'rest',
            name: '休息',
            icon: '😴',
            staminaCost: 0,
            staminaRecovery: 40,
            conditionImproveChance: 0.6,
            description: '体力回復と調子の改善'
        }
    },

    // ===== SPECIAL DISH PROGRESS =====
    dishProgress: {
        /** Maximum progress (100% = dish complete) */
        max: 100,

        /** Initial progress */
        initial: 0,

        /** Base progress per trial cooking (before skill bonuses) */
        baseProgressPerTrial: 5,

        /**
         * Skill contribution to dish progress
         * Formula: baseProgress + sum(skillLevel * weight) * conditionMultiplier
         */
        skillWeights: {
            cutting: 0.8,
            boiling: 1.2,
            frying: 0.6,
            analysis: 0.4
        },

        /** Minimum progress required for Day 7 success */
        victoryThreshold: 80
    },

    // ===== EPISODE 1: 7-DAY SPRINT =====
    episode1: {
        /** Maximum days in the sprint */
        maxDays: 7,

        /** Day when Spice Crisis triggers */
        spiceCrisisDay: 3,

        /** Day when Spice Crisis ends */
        spiceCrisisEndDay: 5,

        /** Chimera Stew skill requirements for Day 7 Judgment */
        chimeraStewRequirements: {
            cutting: 6,
            boiling: 8,
            frying: 4,
            analysis: 3
        },

        /** Legacy growth target (for backward compatibility) */
        growthTarget: 50
    },

    // ===== CEREMONY SYSTEM =====
    ceremony: {
        /** Transition animation duration (ms) */
        transitionDuration: 1500,

        /** Delay before phase transition (ms) */
        phaseTransitionDelay: 1000
    },

    // ===== SUCCESS RATE MODIFIERS =====
    successRate: {
        /** Base success rate for actions */
        base: 0.70,

        /** Minimum success rate (floor) */
        minimum: 0.20,

        /** Maximum success rate (ceiling) */
        maximum: 0.95,

        /** Critical success chance */
        criticalChance: 0.12,

        /** Penalties */
        penalties: {
            lowStamina: -0.15,      // stamina < 25
            highDebt: -0.10,        // technicalDebt > 15
            lowMood: -0.08          // oldManMood < 30
        },

        /** Bonuses */
        bonuses: {
            highStamina: 0.05,      // stamina > 80
            lowDebt: 0.05           // technicalDebt < 5
        }
    },

    // ===== TECH DEBT SYSTEM =====
    techDebt: {
        /** Initial tech debt */
        initial: 0,

        /** Maximum tech debt */
        max: 30,

        /** Tech debt increase per failed action */
        failurePenalty: 3,

        /** Daily tech debt increase (entropy) */
        dailyIncrease: 2,

        /** Warning threshold */
        warningThreshold: 15
    },

    // ===== UI ANIMATION TIMINGS =====
    ui: {
        /** Level-up notification display duration (ms) */
        levelUpDuration: 2500,

        /** Floating text duration (ms) */
        floatingTextDuration: 2000,

        /** Screen shake duration (ms) */
        screenShakeDuration: 400,

        /** Phase transition overlay duration (ms) */
        phaseTransitionDuration: 1500,

        /** Condition change animation duration (ms) */
        conditionChangeDuration: 1000,

        /** Critical glow effect duration (ms) */
        criticalGlowDuration: 1500
    },

    // ===== LEGACY SUPPORT =====
    growth: {
        scaleFactor: 50 / 26,
        max: 50
    }
};

// Freeze config to prevent accidental modification
Object.freeze(GameConfig);
Object.freeze(GameConfig.skills);
Object.freeze(GameConfig.skills.names);
Object.freeze(GameConfig.skills.grades);
Object.freeze(GameConfig.condition);
Object.freeze(GameConfig.condition.levels);
Object.freeze(GameConfig.condition.restTransitions);
Object.freeze(GameConfig.phases);
Object.freeze(GameConfig.stamina);
Object.freeze(GameConfig.stamina.colorThresholds);
Object.freeze(GameConfig.dayActions);
Object.freeze(GameConfig.dayActions.chopping);
Object.freeze(GameConfig.dayActions.heatControl);
Object.freeze(GameConfig.dayActions.cleaning);
Object.freeze(GameConfig.nightActions);
Object.freeze(GameConfig.nightActions.trialCooking);
Object.freeze(GameConfig.nightActions.study);
Object.freeze(GameConfig.nightActions.rest);
Object.freeze(GameConfig.dishProgress);
Object.freeze(GameConfig.dishProgress.skillWeights);
Object.freeze(GameConfig.episode1);
Object.freeze(GameConfig.episode1.chimeraStewRequirements);
Object.freeze(GameConfig.ceremony);
Object.freeze(GameConfig.successRate);
Object.freeze(GameConfig.successRate.penalties);
Object.freeze(GameConfig.successRate.bonuses);
Object.freeze(GameConfig.techDebt);
Object.freeze(GameConfig.ui);
Object.freeze(GameConfig.growth);

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameConfig };
}
