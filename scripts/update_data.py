#!/usr/bin/env python3
"""Fetch military ADS-B traffic + FAA TFRs for Kentucky and write static JSON.

Usage:  python scripts/update_data.py <output-dir>

Writes into <output-dir>:
  aircraft.json  latest military aircraft in/near Kentucky
  tfr.json       active Kentucky TFRs from the FAA
  activity.json  rolling 15-day sighting log used for the activity graph
  contracts.json recent federal contract awards mentioning each installation (USAspending, no key)
  news.json      recent news headlines per installation (Google News RSS)

Run on a schedule by .github/workflows/update-data.yml. Standard library only.
Aircraft data: adsb.lol / adsb.fi (ODbL). TFR data: FAA.
"""
import datetime, json, math, os, re, sys, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

SOURCES = ["https://api.adsb.lol/v2/mil", "https://opendata.adsb.fi/api/v2/mil"]
MARGIN = 0.75
LAT_MIN, LAT_MAX = 36.49 - MARGIN, 39.15 + MARGIN
LON_MIN, LON_MAX = -89.57 - MARGIN, -81.96 + MARGIN
RADIUS_NM = 40
KEEP_SECONDS = 15 * 86400
# Keep in sync with SITES in app.js
LOG_SITES = {
    "campbell": (36.669, -87.474),
    "knox": (37.891, -85.966),
    "bgad": (37.690, -84.250),
}
UA = {"User-Agent": "kentucky-osint/1.0 (github static site)"}


def get_json(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def nm(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 3440.065 * math.asin(math.sqrt(a))


def load(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))
    os.replace(tmp, path)


def fetch_aircraft():
    last_err = None
    for url in SOURCES:
        try:
            raw = get_json(url)
            out = []
            for a in raw.get("ac", []):
                lat, lon = a.get("lat"), a.get("lon")
                if lat is None or lon is None:
                    continue
                if not (LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX):
                    continue
                out.append({
                    "hex": a.get("hex"),
                    "callsign": (a.get("flight") or "").strip(),
                    "reg": a.get("r"),
                    "type": a.get("t"),
                    "alt": a.get("alt_baro"),
                    "gs": a.get("gs"),
                    "track": a.get("track"),
                    "squawk": a.get("squawk"),
                    "emergency": a.get("emergency"),
                    "lat": lat, "lon": lon,
                })
            return out, url
        except Exception as e:  # try next source
            last_err = e
            print("aircraft source failed:", url, e, file=sys.stderr)
    print("all aircraft sources failed:", last_err, file=sys.stderr)
    return None, None


def fetch_tfr():
    try:
        lst = get_json("https://tfr.faa.gov/tfrapi/getTfrList")
        return [
            {"id": x["notam_id"], "type": x.get("type"), "desc": x.get("description"),
             "mod": x.get("mod_date"), "new": x.get("is_new") == "Y",
             "url": "https://tfr.faa.gov/tfr3/?page=detail_" + x["notam_id"].replace("/", "_")}
            for x in lst if x.get("state") == "KY"]
    except Exception as e:
        print("tfr fetch failed:", e, file=sys.stderr)
        return None


SLOW_EVERY = 6 * 3600  # contracts and news refresh at most every 6 hours
QUERIES = {
    "campbell": {"keywords": ["Fort Campbell"], "match": ["campbell", "101st", "160th"]},
    "knox": {"keywords": ["Fort Knox"], "match": ["knox"]},
    "bgad": {"keywords": ["Blue Grass Army Depot"], "match": ["blue grass army depot", "bluegrass army depot", "bgad", "bgcapp", "blue grass chemical"]},
}


def post_json(url, body, timeout=40):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers=dict(UA, **{"Content-Type": "application/json"}))
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def fetch_contracts(prev):
    """Recent contract awards per site from USAspending (public API, no key)."""
    today = datetime.date.today()
    out = {}
    for k, q in QUERIES.items():
        try:
            d = post_json("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
                "filters": {
                    "keywords": q["keywords"],
                    "award_type_codes": ["A", "B", "C", "D"],
                    "time_period": [{"start_date": (today - datetime.timedelta(days=365)).isoformat(),
                                     "end_date": today.isoformat()}]},
                "fields": ["Award ID", "Recipient Name", "Award Amount", "Description", "Start Date",
                           "Awarding Sub Agency", "generated_internal_id"],
                "sort": "Start Date", "order": "desc", "limit": 12, "page": 1})
            out[k] = [{
                "date": x.get("Start Date"), "who": x.get("Recipient Name"), "amount": x.get("Award Amount"),
                "desc": (x.get("Description") or "")[:240], "agency": x.get("Awarding Sub Agency"),
                "url": "https://www.usaspending.gov/award/" + str(x.get("generated_internal_id"))}
                for x in d.get("results", [])]
        except Exception as e:
            print("contracts failed:", k, e, file=sys.stderr)
            if prev and k in prev.get("sites", {}):
                out[k] = prev["sites"][k]
    return out or None


def fetch_news(prev):
    """Recent headlines per site from Google News RSS, kept only if the title names the site."""
    out = {}
    for k, q in QUERIES.items():
        try:
            qs = urllib.parse.quote('"%s" when:60d' % q["keywords"][0])
            url = "https://news.google.com/rss/search?q=%s&hl=en-US&gl=US&ceid=US:en" % qs
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                root = ET.fromstring(r.read())
            items = []
            for it in root.iter("item"):
                title = (it.findtext("title") or "").strip()
                src = (it.findtext("source") or "").strip()
                if src and title.endswith(" - " + src):
                    title = title[: -len(src) - 3]
                if not any(m in title.lower() for m in q["match"]):
                    continue
                items.append({"title": title, "source": src, "url": it.findtext("link"),
                              "date": (it.findtext("pubDate") or "")[:16]})
                if len(items) >= 10:
                    break
            out[k] = items
        except Exception as e:
            print("news failed:", k, e, file=sys.stderr)
            if prev and k in prev.get("sites", {}):
                out[k] = prev["sites"][k]
    return out or None


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    now = int(time.time())

    aircraft, src = fetch_aircraft()
    if aircraft is not None:
        save(os.path.join(out, "aircraft.json"),
             {"updated": now, "source": src, "aircraft": aircraft})
        act_path = os.path.join(out, "activity.json")
        act = load(act_path, {"first": now, "s": []})
        for a in aircraft:
            site, best = "", RADIUS_NM
            for k, (la, lo) in LOG_SITES.items():
                d = nm(a["lat"], a["lon"], la, lo)
                if d <= best:
                    best, site = d, k
            act["s"].append([now, a["hex"], a["type"] or "", site])
        act["s"] = [x for x in act["s"] if x[0] >= now - KEEP_SECONDS]
        act["last"] = now
        save(act_path, act)
        print("aircraft in KY area:", len(aircraft))

    for name, fn in (("contracts.json", fetch_contracts), ("news.json", fetch_news)):
        path = os.path.join(out, name)
        prev = load(path, None)
        if prev and now - prev.get("updated", 0) < SLOW_EVERY:
            continue
        sites = fn(prev)
        if sites is not None:
            save(path, {"updated": now, "sites": sites})
            print(name, "updated")

    tfrs = fetch_tfr()
    if tfrs is not None:
        save(os.path.join(out, "tfr.json"), {"updated": now, "tfrs": tfrs})
        print("KY TFRs:", len(tfrs))


if __name__ == "__main__":
    main()
