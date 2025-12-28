// ===== ネコノヒゲ：アジャイル厨房 =====
// 異世界食堂で学ぶアジャイルマインド

// --- ゲーム状態 ---
let day = 1;
let stagnation = 50;
let growth = 0;
let technicalDebt = 0; // 技術的負債（隠しパラメータ）
let lastAction = 0;
const MAX_GROWTH = 50;

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

// --- エピソードデータ ---
const EPISODE_GOALS = {
    1: { goalGrowth: 20, message: "第1話：ウォーターフォールを打ち破れ！停滞したルーティンからの脱出" },
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
        epStatus += `<div class="episode-goal">目標：成長度 ${growth}/${epData.goalGrowth}</div>`;
    } else if (currentEpisode === 2) {
        epStatus += `<div class="episode-goal">目標：特殊客対応 ${specialChallengeSuccess}/${epData.goalSuccess}回</div>`;
    } else if (currentEpisode === 3) {
        epStatus += `<div class="episode-goal">目標：成長度 ${growth}/${epData.goalGrowth} ＆ 店主機嫌 ${oldManMood}/${epData.goalMood}以上</div>`;
    }
    document.getElementById('episode-status').innerHTML = epStatus;

    // 今日のお題
    document.getElementById('todays-challenge').innerHTML = generateChallenge();
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

    // 停滞ロジック
    if (actionId === lastAction) {
        stagnation = Math.min(100, stagnation + 12);
        oldManMood = Math.max(0, oldManMood - 5);
        technicalDebt += 2;
        message += `<div class="result-item negative">同じアクションの繰り返し！停滞度上昇、信頼低下。技術的負債 +2</div>`;
        perfectCycleCount = 0;
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

        // アジャイル格言表示
        setTimeout(showAgileTip, 500);
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

    // エピソード進行
    if (currentEpisode === 1 && growth >= EPISODE_GOALS[1].goalGrowth) {
        currentEpisode = 2;
        specialChallengeSuccess = 0;
        document.getElementById('message').innerHTML = '<span class="episode-clear">第1話クリア！</span> ウォーターフォールの鎖を断ち切った！';
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
