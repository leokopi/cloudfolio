// ── Config (fill after `sam deploy` / CloudFormation outputs) ──────────────
const CONFIG = {
  apiBase:        "https://cdsyovnqe1.execute-api.us-east-2.amazonaws.com/prod",        // ApiUrl output
  cognitoDomain:  "https://cloudfolio-594552272210.auth.us-east-2.amazoncognito.com",         // CognitoDomain output
  clientId:       "527u7m32ksf3skood9gcegcft9",      // CognitoClientId output
  redirectUri:    globalThis.location.origin + "/callback.html",
};

// ── PKCE helpers ──────────────────────────────────────────────────────────
function randomBase64(len) {
  const buf = crypto.getRandomValues(new Uint8Array(len));
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function sha256Base64Url(plain) {
  const enc = new TextEncoder().encode(plain);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ── Auth ──────────────────────────────────────────────────────────────────
export async function login() {
  const verifier = randomBase64(64);
  const challenge = await sha256Base64Url(verifier);
  sessionStorage.setItem("pkce_verifier", verifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CONFIG.clientId,
    redirect_uri: CONFIG.redirectUri,
    scope: "email openid profile",
    code_challenge: challenge,
    code_challenge_method: "S256",
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
      grant_type: "authorization_code",
      client_id: CONFIG.clientId,
      redirect_uri: CONFIG.redirectUri,
      code,
      code_verifier: verifier,
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

export function getToken() {
  return localStorage.getItem("id_token");
}

export function logout() {
  localStorage.removeItem("id_token");
  localStorage.removeItem("refresh_token");
  const params = new URLSearchParams({
    client_id: CONFIG.clientId,
    logout_uri: globalThis.location.origin,
  });
  globalThis.location.href = `${CONFIG.cognitoDomain}/logout?${params}`;
}

// ── API ───────────────────────────────────────────────────────────────────
function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: getToken(),
  };
}

export async function loadPortfolio() {
  const res = await fetch(`${CONFIG.apiBase}/portfolio`, { headers: authHeaders() });
  if (res.status === 401) { login(); return; }
  const data = await res.json();
  renderHoldings(data.holdings || []);
}

export async function addHolding(ticker, shares, avg_cost) {
  await fetch(`${CONFIG.apiBase}/holding`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ticker, shares, avg_cost }),
  });
  loadPortfolio();
}

export async function deleteHolding(id) {
  await fetch(`${CONFIG.apiBase}/holding/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  loadPortfolio();
}

// ── Render ────────────────────────────────────────────────────────────────
function renderHoldings(holdings) {
  const container = document.getElementById("holdings-list");
  if (!holdings.length) {
    container.innerHTML = "<p>No holdings yet.</p>";
    return;
  }

  const rows = holdings.map(h => {
    const gainLoss = ((h.current_price - h.avg_cost) * h.shares).toFixed(2);
    const cls = gainLoss >= 0 ? "gain" : "loss";
    return `<tr>
      <td>${h.ticker}</td>
      <td>${h.shares}</td>
      <td>$${Number(h.avg_cost).toFixed(2)}</td>
      <td>$${Number(h.current_price ?? 0).toFixed(2)}</td>
      <td class="${cls}">${gainLoss >= 0 ? "+" : ""}$${gainLoss}</td>
      <td><button class="delete-btn" data-id="${h.id}">Remove</button></td>
    </tr>`;
  }).join("");

  container.innerHTML = `<table>
    <thead><tr><th>Ticker</th><th>Shares</th><th>Avg Cost</th><th>Price</th><th>Gain/Loss</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  container.querySelectorAll(".delete-btn").forEach(btn =>
    btn.addEventListener("click", () => deleteHolding(btn.dataset.id))
  );
}

// ── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Only run on index.html — other pages import app.js for specific functions only
  if (!document.getElementById("holdings-list")) return;

  if (!getToken()) {
    globalThis.location.replace("/login.html");
    return;
  }

  document.getElementById("logout-btn").addEventListener("click", logout);

  document.getElementById("holding-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const ticker   = document.getElementById("ticker").value.trim().toUpperCase();
    const shares   = parseFloat(document.getElementById("shares").value);
    const avg_cost = parseFloat(document.getElementById("avg-cost").value);
    await addHolding(ticker, shares, avg_cost);
    e.target.reset();
  });

  loadPortfolio();
});
