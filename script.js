// ===== ネコノヒゲ：アジャイル厨房 =====
// 異世界食堂で学ぶアジャイルマインド

// --- ゲーム状態 ---
let day = 1;
let stagnation = 50;
let growth = 0;
let technicalDebt = 0; // 技術的負債（隠しパラメータ）
let lastAction = 0;
const MAX_GROWTH = 50;

// --- Story Intro State ---
let introComplete = false;
let playerChoice = null; // 'obedient' or 'agile'

// --- コンボチェーンシステム ---
let actionHistory = [];
let perfectCycleCount = 0;

const ACTION_NAMES = {
    1: "試食",
    2: "CI/CD",
    3: "傾聴"
};

const ACTION_ICONS = {
    1: "🍳",
    2: "🔧",
    3: "👥"
};

// アジャイル格言集
const AGILE_TIPS = [
    "小さなバッチでリスクを減らせ！価値を少しずつ届けよう。",
    "フィードバックループは必須。顧客の声に耳を傾けよう！",
    "継続的改善は完璧な計画に勝る。",
    "変化を歓迎せよ。それが競争優位になる！",
    "動くソフトウェアこそ進捗の証。",
    "最良のアーキテクチャは自己組織化チームから生まれる。",
    "シンプルさとは、やらない仕事を最大化する技術である。",
    "定期的に振り返り、行動を調整せよ。",
    "持続可能なペースがチームを健全に保つ。",
    "対面での会話が最も効率的なコミュニケーション。"
];

let currentEpisode = 1;
let oldManMood = 70;
let ingredientQuality = 50;
let currentIngredients = 3;
let specialCustomer = null;
let specialChallengeSuccess = 0;
let requirementChangeActive = false;

// --- Episode 1 Story State ---
let traditionScore = 50; // 0-100: 0=full innovation, 100=full tradition
let hybridMomentTriggered = false;
let hasChefKnife = false;

// --- エピソードデータ ---
const EPISODE_GOALS = {
    1: { goalGrowth: 20, goalBalance: true, message: "第1話：伝統を守りながら、変化を受け入れろ" },
    2: { goalSuccess: 2, message: "第2話：無理難題！異世界の顧客に対応せよ" },
    3: { goalGrowth: 50, goalMood: 80, message: "最終話：老店主にアジャイルを認めさせろ！" }
};

// --- パーフェクトサイクル判定 ---
function checkPerfectCycle() {
    if (actionHistory.length < 3) return false;
    const lastThree = actionHistory.slice(-3);
    const uniqueActions = new Set(lastThree);
    return uniqueActions.size === 3;
}

// --- コンボ表示更新 ---
function updateComboDisplay() {
    const comboContainer = document.getElementById('combo-display');
    if (!comboContainer) return;

    let html = '<div class="combo-header">スプリントサイクル</div>';
    html += '<div class="combo-slots">';

    for (let i = 0; i < 3; i++) {
        const actualIndex = Math.max(0, actionHistory.length - 3) + i;
        if (actualIndex < actionHistory.length && actionHistory.length > i) {
            const act = actionHistory[actualIndex];
            html += `<div class="combo-slot filled">${ACTION_ICONS[act]}<span>${ACTION_NAMES[act]}</span></div>`;
        } else {
            html += '<div class="combo-slot empty">?</div>';
        }
    }
    html += '</div>';

    if (checkPerfectCycle()) {
        html += `<div class="combo-perfect">パーフェクトサイクル！</div>`;
        if (perfectCycleCount > 1) {
            html += `<div class="combo-streak">${perfectCycleCount}連続！</div>`;
        }
    } else if (actionHistory.length >= 2) {
        const remaining = getMissingActions();
        if (remaining.length === 1) {
            html += `<div class="combo-hint">次は「${ACTION_NAMES[remaining[0]]}」でパーフェクト！</div>`;
        }
    }

    comboContainer.innerHTML = html;
}

// --- 足りないアクション取得 ---
function getMissingActions() {
    const lastTwo = actionHistory.slice(-2);
    const allActions = [1, 2, 3];
    return allActions.filter(a => !lastTwo.includes(a));
}

// --- アジャイル格言モーダル表示 ---
function showAgileTip() {
    const tip = AGILE_TIPS[Math.floor(Math.random() * AGILE_TIPS.length)];
    const modal = document.getElementById('agile-tip-modal');
    const tipText = document.getElementById('agile-tip-text');
    if (modal && tipText) {
        tipText.textContent = tip;
        modal.classList.remove('hidden');
    }
}

function closeAgileTip() {
    const modal = document.getElementById('agile-tip-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// --- 主人公アニメーション ---
function triggerFujiBounce() {
    const fujiImage = document.getElementById('fuji-image');
    if (fujiImage) {
        fujiImage.classList.add('action-bounce');
        setTimeout(() => {
            fujiImage.classList.remove('action-bounce');
        }, 600);
    }
}

// --- ゲーム初期化 ---
function initializeGame() {
    if (document.getElementById('day')) {
        updateMeters();
        console.log("ネコノヒゲ厨房、初期化完了！");
        // オープニングダイアログを表示
        showOpeningDialogue();
    } else {
        console.error("DOM要素が見つかりません");
    }
}

// --- メーター更新 ---
function updateMeters() {
    document.getElementById('day').textContent = day;

    document.getElementById('stagnation-val').textContent = stagnation;
    document.getElementById('stagnation-meter').style.width = `${stagnation}%`;

    document.getElementById('growth-val').textContent = growth;
    document.getElementById('growth-meter').style.width = `${(growth / MAX_GROWTH) * 100}%`;

    updateComboDisplay();
    updateBalanceGauge();

    // ステータス表示（技術的負債含む）
    let statusHTML = `
        <div class="status-row">
            <span class="status-label">老店主の機嫌</span>
            <span class="status-value">${oldManMood}/100</span>
        </div>
        <div class="status-row">
            <span class="status-label">食材の品質</span>
            <span class="status-value">${ingredientQuality}/100</span>
        </div>
        <div class="status-row">
            <span class="status-label">手持ち食材</span>
            <span class="status-value">${currentIngredients}個</span>
        </div>
    `;

    if (technicalDebt > 0) {
        statusHTML += `
            <div class="status-row warning">
                <span class="status-label">技術的負債</span>
                <span class="status-value debt">停滞度 +${technicalDebt}</span>
            </div>
        `;
    }

    if (stagnation >= 80) {
        statusHTML += `<div class="alert-box danger">停滞度が危険域！老店主の忍耐が限界に…</div>`;
    } else if (ingredientQuality < 30) {
        statusHTML += `<div class="alert-box warning">品質警告！食材が劣化しています</div>`;
    }

    document.getElementById('status-additional').innerHTML = statusHTML;

    // エピソード表示
    const epData = EPISODE_GOALS[currentEpisode];
    let epStatus = `<div class="episode-title">${epData.message}</div>`;

    if (currentEpisode === 1) {
        const balanceStatus = isBalanced() ? "達成" : "未達成";
        epStatus += `<div class="episode-goal">目標：成長度 ${growth}/${epData.goalGrowth} ＆ バランス（${balanceStatus}）</div>`;
    } else if (currentEpisode === 2) {
        epStatus += `<div class="episode-goal">目標：特殊客対応 ${specialChallengeSuccess}/${epData.goalSuccess}回</div>`;
    } else if (currentEpisode === 3) {
        epStatus += `<div class="episode-goal">目標：成長度 ${growth}/${epData.goalGrowth} ＆ 店主機嫌 ${oldManMood}/${epData.goalMood}以上</div>`;
    }
    document.getElementById('episode-status').innerHTML = epStatus;

    // 今日のお題
    document.getElementById('todays-challenge').innerHTML = generateChallenge();
}

// --- バランスゲージ更新 ---
function updateBalanceGauge() {
    const indicator = document.getElementById('balance-indicator');
    const status = document.getElementById('balance-status');
    if (!indicator || !status) return;

    // Position: 0% = full tradition (left), 100% = full innovation (right)
    // traditionScore: 0 = innovation, 100 = tradition
    const position = 100 - traditionScore;
    indicator.style.left = `${position}%`;

    // Remove all classes
    indicator.classList.remove('tradition-heavy', 'innovation-heavy', 'balanced');
    status.classList.remove('tradition', 'innovation', 'balanced');

    if (traditionScore >= 60) {
        indicator.classList.add('tradition-heavy');
        status.classList.add('tradition');
        status.textContent = '伝統寄り：革新が必要';
    } else if (traditionScore <= 40) {
        indicator.classList.add('innovation-heavy');
        status.classList.add('innovation');
        status.textContent = '革新寄り：伝統を尊重せよ';
    } else {
        indicator.classList.add('balanced');
        status.classList.add('balanced');
        status.textContent = '調和：伝統と革新のバランス';
    }
}

// --- バランス判定 ---
function isBalanced() {
    return traditionScore >= 35 && traditionScore <= 65;
}

// --- 今日のお題生成 ---
function generateChallenge() {
    const challenges = [
        "客足が多い日。迅速な対応（CI/CD）が重要！",
        "老店主が監視中。大きな変更（イテレーション試食）は控えめに。",
        "仕入れ問題発生。リソースを節約せよ！",
        "曖昧な注文が多い。ユーザーの声を聴く絶好の機会！",
        "古い設備（技術的負債）に注意。CI/CDに集中すべき日。",
    ];

    let challengeHTML = '<div class="challenge-label">今日のスプリント目標</div>';
    if (specialCustomer) {
        challengeHTML += `<div class="challenge-text urgent">緊急：${specialCustomer.name}の要求に対応せよ！</div>`;
    } else if (requirementChangeActive) {
        challengeHTML += `<div class="challenge-text urgent">仕様変更：顧客が注文を変更しました！</div>`;
    } else {
        challengeHTML += `<div class="challenge-text">${challenges[Math.floor(Math.random() * challenges.length)]}</div>`;
    }
    return challengeHTML;
}

// --- 特殊客チェック ---
function checkSpecialCustomer() {
    if (currentEpisode !== 2) {
        specialCustomer = null;
        return "";
    }
    if (Math.random() < 0.25) {
        const customers = [
            { name: "スライム", requirement: "プニプニ感を増したゲル", bonus: 15, canChangeReq: true },
            { name: "ドラゴン", requirement: "炎を吐くスパイスブレンド", bonus: 25, canChangeReq: false },
        ];
        specialCustomer = customers[Math.floor(Math.random() * customers.length)];
        return `<div class="event-box special">新規顧客：${specialCustomer.name}が「${specialCustomer.requirement}」を注文！</div>`;
    }
    specialCustomer = null;
    return "";
}

// --- ランダムイベント発生 ---
function triggerEvent() {
    let eventMessage = "";

    // 仕様変更イベント（スライム専用）
    if (specialCustomer && specialCustomer.canChangeReq && Math.random() < 0.3) {
        requirementChangeActive = true;
        const newRequirements = [
            "やっぱりカリカリにして！",
            "待って、冷たいのがいい！",
            "キラキラを追加できる？"
        ];
        const newReq = newRequirements[Math.floor(Math.random() * newRequirements.length)];
        specialCustomer.requirement = newReq;
        technicalDebt += 5;
        eventMessage += `<div class="event-box scope-change">仕様変更！ ${specialCustomer.name}：「${newReq}」（技術的負債 +5）</div>`;
    }

    // 通常イベント
    if (Math.random() < 0.35) {
        const events = [
            { type: 'quality_drop', message: "設備劣化！品質が急低下しました。" },
            { type: 'oldman_anger', message: "老店主の圧力：「なぜレシピ通りにやらん！」" },
            { type: 'slow_day', message: "閑散とした日。革新を求める声がない。停滞度上昇。" },
            { type: 'tech_debt', message: "レガシーコード！古い厨房の習慣が足を引っ張る。" }
        ];
        const event = events[Math.floor(Math.random() * events.length)];
        eventMessage += `<div class="event-box negative">${event.message}</div>`;

        if (event.type === 'quality_drop') ingredientQuality = Math.max(0, ingredientQuality - 20);
        if (event.type === 'oldman_anger') oldManMood = Math.max(0, oldManMood - 20);
        if (event.type === 'slow_day') stagnation = Math.min(100, stagnation + 10);
        if (event.type === 'tech_debt') technicalDebt += 3;
    }

    eventMessage += checkSpecialCustomer();

    return eventMessage;
}

// --- メインアクションロジック ---
function runAction(actionId) {
    if (growth >= MAX_GROWTH || stagnation >= 90 || ingredientQuality <= 0 || oldManMood <= 0) return;

    triggerFujiBounce();
    requirementChangeActive = false;

    day++;
    let message = `<div class="day-header">DAY ${day - 1} 振り返り</div>`;
    let baseSuccessRate = 0.45;

    // アクション履歴追跡
    actionHistory.push(actionId);
    if (actionHistory.length > 3) {
        actionHistory.shift();
    }

    // 技術的負債の効果適用
    if (technicalDebt > 0) {
        stagnation = Math.min(100, stagnation + Math.floor(technicalDebt / 5));
    }

    // --- Episode 1: Tradition vs Innovation Balance ---
    if (currentEpisode === 1) {
        // Action 1 (試食/Iteration) = Innovation (decreases tradition)
        // Action 2 (CI/CD) = Balanced (slight tradition due to maintenance)
        // Action 3 (Feedback) = Innovation (customer-focused)
        if (actionId === 1) {
            traditionScore = Math.max(0, traditionScore - 8);
        } else if (actionId === 2) {
            traditionScore = Math.min(100, traditionScore + 3);
        } else if (actionId === 3) {
            traditionScore = Math.max(0, traditionScore - 5);
        }

        // Hybrid Moment: Trigger around Day 6
        if (day === 6 && !hybridMomentTriggered) {
            hybridMomentTriggered = true;
            setTimeout(showHybridMomentDialogue, 500);
        }
    }

    // 停滞ロジック
    let showCrisisDialogue = false;
    if (actionId === lastAction) {
        stagnation = Math.min(100, stagnation + 12);
        oldManMood = Math.max(0, oldManMood - 5);
        technicalDebt += 2;
        // Repeating same action increases tradition (stuck in old ways)
        traditionScore = Math.min(100, traditionScore + 5);
        message += `<div class="result-item negative">同じアクションの繰り返し！停滞度上昇、信頼低下。技術的負債 +2</div>`;
        perfectCycleCount = 0;
        showCrisisDialogue = true; // 停滞危機ダイアログをトリガー
    } else {
        stagnation = Math.max(0, stagnation - 7);
        message += `<div class="result-item positive">新しいアプローチ！ルーティンを打破。</div>`;
    }

    // パーフェクトサイクルチェック
    if (checkPerfectCycle()) {
        perfectCycleCount++;
        const bonusGrowth = 10 + (perfectCycleCount > 1 ? 5 : 0);
        const bonusStagnation = 15 + (perfectCycleCount > 1 ? 5 : 0);
        const debtReduction = Math.min(technicalDebt, 3);

        growth += bonusGrowth;
        stagnation = Math.max(0, stagnation - bonusStagnation);
        oldManMood = Math.min(100, oldManMood + 5);
        technicalDebt = Math.max(0, technicalDebt - debtReduction);

        message += `<div class="result-item perfect">パーフェクトサイクル！ 成長 +${bonusGrowth}、停滞 -${bonusStagnation}、負債 -${debtReduction}</div>`;
        if (perfectCycleCount > 1) {
            message += `<div class="result-item streak">${perfectCycleCount}連続ボーナス！</div>`;
        }

        // VNダイアログを表示（パーフェクトサイクル）
        setTimeout(showPerfectCycleDialogue, 500);
    } else {
        perfectCycleCount = 0;
    }

    lastAction = actionId;

    // 成功率調整
    let adjustedSuccessRate = baseSuccessRate;
    if (ingredientQuality < 30) adjustedSuccessRate -= 0.3;
    if (oldManMood < 30) adjustedSuccessRate -= 0.15;
    if (currentIngredients === 0 && actionId !== 2) adjustedSuccessRate -= 0.2;
    if (technicalDebt > 10) adjustedSuccessRate -= 0.1;

    let success = Math.random() < adjustedSuccessRate;

    // アクション結果
    if (actionId === 1) { // イテレーション試食
        currentIngredients = Math.max(0, currentIngredients - 1);
        if (specialCustomer && success) {
            growth += specialCustomer.bonus;
            specialChallengeSuccess += 1;
            message += `<div class="result-item success">イテレーション試食：${specialCustomer.name}の要求をクリア！ 成長 +${specialCustomer.bonus}</div>`;
            specialCustomer = null;
        } else if (success) {
            growth += 15;
            stagnation = Math.max(0, stagnation - 15);
            oldManMood = Math.min(100, oldManMood + 10);
            message += `<div class="result-item success">イテレーション試食：新しい味の組み合わせが成功！ 成長 +15</div>`;
        } else {
            oldManMood = Math.max(0, oldManMood - 15);
            technicalDebt += 1;
            message += `<div class="result-item failure">イテレーション試食：失敗！老店主が不満。技術的負債 +1</div>`;
        }
    } else if (actionId === 2) { // CI/CDキッチンメンテナンス
        if (success) {
            ingredientQuality = Math.min(100, ingredientQuality + 30);
            stagnation = Math.max(0, stagnation - 5);
            currentIngredients = Math.min(5, currentIngredients + 2);
            technicalDebt = Math.max(0, technicalDebt - 2);
            message += `<div class="result-item success">CI/CDメンテナンス：厨房を最適化！ 品質 +30、食材 +2、負債 -2</div>`;
        } else {
            ingredientQuality = Math.max(0, ingredientQuality - 10);
            message += `<div class="result-item failure">CI/CDメンテナンス：自動化失敗。品質が低下。</div>`;
        }
    } else if (actionId === 3) { // ユーザーフィードバックループ
        if (success) {
            growth += 20;
            oldManMood = Math.min(100, oldManMood + 5);
            message += `<div class="result-item success">ユーザーの声：顧客から貴重な洞察を得た！ 成長 +20</div>`;
        } else {
            message += `<div class="result-item neutral">ユーザーの声：顧客は「いつもの」を注文。特に収穫なし。</div>`;
        }
    }

    // ターン終了処理
    ingredientQuality = Math.max(0, ingredientQuality - 5);
    message += triggerEvent();

    growth = Math.min(MAX_GROWTH, growth);
    document.getElementById('result').innerHTML = message;
    updateMeters();

    // ミナのアジャイルTipsをランダム表示
    maybeShowMinaTip();

    // 停滞危機ダイアログを表示
    if (showCrisisDialogue && stagnation >= 60) {
        setTimeout(showStagnationCrisisDialogue, 500);
    }

    // エピソード進行
    if (currentEpisode === 1 && growth >= EPISODE_GOALS[1].goalGrowth && isBalanced()) {
        // Episode 1 Clear - Show VN dialogue then clear screen
        setTimeout(showEpisode1ClearDialogue, 800);
    } else if (currentEpisode === 2 && specialChallengeSuccess >= EPISODE_GOALS[2].goalSuccess) {
        currentEpisode = 3;
        document.getElementById('message').innerHTML = '<span class="episode-clear">第2話クリア！</span> 変化への対応力を身につけた！';
    }

    // ゲームオーバー判定
    if (stagnation >= 90 || ingredientQuality <= 0 || oldManMood <= 0) {
        document.getElementById('actions').style.display = 'none';
        document.getElementById('gameover').classList.remove('hidden');
        return;
    }

    // クリア判定
    if (currentEpisode === 3 && growth >= MAX_GROWTH && oldManMood >= EPISODE_GOALS[3].goalMood) {
        document.getElementById('actions').style.display = 'none';
        document.getElementById('ending').classList.remove('hidden');
        document.getElementById('message').innerHTML = '<span class="victory">老店主がついにアジャイルを認めた！</span>';
    }
}

// ===== VN Dialogue System =====
let vnDialogueQueue = [];
let vnCurrentIndex = 0;
let vnTypingInterval = null;
let vnIsTyping = false;
let vnCurrentText = "";
let vnCharIndex = 0;
let vnOnComplete = null;

const DIALOGUE_SPEED = 30; // ms per character

// キャラクター定義
const VN_CHARACTERS = {
    fuji: { name: "フジ", position: "left" },
    owner: { name: "老店主", position: "right" },
    mina: { name: "ミナ", position: "left" },
    narrator: { name: "ナレーター", position: "center" }
};

// ミナのアジャイルTips（ゲーム中にランダム表示）
const MINA_AGILE_TIPS = [
    "（こっそり）お父さんには内緒だけど…小さく試して、失敗から学ぶのが大事よ！",
    "（ひそひそ）完璧な計画より、まず動くものを作ってみて！",
    "（ウィンク）お客様の反応を見て調整する。それがアジャイルの秘訣！",
    "（小声で）変化を恐れないで。それが成長のチャンスよ！",
    "（こっそり教えてあげる）試食→改善→フィードバック…このサイクルを回してね！",
    "（ひそひそ）一度に全部完璧にしようとしないで。少しずつ改善していこう！"
];

let lastMinaTipDay = 0; // ミナのTipsが最後に表示された日

// ===== 第1話：導入シーン（5シーン構成） =====

// シーン1：救出（暗い背景、転生してミナに発見される）
const SCENE1_RESCUE = [
    { speaker: "narrator", text: "暗闇の中、意識が戻る…" },
    { speaker: "fuji", text: "うっ…ここは…どこだ…？" },
    { speaker: "narrator", text: "プロジェクトマネージャーだった男、フジ。デスマーチの果てに、異世界へと転生した。" },
    { speaker: "fuji", text: "最後に覚えているのは…終わりなき会議と「もう限界だ」という言葉…" },
    { speaker: "narrator", text: "道端に倒れていたところを、一人の少女に発見される。" },
    { speaker: "mina", text: "大変！誰か倒れてる！" },
    { speaker: "mina", text: "もしもし、大丈夫ですか？" },
    { speaker: "fuji", text: "う…ん…" },
    { speaker: "mina", text: "よかった、息がある！私はミナ。うちのお店に連れていくから、しっかりして！" }
];

// シーン2：ネコノヒゲの厨房（ミナがフジを紹介）
const SCENE2_KITCHEN = [
    { speaker: "narrator", text: "数時間後、『ネコノヒゲ』の厨房にて…" },
    { speaker: "fuji", text: "ここは…？料理の匂いが…" },
    { speaker: "mina", text: "気がついた！よかった〜" },
    { speaker: "mina", text: "ここは私の家の食堂『ネコノヒゲ』よ。お父さーん！この人、目が覚めたよ！" }
];

// シーン3：店主登場（タダ飯と労働契約）
const SCENE3_MASTER = [
    { speaker: "owner", text: "ふむ…目が覚めたか、異世界人よ。" },
    { speaker: "fuji", text: "あなたは…？" },
    { speaker: "owner", text: "ワシはこの食堂『ネコノヒゲ』の店主じゃ。娘のミナがお前を拾ってきおった。" },
    { speaker: "mina", text: "お父さん、この人お腹すいてたみたいで、ちょっとご飯を…" },
    { speaker: "owner", text: "おい！！" },
    { speaker: "owner", text: "ワシの100年レシピで作った料理を3皿も平らげおって！" },
    { speaker: "fuji", text: "す、すみません…気づいたら体が勝手に…" },
    { speaker: "owner", text: "タダ飯を食った以上、働いて返してもらうぞ！" },
    { speaker: "fuji", text: "働く…ですか？" },
    { speaker: "owner", text: "そうじゃ！だがな、ワシにはワシのやり方がある。" },
    { speaker: "owner", text: "この食堂は100年の歴史を持つ。メニューは全て計画済み。一切の変更は許さん！" },
    { speaker: "owner", text: "ワシの完璧な3ヶ月計画に従え。素人の意見など不要じゃ！" },
    { speaker: "owner", text: "さあ、どうする？ワシの計画に従うか？" }
];

// 選択肢後の分岐ダイアログ（選択肢A：従う）
const CHOICE_A_DIALOGUE = [
    { speaker: "fuji", text: "わかりました！店主のご指導に従います！" },
    { speaker: "owner", text: "ふむ、素直でよろしい。" },
    { speaker: "mina", text: "（こっそり）ねえ、本当にそれでいいの？" },
    { speaker: "fuji", text: "（小声で）まずは信頼を得ないと…" },
    { speaker: "owner", text: "何をこそこそ話しておる！" }
];

// 選択肢後の分岐ダイアログ（選択肢B：アジャイル提案）
const CHOICE_B_DIALOGUE = [
    { speaker: "fuji", text: "店主、私は前の世界で…プロジェクトを管理する仕事をしていました。" },
    { speaker: "owner", text: "ほう？" },
    { speaker: "fuji", text: "経験上、長期の完璧な計画より…小さく試して、お客様の声を聴きながら改善する方が…" },
    { speaker: "owner", text: "黙れ！" },
    { speaker: "owner", text: "素人が何を偉そうに！100年の伝統を舐めるな！" },
    { speaker: "mina", text: "お、お父さん落ち着いて…" },
    { speaker: "owner", text: "ミナは黙っておれ！" },
    { speaker: "owner", text: "（フジを睨みつけながら）…いいだろう。お前の『イテレーティブ』とやらを見せてみろ。" },
    { speaker: "owner", text: "だが失敗したらただでは済まさんぞ！" },
    { speaker: "fuji", text: "（やはり…この世界でもアジャイルの価値を証明しなければ…！）" }
];

// シーン5：修行開始（選択後、ゲーム開始直前）
const SCENE5_START = [
    { speaker: "owner", text: "さあ、働け！まずは今日のスプリントからじゃ！" },
    { speaker: "mina", text: "（ウィンク）私もこっそり応援してるからね！" },
    { speaker: "owner", text: "ミナ！余計なことを言うな！" },
    { speaker: "narrator", text: "こうして、フジの『ネコノヒゲ』での修行が始まった。" },
    { speaker: "narrator", text: "【チュートリアル】3つのアクションを使い分けて、成長度を上げよう！" }
];

// 旧オープニングダイアログ（互換性のため保持）
const OPENING_DIALOGUE = SCENE5_START;

// パーフェクトサイクル時のダイアログ
const PERFECT_CYCLE_DIALOGUES = [
    [
        { speaker: "fuji", text: "試食、メンテナンス、フィードバック…完璧なサイクルです！" },
        { speaker: "owner", text: "ふん…確かに厨房の調子がいいようじゃが…" }
    ],
    [
        { speaker: "fuji", text: "これがアジャイルの力！継続的な改善です！" },
        { speaker: "owner", text: "まぐれじゃ…まぐれに決まっておる…" }
    ],
    [
        { speaker: "fuji", text: "お客様の声を聴いて、試して、改善する。このサイクルが大切なんです！" },
        { speaker: "owner", text: "…少しは認めてやらんこともない" }
    ]
];

// 停滞危機時のダイアログ
const STAGNATION_CRISIS_DIALOGUES = [
    [
        { speaker: "owner", text: "見ろ！お前のやり方では厨房が停滞しておるぞ！" },
        { speaker: "fuji", text: "くっ…同じことを繰り返してしまった…変化が必要です！" }
    ],
    [
        { speaker: "owner", text: "ほれ見たことか！計画通りにやらないからじゃ！" },
        { speaker: "fuji", text: "いえ、これは学びのチャンスです！次のスプリントで改善します！" }
    ],
    [
        { speaker: "fuji", text: "停滞度が上がっている…アプローチを変えないと！" },
        { speaker: "owner", text: "ワシの言う通りにしておれば…" },
        { speaker: "fuji", text: "いいえ、だからこそ新しい方法を試すんです！" }
    ]
];

// --- Episode 1: Hybrid Moment Dialogue (Day 6) ---
const HYBRID_MOMENT_DIALOGUE = [
    { speaker: "owner", text: "なんだこれは！スライムの客が料理に文句を言っておるぞ！" },
    { speaker: "fuji", text: "どうやら食感が合わないようですね…" },
    { speaker: "owner", text: "バカな！ワシの完璧なレシピに文句だと？計画通りに作ったはずじゃ！" },
    { speaker: "fuji", text: "店主、一つ提案があります。" },
    { speaker: "owner", text: "なんじゃ？またお前の『アジャイル』か？" },
    { speaker: "fuji", text: "店主の秘伝のスパイスはそのまま活かしましょう。でも、食感だけこのお客様用に調整するんです。" },
    { speaker: "owner", text: "…伝統を守りながら、変化に対応する…だと？" },
    { speaker: "fuji", text: "はい！これが『ハイブリッド』です。伝統と革新、どちらも大切にする。" },
    { speaker: "owner", text: "ふむ…やってみるがいい。だが、味の本質は変えるなよ！" },
    { speaker: "fuji", text: "（これだ…バランスが大事なんだ！）" }
];

// --- Episode 1: Clear Dialogue ---
const EPISODE1_CLEAR_DIALOGUE = [
    { speaker: "owner", text: "フジ…" },
    { speaker: "fuji", text: "はい、店主？" },
    { speaker: "owner", text: "ワシは…間違っておった。" },
    { speaker: "fuji", text: "え？" },
    { speaker: "owner", text: "地図ばかり見て、客の顔を見ることを忘れておった。" },
    { speaker: "owner", text: "お前の『アジャイル』とやら…それはワシが料理を始めた頃の心を思い出させてくれた。" },
    { speaker: "fuji", text: "店主…" },
    { speaker: "owner", text: "客の笑顔を見て、その場で工夫する。それが料理の原点じゃった。" },
    { speaker: "owner", text: "これを受け取れ。ワシの古い包丁じゃ。" },
    { speaker: "fuji", text: "これは…店主の…！" },
    { speaker: "owner", text: "お前になら任せられる。これからも厨房を頼むぞ、フジ。" },
    { speaker: "fuji", text: "はい！必ず、この店を繁盛させてみせます！" }
];

// VNオーバーレイ表示
function showVNOverlay(dialogueType) {
    const overlay = document.getElementById('vn-overlay');
    overlay.classList.remove('hidden', 'vn-event-dialogue', 'vn-crisis-dialogue');

    if (dialogueType === 'perfect') {
        overlay.classList.add('vn-event-dialogue');
    } else if (dialogueType === 'crisis') {
        overlay.classList.add('vn-crisis-dialogue');
    }
}

// VNオーバーレイ非表示
function hideVNOverlay() {
    const overlay = document.getElementById('vn-overlay');
    overlay.classList.add('hidden');
}

// キャラクターの状態を更新
function updateCharacterState(speakerId) {
    const leftChar = document.getElementById('vn-char-left');
    const rightChar = document.getElementById('vn-char-right');
    const minaChar = document.getElementById('vn-char-mina');

    // 全キャラクターからspeakingを削除
    if (leftChar) leftChar.classList.remove('speaking');
    if (rightChar) rightChar.classList.remove('speaking');
    if (minaChar) minaChar.classList.remove('speaking');

    // ナレーターの場合は全員を暗くする
    if (speakerId === 'narrator') {
        return;
    }

    // ミナの場合
    if (speakerId === 'mina') {
        // ミナ専用要素が表示されている場合
        if (minaChar && !minaChar.classList.contains('hidden')) {
            minaChar.classList.add('speaking');
        } else if (leftChar) {
            // ミナ専用要素がない場合は左キャラを使用
            leftChar.classList.add('speaking');
            leftChar.querySelector('.vn-char-name').textContent = 'ミナ';
        }
        return;
    }

    // フジの場合
    if (speakerId === 'fuji') {
        if (leftChar) {
            leftChar.classList.add('speaking');
            leftChar.querySelector('.vn-char-name').textContent = 'フジ';
        }
        return;
    }

    // 店主の場合
    if (speakerId === 'owner') {
        if (rightChar) rightChar.classList.add('speaking');
        return;
    }
}

// テキストをタイピングエフェクトで表示
function typeText(text, element, callback) {
    vnIsTyping = true;
    vnCurrentText = text;
    vnCharIndex = 0;
    element.innerHTML = "";

    if (vnTypingInterval) {
        clearInterval(vnTypingInterval);
    }

    vnTypingInterval = setInterval(() => {
        if (vnCharIndex < vnCurrentText.length) {
            element.innerHTML = vnCurrentText.substring(0, vnCharIndex + 1) + '<span class="typing-cursor">|</span>';
            vnCharIndex++;
        } else {
            clearInterval(vnTypingInterval);
            vnTypingInterval = null;
            vnIsTyping = false;
            element.innerHTML = vnCurrentText;
            if (callback) callback();
        }
    }, DIALOGUE_SPEED);
}

// 即座にテキストを表示
function completeTyping() {
    if (vnTypingInterval) {
        clearInterval(vnTypingInterval);
        vnTypingInterval = null;
    }
    vnIsTyping = false;
    const textElement = document.getElementById('vn-text');
    textElement.innerHTML = vnCurrentText;
}

// 現在のダイアログを表示
function showCurrentDialogue() {
    if (vnCurrentIndex >= vnDialogueQueue.length) {
        // ダイアログ完了時、コールバックがある場合は実行
        // オーバーレイはコールバック側で制御する（シーン間では非表示にしない）
        if (vnOnComplete) {
            const callback = vnOnComplete;
            vnOnComplete = null;
            callback();
        }
        return;
    }

    const dialogue = vnDialogueQueue[vnCurrentIndex];
    const speaker = VN_CHARACTERS[dialogue.speaker];
    const dialogueBox = document.querySelector('.vn-dialogue-box');

    // ナレーターモードの切り替え
    if (dialogue.speaker === 'narrator') {
        dialogueBox.classList.add('narrator-mode');
        document.getElementById('vn-speaker').textContent = '―';
    } else {
        dialogueBox.classList.remove('narrator-mode');
        document.getElementById('vn-speaker').textContent = speaker.name;
    }

    updateCharacterState(dialogue.speaker);

    const textElement = document.getElementById('vn-text');
    typeText(dialogue.text, textElement);
}

// 次のダイアログへ
function advanceDialogue() {
    if (vnIsTyping) {
        completeTyping();
        return;
    }

    vnCurrentIndex++;
    showCurrentDialogue();
}

// ダイアログをスキップ
function skipDialogue() {
    if (vnTypingInterval) {
        clearInterval(vnTypingInterval);
        vnTypingInterval = null;
    }
    vnIsTyping = false;
    vnCurrentIndex = vnDialogueQueue.length;

    // コールバックがある場合は実行（シーン遷移用）
    if (vnOnComplete) {
        const callback = vnOnComplete;
        vnOnComplete = null;
        callback();
    } else {
        // コールバックがない場合のみオーバーレイを非表示
        hideVNOverlay();
    }
}

// ダイアログシーケンスを開始
function startDialogueSequence(dialogues, dialogueType, onComplete) {
    vnDialogueQueue = dialogues;
    vnCurrentIndex = 0;
    vnOnComplete = onComplete || null;

    showVNOverlay(dialogueType);
    showCurrentDialogue();
}

// オープニングダイアログを表示（新しい導入シーケンス）
function showOpeningDialogue() {
    // ゲームUIを非表示にして導入に集中
    hideGameUI();

    // シーン1から開始
    playScene1();
}

// ゲームUIの表示/非表示
function hideGameUI() {
    const gameElements = ['episode-card', 'challenge-card', 'status-card', 'actions-card', 'result-card'];
    gameElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

function showGameUI() {
    const gameElements = ['episode-card', 'challenge-card', 'status-card', 'actions-card', 'result-card'];
    gameElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    });
}

// シーン1：救出（暗い背景、転生してミナに発見される）
function playScene1() {
    console.log("Playing Scene 1: Rescue");
    updateSceneBackground('road');
    updateSceneTitle('第1話：異世界転生');
    hideAllCharacters();
    showCharacter('fuji');
    showCharacter('mina');
    startDialogueSequence(SCENE1_RESCUE, 'opening', function() {
        console.log("Scene 1 complete, starting Scene 2");
        playScene2();
    });
}

// シーン2：ネコノヒゲの厨房（ミナとフジ）
function playScene2() {
    console.log("Playing Scene 2: Kitchen");
    updateSceneBackground('restaurant');
    updateSceneTitle('ネコノヒゲ');
    hideAllCharacters();
    showCharacter('fuji');
    showCharacter('mina');
    startDialogueSequence(SCENE2_KITCHEN, 'opening', function() {
        console.log("Scene 2 complete, starting Scene 3");
        playScene3();
    });
}

// シーン3：店主登場（タダ飯と労働契約）
function playScene3() {
    console.log("Playing Scene 3: Master");
    updateSceneBackground('restaurant');
    updateSceneTitle('店主登場');
    hideAllCharacters();
    showCharacter('fuji');
    showCharacter('mina');
    showCharacter('owner');
    startDialogueSequence(SCENE3_MASTER, 'opening', function() {
        console.log("Scene 3 complete, showing choice");
        playScene4Choice();
    });
}

// シーン4：選択肢
function playScene4Choice() {
    console.log("Playing Scene 4: Choice");

    // VNオーバーレイを非表示
    hideVNOverlay();
    updateSceneTitle('');

    // 少し遅延してから選択肢を表示（スムーズな遷移のため）
    setTimeout(function() {
        const choiceOverlay = document.getElementById('choice-overlay');
        if (choiceOverlay) {
            choiceOverlay.classList.remove('hidden');
        }
    }, 100);
}

// シーン背景更新
function updateSceneBackground(scene) {
    const overlay = document.getElementById('vn-overlay');
    overlay.classList.remove('scene-road', 'scene-rescue', 'scene-restaurant');
    overlay.classList.add('scene-' + scene);
}

// シーンタイトル更新
function updateSceneTitle(title) {
    const sceneTitle = document.getElementById('vn-scene-title');
    if (sceneTitle) {
        sceneTitle.textContent = title;
    }
}

// 全キャラクター非表示
function hideAllCharacters() {
    const chars = ['vn-char-left', 'vn-char-right', 'vn-char-mina'];
    chars.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

// キャラクター表示
function showCharacter(charId) {
    if (charId === 'fuji') {
        const el = document.getElementById('vn-char-left');
        if (el) {
            el.classList.remove('hidden');
            el.querySelector('.vn-char-name').textContent = 'フジ';
        }
    } else if (charId === 'mina') {
        const el = document.getElementById('vn-char-mina');
        if (el) el.classList.remove('hidden');
    } else if (charId === 'owner') {
        const el = document.getElementById('vn-char-right');
        if (el) el.classList.remove('hidden');
    }
}

// 選択肢A：従順に従う
function selectChoiceA() {
    console.log("Choice A selected: Obedient");
    playerChoice = 'obedient';
    oldManMood = Math.min(100, oldManMood + 15); // 店主の機嫌アップ

    hideChoiceOverlay();

    // シーン背景をレストランに再設定
    updateSceneBackground('restaurant');
    updateSceneTitle('決断');
    hideAllCharacters();
    showCharacter('fuji');
    showCharacter('mina');
    showCharacter('owner');

    startDialogueSequence(CHOICE_A_DIALOGUE, 'opening', function() {
        console.log("Choice A dialogue complete, starting Scene 5");
        playScene5Start();
    });
}

// 選択肢B：アジャイルを提案
function selectChoiceB() {
    console.log("Choice B selected: Agile");
    playerChoice = 'agile';
    oldManMood = Math.max(0, oldManMood - 10); // 店主の機嫌ダウン
    growth = 5; // 初期成長度ボーナス

    hideChoiceOverlay();

    // シーン背景をレストランに再設定
    updateSceneBackground('restaurant');
    updateSceneTitle('決断');
    hideAllCharacters();
    showCharacter('fuji');
    showCharacter('mina');
    showCharacter('owner');

    startDialogueSequence(CHOICE_B_DIALOGUE, 'opening', function() {
        console.log("Choice B dialogue complete, starting Scene 5");
        playScene5Start();
    });
}

// 選択肢オーバーレイを非表示
function hideChoiceOverlay() {
    const choiceOverlay = document.getElementById('choice-overlay');
    if (choiceOverlay) {
        choiceOverlay.classList.add('hidden');
    }
}

// シーン5：修行開始（ゲーム開始）
function playScene5Start() {
    console.log("Playing Scene 5: Start");
    updateSceneBackground('restaurant');
    updateSceneTitle('修行開始');
    hideAllCharacters();
    showCharacter('fuji');
    showCharacter('mina');
    showCharacter('owner');

    startDialogueSequence(SCENE5_START, 'opening', function() {
        console.log("Scene 5 complete, starting game");
        introComplete = true;

        // VNオーバーレイを非表示
        hideVNOverlay();

        // シーンタイトルをクリア
        updateSceneTitle('');

        // ゲームUIを表示
        showGameUI();
        updateMeters();

        // ミナからの最初のTip
        setTimeout(showMinaWelcomeTip, 1000);
    });
}

// ミナの歓迎Tip
function showMinaWelcomeTip() {
    const tipMessage = playerChoice === 'agile'
        ? "（ひそひそ）さすがね！お父さんを説得するのは大変だけど、きっとできるわ！"
        : "（こっそり）無理しないでね。でも…本当は新しいアイデアも大切だと思うの。";

    showMinaTip(tipMessage);
}

// ミナのTip表示
function showMinaTip(message) {
    const minaTipModal = document.getElementById('mina-tip-modal');
    const minaTipText = document.getElementById('mina-tip-text');

    if (minaTipModal && minaTipText) {
        minaTipText.textContent = message;
        minaTipModal.classList.remove('hidden');
    }
}

// ミナのTipを閉じる
function closeMinaTip() {
    const minaTipModal = document.getElementById('mina-tip-modal');
    if (minaTipModal) {
        minaTipModal.classList.add('hidden');
    }
}

// ゲーム中にミナのTipをランダム表示（店主が見ていない時）
function maybeShowMinaTip() {
    // 2日に1回くらいの頻度で表示
    if (day - lastMinaTipDay >= 2 && Math.random() < 0.4) {
        lastMinaTipDay = day;
        const tip = MINA_AGILE_TIPS[Math.floor(Math.random() * MINA_AGILE_TIPS.length)];
        setTimeout(() => showMinaTip(tip), 800);
    }
}

// パーフェクトサイクルダイアログを表示
function showPerfectCycleDialogue() {
    const dialogues = PERFECT_CYCLE_DIALOGUES[Math.floor(Math.random() * PERFECT_CYCLE_DIALOGUES.length)];
    startDialogueSequence(dialogues, 'perfect');
}

// 停滞危機ダイアログを表示
function showStagnationCrisisDialogue() {
    const dialogues = STAGNATION_CRISIS_DIALOGUES[Math.floor(Math.random() * STAGNATION_CRISIS_DIALOGUES.length)];
    startDialogueSequence(dialogues, 'crisis');
}

// ハイブリッドモーメントダイアログを表示 (Day 6)
function showHybridMomentDialogue() {
    startDialogueSequence(HYBRID_MOMENT_DIALOGUE, 'opening', function() {
        // After hybrid moment, give a small balance bonus
        traditionScore = Math.max(35, Math.min(65, traditionScore));
        oldManMood = Math.min(100, oldManMood + 10);
        updateMeters();
        document.getElementById('message').innerHTML = '<span class="episode-clear">ハイブリッドの瞬間！</span> 伝統と革新のバランスを学んだ！';
    });
}

// Episode 1 クリアダイアログを表示
function showEpisode1ClearDialogue() {
    startDialogueSequence(EPISODE1_CLEAR_DIALOGUE, 'perfect', function() {
        // Show Episode 1 Clear Screen
        showEpisode1ClearScreen();
    });
}

// Episode 1 クリア画面を表示
function showEpisode1ClearScreen() {
    hasChefKnife = true;
    document.getElementById('episode1-clear').classList.remove('hidden');
    document.getElementById('message').innerHTML = '<span class="episode-clear">第1話クリア：革新の第一歩</span>';
}

// Episode 2 へ進む
function startEpisode2() {
    document.getElementById('episode1-clear').classList.add('hidden');
    currentEpisode = 2;
    specialChallengeSuccess = 0;

    // Reset some values for Episode 2
    traditionScore = 50;
    hybridMomentTriggered = false;

    updateMeters();

    // Show Episode 2 intro dialogue
    const episode2IntroDialogue = [
        { speaker: "owner", text: "フジ、包丁を渡したが…まだ試練は続くぞ。" },
        { speaker: "fuji", text: "はい、覚悟しています！" },
        { speaker: "owner", text: "この異世界の客は気まぐれじゃ。スライムやドラゴンの要求に対応できるか？" },
        { speaker: "fuji", text: "アジャイルの真髄は『変化への対応』！どんな要求にも応えてみせます！" },
        { speaker: "owner", text: "ほう…その意気じゃ。見せてもらおう！" }
    ];
    startDialogueSequence(episode2IntroDialogue, 'opening');
}

// VNオーバーレイのクリックイベント
document.addEventListener('DOMContentLoaded', function() {
    const overlay = document.getElementById('vn-overlay');
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            // スキップボタンはここでは処理しない
            if (e.target.classList.contains('vn-skip-btn')) return;
            advanceDialogue();
        });
    }
});
