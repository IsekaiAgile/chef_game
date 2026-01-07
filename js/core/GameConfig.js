/**
 * GameConfig - Centralized configuration for all game balancing parameters
 *
 * This file contains all "magic numbers" used throughout the game.
 * Centralizing these values makes balancing easier and prevents
 * scattered constants that are hard to maintain.
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
            plating: '盛り付け'
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

    // ===== STAMINA SYSTEM =====
    stamina: {
        /** Maximum stamina value */
        max: 100,

        /** Initial stamina at game start */
        initial: 100,

        /** Stamina recovered overnight during retrospective */
        overnightRecovery: 40,

        /** Stamina recovered from Rest action */
        restRecovery: 30,

        /** Threshold for showing "low stamina" warning */
        lowThreshold: 30,

        /** UI color thresholds (percentage) */
        colorThresholds: {
            high: 60,      // Green
            medium: 35,    // Yellow
            low: 15,       // Orange
            critical: 0    // Red + pulsing
        }
    },

    // ===== ACTION COSTS =====
    actions: {
        /** Stamina cost per action */
        costs: {
            1: 15,  // 皿洗い (Dishwashing)
            2: 25,  // 下準備 (Prep Work)
            3: 35,  // 火の番 (Stovework)
            4: 0    // 休憩 (Rest) - no cost
        },

        /** Experience rewards per action (base values, before critical) */
        expRewards: {
            1: { // 皿洗い
                cutting: { base: 20, critical: 40 },
                boiling: { base: 5, critical: 10 }
            },
            2: { // 下準備
                cutting: { base: 18, critical: 35 },
                boiling: { base: 15, critical: 30 }
            },
            3: { // 火の番
                frying: { base: 22, critical: 40 },
                plating: { base: 12, critical: 25 }
            }
        },

        /** Experience gained even on failure (learning from mistakes) */
        failureExp: {
            1: { cutting: 5 },
            2: { cutting: 8, boiling: 5 },
            3: { frying: 10, plating: 5 }
        }
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
            cutting: 8,    // Need Cutting Lv.8+ for proper meat prep
            boiling: 10,   // Need Boiling Lv.10+ for the stew base
            frying: 5,     // Need Frying Lv.5+ for aromatics
            plating: 3     // Need Plating Lv.3+ for presentation
        },

        /** Legacy growth target (for backward compatibility) */
        growthTarget: 50
    },

    // ===== CEREMONY SYSTEM =====
    ceremony: {
        /** Actions allowed per day */
        actionsPerDay: 3,

        /** Transition animation duration (ms) */
        transitionDuration: 1500,

        /** Delay before night phase starts after last action (ms) */
        nightTransitionDelay: 1500
    },

    // ===== SUCCESS RATE MODIFIERS =====
    successRate: {
        /** Base success rate for actions */
        base: 0.65,

        /** Minimum success rate (floor) */
        minimum: 0.15,

        /** Critical success chance */
        criticalChance: 0.10,

        /** Penalties */
        penalties: {
            lowQuality: -0.20,      // ingredientQuality < 30
            lowMood: -0.10,         // oldManMood < 30
            noIngredients: -0.15,   // currentIngredients === 0
            highDebt: -0.05         // technicalDebt > 10
        },

        /** Bonuses */
        bonuses: {
            qualityFocus: 0.10,     // Daily focus: quality
            pivotBonus: 0.15,       // From pivot decision
            spiceCrisisExperiment: 0.20  // Experiment during spice crisis
        },

        /** Spice crisis cooking penalty */
        spiceCrisisPenalty: -0.20
    },

    // ===== STAGNATION & CYCLE SYSTEM =====
    stagnation: {
        /** Initial stagnation value */
        initial: 50,

        /** Stagnation increase for repeating same action */
        repeatPenalty: 12,

        /** Stagnation decrease for varied action */
        varietyReward: -7,

        /** Perfect cycle bonuses */
        perfectCycle: {
            growthBonus: 10,
            streakBonus: 5,         // Additional bonus for consecutive cycles
            stagnationReduction: 15,
            streakStagnationBonus: 5,
            moodBonus: 5,
            debtReduction: 3
        },

        /** Warning threshold for UI */
        warningThreshold: 30
    },

    // ===== INGREDIENT SYSTEM =====
    ingredients: {
        /** Starting ingredients */
        initial: 3,

        /** Maximum ingredients */
        max: 5,

        /** Overnight replenishment amount */
        overnightReplenish: 2,

        /** Threshold below which replenishment occurs */
        replenishThreshold: 3
    },

    // ===== UI ANIMATION TIMINGS =====
    ui: {
        /** Level-up notification display duration (ms) */
        levelUpDuration: 2000,

        /** Floating text duration (ms) */
        floatingTextDuration: 2000,

        /** Screen shake duration (ms) */
        screenShakeDuration: 400,

        /** Perfect cycle overlay duration (ms) */
        perfectOverlayDuration: 2500,

        /** Critical glow effect duration (ms) */
        criticalGlowDuration: 1500
    },

    // ===== GROWTH CALCULATION =====
    growth: {
        /**
         * Growth scaling factor
         * With 4 skills at max 20 each = 80 total skill levels
         * Target growth of 50 means: growth = totalSkills * 50 / 26
         */
        scaleFactor: 50 / 26,

        /** Maximum growth value */
        max: 50
    }
};

// Freeze config to prevent accidental modification
Object.freeze(GameConfig);
Object.freeze(GameConfig.skills);
Object.freeze(GameConfig.skills.names);
Object.freeze(GameConfig.skills.grades);
Object.freeze(GameConfig.stamina);
Object.freeze(GameConfig.stamina.colorThresholds);
Object.freeze(GameConfig.actions);
Object.freeze(GameConfig.actions.costs);
Object.freeze(GameConfig.actions.expRewards);
Object.freeze(GameConfig.actions.failureExp);
Object.freeze(GameConfig.episode1);
Object.freeze(GameConfig.episode1.chimeraStewRequirements);
Object.freeze(GameConfig.ceremony);
Object.freeze(GameConfig.successRate);
Object.freeze(GameConfig.successRate.penalties);
Object.freeze(GameConfig.successRate.bonuses);
Object.freeze(GameConfig.stagnation);
Object.freeze(GameConfig.stagnation.perfectCycle);
Object.freeze(GameConfig.ingredients);
Object.freeze(GameConfig.ui);
Object.freeze(GameConfig.growth);

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameConfig };
}
