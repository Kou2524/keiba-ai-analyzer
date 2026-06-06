const GAS_URL = "https://script.google.com/macros/s/AKfycbzNfqlmoLtIUpigsCeg9C2Hl0Grd33cM6nlwISL72Wcvm0jiK7p7aBV_SajzdjIO29_7Q/exec";

const analyzeBtn = document.getElementById("analyzeBtn");
const raceUrlInput = document.getElementById("raceUrl");
const openNetkeibaBtn = document.getElementById("openNetkeibaBtn");

let progressTimers = [];

function calculateJockeyScore(horse) {
  let score = 70;
  const reasons = [];

  if (horse.jockeyCourseTop3Rate >= 0.35) {
    score += 7;
    reasons.push("今回の競馬場での騎手成績が安定");
  }

  if (horse.jockeyDistanceTop3Rate >= 0.30) {
    score += 5;
    reasons.push("今回の距離での騎手成績が良好");
  }

  if (horse.isSameJockey) {
    score += 6;
    reasons.push("前走からの継続騎乗");
  }

  if (horse.jockeyChangeType === "upgrade") {
    score += 8;
    reasons.push("騎手乗り替わりがプラス材料");
  } else if (horse.jockeyChangeType === "downgrade") {
    score -= 8;
    reasons.push("騎手乗り替わりが不安材料");
  }

  if (horse.jockeyRecentWinRate >= 0.15) {
    score += 6;
    reasons.push("騎手の近走成績が好調");
  }

  score = Math.max(40, Math.min(100, Math.round(score)));

  return {
    score,
    comment: reasons.length
      ? reasons.join("。") + "。"
      : "騎手面では大きな加点・減点材料は少ない。"
  };
}

openNetkeibaBtn.addEventListener("click", () => {
  window.open("https://race.netkeiba.com/top/", "_blank");
});

analyzeBtn.addEventListener("click", async () => {
  const raceUrl = raceUrlInput.value.trim();

  if (!raceUrl) {
    alert("URLを入力してください！");
    return;
  }

  startLoading();

  try {
    const apiUrl = `${GAS_URL}?url=${encodeURIComponent(raceUrl)}`;
    const res = await fetch(apiUrl);

    if (!res.ok) {
      throw new Error(`通信エラー: ${res.status}`);
    }

    const data = await res.json();

    if (data.status === "error") {
      throw new Error(data.message || "GAS側でエラーが発生しました");
    }

    renderResult(data);

  } catch (error) {
    console.error(error);
    clearProgressTimers();
    setProgress("エラーが発生しました", 100);
    alert("取得に失敗しました：" + error.message);
    stopLoading();
  }
});

function startLoading() {
  analyzeBtn.disabled = true;

  document.getElementById("loadingTitle").textContent = "分析中";
  
  document.getElementById("loading").classList.remove("hidden");
  document.getElementById("result").classList.add("hidden");

  clearProgressTimers();

  setProgress("出馬表を取得中...", 15);

  progressTimers.push(setTimeout(() => setProgress("出走馬を解析中...", 35), 700));
  progressTimers.push(setTimeout(() => setProgress("過去成績を取得中...", 60), 1600));
  progressTimers.push(setTimeout(() => setProgress("AIスコアを計算中...", 85), 3000));
}

function clearProgressTimers() {
  progressTimers.forEach(timer => clearTimeout(timer));
  progressTimers = [];
}

function stopLoading() {
  analyzeBtn.disabled = false;
}

function setProgress(text, percent) {
  document.getElementById("statusText").textContent = text;
  document.getElementById("progressBar").style.width = `${percent}%`;
  document.getElementById("progressPercent").textContent = `${percent}%`;
}

function renderResult(data) {

  window.lastResult = data;

  console.log(data.horseSummary);

  clearProgressTimers();

  document.getElementById("loadingTitle").textContent = "予測完了！";

  document.getElementById("statusText").textContent = "";

  document.getElementById("progressBar").style.width = "100%";
  document.getElementById("progressPercent").textContent = "100%";

  stopLoading();
  if (!Array.isArray(data.aiScoreRanking) || data.aiScoreRanking.length === 0) {
    alert("分析結果が取得できません。URLがスマホ版、対象外ページ、またはnetkeiba側の仕様変更の可能性があります！");
    console.log(data);
    return;
  }

  const resultItems = data.aiScoreRanking;
  const aiConfidence = calculateAiConfidence(resultItems);

  let confidenceLabel = "";
let confidenceClass = "";

if (aiConfidence >= 80) {
  confidenceLabel = "高信頼";
  confidenceClass = "high";
} else if (aiConfidence >= 60) {
  confidenceLabel = "標準";
  confidenceClass = "medium";
} else {
  confidenceLabel = "低め";
  confidenceClass = "low";
}
  
  document.getElementById("result").classList.remove("hidden");
  document.getElementById("raceTitle").textContent = data.title || "分析結果";

  const raceTitle = document.getElementById("raceTitle");

let confidenceElement = document.getElementById("aiConfidence");

if (!confidenceElement) {
  confidenceElement = document.createElement("div");
  confidenceElement.id = "aiConfidence";

  raceTitle.insertAdjacentElement(
    "afterend",
    confidenceElement
  );
}

confidenceElement.innerHTML = `
  <div class="ai-confidence-box">
    <div class="ai-confidence-title">
      🤖 AI信頼度
    </div>

    <div class="ai-confidence-value ${confidenceClass}">
      ${aiConfidence}%
    </div>

     <div class="ai-confidence-status ${confidenceClass}">
      ${confidenceLabel}
     </div>

    <div class="ai-confidence-note">
      データ量・スコア差から算出
    </div>
  </div>
`;
  
  const rankingList = document.getElementById("rankingList");
  rankingList.innerHTML = "";

  console.log(data.aiScoreRanking[0].detail);
  
  const adjustedRanking = data.aiScoreRanking
    .map(item => {
      const frameBonus = calculateFrameBonus(
        item.horseNumber,
        data.raceCondition
      );

      const adjustedTotalScore =
        (Number(item.totalScore) || 0) + frameBonus;

      return {
        ...item,
        frameBonus,
        adjustedTotalScore
      };
    })
    .sort((a, b) => b.adjustedTotalScore - a.adjustedTotalScore)
    .map((item, index) => ({
      ...item,
      adjustedRank: index + 1,
      adjustedMark: getPredictionMark(index)
    }));

  adjustedRanking.slice(0, 10).forEach(item => {
    const detail = item.detail || {};

    const frameBonus = item.frameBonus;
    const displayTotalScore = item.adjustedTotalScore;
    
    const card = document.createElement("div");
    card.className = `rank-card rank-${Number(item.adjustedRank) || ""}`;

    const ranksHtml = Array.isArray(item.recentRanks)
      ? item.recentRanks
          .map(rank => `<span class="rank-chip ${getRankClass(rank)}">${escapeHtml(rank || "-")}</span>`)
          .join(`<span class="rank-separator">-</span>`)
      : "";

    card.innerHTML = `
      <div class="rank-main">
        <div class="rank-left">
          <div class="rank-title">
            <span class="mark">${escapeHtml(item.adjustedMark || "")}</span>
            <span class="rank-number">${escapeHtml(item.adjustedRank || "-")}位</span>
          </div>

          <h3>${escapeHtml(item.horseName || "馬名不明")}</h3>
          <p class="score">総合スコア：${escapeHtml(displayTotalScore)}点</p>

          <p class="frame-bonus">
            🎯 枠順補正：${frameBonus >= 0 ? "+" : ""}${frameBonus}点
          </p>

          <ul class="score-list">
            <li>🟢 コース適性：${escapeHtml(detail.courseFit ?? 0)}点</li>
            <li>📊 近走成績：${escapeHtml(detail.recentForm ?? 0)}点</li>
            <li>
              <div class="score-sub-lines">
                <div>🔥 上がり性能：${escapeHtml(detail.agari ?? 0)}点</div>
                <small>平均上がり：${escapeHtml(detail.avgAgari ?? "-")}</small>
              </div>
            </li>
            <li>🏆 距離ベスト：${escapeHtml(detail.bestDistance ?? 0)}点</li>
            <li>⭐ 最新走：${escapeHtml(detail.latestRank ?? 0)}点</li>
            <li>
              <div class="score-sub-lines">
                <div>
                  🏇 騎手評価：${escapeHtml(detail.jockeyPoint ?? 0)}点
                </div>
                <small>
                  ${escapeHtml(detail.jockey || "-")}
                  （評価値:${escapeHtml(detail.jockeyScore ?? 0)}）
                </small>
              </div>
            </li>
            <li>
              <div class="score-sub-lines">
                <div>🏃 脚質：${escapeHtml(detail.runningStyle || "不明")}</div>
                <small>脚質評価：${escapeHtml(detail.runningStyleScore ?? 0)}点</small>
              </div>
            </li>
          </ul>

          <p class="score-comment">
            ${escapeHtml(detail.agariComment || "").replaceAll("。", "。<br>")}
          </p>

          <p class="score-comment">
            ${escapeHtml(detail.runningStyleComment || "").replaceAll("。", "。<br>")}
          </p>
          
          <p class="score-comment">
            ${escapeHtml(detail.jockeyComment || "")
              .replaceAll("。", "。<br>")}
          </p>
        </div>

        <div class="rank-right">
          <h4>近走順位（直近5走）</h4>
          <div class="recent-ranks">
            ${ranksHtml || `<span class="no-data">データなし</span>`}
          </div>

          <div class="legend">
            <span><b class="dot win"></b>1着</span>
            <span><b class="dot place2"></b>2着</span>
            <span><b class="dot place3"></b>3着</span>
            <span><b class="dot other"></b>着外</span>
          </div>
        </div>
      </div>
    `;

    rankingList.appendChild(card);
  });

  renderExplanation(data);
}

function getRankClass(rank) {
  const n = Number(rank);

  if (n === 1) return "rank-win";
  if (n === 2) return "rank-second";
  if (n === 3) return "rank-third";
  return "rank-other";
}

function renderExplanation(data) {
  const explanationBox = document.getElementById("explanationBox");

  const condition = data.raceCondition || {};
  const placeName = condition.placeName || "";
  const distanceText = condition.distanceText || "";

  const courseText = distanceText
    ? `${placeName}${distanceText}`
    : "対象レースの条件";

  explanationBox.innerHTML = `
    <section class="explanation-card">
      <h2>スコア判定の見方</h2>
      <p class="explanation-lead">
        この予想は、出走馬の過去成績に加えて、騎手評価・脚質評価・枠順補正を含めて総合スコアを出しています。
      </p>

      <div class="explanation-grid">
        <div class="explanation-item">
          <h3>🟢 コース適性</h3>
          <p>
            対象レースと同じ条件、今回は <strong>${escapeHtml(courseText)}</strong> の過去成績を見ています。
            直近1年以内の同条件レースで、持ちタイムが速い馬ほど高得点です。
          </p>
          <span>最大30点</span>
        </div>

        <div class="explanation-item">
          <h3>📊 近走成績</h3>
          <p>
            直近5走の着順を点数化しています。
            1着10点、2着8点、3着6点、4〜5着4点、6〜9着2点、10着以下0点で計算します。
          </p>
          <span>最大25点</span>
        </div>

        <div class="explanation-item">
          <h3>🔥 上がり性能</h3>
          <p>
            各馬の過去レースから、最も速い上がり3Fを評価しています。
            上がりが速い馬ほど、終盤の伸び脚があると見て加点します。
          </p>
          <span>最大20点</span>
        </div>

        <div class="explanation-item">
          <h3>🏆 距離ベスト</h3>
          <p>
            対象レースと同じ距離のベストタイムを比較します。
            距離適性の強さを見る項目です。
          </p>
          <span>最大15点</span>
        </div>

        <div class="explanation-item">
          <h3>⭐ 最新走</h3>
          <p>
            一番新しいレースの着順を評価しています。
            最新走で好走している馬ほど、現在の状態が良いと判断して加点します。
          </p>
          <span>最大10点</span>
        </div>

        <div class="explanation-item">
          <h3>🏇 騎手評価</h3>
          <p>
            騎手のコース相性、距離相性、継続騎乗、乗り替わり、近走成績などをもとに評価します。
            今回の条件で騎手がどれだけプラス材料になるかを見る項目です。
          </p>
          <span>補正評価</span>
        </div>

        <div class="explanation-item">
          <h3>🏃 脚質評価</h3>
          <p>
            過去5走の通過順から、
            逃げ・先行・差し・追込を判定します。
            レース展開との相性を見るための評価です。
          </p>
          <span>最大18点</span>
        </div>

        <div class="explanation-item">
          <h3>🎯 枠順補正</h3>
          <p>
            コースごとの有利不利をもとに、馬番から加点・減点を行います。
            東京芝1600m、中山芝1200m、新潟芝1000mなど、一部条件で補正が反映されます。
          </p>
          <span>補正評価</span>
        </div>
        
      </div>

      <div class="explanation-note">
        <p>
          ※このツールでは、ChatGPTによるAI予想を使用しています。あまり過信せず、参考程度に留めてください。
        </p>

        <p>
          ※このスコアは過去成績ベースの機械的な評価です。枠順、馬場状態、展開、当日の気配などを別途確認すると、より精度が上がります。
        </p>
      </div>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function calculateAiConfidence(items) {
  if (!items || items.length === 0) return 0;

  let knownCount = 0;
  let totalCount = 0;

  items.forEach(item => {
    const detail = item.detail || {};

    const checks = [
      item.totalScore,
      detail.courseFit,
      detail.recentForm,
      detail.agari,
      detail.bestDistance,
      detail.latestRank,
      detail.jockeyPoint,
      detail.jockeyScore,
      detail.runningStyleScore
    ];

    checks.forEach(value => {
      totalCount++;

      if (
        value !== undefined &&
        value !== null &&
        value !== "" &&
        value !== "不明"
      ) {
        knownCount++;
      }
    });
  });

  const dataCompleteness = knownCount / totalCount;

  const scores = items
    .map(item => Number(item.totalScore) || 0)
    .sort((a, b) => b - a);

  const topScore = scores[0] || 0;
  const secondScore = scores[1] || 0;
  const thirdScore = scores[2] || 0;
  const bottomScore = scores[scores.length - 1] || 0;

  const totalGap = topScore - bottomScore;
  const topGap = topScore - secondScore;
  const top3Gap = topScore - thirdScore;

  const totalGapRate = Math.min(totalGap / 40, 1);
  const topGapRate = Math.min(topGap / 10, 1);
  const top3GapRate = Math.min(top3Gap / 18, 1);

  const horseCount = items.length;
  const horseCountRate =
    horseCount <= 12 ? 1 :
    horseCount <= 16 ? 0.9 :
    0.82;

  const confidence =
    dataCompleteness * 45 +
    totalGapRate * 20 +
    topGapRate * 20 +
    top3GapRate * 10 +
    horseCountRate * 5;

  return Math.round(Math.max(35, Math.min(confidence, 95)));
}

function calculateFrameBonus(horseNumber, raceCondition) {
  const number = Number(horseNumber);
  if (!number) return 0;

  const place = raceCondition?.placeName || "";
  const distanceText = raceCondition?.distanceText || "";

  // 東京芝1600m：内〜中枠を少し評価
  if (place === "東京" && distanceText === "芝1600") {
    if (number >= 1 && number <= 4) return 3;
    if (number >= 5 && number <= 12) return 1;
    return -1;
  }

  // 中山芝1200m：内枠有利
  if (place === "中山" && distanceText === "芝1200") {
    if (number >= 1 && number <= 6) return 3;
    if (number >= 7 && number <= 12) return 1;
    return -2;
  }

  // 新潟芝1000m：外枠有利
  if (place === "新潟" && distanceText === "芝1000") {
    if (number >= 13) return 4;
    if (number >= 9) return 2;
    if (number <= 4) return -3;
    return 0;
  }

  return 0;
}

function getPredictionMark(index) {
  const marks = ["◎", "○", "▲", "△", "☆"];
  return marks[index] || "";
}
