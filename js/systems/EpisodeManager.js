/**
 * EpisodeManager - Manages episode content and progression
 *
 * SOLID Principles:
 * - Single Responsibility: Only manages episode definitions and flow
 * - Open/Closed: New episodes can be added via registerEpisode()
 * - Dependency Inversion: Uses EventBus for communication
 */

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
        // Episode 1: The Beginning
        this.registerEpisode({
            id: 1,
            title: '第1話：伝統を守りながら、変化を受け入れろ',
            goals: {
                growth: 20,
                balanced: true
            },
            checkCompletion: (state) => {
                return state.growth >= 20 && this._gameState.isBalanced();
            }
        });

        // Episode 2: Special Customers
        this.registerEpisode({
            id: 2,
            title: '第2話：無理難題！異世界の顧客に対応せよ',
            goals: {
                specialChallengeSuccess: 2
            },
            checkCompletion: (state) => {
                return state.specialChallengeSuccess >= 2;
            }
        });

        // Episode 3: Final Challenge
        this.registerEpisode({
            id: 3,
            title: '最終話：老店主にアジャイルを認めさせろ！',
            goals: {
                growth: 50,
                oldManMood: 80
            },
            checkCompletion: (state) => {
                return state.growth >= 50 && state.oldManMood >= 80;
            }
        });

        // Register default scenes
        this._registerDefaultScenes();
    }

    _registerDefaultScenes() {
        // Scene 1: The Rescue (Reincarnation)
        this.registerScene('SCENE1_RESCUE', [
            { speaker: 'narrator', text: '気がつくと、あなたは見知らぬ路上で倒れていた。' },
            { speaker: 'narrator', text: '記憶がぼんやりとしている...前世では確か、ITエンジニアだったような...？' },
            { speaker: 'mina', text: 'あ！大丈夫ですか！？しっかりして！' },
            { speaker: 'narrator', text: '若い女性の声が聞こえる。ピンク色の髪...猫耳...？' },
            { speaker: 'mina', text: 'お父さーん！誰か倒れてる！' },
            { speaker: 'narrator', text: 'これは...異世界転生というやつか...？' }
        ]);

        // Scene 2: Nekonohige Kitchen
        this.registerScene('SCENE2_KITCHEN', [
            { speaker: 'narrator', text: '目を覚ますと、あなたは古びた食堂の中にいた。' },
            { speaker: 'mina', text: 'あ、目が覚めた！よかったぁ〜' },
            { speaker: 'mina', text: '私はミナ！ここは「猫の髭亭」だよ。お父さんがやってる食堂なの。' },
            { speaker: 'fuji', text: '...（自分の名前は...フジ、だったか？記憶が曖昧だ）' },
            { speaker: 'mina', text: 'えっと...お名前は？' },
            { speaker: 'fuji', text: 'フジ...だと思う。' },
            { speaker: 'mina', text: 'フジさんね！変わった格好してるけど...旅の人？' }
        ]);

        // Scene 3: The Master
        this.registerScene('SCENE3_MASTER', [
            { speaker: 'narrator', text: '厨房から重い足音が聞こえてくる。' },
            { speaker: 'owner', text: 'ミナ、騒がしいぞ。客でも来たか？' },
            { speaker: 'mina', text: 'お父さん！この人、道で倒れてたの！' },
            { speaker: 'owner', text: 'ふむ...見慣れない服装だな。どこから来た？' },
            { speaker: 'fuji', text: '...正直、よく覚えていません。' },
            { speaker: 'owner', text: '記憶がないのか。まあいい、腹は減っているだろう。食っていけ。' },
            { speaker: 'narrator', text: '老店主は無愛想だが、悪い人ではなさそうだ。' },
            { speaker: 'owner', text: 'しかし、タダ飯はない。食ったら厨房を手伝ってもらう。' },
            { speaker: 'owner', text: 'この店は人手が足りん。お前、料理はできるか？' },
            { speaker: 'fuji', text: '料理は...わかりませんが、働くことならできます。' },
            { speaker: 'owner', text: 'よかろう。だが、ワシのやり方に口出しはするなよ。' }
        ]);

        // Scene 5: The Start (after choice)
        this.registerScene('SCENE5_START', [
            { speaker: 'owner', text: '...まあいい。とにかく働きながら覚えろ。' },
            { speaker: 'mina', text: 'フジさん、頑張ってね！私も手伝うから！' },
            { speaker: 'narrator', text: 'こうして、あなたの異世界キッチンでの日々が始まった。' },
            { speaker: 'narrator', text: '前世の知識が、この古びた食堂で役に立つだろうか...？' }
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

        // Opening scene: Fuji collapsed outside (食堂前夜.png)
        this._eventBus.emit(GameEvents.SCENE_BACKGROUND_CHANGED, { scene: 'road' });
        this._eventBus.emit(GameEvents.CHARACTER_SHOWN, { characterId: 'mina' });

        this._dialogueSystem.start(scene1, 'intro', () => {
            this._playScene2Kitchen(onComplete);
        });
    }

    _playScene2Kitchen(onComplete) {
        const scene2 = this._sceneData.get('SCENE2_KITCHEN');

        // Transition to diner interior (食堂.png) with fade effect
        this._eventBus.emit(GameEvents.SCENE_BACKGROUND_CHANGED, { scene: 'restaurant' });

        // Hide Mina first, then show both after background transition
        this._eventBus.emit(GameEvents.CHARACTER_HIDDEN, { characterId: 'mina' });

        // Delay character appearance for smoother transition
        setTimeout(() => {
            this._eventBus.emit(GameEvents.CHARACTER_SHOWN, { characterId: 'fuji' });
            this._eventBus.emit(GameEvents.CHARACTER_SHOWN, { characterId: 'mina' });
        }, 400);

        this._dialogueSystem.start(scene2, 'intro', () => {
            this._playScene3Master(onComplete);
        });
    }

    _playScene3Master(onComplete) {
        const scene3 = this._sceneData.get('SCENE3_MASTER');

        // Owner enters the scene
        this._eventBus.emit(GameEvents.CHARACTER_SHOWN, { characterId: 'owner' });

        this._dialogueSystem.start(scene3, 'intro', () => {
            // Show choice
            this._eventBus.emit(GameEvents.CHOICE_PRESENTED, {
                choices: [
                    { id: 'obedient', text: 'A. 黙って従う「わかりました、ご指導お願いします」' },
                    { id: 'agile', text: 'B. アジャイルを提案「...効率化の提案があるのですが」' }
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
            this._gameState.adjust('traditionScore', 10, 0, 100);
            this._gameState.adjust('oldManMood', 10, 0, 100);
        } else {
            this._gameState.adjust('traditionScore', -10, 0, 100);
            this._gameState.adjust('oldManMood', -5, 0, 100);
            this._gameState.update({ hasChefKnife: true });
        }

        this._eventBus.emit(GameEvents.CHOICE_SELECTED, { choice: choiceId });

        // Play scene 5
        this._playScene5Start();
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
