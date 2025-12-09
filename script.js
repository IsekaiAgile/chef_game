// --- ゲームの状態と定数 ---
let day = 1;
let stagnation = 50; 
let growth = 0;      
let lastAction = 0;  
const MAX_GROWTH = 50; 

let currentEpisode = 1; 
let oldManMood = 70; 
let ingredientQuality = 50; 
let currentIngredients = 3; 
let specialCustomer = null; 
let specialChallengeSuccess = 0; 

// --- データの定義 ---
const EPISODE_GOALS = {
    1: { goalGrowth: 20, message: "第1話: 停滞の日常。まずは思考停止の日常を破れ！" },
    2: { goalSuccess: 2, message: "第2話: 異世界からの無理難題。予期せぬ客の要求に応えろ！" },
    3: { goalGrowth: 50, goalMood: 80, message: "最終話: 覚醒の瞬間。改善を店主に認めさせろ！" }
};

// --- 初期化関数（HTMLロード後に実行される） ---
function initializeGame() {
    // DOM要素が存在するかチェックしてから更新を開始
    if (document.getElementById('day')) {
        updateMeters();
        console.log("ゲーム初期化成功。ボタンが押せる状態です。");
    } else {
        console.error("DOM要素が見つかりません。HTMLが不完全です。");
    }
}

// メーター表示を更新する関数
function updateMeters() {
    document.getElementById('day').textContent = day;
    
    // メーターの更新
    document.getElementById('stagnation-val').textContent = stagnation;
    document.getElementById('stagnation-meter').style.width = `${stagnation}%`;
    
    document.getElementById('growth-val').textContent = growth;
    document.getElementById('growth-meter').style.width = `${(growth / MAX_GROWTH) * 100}%`;

    // 補助メーター（老店主、品質、リソース）の表示
    let statusMsg = `<p style="color:#ffcc80;">老店主の機嫌: ${oldManMood}/100 | 食材品質: ${ingredientQuality}/100 | 手持ち食材: ${currentIngredients}個</p>`;
    if (stagnation >= 80) {
        statusMsg += "<p style='color:#e74c3c;'>🚨 **停滞警告！老店主が不満そうです。**</p>";
    } else if (ingredientQuality < 30) {
        statusMsg += "<p style='color:#e74c3c;'>🤢 **品質警告！食材が危険な状態です。**</p>";
    }
    document.getElementById('status-additional').innerHTML = statusMsg;

    // --- エピソード表示の更新 ---
    const epData = EPISODE_GOALS[currentEpisode];
    let epStatus = `【${epData.message}】 `;
    
    if (currentEpisode === 1) {
        epStatus += `目標: 成長度 ${epData.goalGrowth} (${growth}/${epData.goalGrowth})`;
    } else if (currentEpisode === 2) {
        epStatus += `目標: 特殊客対応 ${epData.goalSuccess}回 (${specialChallengeSuccess}/${epData.goalSuccess})`;
    } else if (currentEpisode === 3) {
        epStatus += `目標: 成長度 ${epData.goalGrowth} (${growth}/${epData.goalGrowth}) & 店主機嫌 ${epData.goalMood}+`;
    }
    document.getElementById('episode-status').innerHTML = epStatus;

    // --- 日替わりお題の表示 ---
    document.getElementById('todays-challenge').innerHTML = generateChallenge();
}


// --- 日替わりお題 (タスクの制約) の生成 ---
function generateChallenge() {
    const challenges = [
        "今日は客足が多い。迅速な提供（2.道具改善）が必要だ！",
        "老店主が厨房にいる！大きな変化（1.レシピ改善）は厳禁。",
        "昨日、食材の仕入れが失敗した。リソース（食材）を消費するな！",
        "客の注文が曖昧だ。真のニーズ（3.顧客観察）を探る絶好の機会。",
        "普段使わない古い道具（技術的負債）がある。品質改善（2.道具改善）に集中すべき日だ。",
    ];
    let challengeMsg = "🎯 **今日のお題:** ";
    if (specialCustomer) {
        challengeMsg += `<span style="color: red;">【緊急】${specialCustomer.name}の無理難題対応に専念せよ！</span>`;
    } else {
        challengeMsg += challenges[Math.floor(Math.random() * challenges.length)];
    }
    return challengeMsg;
}

// 特殊な客の来店判定
function checkSpecialCustomer() {
    // エピソード2以外では特殊客は来ない
    if (currentEpisode !== 2) {
        specialCustomer = null;
        return "";
    }
    if (Math.random() < 0.25) { // エピソード2では25%で特殊客
        const customers = [
            { name: "スライム", requirement: "プニプニ感を増したゲル", bonus: 15 },
            { name: "ドラゴン", requirement: "炎を吐くスパイス", bonus: 25 },
        ];
        specialCustomer = customers[Math.floor(Math.random() * customers.length)];
        return `<br><span style="color:#f1c40f;">🐉 **【緊急課題】** ${specialCustomer.name}が来店！${specialCustomer.requirement}を求めている！</span>`;
    }
    specialCustomer = null;
    return "";
}

// ランダムな困難の発生
function triggerEvent() {
    let eventMessage = "";
    
    // 通常の困難
    if (Math.random() < 0.35) { 
        const events = [
            { type: 'quality_drop', message: "🥶 調理器具の劣化！食材の品質が急激に低下しました。" },
            { type: 'oldman_anger', message: "😠 老店主の圧力！「なぜレシピ通りにやらない！」と怒鳴られました。" },
            { type: 'slow_day', message: "🥱 客足が重い日。誰も新しい味を求めず、停滞感が強まります。" }
        ];
        const event = events[Math.floor(Math.random() * events.length)];
        eventMessage += `<br><span style="color:red;">【困難発生】 ${event.message}</span>`;
        
        if (event.type === 'quality_drop') ingredientQuality = Math.max(0, ingredientQuality - 20);
        if (event.type === 'oldman_anger') oldManMood = Math.max(0, oldManMood - 20);
        if (event.type === 'slow_day') stagnation = Math.min(100, stagnation + 10);
    }
    
    // 特殊客の来店チェック
    eventMessage += checkSpecialCustomer();
    
    return eventMessage;
}

// アクション実行ロジック
function runAction(actionId) {
    if (growth >= MAX_GROWTH || stagnation >= 90 || ingredientQuality <= 0 || oldManMood <= 0) return; 

    day++;
    let message = `【DAY ${day - 1}の振り返り】: `;
    let baseSuccessRate = 0.45; 

    // 停滞ロジック
    if (actionId === lastAction) {
        stagnation = Math.min(100, stagnation + 12);
        oldManMood = Math.max(0, oldManMood - 5);
        message += "😩 **ルーティンを続けたため、停滞度が上昇！** 老店主の信頼も失いました。";
    } else {
        stagnation = Math.max(0, stagnation - 7);
        message += "💡 **昨日と違う実験！** 停滞を打破し、新しい可能性を探りました。";
    }

    lastAction = actionId;

    // 成功率の調整
    let adjustedSuccessRate = baseSuccessRate;
    if (ingredientQuality < 30) adjustedSuccessRate -= 0.3; 
    if (oldManMood < 30) adjustedSuccessRate -= 0.15; 
    if (currentIngredients === 0 && actionId !== 2) adjustedSuccessRate -= 0.2; 

    let success = Math.random() < adjustedSuccessRate;

    // --- アクションごとの結果 ---
    if (actionId === 1) { // レシピ改善 (インクリメント)
        currentIngredients = Math.max(0, currentIngredients - 1);
        if (specialCustomer && success) { 
            growth += specialCustomer.bonus;
            specialChallengeSuccess += 1;
            message += `<br>🔥 【特殊客対応】: ${specialCustomer.name}の無理難題に対応！**驚異的な成長度 +${specialCustomer.bonus}**！`;
            specialCustomer = null;
        } else if (success) {
            growth += 15;
            stagnation = Math.max(0, stagnation - 15);
            oldManMood = Math.min(100, oldManMood + 10);
            message += "<br>✨ 【レシピ改善】: 新しいスパイスの配合が成功！老店主も黙認しました。**成長度 +15**！";
        } else {
            oldManMood = Math.max(0, oldManMood - 15);
            message += "<br>❌ 【レシピ改善】: 失敗！固定観念に阻まれ、老店主に厳しく叱責されました。";
        }
    } else if (actionId === 2) { // 道具の改善/品質管理 (リファクタリング/QA)
        if (success) {
            ingredientQuality = Math.min(100, ingredientQuality + 30);
            stagnation = Math.max(0, stagnation - 5);
            currentIngredients = Math.min(5, currentIngredients + 2);
            message += "<br>⚙️ 【品質管理】: 器具を磨き、食材を適切に管理！**品質大幅回復＆リソース+2**！";
        } else {
            ingredientQuality = Math.max(0, ingredientQuality - 10);
            message += "<br>📉 【道具改善】: 慣れない作業で手間取り、かえって品質を落としました。";
        }
    } else if (actionId === 3) { // 顧客観察/対話 (フィードバック/PO機能)
        if (success) {
            growth += 20;
            oldManMood = Math.min(100, oldManMood + 5);
            message += "<br>🔎 【顧客対話】: 無愛想な常連客が、ふと真のニーズを漏らした！**大きな学びを得た**！**成長度 +20**。";
        } else {
            message += "<br>🤫 【顧客観察】: 客は『いつもの』を要求するばかりで、何も得られませんでした。";
        }
    }
    
    // --- ターン終了処理 ---
    
    ingredientQuality = Math.max(0, ingredientQuality - 5); 

    message += triggerEvent();
    
    // メーターの最終調整
    growth = Math.min(MAX_GROWTH, growth);
    document.getElementById('result').innerHTML = message;
    updateMeters();

    // --- エピソードの進行判定 ---
    if (currentEpisode === 1 && growth >= EPISODE_GOALS[1].goalGrowth) {
        currentEpisode = 2;
        specialChallengeSuccess = 0;
        document.getElementById('message').textContent = "👏 第1話クリア！思考停止の鎖を破った！次は異世界の壁に挑め！";
    } else if (currentEpisode === 2 && specialChallengeSuccess >= EPISODE_GOALS[2].goalSuccess) {
        currentEpisode = 3;
        document.getElementById('message').textContent = "💪 第2話クリア！予期せぬ変化への対応力を得た。いざ、店主に認めさせる最終局面へ！";
    }

    // ゲームオーバー判定
    if (stagnation >= 90 || ingredientQuality <= 0 || oldManMood <= 0) {
        document.getElementById('actions').style.display = 'none';
        document.getElementById('gameover').classList.remove('hidden');
        return;
    }

    // クリア判定 (最終エピソードのゴール)
    if (currentEpisode === 3 && growth >= MAX_GROWTH && oldManMood >= EPISODE_GOALS[3].goalMood) {
        document.getElementById('actions').style.display = 'none';
        document.getElementById('ending').classList.remove('hidden');
        document.getElementById('message').textContent = "🎉 老店主: 「…フジ。お前の変化、認めよう！」";
    }
}