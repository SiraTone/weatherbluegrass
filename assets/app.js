const TABS = ["news", "weather", "sports", "community"];
let ARTICLES = [];

// Keep in sync with slugify()/articleSlug() in scripts/build-articles.mjs —
// this is how the homepage links to each story's real, static, indexable
// page in /articles/.
function slugify(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
}
function articleSlug(a) {
  const base = slugify(a.title) || "story";
  const suffix = String(a.id).slice(-6);
  return `${base}-${suffix}`;
}
function articleUrl(a) {
  return `articles/${articleSlug(a)}.html`;
}

const initialTab = new URLSearchParams(location.search).get("tab");
let currentTab = TABS.includes(initialTab) ? initialTab : "news";

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

// Re-check ages periodically so a story quietly drops off the ticker once it
// crosses 24 hours old, even if the page is left open and articles.json
// hasn't changed.
setInterval(renderTicker, 5 * 60 * 1000);

// Articles are considered "fresh" for the ticker for this many hours after
// they were published. `id` is a millisecond timestamp assigned when the
// article was created (see build-articles.mjs), so we use that instead of
// the day-only `date` field to get real 24-hour precision.
const TICKER_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function articleTimestamp(a) {
  const idMs = Number(a.id);
  if (!isNaN(idMs) && idMs > 0) return idMs;
  // Fallback for articles without a usable numeric id: midnight of `date`.
  const dt = new Date(a.date + "T00:00:00");
  return isNaN(dt) ? 0 : dt.getTime();
}

function renderTicker() {
  const now = Date.now();
  const fresh = ARTICLES.filter(a => now - articleTimestamp(a) < TICKER_MAX_AGE_MS);
  const latest = fresh.slice(0, 8);
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

// Defensively re-check image URLs are http(s) before using them, in case
// articles.json was ever edited by hand or by an older admin session.
function safeImageUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url, location.href);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch (e) { /* invalid */ }
  return "";
}

function renderTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  const items = ARTICLES.filter(a => (a.tab || "").trim().toLowerCase() === tab);

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
    <div class="story-grid ${rest.length ? "" : "story-grid-solo"}">
      <article class="feature-card">
        <a href="${escapeHtml(articleUrl(feature))}" class="card-link">
          ${feature.image ? `<div class="thumb" style="background-image:url('${escapeHtml(safeImageUrl(feature.image))}')"></div>` : ""}
          <div class="eyebrow">${feature.tab}</div>
          <h2>${escapeHtml(feature.title)}</h2>
          <p>${escapeHtml(feature.summary || "")}</p>
          <div class="byline">${escapeHtml(feature.author || "Newsroom Staff")} &middot; ${formatDate(feature.date)}</div>
        </a>
      </article>
      ${rest.length ? `
      <div class="side-list">
        ${rest.map(a => `
          <a href="${escapeHtml(articleUrl(a))}" class="side-item">
            ${a.image ? `<div class="thumb" style="background-image:url('${escapeHtml(safeImageUrl(a.image))}')"></div>` : `<div class="thumb"></div>`}
            <div>
              <h3>${escapeHtml(a.title)}</h3>
              <div class="byline">${formatDate(a.date)}</div>
            </div>
          </a>
        `).join("")}
      </div>` : ""}
    </div>
  `;
}

document.querySelectorAll(".tab-btn[data-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    renderTab(btn.dataset.tab);
    history.replaceState(null, "", `?tab=${btn.dataset.tab}`);
  });
});

loadArticles();
