// build-articles.mjs
//
// Reads data/articles.json and generates one real, static, standalone HTML
// file per story in /articles/. Each page has its own <title>, meta
// description, canonical URL, Open Graph / Twitter tags, and NewsArticle
// JSON-LD — so Google (and Facebook/X previews, etc.) can crawl and index
// every single story on its own URL instead of only seeing the JS-rendered
// homepage.
//
// Also (re)generates sitemap.xml and robots.txt.
//
// Run manually with:  node scripts/build-articles.mjs
// Runs automatically via .github/workflows/build-articles.yml whenever
// data/articles.json changes (i.e. whenever the newsroom publishes a story
// through admin.html).

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SITE_URL = "https://bluegrasstransport.site";
const SITE_NAME = "Bluegrass TV";

const ARTICLES_JSON = path.join(ROOT, "data", "articles.json");
const ARTICLES_DIR = path.join(ROOT, "articles");
const TAB_LABELS = { news: "News", weather: "Weather", sports: "Sports", community: "Community" };

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
}

// Deterministic, collision-free slug: readable title text + a short stable
// suffix from the article id. Mirrored exactly in assets/app.js so links
// generated client-side always point at the right file.
function articleSlug(a) {
  const base = slugify(a.title) || "story";
  const suffix = String(a.id).slice(-6);
  return `${base}-${suffix}`;
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str) {
  return escapeHtml(str);
}

function isSafeHttpUrl(url) {
  try {
    const u = new URL(url, SITE_URL);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function formatDateHuman(d) {
  const dt = new Date(`${d}T00:00:00`);
  if (isNaN(dt)) return d || "";
  return dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function isoDate(d) {
  const dt = new Date(`${d}T12:00:00-04:00`);
  if (isNaN(dt)) return undefined;
  return dt.toISOString();
}

function paragraphsHtml(text) {
  const safe = escapeHtml(text || "");
  return safe
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n        ") || "<p></p>";
}

function renderRelated(all, current, max = 4) {
  const related = all
    .filter(a => a.id !== current.id && (a.tab || "").toLowerCase() === (current.tab || "").toLowerCase())
    .slice(0, max);
  if (!related.length) return "";
  return `
      <aside class="related-stories">
        <h2>More in ${escapeHtml(TAB_LABELS[current.tab] || current.tab)}</h2>
        <ul>
          ${related.map(a => `<li><a href="${escapeAttr(articleSlug(a))}.html">${escapeHtml(a.title)}</a></li>`).join("\n          ")}
        </ul>
      </aside>`;
}

function renderArticlePage(article, all) {
  const tab = (article.tab || "news").toLowerCase();
  const tabLabel = TAB_LABELS[tab] || tab;
  const slug = articleSlug(article);
  const url = `${SITE_URL}/articles/${slug}.html`;
  const description = escapeAttr((article.summary || article.content || "").slice(0, 200));
  const image = isSafeHttpUrl(article.image) ? article.image : "";
  const published = isoDate(article.date);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": article.title,
    "description": article.summary || undefined,
    "image": image ? [image] : undefined,
    "datePublished": published,
    "dateModified": published,
    "author": { "@type": "Organization", "name": article.author || "Newsroom Staff" },
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "logo": { "@type": "ImageObject", "url": `${SITE_URL}/assets/logo-bluegrasstv.png` }
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": url }
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://cloudflareinsights.com;">
<title>${escapeHtml(article.title)} | ${SITE_NAME}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${url}">

<meta property="og:type" content="article">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${escapeAttr(article.title)}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
${image ? `<meta property="og:image" content="${escapeAttr(image)}">` : ""}
<meta property="article:section" content="${escapeAttr(tabLabel)}">
${published ? `<meta property="article:published_time" content="${published}">` : ""}

<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${escapeAttr(article.title)}">
<meta name="twitter:description" content="${description}">
${image ? `<meta name="twitter:image" content="${escapeAttr(image)}">` : ""}

<link rel="stylesheet" href="../assets/style.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>

<header class="site-header">
  <a href="../index.html" class="brand" style="text-decoration:none;">
    <img src="../assets/logo-bluegrasstv.png" alt="Bluegrass TV logo">
    <div class="brand-text">BLUEGRASS<span>TV</span></div>
  </a>
</header>

<nav class="tab-nav">
  <a class="tab-btn" href="../index.html?tab=news">News</a>
  <a class="tab-btn" href="../index.html?tab=weather">Weather</a>
  <a class="tab-btn" href="../index.html?tab=sports">Sports</a>
  <a class="tab-btn" href="../index.html?tab=community">Community</a>
  <a href="../live.html" class="tab-btn">Live</a>
</nav>

<main id="main">
  <div class="article-view">
    <a class="back-link" href="../index.html?tab=${escapeAttr(tab)}">&larr; Back to ${escapeHtml(tabLabel)}</a>
    <div class="eyebrow">${escapeHtml(tabLabel)}</div>
    <h1>${escapeHtml(article.title)}</h1>
    ${article.summary ? `<p class="dek">${escapeHtml(article.summary)}</p>` : ""}
    <div class="byline">${escapeHtml(article.author || "Newsroom Staff")} &middot; <time datetime="${escapeAttr(article.date || "")}">${escapeHtml(formatDateHuman(article.date))}</time></div>
    ${image ? `<div class="thumb" style="background-image:url('${escapeAttr(image)}')" role="img" aria-label="${escapeAttr(article.title)}"></div>` : ""}
    <div class="body-text">
        ${paragraphsHtml(article.content || article.summary)}
    </div>
  </div>${renderRelated(all, article)}
</main>

<footer>
  Bluegrass TV &middot; Local news, weather, sports &amp; community &middot; <a href="../admin.html">Newsroom Login</a>
</footer>

<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "YOUR_CF_BEACON_TOKEN"}'></script>
</body>
</html>
`;
}

function renderSitemap(articles) {
  const staticUrls = [
    { loc: `${SITE_URL}/index.html`, priority: "1.0" },
    { loc: `${SITE_URL}/live.html`, priority: "0.6" }
  ];
  const articleUrls = articles.map(a => ({
    loc: `${SITE_URL}/articles/${articleSlug(a)}.html`,
    lastmod: a.date,
    priority: "0.8"
  }));
  const all = [...staticUrls, ...articleUrls];
  const body = all.map(u => `  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}
    <priority>${u.priority}</priority>
  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function renderRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

function main() {
  if (!existsSync(ARTICLES_JSON)) {
    console.error(`No articles.json found at ${ARTICLES_JSON}`);
    process.exit(1);
  }
  const articles = JSON.parse(readFileSync(ARTICLES_JSON, "utf8"));

  mkdirSync(ARTICLES_DIR, { recursive: true });

  // Clear out stale generated pages (e.g. from a deleted or retitled story)
  // before regenerating, so old URLs don't linger with outdated content.
  for (const f of readdirSync(ARTICLES_DIR)) {
    if (f.endsWith(".html")) unlinkSync(path.join(ARTICLES_DIR, f));
  }

  const seenSlugs = new Set();
  for (const article of articles) {
    const slug = articleSlug(article);
    if (seenSlugs.has(slug)) {
      console.warn(`Skipping duplicate slug "${slug}" for article id ${article.id}`);
      continue;
    }
    seenSlugs.add(slug);
    const html = renderArticlePage(article, articles);
    writeFileSync(path.join(ARTICLES_DIR, `${slug}.html`), html, "utf8");
  }

  writeFileSync(path.join(ROOT, "sitemap.xml"), renderSitemap(articles), "utf8");
  writeFileSync(path.join(ROOT, "robots.txt"), renderRobots(), "utf8");

  console.log(`Generated ${seenSlugs.size} article page(s), sitemap.xml, and robots.txt.`);
}

main();
