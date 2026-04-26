// ── Config ────────────────────────────────────────────────────────────────
const CONFIG = {
  apiBase:       "https://cdsyovnqe1.execute-api.us-east-2.amazonaws.com/prod",
  cognitoDomain: "https://cloudfolio-594552272210.auth.us-east-2.amazoncognito.com",
  clientId:      "527u7m32ksf3skood9gcegcft9",
  redirectUri:   globalThis.location.origin + "/callback.html",
};

// ── PKCE ──────────────────────────────────────────────────────────────────
function randomBase64(len) {
  const buf = crypto.getRandomValues(new Uint8Array(len));
  return btoa(String.fromCharCode(...buf)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}
async function sha256Base64Url(plain) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}

// ── Auth ──────────────────────────────────────────────────────────────────
export async function login() {
  const verifier = randomBase64(64);
  const challenge = await sha256Base64Url(verifier);
  sessionStorage.setItem("pkce_verifier", verifier);
  const params = new URLSearchParams({
    response_type: "code", client_id: CONFIG.clientId,
    redirect_uri: CONFIG.redirectUri, scope: "email openid profile",
    code_challenge: challenge, code_challenge_method: "S256",
    identity_provider: "Google",
  });
  globalThis.location.href = `${CONFIG.cognitoDomain}/oauth2/authorize?${params}`;
}

export async function handleCallback() {
  const code = new URLSearchParams(globalThis.location.search).get("code");
  if (!code) return false;
  const verifier = sessionStorage.getItem("pkce_verifier");
  const resp = await fetch(`${CONFIG.cognitoDomain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", client_id: CONFIG.clientId,
      redirect_uri: CONFIG.redirectUri, code, code_verifier: verifier,
    }),
  });
  const tokens = await resp.json();
  if (tokens.id_token) {
    localStorage.setItem("id_token", tokens.id_token);
    localStorage.setItem("refresh_token", tokens.refresh_token || "");
    return true;
  }
  return false;
}

export function getToken() { return localStorage.getItem("id_token"); }

export function logout() {
  localStorage.removeItem("id_token");
  localStorage.removeItem("refresh_token");
  const params = new URLSearchParams({ client_id: CONFIG.clientId, logout_uri: globalThis.location.origin });
  globalThis.location.href = `${CONFIG.cognitoDomain}/logout?${params}`;
}

// ── Toast ─────────────────────────────────────────────────────────────────
function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  document.getElementById("toast-container").appendChild(el);
  requestAnimationFrame(() => { requestAnimationFrame(() => el.classList.add("show")); });
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ── API helpers ───────────────────────────────────────────────────────────
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: getToken() };
}

// ── Portfolio ─────────────────────────────────────────────────────────────
let cachedHoldings = [];

export async function loadPortfolio() {
  const res = await fetch(`${CONFIG.apiBase}/portfolio`, { headers: authHeaders() });
  if (res.status === 401) { login(); return; }
  const data = await res.json();
  cachedHoldings = data.holdings || [];
  renderHoldings(cachedHoldings);
  renderPortfolioSidebar(cachedHoldings);
}

export async function addHolding(ticker, shares, avg_cost) {
  const res = await fetch(`${CONFIG.apiBase}/holding`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ticker, shares, avg_cost }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  await loadPortfolio();
  toast(`${ticker} added to portfolio`);
}

export async function deleteHolding(id, ticker) {
  const res = await fetch(`${CONFIG.apiBase}/holding/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  await loadPortfolio();
  toast(`${ticker} removed from portfolio`, "error");
}

// ── Render holdings ───────────────────────────────────────────────────────
function renderHoldings(holdings) {
  const container = document.getElementById("holdings-list");
  if (!holdings.length) {
    container.innerHTML = "<p class=\"muted\">No holdings yet. Add one below.</p>";
    return;
  }

  const rows = holdings.map(h => {
    const price    = Number(h.current_price ?? 0);
    const cost     = Number(h.avg_cost);
    const shares   = Number(h.shares);
    const gainLoss = ((price - cost) * shares).toFixed(2);
    const cls      = gainLoss >= 0 ? "gain" : "loss";
    const sign     = gainLoss >= 0 ? "+" : "";
    return `<tr>
      <td><button class="ticker-btn" data-ticker="${h.ticker}">${h.ticker}</button></td>
      <td>${shares}</td>
      <td>$${cost.toFixed(2)}</td>
      <td>$${price.toFixed(2)}</td>
      <td class="${cls}">${sign}$${Math.abs(gainLoss).toFixed(2)}</td>
      <td><button class="delete-btn" data-id="${h.id}" data-ticker="${h.ticker}">Remove</button></td>
    </tr>`;
  }).join("");

  container.innerHTML = `<table>
    <thead><tr>
      <th>Ticker</th><th>Shares</th><th>Avg Cost</th>
      <th>Price</th><th>Gain / Loss</th><th></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  container.querySelectorAll(".ticker-btn").forEach(btn =>
    btn.addEventListener("click", () => openTickerModal(btn.dataset.ticker))
  );

  container.querySelectorAll(".delete-btn").forEach(btn =>
    btn.addEventListener("click", () => deleteHolding(btn.dataset.id, btn.dataset.ticker))
  );
}

// ── Portfolio sidebar + hero ──────────────────────────────────────────────
function renderPortfolioSidebar(holdings) {
  const totalValue = holdings.reduce((sum, h) =>
    sum + Number(h.current_price ?? h.avg_cost) * Number(h.shares), 0);
  const totalCost = holdings.reduce((sum, h) =>
    sum + Number(h.avg_cost) * Number(h.shares), 0);
  const totalGain = totalValue - totalCost;
  const gainCls  = totalGain >= 0 ? "gain" : "loss";
  const gainSign = totalGain >= 0 ? "+" : "";
  const fmt      = v => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Dashboard sidebar
  const elTotal  = document.getElementById("summary-total");
  const elChange = document.getElementById("summary-change");
  if (elTotal)  elTotal.textContent = `$${fmt(totalValue)}`;
  if (elChange) {
    elChange.textContent = `${gainSign}$${fmt(Math.abs(totalGain))}`;
    elChange.className   = `summary-change ${gainCls}`;
  }
  const miniList = document.getElementById("mini-holdings");
  if (miniList) {
    miniList.innerHTML = holdings.slice(0, 6).map(h => {
      const val   = Number(h.current_price ?? h.avg_cost) * Number(h.shares);
      const alloc = totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : "0.0";
      return `<li class="mini-holding">
        <span class="ticker">${h.ticker}</span>
        <span class="alloc">${alloc}%</span>
      </li>`;
    }).join("");
  }

  // Portfolio page hero
  const elHeroTotal  = document.getElementById("hero-total");
  const elHeroChange = document.getElementById("hero-change");
  if (elHeroTotal)  elHeroTotal.textContent = `$${fmt(totalValue)}`;
  if (elHeroChange) {
    elHeroChange.textContent = `${gainSign}$${fmt(Math.abs(totalGain))} all time`;
    elHeroChange.className   = `hero-change ${gainCls}`;
  }
}

// ── Ticker modal ──────────────────────────────────────────────────────────
function openTickerModal(ticker) {
  document.getElementById("modal-ticker-name").textContent = ticker;
  document.getElementById("modal-chart").innerHTML = `
    <iframe
      src="https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(ticker)}&interval=D&theme=light&style=1&locale=en&toolbar_bg=%23ffffff&hide_top_toolbar=0&hide_legend=0&saveimage=0&show_popup_button=0"
      allowtransparency="true"
    ></iframe>`;
  document.getElementById("ticker-modal").hidden = false;
}

function closeTickerModal() {
  document.getElementById("ticker-modal").hidden = true;
  document.getElementById("modal-chart").innerHTML = "";
}

// ── Market sidebar ────────────────────────────────────────────────────────
async function loadMarket() {
  try {
    const res = await fetch(`${CONFIG.apiBase}/market`, { headers: authHeaders() });
    if (!res.ok) return;
    const { markets } = await res.json();

    const list = document.getElementById("market-list");
    list.innerHTML = markets.map(m => {
      const cls  = m.change_pct >= 0 ? "gain" : "loss";
      const sign = m.change_pct >= 0 ? "+" : "";
      const price = m.ticker === "BTC"
        ? `$${Number(m.price).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
        : `$${Number(m.price).toFixed(2)}`;
      return `<li class="market-item">
        <span class="market-name">${m.name}</span>
        <div class="market-right">
          <span class="market-price">${price}</span>
          <span class="market-pct ${cls}">${sign}${m.change_pct}%</span>
        </div>
      </li>`;
    }).join("");
  } catch (e) {
    console.error("Market fetch failed", e);
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  if (!getToken()) { globalThis.location.replace("/login.html"); return; }

  document.getElementById("logout-btn")?.addEventListener("click", logout);

  // ── Dashboard (index.html) ────────────────────────────────────────────
  if (document.getElementById("holding-form")) {
    const form      = document.getElementById("holding-form");
    const submitBtn = form.querySelector("button[type=submit]");
    const errorMsg  = document.getElementById("form-error");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const ticker   = document.getElementById("ticker").value.trim().toUpperCase();
      const shares   = parseFloat(document.getElementById("shares").value);
      const avg_cost = parseFloat(document.getElementById("avg-cost").value);

      submitBtn.disabled = true;
      submitBtn.textContent = "Adding…";
      errorMsg.textContent = "";

      try {
        await addHolding(ticker, shares, avg_cost);
        form.reset();
      } catch (err) {
        errorMsg.textContent = `Failed: ${err.message}`;
        toast(`Failed to add holding: ${err.message}`, "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Add";
      }
    });

    loadPortfolio();
    loadMarket();
    setInterval(loadMarket, 120_000);
  }

  // ── Portfolio page (portfolio.html) ───────────────────────────────────
  if (document.getElementById("hero-total")) {
    document.getElementById("modal-close").addEventListener("click", closeTickerModal);
    document.getElementById("modal-overlay").addEventListener("click", closeTickerModal);
    loadPortfolio();
  }
});
