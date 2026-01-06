/**
 * EpisodeManager - Manages episode content and progression
 *
 * SOLID Principles:
 * - Single Responsibility: Only manages episode definitions and flow
 * - Open/Closed: New episodes can be added via registerEpisode()
 * - Dependency Inversion: Uses EventBus for communication
 */

// ===== BACKGROUND IMAGE CONSTANTS =====
const BACKGROUNDS = {
    EXTERIOR_NIGHT: 'exterior_night',  // 食堂前夜.png
    INTERIOR_DINER: 'interior_diner'   // 食堂.png
};

// ===== SCENE IDENTIFIERS =====
const SCENES = {
    RESCUE: 'SCENE1_RESCUE',
    KITCHEN: 'SCENE2_KITCHEN',
    MASTER: 'SCENE3_MASTER',
    START: 'SCENE5_START',
    PERFECT_CYCLE: 'PERFECT_CYCLE',
    STAGNATION_CRISIS: 'STAGNATION_CRISIS',
    HYBRID_MOMENT: 'HYBRID_MOMENT'
};

// ===== 5-EPISODE CONFIGURATION =====
const EPISODE_CONFIG = {
    1: {
        id: 1,
        title: '第1話：不可能な弟子入り',
        subtitle: 'The Impossible Apprenticeship',
        description: '親父の伝説料理「キメラシチュー」を7日間で再現せよ！',
        dish: 'キメラシチュー',
        dishEnglish: 'Chimera Stew',
        guest: null,
        characters: ['mina', 'owner', 'fuji'],
        maxDays: 7,
        maxGrowth: 50,
        actionsPerDay: 3,
        modifiers: {
            qualityDecayRate: 1.0,
            orderFrequency: 1.0,
            ingredientConsumption: 1
        },
        // Mid-week crisis event (Days 3-4)
        spiceCrisis: {
            triggerDay: 3,
            endDay: 4,
            qualityPenalty: -0.20,      // -20% success for quality/cooking
            experimentBonus: 0.20        // +20% success for experiment
        },
        winCondition: {
            type: 'growth_target',
            growth: 50,
            byDay: 7
        },
        lossCondition: {
            type: 'day_limit_failed',
            maxDay: 7,
            requiredGrowth: 50
        }
    },
    2: {
        id: 2,
        title: '第2話：ゴブリン襲来！底なしの胃袋',
        subtitle: 'Goblin Raid! The Bottomless Pit',
        description: '食材切れ即ゲームオーバー！高頻度の注文に対応せよ',
        guest: 'goblin',
        characters: ['mina', 'owner', 'fuji', 'goblin'],
        modifiers: {
            qualityDecayRate: 1.0,
            orderFrequency: 2.0,      // Orders come 2x faster
            ingredientConsumption: 2  // Uses 2x ingredients per order
        },
        winCondition: {
            type: 'survive_orders',
            ordersCompleted: 10
        },
        lossCondition: {
            type: 'ingredients_zero',  // SPECIAL: Ingredients = 0 = Game Over!
            ingredients: 0
        }
    },
    3: {
        id: 3,
        title: '第3話：ドラゴン猛襲！破壊者',
        subtitle: 'Dragon Onslaught! The Destroyer',
        description: '品質が2倍速で劣化！整備で厨房を安定させろ',
        guest: 'dragonoid',
        characters: ['mina', 'owner', 'fuji', 'dragonoid'],
        modifiers: {
            qualityDecayRate: 2.0,    // Quality decays 2x faster!
            orderFrequency: 1.0,
            ingredientConsumption: 1
        },
        winCondition: {
            type: 'quality_survival',
            minQuality: 30,
            turnsToSurvive: 12
        },
        lossCondition: {
            type: 'quality_zero',
            quality: 0
        }
    },
    4: {
        id: 4,
        title: '第4話：天才ライバル、スリモン登場！',
        subtitle: 'The Genius Rival: Srimon Appears!',
        description: '料理対決！ライバルの見えないスコアを超えろ',
        guest: 'srimon',
        characters: ['mina', 'owner', 'fuji', 'srimon'],
        isRivalBattle: true,
        modifiers: {
            qualityDecayRate: 1.0,
            orderFrequency: 1.0,
            ingredientConsumption: 1
        },
        rivalConfig: {
            baseGrowthPerTurn: 2,     // Rival gains 2 growth per turn
            variability: 1,            // +/- 1 random
            catchUpBonus: 0.5          // Gains 50% more when behind
        },
        winCondition: {
            type: 'rival_battle',
            turnsToWin: 15,
            mustBeAhead: true
        },
        lossCondition: {
            type: 'rival_ahead',
            rivalLeadThreshold: 15     // Lose if rival is 15+ ahead
        }
    },
    5: {
        id: 5,
        title: '最終話：食堂危機！わがまま姫',
        subtitle: 'Diner in Crisis! The Tomboy Elf Princess',
        description: '最終試練！学んだ全てを使い、姫の無理難題をクリアせよ',
        guest: 'elfPrincess',
        characters: ['mina', 'owner', 'fuji', 'elfPrincess'],
        isFinalBoss: true,
        modifiers: {
            qualityDecayRate: 1.5,
            orderFrequency: 1.5,
            ingredientConsumption: 1,
            demandChangeChance: 0.4    // 40% chance of demand change per turn
        },
        winCondition: {
            type: 'final_satisfaction',
            growth: 50,
            princessSatisfaction: 100
        },
        lossCondition: {
            type: 'princess_rage',
            princessAnger: 100
        }
    }
};

// ===== GUEST CHARACTER DEFINITIONS =====
const GUEST_CHARACTERS = {
    goblin: {
        id: 'goblin',
        name: 'ゴブリン',
        sprite: 'goblin.png',
        personality: 'hungry',
        catchphrase: 'もっと食わせろ！腹減った！'
    },
    dragonoid: {
        id: 'dragonoid',
        name: 'ドラゴノイド',
        sprite: 'dragonoid.png',
        personality: 'destructive',
        catchphrase: '熱いのをよこせ！ぬるいと焼き尽くすぞ！'
    },
    srimon: {
        id: 'srimon',
        name: 'スリモン',
        sprite: 'srimon.png',
        personality: 'rival',
        catchphrase: 'ふん、その程度か？僕の料理を見せてやる'
    },
    elfPrincess: {
        id: 'elfPrincess',
        name: 'エルフ姫',
        sprite: 'elf_princess.png',
        personality: 'demanding',
        catchphrase: 'これじゃない！もっと...こう...キラキラした感じ！'
    }
};

/**
 * @typedef {Object} EpisodeDefinition
 * @property {number} id - Episode ID
 * @property {string} title - Episode title
 * @property {Object} goals - Completion goals
 * @property {Array} scenes - VN scenes for this episode
 * @property {Function} checkCompletion - Check if episode is complete
 */

class EpisodeManager {
    /**
     * @param {EventBus} eventBus - Event bus for communication
     * @param {DialogueSystem} dialogueSystem - Dialogue system
     * @param {GameState} gameState - Game state manager
     */
    constructor(eventBus, dialogueSystem, gameState) {
        this._eventBus = eventBus;
        this._dialogueSystem = dialogueSystem;
        this._gameState = gameState;

        // Episode registry (Open/Closed: can be extended)
        this._episodes = new Map();
        this._sceneData = new Map();

        // Register default episodes
        this._registerDefaultEpisodes();

        // Setup event listeners
        this._setupEventListeners();
    }

    // ===== Episode Registration (Open/Closed Principle) =====

    /**
     * Register an episode
     * @param {EpisodeDefinition} episode - Episode definition
     */
    registerEpisode(episode) {
        this._episodes.set(episode.id, episode);
    }

    /**
     * Register scene data for an episode
     * @param {string} sceneId - Scene identifier
     * @param {Array} dialogues - Dialogue lines
     */
    registerScene(sceneId, dialogues) {
        this._sceneData.set(sceneId, dialogues);
    }

    // ===== Default Episodes =====

    _registerDefaultEpisodes() {
        // Register all 5 episodes from EPISODE_CONFIG
        Object.values(EPISODE_CONFIG).forEach(config => {
            this.registerEpisode({
                id: config.id,
                title: config.title,
                subtitle: config.subtitle,
                description: config.description,
                guest: config.guest,
                characters: config.characters,
                modifiers: config.modifiers,
                winCondition: config.winCondition,
                lossCondition: config.lossCondition,
                isRivalBattle: config.isRivalBattle || false,
                rivalConfig: config.rivalConfig || null,
                isFinalBoss: config.isFinalBoss || false,
                checkCompletion: (state) => this._checkEpisodeWin(config.id, state),
                checkFailure: (state) => this._checkEpisodeLoss(config.id, state)
            });
        });

        // Register default scenes
        this._registerDefaultScenes();
    }

    /**
     * Check if episode win condition is met
     * @param {number} episodeId - Episode ID
     * @param {Object} state - Current game state
     * @returns {boolean}
     */
    _checkEpisodeWin(episodeId, state) {
        const config = EPISODE_CONFIG[episodeId];
        if (!config) return false;

        const win = config.winCondition;
        switch (win.type) {
            case 'growth_and_balance':
                return state.growth >= win.growth && this._gameState.isBalanced();

            case 'survive_orders':
                return (state.ordersCompleted || 0) >= win.ordersCompleted;

            case 'quality_survival':
                return state.ingredientQuality >= win.minQuality &&
                       state.day >= win.turnsToSurvive;

            case 'rival_battle':
                return state.day >= win.turnsToWin &&
                       state.growth > (state.rivalGrowth || 0);

            case 'final_satisfaction':
                return state.growth >= win.growth &&
                       (state.princessSatisfaction || 0) >= win.princessSatisfaction;

            default:
                return false;
        }
    }

    /**
     * Check if episode loss condition is met
     * @param {number} episodeId - Episode ID
     * @param {Object} state - Current game state
     * @returns {boolean}
     */
    _checkEpisodeLoss(episodeId, state) {
        const config = EPISODE_CONFIG[episodeId];
        if (!config) return false;

        const loss = config.lossCondition;
        switch (loss.type) {
            case 'stagnation':
                return state.stagnation >= loss.stagnation;

            case 'ingredients_zero':
                return state.currentIngredients <= 0;

            case 'quality_zero':
                return state.ingredientQuality <= 0;

            case 'rival_ahead':
                const rivalLead = (state.rivalGrowth || 0) - state.growth;
                return rivalLead >= loss.rivalLeadThreshold;

            case 'princess_rage':
                return (state.princessAnger || 0) >= loss.princessAnger;

            default:
                return false;
        }
    }

    /**
     * Get current episode's modifiers
     * @returns {Object} Episode modifiers
     */
    getEpisodeModifiers() {
        const episodeId = this._gameState.get('currentEpisode');
        const config = EPISODE_CONFIG[episodeId];
        return config ? config.modifiers : {
            qualityDecayRate: 1.0,
            orderFrequency: 1.0,
            ingredientConsumption: 1
        };
    }

    /**
     * Get current episode's guest character
     * @returns {Object|null} Guest character info
     */
    getEpisodeGuest() {
        const episodeId = this._gameState.get('currentEpisode');
        const config = EPISODE_CONFIG[episodeId];
        if (!config || !config.guest) return null;
        return GUEST_CHARACTERS[config.guest] || null;
    }

    /**
     * Check if current episode is a rival battle
     * @returns {boolean}
     */
    isRivalBattle() {
        const episodeId = this._gameState.get('currentEpisode');
        const config = EPISODE_CONFIG[episodeId];
        return config ? config.isRivalBattle : false;
    }

    /**
     * Get rival configuration for Episode 4
     * @returns {Object|null}
     */
    getRivalConfig() {
        const episodeId = this._gameState.get('currentEpisode');
        const config = EPISODE_CONFIG[episodeId];
        return config ? config.rivalConfig : null;
    }

    _registerDefaultScenes() {
        // ===== EPISODE 1: THE IMPOSSIBLE APPRENTICESHIP =====

        // Scene 1: The Rescue (Reincarnation)
        this.registerScene('SCENE1_RESCUE', [
            { speaker: 'narrator', text: '気がつくと、あなたは見知らぬ路上で倒れていた。' },
            { speaker: 'narrator', text: '記憶がぼんやりとしている...前世では確か、ITエンジニアだったような...？' },
            { speaker: 'mina', text: 'あ！大丈夫ですか！？しっかりして！' },
            { speaker: 'narrator', text: '若い女性の声が聞こえる。ピンク色の髪...猫耳...？' },
            { speaker: 'mina', text: 'お父さーん！誰か倒れてる！' },
            { speaker: 'narrator', text: 'これは...異世界転生というやつか...？' }
        ]);

        // Scene 2: Nekonohige Kitchen - Fuji wakes up
        this.registerScene('SCENE2_KITCHEN', [
            { speaker: 'narrator', text: '目を覚ますと、あなたは古びた食堂の中にいた。' },
            { speaker: 'mina', text: 'あ、目が覚めた！よかったぁ〜' },
            { speaker: 'mina', text: '私はミナ！ここは「ネコノヒゲ亭」だよ。お父さんがやってる食堂なの。' },
            { speaker: 'fuji', text: '...（自分の名前は...フジ、だったか？記憶が曖昧だ）' },
            { speaker: 'mina', text: 'えっと...お名前は？' },
            { speaker: 'fuji', text: 'フジ...だと思う。' },
            { speaker: 'mina', text: 'フジさんね！変わった格好してるけど...旅の人？' }
        ]);

        // Scene 3: The Master's Rejection
        this.registerScene('SCENE3_MASTER', [
            { speaker: 'narrator', text: '厨房から重い足音が聞こえてくる。' },
            { speaker: 'owner', text: 'ミナ、騒がしいぞ。客でも来たか？' },
            { speaker: 'mina', text: 'お父さん！この人、道で倒れてたの！働きたいって！' },
            { speaker: 'owner', text: 'ふん...見るからに素人だな。帰れ。' },
            { speaker: 'fuji', text: 'え...？' },
            { speaker: 'owner', text: 'ウチは人を育てる余裕はない。よそを当たれ。' },
            { speaker: 'mina', text: 'お父さん！そんな言い方ないよ！' },
            { speaker: 'mina', text: '最近お客さん減ってるし、手伝いがいた方がいいでしょ！' },
            { speaker: 'owner', text: '...チッ。うるさい娘だ。' },
            { speaker: 'narrator', text: '老店主はしばらく黙った後、厳しい目つきでフジを見た。' }
        ]);

        // Scene 4: The Impossible Challenge
        this.registerScene('SCENE4_CHALLENGE', [
            { speaker: 'owner', text: 'いいだろう。だが、条件がある。' },
            { speaker: 'owner', text: 'ワシの看板料理「キメラシチュー」を知っているか？' },
            { speaker: 'fuji', text: 'いえ...' },
            { speaker: 'owner', text: '異界の獣肉と薬草を煮込んだ伝説の一品だ。ワシが完成させるのに2年かかった。' },
            { speaker: 'owner', text: 'お前が本気で働きたいなら...7日以内にこれを再現してみろ。' },
            { speaker: 'mina', text: '7日！？お父さん、それは無茶だよ！' },
            { speaker: 'owner', text: '無茶？ならば帰れ。才能のない奴に使う時間はない。' },
            { speaker: 'fuji', text: '...（2年かかった料理を7日で？普通なら不可能だ）' },
            { speaker: 'fuji', text: '...（でも待てよ。前世で学んだ「アジャイル」の考え方なら...）' },
            { speaker: 'fuji', text: '...（小さく試して、フィードバックを得て、すばやく改善する）' },
            { speaker: 'fuji', text: '...（2年分の「経験」を7日で圧縮できるかもしれない！）' }
        ]);

        // Scene 5: Fuji accepts the challenge
        this.registerScene('SCENE5_START', [
            { speaker: 'fuji', text: 'やります。7日間で、必ず。' },
            { speaker: 'owner', text: 'ほう...？目だけは一人前だな。' },
            { speaker: 'owner', text: 'いいだろう。7日後にワシが味見する。合格ラインに届かなければ...出て行け。' },
            { speaker: 'mina', text: 'フジさん...！' },
            { speaker: 'fuji', text: '（伝統的な修行は時間がかかる。だが「反復実験」と「即時フィードバック」で）' },
            { speaker: 'fuji', text: '（不可能を可能にしてみせる...！）' },
            { speaker: 'narrator', text: 'こうして、フジの「7日間の試用期間」が始まった。' },
            { speaker: 'narrator', text: '伝統の味を「アジャイル」で攻略できるのか...？' }
        ]);

        // Perfect cycle event dialogue
        this.registerScene('PERFECT_CYCLE', [
            { speaker: 'mina', text: 'すごい！完璧なリズムだね！' },
            { speaker: 'owner', text: 'ふむ...悪くない動きだ。' }
        ]);

        // Stagnation crisis dialogue
        this.registerScene('STAGNATION_CRISIS', [
            { speaker: 'owner', text: 'また同じやり方か...少しは変化をつけろ！' },
            { speaker: 'mina', text: 'フジさん、違うアプローチも試してみて！' }
        ]);

        // Hybrid moment dialogue (Day 6)
        this.registerScene('HYBRID_MOMENT', [
            { speaker: 'narrator', text: '6日目の夕方。店主がめずらしく話しかけてきた。' },
            { speaker: 'owner', text: 'フジ。お前のやり方...認めたくはないが、客の反応は悪くない。' },
            { speaker: 'owner', text: 'だが、伝統を完全に捨てるつもりはない。わかっているな？' },
            { speaker: 'fuji', text: '...伝統と革新のバランス、ですね。' },
            { speaker: 'owner', text: 'ふん。生意気な奴だ。だが...その通りだ。' },
            { speaker: 'mina', text: '（お父さんがフジさんを認め始めてる...！）' }
        ]);
    }

    _setupEventListeners() {
        // Listen for perfect cycle
        this._eventBus.on(GameEvents.PERFECT_CYCLE, (data) => {
            this._playEventDialogue('PERFECT_CYCLE');
        });

        // Listen for stagnation crisis
        this._eventBus.on('stagnation:crisis', () => {
            this._playEventDialogue('STAGNATION_CRISIS');
        });

        // Listen for hybrid moment
        this._eventBus.on('episode1:hybrid_moment', () => {
            this._playHybridMoment();
        });

        // Listen for episode completion
        this._eventBus.on(GameEvents.EPISODE_COMPLETED, (data) => {
            this._onEpisodeCompleted(data.episode);
        });
    }

    // ===== Scene Playback =====

    /**
     * Play episode intro scenes
     * @param {number} episodeId - Episode ID
     * @param {Function} onComplete - Callback when complete
     */
    playEpisodeIntro(episodeId, onComplete) {
        if (episodeId === 1) {
            this._playScene1Intro(onComplete);
        } else {
            // Other episodes can have their intros defined here
            if (onComplete) onComplete();
        }
    }

    /**
     * Play Episode 1 intro sequence
     * @param {Function} onComplete - Callback when complete
     */
    _playScene1Intro(onComplete) {
        const scene1 = this._sceneData.get('SCENE1_RESCUE');

        // Opening scene: Fuji collapsed outside (食堂前夜.png - Exterior Night)
        this._eventBus.emit(GameEvents.SCENE_BACKGROUND_CHANGED, { scene: 'road' });
        this._eventBus.emit(GameEvents.CHARACTER_SHOWN, { characterId: 'mina' });

        this._dialogueSystem.start(scene1, 'intro', () => {
            // Scene 1 complete - trigger fade-to-black transition
            this._transitionToKitchen(onComplete);
        });
    }

    /**
     * Transition from Exterior Night to Interior Diner with fade-to-black
     * @param {Function} onComplete - Callback when complete
     */
    _transitionToKitchen(onComplete) {
        // Hide all characters before fade (they'll re-enter in the new scene)
        this._eventBus.emit(GameEvents.CHARACTER_HIDDEN, { characterId: 'mina' });
        this._eventBus.emit(GameEvents.CHARACTER_HIDDEN, { characterId: 'fuji' });
        this._eventBus.emit(GameEvents.CHARACTER_HIDDEN, { characterId: 'owner' });

        // Trigger fade-to-black transition to the warm diner interior
        this._eventBus.emit('scene:fade_transition', {
            toScene: BACKGROUNDS.INTERIOR_DINER,
            onComplete: () => {
                // After fade completes, play Scene 2 (Fuji wakes up)
                this._playScene2Kitchen(onComplete);
            }
        });
    }

    _playScene2Kitchen(onComplete) {
        const scene2 = this._sceneData.get('SCENE2_KITCHEN');

        // Characters appear after fade-in (inside the warm diner)
        setTimeout(() => {
            this._eventBus.emit(GameEvents.CHARACTER_SHOWN, { characterId: 'fuji' });
            this._eventBus.emit(GameEvents.CHARACTER_SHOWN, { characterId: 'mina' });
        }, 300);

        this._dialogueSystem.start(scene2, 'intro', () => {
            this._playScene3Master(onComplete);
        });
    }

    _playScene3Master(onComplete) {
        const scene3 = this._sceneData.get('SCENE3_MASTER');

        // Owner enters the scene
        this._eventBus.emit(GameEvents.CHARACTER_SHOWN, { characterId: 'owner' });

        this._dialogueSystem.start(scene3, 'intro', () => {
            // Continue to Scene 4: The Impossible Challenge
            this._playScene4Challenge(onComplete);
        });
    }

    _playScene4Challenge(onComplete) {
        const scene4 = this._sceneData.get('SCENE4_CHALLENGE');

        this._dialogueSystem.start(scene4, 'intro', () => {
            // Show choice: Accept the challenge or give up
            this._eventBus.emit(GameEvents.CHOICE_PRESENTED, {
                choices: [
                    { id: 'agile', text: 'A. 挑戦を受ける「7日で証明してみせます！」' },
                    { id: 'obedient', text: 'B. 諦める「...無理です、他を探します」' }
                ]
            });

            // Store callback for after choice
            this._pendingChoiceCallback = onComplete;
        });
    }

    /**
     * Handle player choice selection
     * @param {string} choiceId - 'obedient' or 'agile'
     */
    handleChoice(choiceId) {
        this._gameState.update({ playerChoice: choiceId });

        if (choiceId === 'obedient') {
            // Player gave up - bad ending
            this._gameState.adjust('oldManMood', -10, 0, 100);
            this._eventBus.emit(GameEvents.CHOICE_SELECTED, { choice: choiceId });
            this._playGiveUpEnding();
        } else {
            // Player accepts the challenge!
            this._gameState.adjust('oldManMood', 5, 0, 100);
            this._eventBus.emit(GameEvents.CHOICE_SELECTED, { choice: choiceId });
            this._playScene5Start();
        }
    }

    _playGiveUpEnding() {
        const giveUpScene = [
            { speaker: 'owner', text: '...そうか。賢明な判断だ。' },
            { speaker: 'owner', text: '素人が厨房で働くのは甘くない。他を当たれ。' },
            { speaker: 'mina', text: 'フジさん...' },
            { speaker: 'narrator', text: 'フジは「ネコノヒゲ亭」を後にした...' },
            { speaker: 'narrator', text: '【BAD END：挑戦なき者に道は開かれず】' }
        ];

        this._dialogueSystem.start(giveUpScene, 'intro', () => {
            // Show game over
            this._eventBus.emit(GameEvents.GAME_OVER, {
                state: this._gameState.getState(),
                reason: 'gave_up'
            });
        });
    }

    _playScene5Start() {
        const scene5 = this._sceneData.get('SCENE5_START');

        this._dialogueSystem.start(scene5, 'intro', () => {
            this._gameState.update({ introComplete: true });

            this._eventBus.emit(GameEvents.DIALOGUE_COMPLETED, { type: 'intro' });
            this._eventBus.emit(GameEvents.INTRO_COMPLETED, {});

            if (this._pendingChoiceCallback) {
                this._pendingChoiceCallback();
                this._pendingChoiceCallback = null;
            }
        });
    }

    _playEventDialogue(sceneId) {
        const scene = this._sceneData.get(sceneId);
        if (scene) {
            // DialogueSystem.start() will emit DIALOGUE_STARTED
            // DialogueUIRenderer will show the overlay and handle clicks
            this._dialogueSystem.start(scene, 'event');
        }
    }

    _playHybridMoment() {
        const scene = this._sceneData.get('HYBRID_MOMENT');
        if (scene) {
            this._eventBus.emit(GameEvents.CHARACTER_SHOWN, { characterId: 'owner' });
            this._eventBus.emit(GameEvents.CHARACTER_SHOWN, { characterId: 'mina' });
            this._dialogueSystem.start(scene, 'hybrid');
        }
    }

    _onEpisodeCompleted(episodeId) {
        const nextEpisode = episodeId + 1;
        if (this._episodes.has(nextEpisode)) {
            this._gameState.startEpisode(nextEpisode);
        }
    }

    // ===== Public Methods =====

    /**
     * Get episode info
     * @param {number} episodeId - Episode ID
     * @returns {EpisodeDefinition|null}
     */
    getEpisode(episodeId) {
        return this._episodes.get(episodeId) || null;
    }

    /**
     * Get current episode info
     * @returns {EpisodeDefinition|null}
     */
    getCurrentEpisode() {
        const currentId = this._gameState.get('currentEpisode');
        return this.getEpisode(currentId);
    }

    /**
     * Check if current episode is complete
     * @returns {boolean}
     */
    isCurrentEpisodeComplete() {
        const episode = this.getCurrentEpisode();
        if (!episode) return false;
        return episode.checkCompletion(this._gameState.getState());
    }

    /**
     * Get Mina's tip based on game state
     * @returns {string}
     */
    getMinaTip() {
        const state = this._gameState.getState();
        const tips = [];

        if (state.stagnation >= 70) {
            tips.push('停滞度が高いよ！違うアクションを試してみて！');
        }
        if (state.ingredientQuality < 30) {
            tips.push('品質が下がってる...CI/CDメンテナンスで改善しよう！');
        }
        if (state.oldManMood < 40) {
            tips.push('お父さんの機嫌が悪いみたい...成功を積み重ねて！');
        }
        if (state.technicalDebt > 5) {
            tips.push('技術的負債が溜まってるね。CI/CDで返済しよう！');
        }
        if (state.currentIngredients === 0) {
            tips.push('食材がないよ！CI/CDメンテナンスで補充して！');
        }

        // Perfect cycle hint
        const missing = this._gameState.getMissingActions();
        if (state.actionHistory.length >= 2 && missing.length === 1) {
            const actionNames = { 1: 'イテレーション試食', 2: 'CI/CDメンテナンス', 3: 'ユーザーフィードバック' };
            tips.push(`次は「${actionNames[missing[0]]}」でパーフェクトサイクル！`);
        }

        if (tips.length === 0) {
            tips.push('良い調子！バランスよくアクションを使い分けてね！');
        }

        return tips[Math.floor(Math.random() * tips.length)];
    }

    /**
     * Show Mina tip
     */
    showMinaTip() {
        const tip = this.getMinaTip();
        this._eventBus.emit(GameEvents.MINA_TIP_SHOWN, { message: tip });
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EpisodeManager };
}
