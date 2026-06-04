const GAS_URL = "https://script.google.com/macros/s/AKfycbzNfqlmoLtIUpigsCeg9C2Hl0Grd33cM6nlwISL72Wcvm0jiK7p7aBV_SajzdjIO29_7Q/exec";

const analyzeBtn = document.getElementById("analyzeBtn");
const raceUrlInput = document.getElementById("raceUrl");
const openNetkeibaBtn = document.getElementById("openNetkeibaBtn");

let progressTimers = [];

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

  document.getElementById("result").classList.remove("hidden");
  document.getElementById("raceTitle").textContent = data.title || "分析結果";

  const rankingList = document.getElementById("rankingList");
  rankingList.innerHTML = "";

  data.aiScoreRanking.slice(0, 10).forEach(item => {
    const detail = item.detail || {};

    const card = document.createElement("div");
    card.className = `rank-card rank-${Number(item.rank) || ""}`;

    const ranksHtml = Array.isArray(item.recentRanks)
      ? item.recentRanks
          .map(rank => `<span class="rank-chip ${getRankClass(rank)}">${escapeHtml(rank || "-")}</span>`)
          .join(`<span class="rank-separator">-</span>`)
      : "";

    card.innerHTML = `
      <div class="rank-main">
        <div class="rank-left">
          <div class="rank-title">
            <span class="mark">${escapeHtml(item.mark || "")}</span>
            <span class="rank-number">${escapeHtml(item.rank || "-")}位</span>
          </div>

          <h3>${escapeHtml(item.horseName || "馬名不明")}</h3>
          <p class="score">総合スコア：${escapeHtml(item.totalScore ?? 0)}点</p>

          <ul class="score-list">
            <li>🟢 コース適性：${escapeHtml(detail.courseFit ?? 0)}点</li>
            <li>📊 近走成績：${escapeHtml(detail.recentForm ?? 0)}点</li>
            <li>🔥 上がり性能：${escapeHtml(detail.agari ?? 0)}点</li>
            <li>🏆 距離ベスト：${escapeHtml(detail.bestDistance ?? 0)}点</li>
            <li>⭐ 最新走：${escapeHtml(detail.latestRank ?? 0)}点</li>
          </ul>
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
        この予想は、出走馬の過去成績から5つの項目を点数化して総合スコアを出しています。
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
