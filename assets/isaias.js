/* Hurricane Isaias live page.
   Storm data: NOAA/NHC tropical map service (ArcGIS, CORS-enabled). Alerts: api.weather.gov.
   Satellite: NASA GIBS. Radar: NOAA MRMS WMS. Place search: Open-Meteo.
   Everything is fetched in the browser and refreshed every few minutes. */
(function () {
  'use strict';
  var d = document;
  var $ = function (id) { return d.getElementById(id); };

  var SVC = 'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer';
  var NWS = 'https://api.weather.gov/';
  var REFRESH_MS = 3 * 60 * 1000;
  var STORM_RE = /isaias/i;
  var BINS = ['AT1', 'AT2', 'AT3', 'AT4', 'AT5'];
  var ALERT_STATES = 'FL,AL,MS,LA,GA';
  var ALERT_EVENTS = ['Evacuation Immediate', 'Extreme Wind Warning', 'Hurricane Warning', 'Storm Surge Warning', 'Tornado Warning',
    'Flash Flood Emergency', 'Hurricane Watch', 'Storm Surge Watch', 'Tropical Storm Warning', 'Tropical Storm Watch', 'Tornado Watch'];
  var RED_EVENTS = { 'Evacuation Immediate': 1, 'Extreme Wind Warning': 1, 'Hurricane Warning': 1, 'Storm Surge Warning': 1, 'Tornado Warning': 1, 'Flash Flood Emergency': 1 };
    var ABBR = { alabama: 'AL', florida: 'FL', georgia: 'GA', louisiana: 'LA', mississippi: 'MS', texas: 'TX', 'south carolina': 'SC', 'north carolina': 'NC', tennessee: 'TN' };
  var TZ = { EDT: -4, EST: -5, CDT: -5, CST: -6, MDT: -6, MST: -7, PDT: -7, PST: -8, AST: -4, ADT: -3, HST: -10, UTC: 0, GMT: 0 };

  var state = { bin: null, storm: null, data: null, lastOk: 0, lastAdv: null, place: null, firstFit: true };
  var map, groups = {}, radarLayer, satLayer;

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function getJson(url, opts) {
    return fetch(url, Object.assign({ cache: 'no-store' }, opts || {})).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function mph(kt) { return Math.round(kt * 1.15078 / 5) * 5; }
  function mi(nm) { return nm * 1.15078; }
  function cat(kt, type) {
    var t = String(type || '');
    if (/^(EX|PT|LO|WV|DB)$/.test(t) && kt < 64) return { n: t === 'EX' ? 'Post-tropical' : t === 'PT' ? 'Post-tropical' : t === 'DB' ? 'Disturbance' : 'Low', c: '#9aa8c8', k: 'LOW' };
    if (kt < 34) return { n: 'Tropical depression', c: '#5ebaff', k: 'TD' };
    if (kt < 64) return { n: 'Tropical storm', c: '#00e5e0', k: 'TS' };
    if (kt < 83) return { n: 'Category 1', c: '#ffffb0', k: 'C1' };
    if (kt < 96) return { n: 'Category 2', c: '#ffe066', k: 'C2' };
    if (kt < 113) return { n: 'Category 3', c: '#ffb23c', k: 'C3' };
    if (kt < 137) return { n: 'Category 4', c: '#ff8a1f', k: 'C4' };
    return { n: 'Category 5', c: '#ff5a5a', k: 'C5' };
  }
  function compass(deg) {
    var n = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return n[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
  }
  function fmtTime(ms) {
    return new Date(ms).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  }
  function fmtDay(ms) { return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  function pos(lat, lon) { return Math.abs(lat).toFixed(1) + (lat >= 0 ? 'N ' : 'S ') + Math.abs(lon).toFixed(1) + (lon >= 0 ? 'E' : 'W'); }
  function rad(x) { return x * Math.PI / 180; }
  function distMi(a, b, c, e) {
    var dLat = rad(c - a), dLon = rad(e - b);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  function bearing(a, b, c, e) {
    var y = Math.sin(rad(e - b)) * Math.cos(rad(c));
    var x = Math.cos(rad(a)) * Math.sin(rad(c)) - Math.sin(rad(a)) * Math.cos(rad(c)) * Math.cos(rad(e - b));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  function inRing(lon, lat, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function inCone(lon, lat, fc) {
    return (fc.features || []).some(function (f) {
      var g = f.geometry; if (!g) return false;
      var polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      return polys.some(function (p) {
        if (!inRing(lon, lat, p[0])) return false;
        for (var h = 1; h < p.length; h++) if (inRing(lon, lat, p[h])) return false;
        return true;
      });
    });
  }
  /* "2026-10-08 1:00 PM Thu CDT" -> UTC ms */
  function parseLabel(s) {
    var m = /(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2}) (AM|PM) \w+ (\w+)/.exec(s || '');
    if (!m) return NaN;
    var h = +m[4] % 12 + (m[6] === 'PM' ? 12 : 0);
    var off = TZ[m[7]]; if (off == null) off = 0;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], h - off, +m[5]);
  }
  function parseDtg(n) {
    var s = String(Math.round(n));
    return Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10));
  }
  function say(el, html) { el.innerHTML = html; }

  /* ---------- NHC data ---------- */
  var layerIds;
  function layerMap() {
    if (layerIds) return Promise.resolve(layerIds);
    return getJson(SVC + '?f=json').then(function (j) {
      layerIds = {}; (j.layers || []).forEach(function (l) { layerIds[l.name] = l.id; });
      return layerIds;
    });
  }
  function query(name) {
    return layerMap().then(function (ids) {
      var id = ids[name];
      if (id == null) throw new Error('no layer ' + name);
      return getJson(SVC + '/' + id + '/query?where=1%3D1&outFields=*&outSR=4326&f=geojson');
    });
  }
  function findStorm() {
    var order = state.bin ? [state.bin].concat(BINS.filter(function (b) { return b !== state.bin; })) : BINS;
    var i = 0, fallback = null;
    function next() {
      if (i >= order.length) return fallback;
      var bin = order[i++];
      return query(bin + ' Forecast Points').then(function (fc) {
        var f = (fc.features || []);
        if (!f.length) return next();
        var name = f[0].properties.stormname || '';
        if (STORM_RE.test(name)) return { bin: bin, fcPts: fc };
        if (!fallback) fallback = { bin: bin, fcPts: fc, other: true };
        return next();
      }, function () { return next(); });
    }
    return Promise.resolve(next());
  }
  function loadStorm() {
    return findStorm().then(function (found) {
      if (!found) return null;
      var b = found.bin;
      function opt(name) { return query(b + ' ' + name).catch(function () { return { features: [] }; }); }
      return Promise.all([opt('Forecast Track'), opt('Forecast Cone'), opt('Watch-Warning'), opt('Past Points'), opt('Past Track'), opt('Advisory Wind Field')])
        .then(function (r) {
          return { bin: b, other: !!found.other, fcPts: found.fcPts, track: r[0], cone: r[1], ww: r[2], pastPts: r[3], pastTrack: r[4], wind: r[5] };
        });
    });
  }

  /* ---------- derived series ---------- */
  function series(data) {
    var fc = data.fcPts.features.map(function (f) {
      var p = f.properties, g = f.geometry.coordinates;
      return { t: parseLabel(p.fldatelbl), kt: p.maxwind, gustKt: p.gust, mslp: p.mslp < 2000 ? p.mslp : null, type: p.stormtype, tau: p.tau,
        lat: g[1], lon: g[0], label: p.datelbl, dir: p.tcdir < 999 ? p.tcdir : null, spd: p.tcspd < 999 ? p.tcspd : null, p: p };
    }).sort(function (a, b) { return a.tau - b.tau; });
    var past = data.pastPts.features.map(function (f) {
      var p = f.properties, g = f.geometry.coordinates;
      return { t: parseDtg(p.dtg), kt: p.intensity, type: p.stormtype, lat: g[1], lon: g[0], mslp: p.mslp > 800 ? p.mslp : null };
    }).sort(function (a, b) { return a.t - b.t; });
    var nowT = fc.length ? fc[0].t : Date.now();
    past = past.filter(function (p) { return p.t < nowT; });
    return { fc: fc, past: past, now: fc[0] || null };
  }

  /* ---------- render: stats ---------- */
  function renderStats(s, data) {
    var n = s.now, el = $('izStats');
    if (!n) { el.innerHTML = ''; return; }
    var c = cat(n.kt, n.type);
    var p0 = data.fcPts.features[0].properties;
    var move = n.dir != null && n.spd != null ? (n.spd > 0 ? compass(n.dir) + ' at ' + mph(n.spd) + ' mph' : 'Nearly stationary') : 'Not available';
    var items = [
      ['lead', c.n, 'Strength now', c.c],
      ['', mph(n.kt) + ' mph', 'Max sustained winds'],
      ['', n.gustKt ? mph(n.gustKt) + ' mph' : 'n/a', 'Gusts'],
      ['', n.mslp ? n.mslp + ' mb' : 'n/a', n.mslp ? 'Pressure (' + (n.mslp * 0.02953).toFixed(2) + ' in)' : 'Pressure'],
      ['', move, 'Moving'],
      ['', pos(n.lat, n.lon), 'Center position'],
      ['', '#' + p0.advisnum, 'Advisory, ' + esc(p0.advdate)]
    ];
    el.innerHTML = items.map(function (i) {
      return '<div class="iz-stat' + (i[0] ? ' iz-stat--lead' : '') + '"><b' + (i[3] ? ' style="color:' + i[3] + '"' : '') + '>' + esc(i[1]) + '</b><span>' + i[2] + '</span></div>';
    }).join('');
    var name = p0.stormname || 'Hurricane Isaias';
    $('izTitle').textContent = name;
    d.title = name + ' Live | CellScope Products';
  }

  /* ---------- render: table ---------- */
  function renderTable(s) {
    var rows = s.fc.map(function (f) {
      var c = cat(f.kt, f.type);
      return '<tr><td>' + esc(f.tau === 0 ? 'Now' : '+' + f.tau + ' h') + '</td><td>' + esc(fmtTime(f.t)) + '</td><td>' + esc(pos(f.lat, f.lon)) + '</td><td><b>' + mph(f.kt) + ' mph</b></td><td><span class="iz-cat" style="background:' + c.c + '">' + esc(c.n) + '</span></td><td>' + (f.gustKt ? mph(f.gustKt) + ' mph' : '') + '</td></tr>';
    }).join('');
    $('izTable').innerHTML = '<thead><tr><th>Time</th><th>When</th><th>Position</th><th>Winds</th><th>Strength</th><th>Gusts</th></tr></thead><tbody>' + rows + '</tbody>';
  }

  /* ---------- render: strength history chart ---------- */
  var BANDS = [[0, 39, 'TD', '#5ebaff'], [39, 74, 'TS', '#00e5e0'], [74, 96, 'Cat 1', '#ffffb0'], [96, 111, 'Cat 2', '#ffe066'], [111, 130, 'Cat 3', '#ffb23c'], [130, 157, 'Cat 4', '#ff8a1f'], [157, 250, 'Cat 5', '#ff5a5a']];
  function renderChart(s) {
    var host = $('izChart');
    var pts = {};
    s.past.forEach(function (p) { pts[p.t] = { t: p.t, mph: mph(p.kt), kt: p.kt, type: p.type, src: 'Past' }; });
    s.fc.forEach(function (f) { pts[f.t] = { t: f.t, mph: mph(f.kt), kt: f.kt, type: f.type, src: f.tau === 0 ? 'Now' : 'Forecast' }; });
    var arr = Object.keys(pts).map(function (k) { return pts[k]; }).sort(function (a, b) { return a.t - b.t; });
    if (arr.length < 2) { host.innerHTML = '<p>Not enough data yet.</p>'; return; }
    var W = 800, H = 330, L = 46, R = 50, T = 26, B = 34;
    var tmin = arr[0].t, tmax = arr[arr.length - 1].t;
    var maxv = Math.max.apply(null, arr.map(function (a) { return a.mph; }));
    var ymax = Math.max(100, Math.min(180, Math.ceil((maxv + 10) / 20) * 20));
    function sx(t) { return L + (t - tmin) / (tmax - tmin) * (W - L - R); }
    function sy(v) { return H - B - v / ymax * (H - T - B); }
    var o = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Chart of maximum sustained winds in mph, past and forecast. The table below lists the forecast.">';
    BANDS.forEach(function (b) {
      if (b[0] >= ymax) return;
      var y0 = sy(Math.min(b[1], ymax)), y1 = sy(b[0]);
      o += '<rect x="' + L + '" y="' + y0 + '" width="' + (W - L - R) + '" height="' + (y1 - y0) + '" fill="' + b[3] + '" opacity=".09"/>';
      o += '<text x="' + (W - R + 6) + '" y="' + ((y0 + y1) / 2 + 4) + '">' + b[2] + '</text>';
      o += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y1 + '" y2="' + y1 + '" stroke="rgba(150,180,240,.18)"/>';
    });
    for (var v = 0; v <= ymax; v += 20) o += '<text x="' + (L - 8) + '" y="' + (sy(v) + 4) + '" text-anchor="end">' + v + '</text>';
    o += '<text x="12" y="14">mph</text>';
    var d0 = new Date(tmin); d0.setHours(24, 0, 0, 0);
    for (var t = d0.getTime(); t < tmax; t += 86400000) {
      o += '<line x1="' + sx(t) + '" x2="' + sx(t) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="rgba(150,180,240,.1)"/><text x="' + sx(t) + '" y="' + (H - 12) + '" text-anchor="middle">' + esc(fmtDay(t)) + '</text>';
    }
    var nowT = s.now ? s.now.t : tmax;
    o += '<line x1="' + sx(nowT) + '" x2="' + sx(nowT) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="#fff" stroke-dasharray="2 4" opacity=".7"/><text x="' + sx(nowT) + '" y="' + (T - 8) + '" text-anchor="middle" style="fill:#fff;font-weight:700">Now</text>';
    var pastArr = arr.filter(function (a) { return a.t <= nowT; }), fcArr = arr.filter(function (a) { return a.t >= nowT; });
    function path(a) { return a.map(function (p, i) { return (i ? 'L' : 'M') + sx(p.t).toFixed(1) + ' ' + sy(p.mph).toFixed(1); }).join(''); }
    if (pastArr.length > 1) o += '<path d="' + path(pastArr) + '" fill="none" stroke="#3fe0ff" stroke-width="3" stroke-linejoin="round"/>';
    if (fcArr.length > 1) o += '<path d="' + path(fcArr) + '" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="7 6" stroke-linejoin="round"/>';
    arr.forEach(function (p) {
      o += '<circle cx="' + sx(p.t).toFixed(1) + '" cy="' + sy(p.mph).toFixed(1) + '" r="' + (p.src === 'Now' ? 6 : 3.5) + '" fill="' + cat(p.kt, p.type).c + '" stroke="#04060c" stroke-width="1.5"/>';
    });
    o += '<g id="izHover" style="display:none"><line id="izHv" y1="' + T + '" y2="' + (H - B) + '" stroke="#fff" opacity=".5"/><circle id="izHc" r="6" fill="none" stroke="#fff" stroke-width="2"/><text id="izHt" class="iz-readout" y="' + (T + 14) + '"></text></g>';
    o += '<rect id="izHit" x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '" fill="transparent"/></svg>';
    var peakPast = pastArr.reduce(function (m, p) { return p.mph > m.mph ? p : m; }, pastArr[0] || arr[0]);
    var peakFc = fcArr.reduce(function (m, p) { return p.mph > m.mph ? p : m; }, fcArr[0] || arr[0]);
    o += '<p class="iz-fine" style="margin:8px 4px 2px">Peak so far: <b>' + peakPast.mph + ' mph</b> (' + esc(cat(peakPast.kt, peakPast.type).n) + ') on ' + esc(fmtDay(peakPast.t)) + '. Forecast peak: <b>' + peakFc.mph + ' mph</b> (' + esc(cat(peakFc.kt, peakFc.type).n) + ') around ' + esc(fmtTime(peakFc.t)) + '. Solid line is observed, dashed is forecast.</p>';
    host.innerHTML = o;
    var svg = host.querySelector('svg'), hit = $('izHit');
    function show(ev) {
      var r = svg.getBoundingClientRect();
      var x = (ev.clientX - r.left) / r.width * W;
      var best = arr[0], bd = 1e9;
      arr.forEach(function (p) { var dd = Math.abs(sx(p.t) - x); if (dd < bd) { bd = dd; best = p; } });
      var px = sx(best.t), py = sy(best.mph);
      $('izHover').style.display = '';
      $('izHv').setAttribute('x1', px); $('izHv').setAttribute('x2', px);
      $('izHc').setAttribute('cx', px); $('izHc').setAttribute('cy', py);
      var tx = $('izHt');
      tx.textContent = fmtTime(best.t) + ': ' + best.mph + ' mph, ' + cat(best.kt, best.type).n + ' (' + best.src.toLowerCase() + ')';
      var right = px > W * 0.55;
      tx.setAttribute('x', right ? px - 8 : px + 8); tx.setAttribute('text-anchor', right ? 'end' : 'start');
    }
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', function () { $('izHover').style.display = 'none'; });
  }

  /* ---------- map ---------- */
  var WW_STYLE = {
    HWR: ['#ff3b4d', 'Hurricane warning'], HWA: ['#ff8fd0', 'Hurricane watch'],
    TWR: ['#3b82ff', 'Tropical storm warning'], TWA: ['#ffe14a', 'Tropical storm watch']
  };
  function initMap() {
    if (map || !window.L) return;
    map = L.map('izMap', { zoomControl: true, worldCopyJump: true, minZoom: 3 }).setView([27, -88], 5);
    var ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
    L.tileLayer(ESRI + 'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 12, maxNativeZoom: 12, attribution: 'Esri, HERE, Garmin, OpenStreetMap'
    }).addTo(map);
    map.createPane('izLabels'); map.getPane('izLabels').style.zIndex = 640; map.getPane('izLabels').style.pointerEvents = 'none';
    L.tileLayer(ESRI + 'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 12, maxNativeZoom: 12, pane: 'izLabels' }).addTo(map);
    ['sat', 'radar', 'cone', 'wind', 'past', 'ww', 'track'].forEach(function (k) { groups[k] = L.layerGroup(); });
    satLayer = L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_GeoColor/default/default/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png', {
      maxNativeZoom: 7, maxZoom: 12, opacity: .85, attribution: 'Satellite: NASA GIBS / NOAA GOES-East'
    });
    var RADAR = 'https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity/MapServer/export';
    var RadarTiles = L.TileLayer.extend({
      getTileUrl: function (c) {
        var n = Math.pow(2, this._getZoomForUrl()), W = 20037508.342789244, size = 2 * W / n;
        var x0 = -W + c.x * size, y1 = W - c.y * size;
        return RADAR + '?bbox=' + [x0, y1 - size, x0 + size, y1].join(',') + '&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image&_t=' + this.options.stamp;
      }
    });
    radarLayer = new RadarTiles('', { maxZoom: 12, opacity: .75, stamp: Math.floor(Date.now() / 120000), attribution: 'Radar: NOAA/NWS MRMS' });
    groups.sat.addLayer(satLayer); groups.radar.addLayer(radarLayer);
    map.createPane('izTop'); map.getPane('izTop').style.zIndex = 650;
    $('izLayers').addEventListener('change', function (e) {
      var k = e.target.getAttribute('data-l'); if (!k) return;
      toggle(k, e.target.checked);
    });
    Array.prototype.forEach.call($('izLayers').querySelectorAll('input'), function (i) { toggle(i.getAttribute('data-l'), i.checked); });
  }
  function toggle(k, on) {
    if (!map || !groups[k]) return;
    if (on) groups[k].addTo(map); else map.removeLayer(groups[k]);
    if (k === 'sat' || k === 'radar') { if (on) groups[k].eachLayer(function (l) { if (l.bringToFront && k === 'radar') l.bringToFront(); }); }
  }
  function renderMap(s, data) {
    if (!map) return;
    ['cone', 'wind', 'past', 'ww', 'track'].forEach(function (k) { groups[k].clearLayers(); });
    var bounds = [];
    // cone
    L.geoJSON(data.cone, { style: { color: '#fff', weight: 1.5, fillColor: '#fff', fillOpacity: .2 } }).addTo(groups.cone);
    // wind field (largest first so the strongest sits on top)
    var wf = (data.wind.features || []).slice().sort(function (a, b) { return b.properties.radii - a.properties.radii; });
    var wcol = { 34: '#ffd23f', 50: '#ff9f43', 64: '#ff4d5a' };
    wf.forEach(function (f) {
      var col = wcol[f.properties.radii] || '#fff';
      L.geoJSON(f, { style: { color: col, weight: 1.5, fillColor: col, fillOpacity: .22 } })
        .bindTooltip(f.properties.radii + '-knot wind radius now', { className: 'iz-tip', sticky: true }).addTo(groups.wind);
    });
    // watches and warnings
    L.geoJSON(data.ww, {
      style: function (f) { var st = WW_STYLE[f.properties.tcww]; return { color: st ? st[0] : '#9aa8c8', weight: 7, opacity: .95, lineCap: 'round' }; },
      onEachFeature: function (f, l) { var st = WW_STYLE[f.properties.tcww]; l.bindTooltip(st ? st[1] : 'Watch or warning', { className: 'iz-tip', sticky: true }); }
    }).addTo(groups.ww);
    // past track: colored segments by intensity
    var pp = s.past.concat(s.now ? [s.now] : []);
    for (var i = 1; i < pp.length; i++) {
      L.polyline([[pp[i - 1].lat, pp[i - 1].lon], [pp[i].lat, pp[i].lon]], { color: cat(pp[i].kt, pp[i].type).c, weight: 4, opacity: .95 }).addTo(groups.past);
    }
    s.past.forEach(function (p) {
      var c = cat(p.kt, p.type);
      L.circleMarker([p.lat, p.lon], { radius: 4, color: '#04060c', weight: 1, fillColor: c.c, fillOpacity: 1 })
        .bindTooltip(fmtTime(p.t) + '<br>' + mph(p.kt) + ' mph, ' + esc(c.n), { className: 'iz-tip' }).addTo(groups.past);
      bounds.push([p.lat, p.lon]);
    });
    // forecast track
    var line = s.fc.map(function (f) { return [f.lat, f.lon]; });
    L.polyline(line, { color: '#fff', weight: 2.5, dashArray: '6 7', opacity: .95 }).addTo(groups.track);
    s.fc.forEach(function (f) {
      var c = cat(f.kt, f.type);
      var m = L.circleMarker([f.lat, f.lon], { radius: f.tau === 0 ? 0.1 : 8, color: '#04060c', weight: 1.5, fillColor: c.c, fillOpacity: 1 })
        .bindPopup('<b>' + esc(fmtTime(f.t)) + '</b><br>' + mph(f.kt) + ' mph, ' + esc(c.n) + '<br>' + esc(pos(f.lat, f.lon)));
      if (f.tau > 0 && f.tau % 24 === 0) m.bindTooltip(esc(f.label), { permanent: true, direction: 'right', offset: [8, 0], className: 'iz-tip' });
      m.addTo(groups.track);
      bounds.push([f.lat, f.lon]);
    });
    if (s.now) {
      L.marker([s.now.lat, s.now.lon], {
        pane: 'izTop', keyboard: false,
        icon: L.divIcon({ className: '', html: '<div class="iz-eye" style="border-color:' + cat(s.now.kt, s.now.type).c + '"></div>', iconSize: [26, 26], iconAnchor: [13, 13] })
      }).bindPopup('<b>Center now</b><br>' + esc(pos(s.now.lat, s.now.lon)) + '<br>' + mph(s.now.kt) + ' mph').addTo(groups.track);
    }
    if (state.firstFit && bounds.length) { map.fitBounds(bounds, { padding: [30, 30], maxZoom: 7 }); state.firstFit = false; }
    // legend
    var lg = [['TD', '#5ebaff'], ['Tropical storm', '#00e5e0'], ['Cat 1', '#ffffb0'], ['Cat 2', '#ffe066'], ['Cat 3', '#ffb23c'], ['Cat 4', '#ff8a1f'], ['Cat 5', '#ff5a5a']]
      .map(function (a) { return '<span><i style="background:' + a[1] + '"></i>' + a[0] + '</span>'; }).join('');
    var seen = {};
    (data.ww.features || []).forEach(function (f) { seen[f.properties.tcww] = 1; });
    Object.keys(seen).forEach(function (k) { var st = WW_STYLE[k]; if (st) lg += '<span><i class="sq" style="background:' + st[0] + '"></i>' + st[1] + '</span>'; });
    $('izLegend').innerHTML = lg;
    // keep time-based layers fresh
    if (radarLayer) { radarLayer.options.stamp = Math.floor(Date.now() / 120000); radarLayer.redraw(); }
    if (satLayer) satLayer.setUrl('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_GeoColor/default/default/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png?_t=' + Math.floor(Date.now() / 600000));
    setTimeout(function () { map.invalidateSize(); }, 50);
  }

  var LOOKUPS = [
    ['Florida: Know Your Zone', 'https://www.floridadisaster.org/knowyourzone/'], ['Alabama EMA', 'https://ema.alabama.gov/'],
    ['Mississippi EMA', 'https://www.msema.org/'], ['Louisiana: Get a Game Plan', 'https://www.getagameplan.org/'],
    ['Georgia GEMA', 'https://gema.georgia.gov/'], ['Find an open shelter (Red Cross)', 'https://www.redcross.org/get-help/disaster-relief-and-recovery-services/find-an-open-shelter.html']
  ];

  /* ---------- refresh loop ---------- */
  var busy = false;
  function showError(msg) { var e = $('izError'); if (msg) { e.textContent = msg; e.hidden = false; } else e.hidden = true; }
  function freshText() {
    if (!state.lastOk) return;
    var age = Math.round((Date.now() - state.lastOk) / 1000);
    var ago = age < 60 ? age + ' s' : Math.round(age / 60) + ' min';
    var adv = state.lastAdv ? 'Advisory ' + esc(state.lastAdv.num) + ', issued ' + esc(state.lastAdv.date) + '. ' : '';
    $('izFresh').innerHTML = adv + 'Checked ' + ago + ' ago. Auto-refreshes every 3 minutes.';
  }
  function refresh() {
    if (busy) return Promise.resolve();
    busy = true; $('izRefresh').disabled = true;
    return loadStorm().then(function (data) {
      if (!data) {
        showError('The National Hurricane Center is not publishing a forecast for Isaias right now. It may have weakened or dissipated. See the latest on nhc.noaa.gov.');
        $('izFresh').textContent = 'No active forecast found.';
        return;
      }
      if (data.other) showError('Isaias was not found. Showing ' + data.fcPts.features[0].properties.stormname + ' instead.'); else showError('');
      state.bin = data.bin; state.data = data;
      var s = state.series = series(data);
      var p0 = data.fcPts.features[0].properties;
      var changed = state.lastAdv && state.lastAdv.num !== p0.advisnum;
      state.lastAdv = { num: p0.advisnum, date: p0.advdate };
      state.lastOk = Date.now();
      renderStats(s, data); renderTable(s); renderChart(s); renderMap(s, data);
      freshText();
      if (changed) $('izFresh').insertAdjacentHTML('beforeend', ' <b>New advisory.</b>');
    }).catch(function () {
      showError('Could not reach the National Hurricane Center data service. Showing the last data we have. Retrying automatically.');
    }).then(function () {
      busy = false; $('izRefresh').disabled = false;
    });
  }

  function init() {
    var yr = $('year'); if (yr) yr.textContent = new Date().getFullYear();
    $('izRefresh').addEventListener('click', refresh);
    $('izSources').innerHTML = [
      ['National Hurricane Center', 'https://www.nhc.noaa.gov/'], ['Hurricanes.gov', 'https://www.hurricanes.gov/'], ['NWS alerts', 'https://alerts.weather.gov/'],
      ['Ready.gov hurricane guide', 'https://www.ready.gov/hurricanes'], ['Our live coverage on YouTube', 'https://www.youtube.com/@BluegrassWeatherCommunications']
    ].map(function (a) { return '<a href="' + a[1] + '" target="_blank" rel="noopener">' + a[0] + '</a>'; }).join('');
    $('izLookups').innerHTML = LOOKUPS.map(function (a) { return '<a href="' + a[1] + '" target="_blank" rel="noopener">' + a[0] + '</a>'; }).join('');
    initMap();
    refresh();
    setInterval(function () { if (!d.hidden) refresh(); }, REFRESH_MS);
    setInterval(freshText, 15000);
    d.addEventListener('visibilitychange', function () { if (!d.hidden && Date.now() - state.lastOk > 60000) refresh(); });
  }
  if (window.L) init(); else window.addEventListener('load', init);
})();
