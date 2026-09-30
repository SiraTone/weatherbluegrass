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
- `assets/logo.svg` — CellScope radar mark with animated sweep (header badge)
- `assets/favicon.svg` — static radar mark (favicon, inline `.cs-logo` badges)
- `assets/apple-touch-icon.png` — 180px render of the favicon for iOS home screens
- `assets/radar-3d.png` — 3D storm render (used for OG previews too)
- `assets/*.png` — graph renders
- `assets/videos/*.mp4` — clips, `preload="none"` with poster frames
- `downloads/CellScope-Demo.exe` — Windows demo, linked from home and products

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
