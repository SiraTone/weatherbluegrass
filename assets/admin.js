// ---------- Security: admin password gate ----------
// This is a static site with no server, so this lock cannot stop a determined
// attacker who reads the JS source - it cannot be made truly server-side
// secure. What it CAN do is stop casual/opportunistic access, and slow down
// scripted brute-forcing enough to make it impractical. Two things do that
// work here: PBKDF2 with a high iteration count (makes each guess slow to
// compute) and a lockout that backs off after repeated failures (makes
// scripting around it slow too). The GitHub token's repo-scoped permissions
// are still your real security boundary - see the note by the token field.
//
// CHANGE THE DEFAULT PASSWORD: unlock this page is not required. Open
// admin.html, scroll to "Change admin password" (visible before you log in),
// enter a new password, and copy the generated line over ADMIN_PW_HASH below.
const ADMIN_PW_SALT = "bgtv-2026-static-site-salt-v1"; // safe to keep as-is; salt just stops precomputed rainbow-table lookups
const PBKDF2_ITERATIONS = 250000;
const ADMIN_PW_HASH = "cb2acaa0114259f8b1f1b5d8f1cfe0d5dfa61b6f535f1e1ccd49ec675d65198d"; // set from user-provided password

const SS_AUTH_KEY = "bgtv_admin_auth"; // sessionStorage - cleared when the tab/browser closes
const SS_AUTH_TIME_KEY = "bgtv_admin_auth_time"; // last-activity timestamp, for idle auto-logout
const LS_ATTEMPTS_KEY = "bgtv_admin_attempts"; // localStorage - survives tab close so a refresh can't reset the lockout
const LS_KEY = "bgtv_admin_cfg"; // localStorage - only used if "remember this device" is checked
const SS_CFG_KEY = "bgtv_admin_cfg_session"; // sessionStorage - default, cleared on tab close

const IDLE_LOGOUT_MS = 20 * 60 * 1000; // auto-lock after 20 minutes of no activity
const LOCKOUT_THRESHOLD = 5; // failed attempts before backoff kicks in

let cfg = {};
let articles = [];
let currentSha = null;
let editingId = null;
let idleTimer = null;

const el = (id) => document.getElementById(id);

// PBKDF2-SHA256 is deliberately slow (250k rounds) so each password guess
// costs real CPU time - unlike a single SHA-256 hash, which a script can
// test millions of times per second.
async function derivePasswordHash(password, salt = ADMIN_PW_SALT, iterations = PBKDF2_ITERATIONS) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function isUnlocked() {
  if (sessionStorage.getItem(SS_AUTH_KEY) !== "1") return false;
  const lastActive = Number(sessionStorage.getItem(SS_AUTH_TIME_KEY) || 0);
  if (Date.now() - lastActive > IDLE_LOGOUT_MS) {
    logout();
    return false;
  }
  return true;
}

function markActive() {
  sessionStorage.setItem(SS_AUTH_TIME_KEY, String(Date.now()));
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  if (!isUnlocked()) return;
  idleTimer = setTimeout(() => {
    logout();
    alert("You were logged out after 20 minutes of inactivity.");
  }, IDLE_LOGOUT_MS);
}
["click", "keydown", "mousemove", "scroll"].forEach(evt =>
  document.addEventListener(evt, () => { if (isUnlocked()) { markActive(); resetIdleTimer(); } }, { passive: true })
);

// ---------- Login attempt lockout ----------
function getAttemptState() {
  try {
    return JSON.parse(localStorage.getItem(LS_ATTEMPTS_KEY) || "{}");
  } catch {
    return {};
  }
}
function setAttemptState(state) {
  localStorage.setItem(LS_ATTEMPTS_KEY, JSON.stringify(state));
}
function lockoutMsRemaining() {
  const state = getAttemptState();
  if (!state.lockedUntil) return 0;
  return Math.max(0, state.lockedUntil - Date.now());
}
function recordFailedAttempt() {
  const state = getAttemptState();
  state.count = (state.count || 0) + 1;
  if (state.count >= LOCKOUT_THRESHOLD) {
    // Exponential backoff: 30s, 60s, 120s, 240s... capped at 30 min
    const extraFailures = state.count - LOCKOUT_THRESHOLD;
    const seconds = Math.min(30 * Math.pow(2, extraFailures), 30 * 60);
    state.lockedUntil = Date.now() + seconds * 1000;
  }
  setAttemptState(state);
}
function clearAttempts() {
  localStorage.removeItem(LS_ATTEMPTS_KEY);
}

async function tryUnlock() {
  const statusEl = el("lockStatus");

  const remaining = lockoutMsRemaining();
  if (remaining > 0) {
    statusEl.textContent = `Too many attempts. Try again in ${Math.ceil(remaining / 1000)}s.`;
    statusEl.className = "status error";
    return;
  }

  const pw = el("fLockPassword").value;
  statusEl.textContent = "Checking...";
  statusEl.className = "status";
  const hash = await derivePasswordHash(pw);
  if (hash === ADMIN_PW_HASH) {
    clearAttempts();
    sessionStorage.setItem(SS_AUTH_KEY, "1");
    markActive();
    resetIdleTimer();
    showAdminUI();
  } else {
    recordFailedAttempt();
    const remainingNow = lockoutMsRemaining();
    statusEl.textContent = remainingNow > 0
      ? `Incorrect password. Locked for ${Math.ceil(remainingNow / 1000)}s.`
      : "Incorrect password.";
    statusEl.className = "status error";
    el("fLockPassword").value = "";
  }
}

function showAdminUI() {
  el("lockPanel").style.display = "none";
  el("changePwPanel").style.display = "none";
  el("settingsPanel").style.display = "block";
  loadCfgIntoForm();
  clearForm();
  if (cfg.owner && cfg.repo && cfg.token) connect();
}

function logout() {
  clearTimeout(idleTimer);
  sessionStorage.removeItem(SS_AUTH_KEY);
  sessionStorage.removeItem(SS_AUTH_TIME_KEY);
  sessionStorage.removeItem(SS_CFG_KEY);
  location.reload();
}

// ---------- In-page password hash generator ----------
// Replaces the old "open devtools and run this snippet" workflow: paste a
// new password here, copy the printed line over the ADMIN_PW_HASH constant
// at the top of this file, commit, done.
async function generatePasswordHash() {
  const pw = el("fNewPassword").value;
  const outEl = el("newHashOutput");
  if (!pw || pw.length < 10) {
    outEl.textContent = "Use a password of at least 10 characters.";
    outEl.className = "status error";
    return;
  }
  outEl.textContent = "Deriving hash (this takes a moment on purpose)...";
  outEl.className = "status";
  const hash = await derivePasswordHash(pw);
  outEl.textContent = `const ADMIN_PW_HASH = "${hash}";`;
  outEl.className = "status ok";
}

// ---------- GitHub connection settings ----------
// Settings (including the token) are kept in sessionStorage by default, so
// they disappear when the tab closes. They're only written to localStorage
// (persisting across sessions on this device) if "remember" is checked.
function loadCfgIntoForm() {
  const stored = localStorage.getItem(LS_KEY) || sessionStorage.getItem(SS_CFG_KEY);
  cfg = JSON.parse(stored || "{}");
  el("cfgOwner").value = cfg.owner || "";
  el("cfgRepo").value = cfg.repo || "";
  el("cfgBranch").value = cfg.branch || "main";
  el("cfgPath").value = cfg.path || "data/articles.json";
  el("cfgToken").value = cfg.token || "";
  el("cfgRemember").checked = !!localStorage.getItem(LS_KEY);
}

function readCfgFromForm() {
  cfg = {
    owner: el("cfgOwner").value.trim(),
    repo: el("cfgRepo").value.trim(),
    branch: el("cfgBranch").value.trim() || "main",
    path: el("cfgPath").value.trim() || "data/articles.json",
    token: el("cfgToken").value.trim()
  };
  const remember = el("cfgRemember").checked;
  localStorage.removeItem(LS_KEY);
  sessionStorage.removeItem(SS_CFG_KEY);
  if (remember) {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  } else {
    sessionStorage.setItem(SS_CFG_KEY, JSON.stringify(cfg));
  }
}

function apiUrl() {
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}?ref=${encodeURIComponent(cfg.branch)}`;
}

function authHeaders() {
  return {
    "Authorization": `Bearer ${cfg.token}`,
    "Accept": "application/vnd.github+json"
  };
}

// base64 helpers that handle UTF-8 correctly
function b64EncodeUnicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64DecodeUnicode(str) {
  return decodeURIComponent(escape(atob(str)));
}

async function connect() {
  readCfgFromForm();
  const statusEl = el("connStatus");
  statusEl.textContent = "Connecting...";
  statusEl.className = "status";

  if (!cfg.owner || !cfg.repo || !cfg.token) {
    statusEl.textContent = "Fill in owner, repo, and token.";
    statusEl.className = "status error";
    return;
  }

  try {
    const res = await fetch(apiUrl(), { headers: authHeaders() });
    if (res.status === 404) {
      // file doesn't exist yet - that's fine, we'll create it on first publish
      articles = [];
      currentSha = null;
      statusEl.textContent = "Connected. No articles.json yet \u2014 publishing will create it.";
      statusEl.className = "status ok";
    } else if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `GitHub returned ${res.status}`);
    } else {
      const data = await res.json();
      currentSha = data.sha;
      const content = b64DecodeUnicode(data.content.replace(/\n/g, ""));
      articles = JSON.parse(content || "[]");
      statusEl.textContent = `Connected. ${articles.length} article(s) loaded.`;
      statusEl.className = "status ok";
    }
    el("editorPanel").style.display = "block";
    el("listPanel").style.display = "block";
    el("analyticsPanel").style.display = "block";
    renderList();
  } catch (e) {
    statusEl.textContent = "Error: " + e.message;
    statusEl.className = "status error";
  }
}

function renderList() {
  const listEl = el("articleList");
  if (!articles.length) {
    listEl.innerHTML = `<div class="hint">No articles published yet.</div>`;
    return;
  }
  const sorted = [...articles].sort((a, b) => (a.date < b.date ? 1 : -1));
  listEl.innerHTML = sorted.map(a => `
    <div class="article-row" data-id="${a.id}">
      <div>
        <strong>${escapeHtml(a.title)}</strong>
        <div class="meta">${a.tab} &middot; ${a.date}</div>
      </div>
    </div>
  `).join("");
  listEl.querySelectorAll(".article-row").forEach(row => {
    row.addEventListener("click", () => loadIntoEditor(row.dataset.id));
  });
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

// Only allow http(s) image URLs - blocks javascript:/data: URLs being stored
// and later rendered into style attributes on the public site.
function sanitizeImageUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url, location.href);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch (e) { /* invalid URL */ }
  return "";
}

function loadIntoEditor(id) {
  const a = articles.find(x => x.id === id);
  if (!a) return;
  editingId = id;
  el("editorHeading").textContent = "Editing: " + a.title;
  el("fTitle").value = a.title || "";
  el("fTab").value = a.tab || "news";
  el("fAuthor").value = a.author || "";
  el("fDate").value = a.date || "";
  el("fImage").value = a.image || "";
  el("fSummary").value = a.summary || "";
  el("fContent").value = a.content || "";
  el("deleteBtn").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearForm() {
  editingId = null;
  el("editorHeading").textContent = "New article";
  el("fTitle").value = "";
  el("fTab").value = "news";
  el("fAuthor").value = "";
  el("fDate").value = new Date().toISOString().slice(0, 10);
  el("fImage").value = "";
  el("fSummary").value = "";
  el("fContent").value = "";
  el("deleteBtn").style.display = "none";
  el("publishStatus").textContent = "";
}

async function saveToGitHub(commitMessage) {
  const body = {
    message: commitMessage,
    content: b64EncodeUnicode(JSON.stringify(articles, null, 2)),
    branch: cfg.branch
  };
  if (currentSha) body.sha = currentSha;

  const res = await fetch(apiUrl().split("?")[0], {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "GitHub write failed");
  currentSha = data.content.sha;
}

async function publish() {
  const statusEl = el("publishStatus");
  const title = el("fTitle").value.trim();
  if (!title) {
    statusEl.textContent = "Title is required.";
    statusEl.className = "status error";
    return;
  }

  const record = {
    id: editingId || String(Date.now()),
    tab: el("fTab").value.trim().toLowerCase(),
    title,
    summary: el("fSummary").value.trim(),
    content: el("fContent").value.trim(),
    author: el("fAuthor").value.trim() || "Newsroom Staff",
    date: el("fDate").value || new Date().toISOString().slice(0, 10),
    image: sanitizeImageUrl(el("fImage").value.trim())
  };

  if (editingId) {
    articles = articles.map(a => a.id === editingId ? record : a);
  } else {
    articles.push(record);
  }

  statusEl.textContent = "Publishing...";
  statusEl.className = "status";

  try {
    await saveToGitHub(editingId ? `Update article: ${title}` : `Publish article: ${title}`);
    statusEl.textContent = "Published! It'll appear on the site within a minute.";
    statusEl.className = "status ok";
    renderList();
    clearForm();
  } catch (e) {
    statusEl.textContent = "Error: " + e.message;
    statusEl.className = "status error";
  }
}

async function deleteArticle() {
  if (!editingId) return;
  if (!confirm("Delete this article? This can't be undone.")) return;

  const statusEl = el("publishStatus");
  articles = articles.filter(a => a.id !== editingId);

  statusEl.textContent = "Deleting...";
  statusEl.className = "status";

  try {
    await saveToGitHub(`Delete article: ${el("fTitle").value.trim()}`);
    statusEl.textContent = "Deleted.";
    statusEl.className = "status ok";
    renderList();
    clearForm();
  } catch (e) {
    statusEl.textContent = "Error: " + e.message;
    statusEl.className = "status error";
  }
}

el("unlockBtn").addEventListener("click", tryUnlock);
el("fLockPassword").addEventListener("keydown", (e) => { if (e.key === "Enter") tryUnlock(); });
el("saveSettingsBtn").addEventListener("click", connect);
el("logoutBtn").addEventListener("click", logout);
el("publishBtn").addEventListener("click", publish);
el("clearBtn").addEventListener("click", clearForm);
el("deleteBtn").addEventListener("click", deleteArticle);
el("generateHashBtn").addEventListener("click", generatePasswordHash);

function reflectLockoutStatus() {
  const remaining = lockoutMsRemaining();
  const statusEl = el("lockStatus");
  const btn = el("unlockBtn");
  if (remaining > 0) {
    btn.disabled = true;
    statusEl.textContent = `Too many attempts. Try again in ${Math.ceil(remaining / 1000)}s.`;
    statusEl.className = "status error";
    setTimeout(reflectLockoutStatus, 1000);
  } else {
    btn.disabled = false;
    if (statusEl.textContent.startsWith("Too many attempts")) statusEl.textContent = "";
  }
}

if (isUnlocked()) {
  markActive();
  resetIdleTimer();
  showAdminUI();
} else {
  reflectLockoutStatus();
  el("fLockPassword").focus();
}
