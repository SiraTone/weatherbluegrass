# 859 Military Observations

A classic-style static site tracking Kentucky military activity from public sources. Runs on GitHub Pages with no server.

## How it works (static workarounds)

| Problem | Workaround |
|---|---|
| ADS-B APIs block browser requests (no CORS) | A GitHub Action (`.github/workflows/update-data.yml`) fetches adsb.lol (adsb.fi as backup) and the FAA TFR list every ~10 minutes |
| A static site can't keep history | The same job appends sightings to `activity.json` (15-day rolling log); the browser builds the 24h/3d/7d/14d graph from it |
| Committing data every 10 minutes would bloat the repo | Data goes to a separate `data` branch that is rewritten as a single commit each run (no history kept) and does not trigger Pages rebuilds |
| Browser needs to read that data | `raw.githubusercontent.com` sends CORS headers, so `app.js` reads `aircraft.json`, `tfr.json`, `activity.json`, `contracts.json`, `news.json` from the `data` branch |
| No form backend | "Submit a Tip" links to GitHub Issues |
| No database for log entries | Hand-edit `content/movements.json` and `content/events.json` |

Live data is therefore **near-live (about 10-20 minutes behind)**, not real-time.

## Setup

1. Create a GitHub repo and push this folder to `main`.
2. **Settings > Pages**: deploy from branch `main`, folder `/ (root)`.
3. **Settings > Actions > General > Workflow permissions**: allow *Read and write permissions*.
4. **Actions** tab > *update-data* > **Run workflow** once to create the `data` branch. After that it runs on its own.
5. Visit `https://<you>.github.io/<repo>/`. The repo is detected from the URL. For a custom domain, set `owner`/`repo` in `config.js`.

Notes:
- GitHub disables scheduled workflows on public repos after 60 days without repo activity. Push a commit now and then, or re-enable it in the Actions tab.
- Scheduled runs can be delayed or skipped under load, which shows as gaps in the activity graph.
- Only aircraft flagged military in the feed that broadcast ADS-B are counted.

## Adding entries

`content/movements.json` (Movement Log; entries with a `site` also show on that installation's page):

```json
[
  {
    "date": "2026-10-31 1430Z",
    "site": "bgad",
    "location": "Richmond, KY",
    "type": "Rail",
    "description": "What was observed",
    "source": "Name of source",
    "url": "https://example.com/source",
    "confidence": "HIGH"
  }
]
```

`site` is one of `campbell`, `knox`, `bgad`, or omit it. `confidence` is `HIGH`, `MED`, `LOW` (or `Confirmed`/`Reported`). `url` must start with http(s).

`content/events.json`:

```json
[
  { "date": "2026-10-31", "title": "What happened", "description": "optional", "source": "Name", "url": "https://..." }
]
```

Installation descriptions and the Blue Grass site notes are in `app.js` (`SITES`).

## Local preview

```
python scripts/update_data.py preview-data
python -m http.server 18431
```

Then open http://127.0.0.1:18431/ . On localhost the page reads `preview-data/` (git-ignored).

## Data credits

Aircraft: [adsb.lol](https://adsb.lol) / [adsb.fi](https://adsb.fi), ODbL. TFRs: FAA.
Only publicly available information. No personal information about service members or civilians.

## HFGCS Monitor tab

Embeds the University of Twente WebSDR (http://websdr.ewi.utwente.nl:8901/) as a cropped, non-interactive waterfall tuned to HFGCS frequencies (USB).

- The receiver only serves plain **http**, and browsers block http frames on **https** pages. On GitHub Pages (https) the tab therefore shows a link that opens the live waterfall in a new tab instead of the embed. The embed works when the page is served over http (for example the local preview).
- To embed on https, point `websdr` in `config.js` at a WebSDR that serves https and allows framing.
- The crop (`CROP` in `app.js`) was measured against the receiver's current page layout. If the receiver changes its layout, re-measure and adjust.
- Audio: the receiver normally waits for a click on its own "start audio" button, which a parent page cannot press. The iframe has `allow="autoplay"`, so in Chromium browsers a click anywhere on this page (including opening the tab) unlocks audio inside the frame. The Audio ON/OFF button reloads the frame with or without that permission.
- While audio is blocked the receiver dims its page with an overlay; a CSS brightness filter on `#hfframe` compensates, and is removed once audio is unlocked.

## Contracts, news and imagery

- `contracts.json` (USAspending, no key) and `news.json` (Google News RSS) are refreshed by the same workflow, at most every 6 hours, and feed the Contracts and News Digest tabs.
- The Imagery Log tab reads `content/imagery.json`. Add an entry with `date`, `site` (campbell, knox or bgad), `title`, `image` (a file in `images/`), `note` and `basis`.
