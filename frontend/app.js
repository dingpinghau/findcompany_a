const form = document.getElementById("search-form");
const nameInput = document.getElementById("name-input");
const websiteInput = document.getElementById("website-input");
const submitBtn = document.getElementById("submit-btn");
const resultsEl = document.getElementById("results");

let chart = null;
let currentStock = null; // { stock_no, market }

const RANGE_LABELS = { "1m": "1個月", "3m": "3個月", "6m": "6個月", "1y": "1年", "5y": "5年" };
const MARKET_LABELS = { twse: "上市", tpex: "上櫃", emerging: "興櫃" };

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const website = websiteInput.value.trim();
  if (!name) return;
  await runSearch(name, website);
});

async function runSearch(name, website) {
  setLoading(true);
  resultsEl.innerHTML = "";
  try {
    const res = await fetch(`/api/company?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    if (!res.ok) {
      renderError(data.detail || "查詢失敗");
      return;
    }
    if (!data.resolved) {
      renderCandidates(data.candidates, website);
      return;
    }
    await renderCompany(data.company, website, name);
  } catch (err) {
    renderError("網路錯誤：" + err.message);
  } finally {
    setLoading(false);
  }
}

async function resolveByTaxId(taxId, website) {
  setLoading(true);
  resultsEl.innerHTML = "";
  try {
    const res = await fetch(`/api/company?tax_id=${encodeURIComponent(taxId)}`);
    const data = await res.json();
    if (!res.ok) {
      renderError(data.detail || "查詢失敗");
      return;
    }
    await renderCompany(data.company, website, data.company.name);
  } catch (err) {
    renderError("網路錯誤：" + err.message);
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "查詢中..." : "查詢";
}

function renderError(message) {
  resultsEl.innerHTML = `<div class="card"><div class="error">${escapeHtml(message)}</div></div>`;
}

function renderCandidates(candidates, website) {
  const items = candidates
    .map(
      (c) => `
      <li data-tax-id="${c.tax_id}">
        <div>${escapeHtml(c.name)}</div>
        <div class="addr">統編 ${c.tax_id} · ${escapeHtml(c.address || "")}</div>
      </li>`
    )
    .join("");
  resultsEl.innerHTML = `
    <div class="card">
      <h2>找到多筆符合的公司，請選擇：</h2>
      <ul class="candidates">${items}</ul>
    </div>`;
  resultsEl.querySelectorAll(".candidates li").forEach((li) => {
    li.addEventListener("click", () => resolveByTaxId(li.dataset.taxId, website));
  });
}

async function renderCompany(company, website, queryName) {
  const listing = company.listing;
  resultsEl.innerHTML = `
    <div class="card">
      <h2>基本資料 ${listing ? `<span class="badge">${MARKET_LABELS[listing.market] || listing.market}</span>` : ""}</h2>
      <dl class="kv">
        <dt>公司名稱</dt><dd>${escapeHtml(company.name)}</dd>
        <dt>統一編號</dt><dd>${escapeHtml(company.tax_id || "無資料")}</dd>
        <dt>地址</dt><dd>${escapeHtml(company.address || listing?.address || "無資料")}</dd>
        <dt>設立時間</dt><dd>${escapeHtml(company.setup_date || listing?.setup_date || "無資料")}</dd>
        <dt>資本額</dt><dd>${formatMoney(company.capital_paid_in ?? listing?.capital_paid_in)}</dd>
        <dt>負責人</dt><dd>${escapeHtml(company.responsible_name || "無資料")}</dd>
        <dt>公司狀態</dt><dd>${escapeHtml(company.status_desc || "無資料")}</dd>
      </dl>
    </div>

    <div class="card" id="insights-card">
      <h2>主要產品服務說明與優勢</h2>
      <div class="placeholder">載入中...</div>
    </div>

    <div class="card" id="news-card">
      <h2>重要消息</h2>
      <div class="placeholder">載入中...</div>
    </div>

    ${
      listing
        ? `<div class="card" id="price-card">
            <h2>股價走勢（${escapeHtml(listing.stock_no)} · ${MARKET_LABELS[listing.market] || listing.market}）</h2>
            <div class="range-buttons" id="range-buttons">
              ${Object.entries(RANGE_LABELS)
                .map(
                  ([key, label], i) =>
                    `<button data-range="${key}" class="${i === 2 ? "active" : ""}">${label}</button>`
                )
                .join("")}
            </div>
            <canvas id="price-chart" height="90"></canvas>
          </div>`
        : ""
    }
  `;

  loadInsights(queryName, website);

  if (listing) {
    currentStock = { stock_no: listing.stock_no, market: listing.market };
    document.getElementById("range-buttons").addEventListener("click", (e) => {
      if (e.target.tagName !== "BUTTON") return;
      document.querySelectorAll("#range-buttons button").forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      loadPrices(e.target.dataset.range);
    });
    loadPrices("6m");
  }
}

async function loadInsights(name, website) {
  const insightsCard = document.getElementById("insights-card");
  const newsCard = document.getElementById("news-card");
  try {
    const url = `/api/insights?name=${encodeURIComponent(name)}${website ? `&website=${encodeURIComponent(website)}` : ""}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.enabled) {
      const msg = `<div class="placeholder">此功能需設定 Anthropic API Key 才能啟用。</div>`;
      insightsCard.innerHTML = `<h2>主要產品服務說明與優勢</h2>${msg}`;
      newsCard.innerHTML = `<h2>重要消息</h2>${msg}`;
      return;
    }
    if (data.error) {
      const msg = `<div class="error">AI 研究模組發生錯誤：${escapeHtml(data.error)}</div>`;
      insightsCard.innerHTML = `<h2>主要產品服務說明與優勢</h2>${msg}`;
      newsCard.innerHTML = `<h2>重要消息</h2>${msg}`;
      return;
    }

    const advantagesHtml = (data.advantages || []).map((a) => `<li>${escapeHtml(a)}</li>`).join("");
    insightsCard.innerHTML = `
      <h2>主要產品服務說明與優勢</h2>
      <p>${escapeHtml(data.products_services || "無資料")}</p>
      ${advantagesHtml ? `<ul class="advantages">${advantagesHtml}</ul>` : ""}
    `;

    const newsItems = (data.news || [])
      .map(
        (n) => `
        <div class="news-item">
          <div>${n.url ? `<a href="${escapeAttr(n.url)}" target="_blank" rel="noopener">${escapeHtml(n.title)}</a>` : escapeHtml(n.title)}</div>
          <div class="date">${escapeHtml(n.date || "")}</div>
          <div>${escapeHtml(n.summary || "")}</div>
        </div>`
      )
      .join("");
    newsCard.innerHTML = `<h2>重要消息</h2>${newsItems || `<div class="placeholder">未找到相關新聞</div>`}`;
  } catch (err) {
    insightsCard.innerHTML = `<h2>主要產品服務說明與優勢</h2><div class="error">載入失敗</div>`;
    newsCard.innerHTML = `<h2>重要消息</h2><div class="error">載入失敗</div>`;
  }
}

async function loadPrices(range) {
  if (!currentStock) return;
  try {
    const res = await fetch(
      `/api/prices/${encodeURIComponent(currentStock.stock_no)}?market=${currentStock.market}&range=${range}`
    );
    const data = await res.json();
    if (!res.ok) return;
    drawChart(data.series);
  } catch (err) {
    // silent — chart just won't update
  }
}

function drawChart(series) {
  const ctx = document.getElementById("price-chart");
  const labels = series.map((r) => r.date);
  const closes = series.map((r) => r.close);
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "收盤價",
          data: closes,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.08)",
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.15,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 8 } },
        y: { ticks: { callback: (v) => v } },
      },
    },
  });
}

function formatMoney(value) {
  if (value === null || value === undefined) return "無資料";
  return "NT$ " + Number(value).toLocaleString("zh-TW");
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, "&#39;");
}
