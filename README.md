# CellScope Products

Static site for CellScope Products. No framework, no build step, no dependencies.
Hosted on GitHub Pages at <https://bluegrasstransport.site>.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Opening banner, product grid, why-we-build-it |
| `products.html` | Five product sections with renders, perf table, motion clips |
| `solutions.html` | Coming soon |
| `about.html` | Mission and approach |
| `contact.html` | Mailto form (no backend) |
| `404.html` | Not found |

## Assets

- `assets/style.css` — single stylesheet, ~14 KB, no webfonts
- `assets/app.js` — nav, reveal-on-scroll, button sheen, mailto form
- `assets/intro.js` — skippable first-release intro (homepage only)
- `assets/intro-music.js` — quiet Web Audio score for the intro, no audio files
- `assets/logo.svg` — CellScope radar mark with animated sweep (header badge)
- `assets/favicon.svg` — static radar mark (favicon, inline `.cs-logo` badges)
- `assets/apple-touch-icon.png` — 180px render of the favicon for iOS home screens
- `assets/radar-3d-volume.png` — 3D reflectivity volume render (homepage hero, products, intro, OG previews)
- `assets/radar-3d-cores.png` — 3D storm-core isosurfaces over satellite basemap (products)
- `assets/*.png` — graph renders
- `assets/videos/*.mp4` — clips, `preload="none"` with poster frames
- Windows demo is hosted on Dropbox (too large for the repo), linked from home and products
- `downloads/CellScope-Trailer.mp4` — 30 s 1080p60 render of the intro with music; rebuild with
  `FFMPEG=/path/to/ffmpeg node tools/render-trailer.js` after changing the intro (needs Playwright)
- `downloads/CellScope-Canada-Radar-Trailer.mp4` — 34 s trailer for the 2026-09-30 Canadian radar update,
  rendered from `trailers/canada-radar.html` with
  `FFMPEG=... node tools/render-seek-trailer.js trailers/canada-radar.html downloads/CellScope-Canada-Radar-Trailer.mp4`.
  Map and precipitation are a stylized illustration, labeled on screen; the ECCC credit line is shown throughout.

## Conventions

- Type: Inter if the OS has it, otherwise the system stack. No webfont requests.
- Motion: transforms and opacity only. Everything respects `prefers-reduced-motion`.
- Every image carries `width`/`height` and `loading="lazy"` below the fold, so anchors
  land where they are supposed to.
- Copy is plain and factual. No em dashes, no hype adjectives, no em-dash-free AI
  phrasing. Say what a product does, then stop.

## Deploy

Push to `main`. GitHub Pages serves `main` from the repo root, with the domain
declared in `CNAME`. Do not delete `CNAME`; the domain 404s on the next push.
