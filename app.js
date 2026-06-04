const GAS_URL = "https://script.google.com/macros/s/AKfycbzNfqlmoLtIUpigsCeg9C2Hl0Grd33cM6nlwISL72Wcvm0jiK7p7aBV_SajzdjIO29_7Q/exec";

const analyzeBtn = document.getElementById("analyzeBtn");
const raceUrlInput = document.getElementById("raceUrl");

analyzeBtn.addEventListener("click", async () => {
  const raceUrl = raceUrlInput.value.trim();

  if (!raceUrl) {
    alert("URLを入力してね！");
    return;
  }

  startLoading();

  try {
    const apiUrl = `${GAS_URL}?url=${encodeURIComponent(raceUrl)}`;
    const res = await fetch(apiUrl);
    const data = await res.json();

    setProgress("分析完了！", 100);
    renderResult(data);

  } catch (error) {
    console.error(error);
    alert("取得に失敗したよ。GAS URLかCORSを確認して！");
    stopLoading();
  }
});

function startLoading() {
  analyzeBtn.disabled = true;
  document.getElementById("loading").classList.remove("hidden");
  document.getElementById("result").classList.add("hidden");

  setProgress("出馬表を取得中...", 15);

  setTimeout(() => setProgress("出走馬を解析中...", 35), 700);
  setTimeout(() => setProgress("過去成績を取得中...", 60), 1600);
  setTimeout(() => setProgress("AIスコアを計算中...", 85), 3000);
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
  stopLoading();

  document.getElementById("result").classList.remove("hidden");
  document.getElementById("raceTitle").textContent = data.title || "分析結果";

  const rankingList = document.getElementById("rankingList");
  rankingList.innerHTML = "";

  data.aiScoreRanking.slice(0, 10).forEach(item => {
    const card = document.createElement("div");
    card.className = `rank-card rank-${item.rank}`;

    const ranksHtml = (item.recentRanks || [])
      .map(rank => `<span class="rank-chip ${getRankClass(rank)}">${rank}</span>`)
      .join(`<span class="rank-separator">-</span>`);

    card.innerHTML = `
      <div class="rank-main">
        <div class="rank-left">
          <div class="rank-title">
            <span class="mark">${item.mark || ""}</span>
            <span class="rank-number">${item.rank}位</span>
          </div>

          <h3>${item.horseName}</h3>
          <p class="score">総合スコア：${item.totalScore}点</p>

          <ul class="score-list">
            <li>🟢 東京1600：${item.detail.tokyo1600}点</li>
            <li>📊 近走成績：${item.detail.recentForm}点</li>
            <li>🔥 上がり性能：${item.detail.agari}点</li>
            <li>🏆 距離ベスト：${item.detail.bestDistance}点</li>
            <li>⭐ 最新走：${item.detail.latestRank}点</li>
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
}

function getRankClass(rank) {
  const n = Number(rank);

  if (n === 1) return "rank-win";
  if (n === 2) return "rank-2";
  if (n === 3) return "rank-3";
  return "rank-other";
}
