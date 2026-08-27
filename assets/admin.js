const LS_KEY = "bgtv_admin_cfg";

let cfg = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
let articles = [];
let currentSha = null;
let editingId = null;

const el = (id) => document.getElementById(id);

function loadCfgIntoForm() {
  el("cfgOwner").value = cfg.owner || "";
  el("cfgRepo").value = cfg.repo || "";
  el("cfgBranch").value = cfg.branch || "main";
  el("cfgPath").value = cfg.path || "data/articles.json";
  el("cfgToken").value = cfg.token || "";
}

function readCfgFromForm() {
  cfg = {
    owner: el("cfgOwner").value.trim(),
    repo: el("cfgRepo").value.trim(),
    branch: el("cfgBranch").value.trim() || "main",
    path: el("cfgPath").value.trim() || "data/articles.json",
    token: el("cfgToken").value.trim()
  };
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
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
    tab: el("fTab").value,
    title,
    summary: el("fSummary").value.trim(),
    content: el("fContent").value.trim(),
    author: el("fAuthor").value.trim() || "Newsroom Staff",
    date: el("fDate").value || new Date().toISOString().slice(0, 10),
    image: el("fImage").value.trim()
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

el("saveSettingsBtn").addEventListener("click", connect);
el("publishBtn").addEventListener("click", publish);
el("clearBtn").addEventListener("click", clearForm);
el("deleteBtn").addEventListener("click", deleteArticle);

loadCfgIntoForm();
clearForm();
if (cfg.owner && cfg.repo && cfg.token) connect();
