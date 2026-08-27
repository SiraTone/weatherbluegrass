const TABS = ["news", "weather", "sports", "community"];
let ARTICLES = [];
let currentTab = "news";

const mainEl = document.getElementById("main");
const tickerTrack = document.getElementById("tickerTrack");
const datetimeEl = document.getElementById("datetime");

function updateDatetime() {
  const now = new Date();
  datetimeEl.textContent = now.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });
}
updateDatetime();

function formatDate(d) {
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

async function loadArticles() {
  try {
    const res = await fetch("data/articles.json", { cache: "no-store" });
    ARTICLES = await res.json();
  } catch (e) {
    ARTICLES = [];
  }
  ARTICLES.sort((a, b) => (a.date < b.date ? 1 : -1));
  renderTicker();
  renderTab(currentTab);
}

function renderTicker() {
  const latest = ARTICLES.slice(0, 8);
  if (!latest.length) {
    tickerTrack.innerHTML = "<span>No stories published yet &mdash; check back soon.</span>";
    return;
  }
  tickerTrack.innerHTML = latest.map(a => `<span>${escapeHtml(a.title)}</span>`).join("");
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function renderTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  const items = ARTICLES.filter(a => a.tab === tab);

  if (!items.length) {
    mainEl.innerHTML = `
      <h1 class="section-heading">${tab}</h1>
      <div class="empty-state">No ${tab} stories published yet.</div>
    `;
    return;
  }

  const [feature, ...rest] = items;

  mainEl.innerHTML = `
    <h1 class="section-heading">${tab}</h1>
    <div class="story-grid">
      <article class="feature-card" data-id="${feature.id}">
        ${feature.image ? `<div class="thumb" style="background-image:url('${escapeHtml(feature.image)}')"></div>` : ""}
        <div class="eyebrow">${feature.tab}</div>
        <h2>${escapeHtml(feature.title)}</h2>
        <p>${escapeHtml(feature.summary || "")}</p>
        <div class="byline">${escapeHtml(feature.author || "Newsroom Staff")} &middot; ${formatDate(feature.date)}</div>
      </article>
      <div class="side-list">
        ${rest.map(a => `
          <div class="side-item" data-id="${a.id}">
            ${a.image ? `<div class="thumb" style="background-image:url('${escapeHtml(a.image)}')"></div>` : `<div class="thumb"></div>`}
            <div>
              <h3>${escapeHtml(a.title)}</h3>
              <div class="byline">${formatDate(a.date)}</div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  mainEl.querySelectorAll("[data-id]").forEach(el => {
    el.addEventListener("click", () => renderArticle(el.dataset.id));
  });
}

function renderArticle(id) {
  const a = ARTICLES.find(x => x.id === id);
  if (!a) return;
  mainEl.innerHTML = `
    <div class="article-view">
      <div class="back-link" id="backLink">&larr; Back to ${a.tab}</div>
      <div class="eyebrow">${a.tab}</div>
      <h1>${escapeHtml(a.title)}</h1>
      <div class="byline">${escapeHtml(a.author || "Newsroom Staff")} &middot; ${formatDate(a.date)}</div>
      ${a.image ? `<div class="thumb" style="background-image:url('${escapeHtml(a.image)}')"></div>` : ""}
      <div class="body-text">${escapeHtml(a.content || a.summary || "")}</div>
    </div>
  `;
  document.getElementById("backLink").addEventListener("click", () => renderTab(a.tab));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => renderTab(btn.dataset.tab));
});

loadArticles();
