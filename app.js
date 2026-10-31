/* 859 Military Observations - static site logic.
 * Live data (aircraft.json, tfr.json, activity.json) is written by a GitHub Action
 * to the "data" branch and read here through raw.githubusercontent.com (CORS-enabled).
 * Hand-edited entries live in content/*.json on the main branch.
 */
(function () {
'use strict';

var RADIUS_NM = 40;
var STALE_MIN = 45;
var cfg = window.KYOSINT || {};

var SITES = {
  campbell: { name: 'Fort Campbell', lat: 36.669, lon: -87.474, airfield: 'KHOP (Campbell AAF)',
    desc: 'Home of the 101st Airborne Division (Air Assault) and the 160th SOAR(A). Straddles the Kentucky/Tennessee line near Hopkinsville and Clarksville. Heavy rotary-wing activity; many aircraft do not broadcast ADS-B.',
    links: [['Official site', 'https://home.army.mil/campbell/'], ['News search', 'https://www.google.com/search?q=Fort+Campbell&tbm=nws']],
    recent: [
      ['Jan 18 - Feb 7, 2026', 'Operation Lethal Eagle 26.1: a 21-day division field exercise with more than 7,000 Soldiers, 22 rotary-wing aircraft and over 20 emerging systems under test. Winter weather paused it, and Fort Campbell closed most of the base during the storm.', 'https://www.stripes.com/branches/army/2026-01-22/101st-airborne-exercise-paused-winter-weather-20489762.html', 'Stars and Stripes'],
      ['Jan 2026', 'The division sped up a training attack to beat a snowstorm during the exercise. Two Marine MV-22 Ospreys took part as a proof of concept ahead of the MV-75 tilt-rotor, which the division expects to field in 2028.', 'https://www.stripes.com/branches/army/2026-01-28/101st-airborne-speeds-training-snowstorm-20545410.html', 'Stars and Stripes'],
      ['Mar 2026', 'The 101st tested integrating next-generation drones to support ground forces in a live-fire exercise.', 'https://www.kentuckynewera.com/ep/news/article_6e76783c-9fed-5b01-bfd0-1e2d4a91d604.html', 'Kentucky New Era'],
      ['Jul 28, 2026', 'The 101st and the Army Corps of Engineers Louisville District held a 3-day planning conference to pick the site for a new hangar at Campbell Army Airfield, the first of a series on modernizing the airfield.', 'https://www.army.mil/article/294186/101st_airborne_usace_partner_to_modernize_campbell_army_airfield', 'Army.mil'],
      ['Ongoing', 'Public affairs advisories warn of increased aircraft activity during large-scale training.', 'https://christiancountynow.com/news/267762-increased-aircraft-activity-expected-during-large-scale-training-exercise-at-fort-campbell/', 'Christian County Now']
    ],
    notes: [
      ['Units', '<b>101st Airborne Division (Air Assault)</b>, the Army\'s only air assault division, with a large aviation brigade.', 'Public record', 'g'],
      ['Units', '<b>160th Special Operations Aviation Regiment (Airborne)</b> and <b>5th Special Forces Group (Airborne)</b> are based here.', 'Public record', 'g'],
      ['Aircraft', 'UH-60 Black Hawk, CH-47 Chinook and AH-64 Apache; the 160th flies MH-60, MH-47 and MH-6/AH-6 variants. Night training is common.', 'Public record', 'g'],
      ['Airfield', 'Campbell Army Airfield (KHOP) and Sabre Army Heliport. Many military helicopters fly with ADS-B off.', 'Public record', 'g'],
      ['Size', 'Roughly 105,000 acres straddling the Kentucky/Tennessee line, with large live-fire and air assault training areas.', 'Public record', 'g']
    ] },
  knox: { name: 'Fort Knox', lat: 37.891, lon: -85.966, airfield: 'KFTK (Godman AAF)',
    desc: 'Army training, Cadet Command and Human Resources Command. Hardin, Meade and Bullitt counties, south of Louisville. Godman Army Airfield handles Army and visiting military aircraft.',
    links: [['Official site', 'https://home.army.mil/knox/'], ['News search', 'https://www.google.com/search?q=Fort+Knox&tbm=nws']],
    recent: [
      ['Jun 4, 2026', 'Cadet Summer Training 2026 began; Advanced Camp at Fort Knox is a 31-day event with more than 6,000 Cadets across nine regiments.', 'https://armyrotc.army.mil/advanced-camp/', 'Army Cadet Command'],
      ['Date not shown', 'A leadership change at Human Resources Command: Maj. Gen. Joseph Calloway returning to Fort Knox to take command, with other senior moves listed.', 'https://growknox.org/upcoming-senior-leaders-changes/', 'Grow Knox'],
      ['Current', 'Units listed on post include U.S. Army Recruiting Command, V Corps, Cadet Command and Human Resources Command.', 'https://home.army.mil/knox/units-tenants', 'Fort Knox official']
    ],
    notes: [
      ['Commands', '<b>US Army Human Resources Command</b>, <b>US Army Cadet Command</b> and <b>US Army Recruiting Command</b> are headquartered here.', 'Public record', 'g'],
      ['Training', 'Cadet summer training, courses, and reserve component training on large ranges.', 'Public record', 'g'],
      ['Airfield', 'Godman Army Airfield (KFTK) handles Army aviation and visiting military aircraft.', 'Public record', 'g'],
      ['Landmarks', 'The <b>US Bullion Depository</b> (run by the Treasury, not the Army) and the Patton Museum are on or beside the post.', 'Public record', 'g'],
      ['Size', 'Roughly 109,000 acres in Hardin, Meade and Bullitt counties.', 'Public record', 'g']
    ] },
  bgad: { name: 'Blue Grass Army Depot', lat: 37.690, lon: -84.250, airfield: 'None on post (nearest civil: Richmond / Lexington)',
    desc: 'Munitions storage and maintenance depot near Richmond, Madison County. Former site of a chemical weapons stockpile. Little aircraft activity of its own, so rail and road movements matter more here than ADS-B.',
    links: [['News search', 'https://www.google.com/search?q=Blue+Grass+Army+Depot&tbm=nws']],
    notes: [
      ['History', 'Former <b>Radar Bomb Scoring (RBS)</b> site. B-52s flew very close to the main gates on RBS runs.', 'Confirmed', 'g'],
      ['History', 'A captured Soviet radar was on site around the same period, used for B-52 jamming (ECM) practice.', 'Confirmed', 'g'],
      ['Rail', '<b>4 known locomotives</b> on site as of 2026.', 'Confirmed', 'g'],
      ['Rail', 'CSX locomotives have been spotted in the BGAD yard near the main gate, presumably <b>L349</b> switching cars. Cargo and purpose unknown.', 'Confirmed', 'g'],
      ['Warning systems', 'During the chemical weapons era, <b>EOWS-612</b> sirens ringed the depot border. A warning system remains, but is now concentrated around the bases.', 'Confirmed', 'g'],
      ['Mission', 'Army munitions storage and maintenance depot (est. 1941), about 14,600 acres in Madison County near Richmond.', 'Public record', 'g'],
      ['Chemical stockpile', 'Stored a legacy chemical weapons stockpile (nerve agent and mustard munitions) until the Blue Grass Chemical Agent Destruction Pilot Plant destroyed it; destruction was completed in 2023.', 'Public record', 'g'],
      ['Tenants', 'Based on unclassified documents, the depot is also home to <b>SOF</b> (special operations forces) elements.', 'Reported', 'y']
    ],
    facilities: [
      ['Igloo field and chemical agent destruction plant', 'images/bgad-igloo-field.jpg', 'About 60 earth-covered magazines laid out on a loop road and spurs. The destruction plant sits in its own fenced area at right. A rail line with railcars runs along the south edge. Several bare tan mounds at the top differ from the grassed igloos.', 'Observed', 'g'],
      ['Destruction plant, August 2025', 'images/bgad-plant-2025-08.jpg', 'Plant with equipment, piping and the full row of units still in place.', 'Observed', 'g'],
      ['Destruction plant, April 2026', 'images/bgad-plant-2026-04.jpg', 'Same plant later: a debris pile at upper left, thinner equipment rows and less piping on the roof, consistent with dismantling.', 'Observed', 'g'],
      ['Munitions destruction area', 'images/bgad-destruction-area.jpg', 'Two round gravel pads (lower left), a cleared and scarred area with a small pond (top), and a large bare area with two ponds beside Muddy Creek (right).', 'Reported', 'y'],
      ['Possible igloo-type structure', 'images/bgad-mound.jpg', 'Bare rounded earth mound with a small shed and a long container beside it. Function unknown; possibly a simulator or special-purpose structure.', 'Reported', 'y']
    ] }
};
var SITE_KEYS = Object.keys(SITES);
var TABS = ['status', 'live', 'activity', 'hfgcs', 'gt27', 'contracts', 'news', 'imagery', 'movements', 'events', 'installations', 'sources', 'emblem', 'about'].concat(SITE_KEYS);
var RANGES = { '24h': [3600, 24], '3d': [10800, 24], '7d': [21600, 28], '14d': [43200, 28] };

var state = { aircraft: null, tfr: null, activity: null, contracts: null, news: null, imagery: null, movements: null, events: null, range: '24h', tab: 'status' };

/* ---------- helpers ---------- */
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : null; }
function distNm(la1, lo1, la2, lo2) {
  var p = Math.PI / 180, dp = (la2 - la1) * p, dl = (lo2 - lo1) * p;
  var a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(la1 * p) * Math.cos(la2 * p) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return 2 * 3440.065 * Math.asin(Math.sqrt(a));
}
function utcTime(ts) { return new Date(ts * 1000).toUTCString().slice(17, 25) + ' Z'; }
function ageMin(ts) { return Math.round((Date.now() / 1000 - ts) / 60); }

function repoInfo() {
  if (cfg.owner && cfg.repo) return { owner: cfg.owner, repo: cfg.repo };
  var h = location.hostname;
  if (/\.github\.io$/i.test(h)) {
    var seg = location.pathname.split('/')[1] || '';
    return { owner: h.split('.')[0], repo: (seg && seg.indexOf('.') < 0) ? seg : h };
  }
  return null;
}
function dataBase() {
  if (cfg.dataBase) return cfg.dataBase;
  var r = repoInfo();
  if (r) return 'https://raw.githubusercontent.com/' + r.owner + '/' + r.repo + '/data/';
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return 'preview-data/';
  return null;
}
function getJSON(url) {
  return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + '_=' + Math.floor(Date.now() / 60000), { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
}

/* ---------- clock ---------- */
function tick() {
  var d = new Date();
  $('utc').textContent = pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds()) + ' Z';
  $('local').textContent = d.toUTCString().slice(0, 16);
}


/* ---------- HFGCS waterfall ---------- */
var WEBSDR = cfg.websdr || 'http://websdr.ewi.utwente.nl:8901/';
// Crop of the WebSDR page (viewport vw x vh) containing just the waterfall + frequency scale.
// Measured against the live page; adjust if the WebSDR layout changes.
var CROP = { vw: 1100, vh: 1000, x: 8, y: 758, w: 1024, h: 168 };
var HF = [
  [4724, 'Lower channel. Generally better after dark.'],
  [5703, 'Lower channel. Generally better after dark.'],
  [6739, 'Evening and night channel.'],
  [8992, 'Works day or night.'],
  [11175, 'Widely monitored channel. Generally better by day.'],
  [13200, 'Daytime channel.'],
  [15016, 'Higher band. Generally daytime only.']
];
var hfSel = 11175, hfActive = false, hfAudio = true, hfLoadedActivated = false;
function hfActivated() { return navigator.userActivation ? navigator.userActivation.hasBeenActive : true; }
// The receiver dims its page with a 'start audio' overlay while audio is blocked; undo the dimming then.
// Only Chromium reliably lets a click on this page unlock audio inside the frame (allow=autoplay).
function hfApplyAudio() {
  var f = $('hfframe'), unlocked = hfAudio && hfActivated() && !!navigator.userAgentData;
  if (hfAudio) f.setAttribute('allow', 'autoplay'); else f.removeAttribute('allow');
  f.style.filter = unlocked ? 'none' : 'brightness(2)';
  hfLoadedActivated = hfActivated();
}
function hfUrl(khz) { return WEBSDR + '?tune=' + khz + 'usb'; }
function hfCanEmbed() { return !(location.protocol === 'https:' && WEBSDR.indexOf('https:') !== 0); }
function hfLayout() {
  var w = $('hfwrap'), inner = $('hfinner'), f = $('hfframe');
  f.style.left = '-' + CROP.x + 'px'; f.style.top = '-' + CROP.y + 'px';
  f.style.width = CROP.vw + 'px'; f.style.height = CROP.vh + 'px';
  inner.style.width = CROP.w + 'px'; inner.style.height = CROP.h + 'px';
  var sc = Math.min(1, w.clientWidth / CROP.w) || 1;
  inner.style.transform = 'scale(' + sc + ')';
  w.style.height = Math.round(CROP.h * sc) + 'px';
}
function hfRender() {
  var btns = '';
  HF.forEach(function (h) { btns += '<a href="#" data-hf="' + h[0] + '"' + (h[0] === hfSel ? ' class="on"' : '') + '>' + h[0] + ' kHz</a>'; });
  btns += ' &nbsp; <a href="#" data-hfaudio="1" class="' + (hfAudio ? 'on' : '') + '">Audio: ' + (hfAudio ? 'ON' : 'OFF') + '</a>';
  $('hfbtns').innerHTML = btns;
  var h = HF.filter(function (x) { return x[0] === hfSel; })[0];
  $('hfdetails').innerHTML =
    '<tr><th>Frequency</th><td class="mono">' + hfSel.toFixed(1) + ' kHz (' + (hfSel / 1000).toFixed(3) + ' MHz)</td><th>Mode</th><td>USB (upper sideband)</td></tr>' +
    '<tr><th>Wavelength</th><td>about ' + (299792 / hfSel).toFixed(1) + ' m</td><th>Network</th><td>USAF HFGCS (US Air Force Global HF)</td></tr>' +
    '<tr><th>Propagation</th><td colspan="3">' + h[1] + ' General guidance only, not a transmission schedule.</td></tr>' +
    '<tr><th>Receiver</th><td colspan="3">University of Twente WebSDR, Enschede, Netherlands (0&ndash;29 MHz). <a target="_blank" rel="noopener" href="' + hfUrl(hfSel) + '">Open full receiver with audio</a></td></tr>';
  var fb = $('hffallback'), wrap = $('hfwrap');
  if (hfCanEmbed()) { fb.style.display = 'none'; wrap.style.display = 'block'; hfLayout(); }
  else {
    wrap.style.display = 'none'; fb.style.display = 'block';
    fb.innerHTML = 'The embedded waterfall is unavailable here: the receiver only serves plain http, and browsers block http frames on https pages. <a target="_blank" rel="noopener" href="' + hfUrl(hfSel) + '"><b>Open the live waterfall for ' + hfSel + ' kHz in a new tab</b></a>.';
  }
  $('hfnote').innerHTML = 'The waterfall is cropped and non-interactive. Audio (USB) plays after your first click on this page; use the Audio button to turn it off. Frequencies in kHz.';
}
function hfLoad(force) {
  if (!hfCanEmbed()) return;
  var f = $('hfframe'), u = hfUrl(hfSel);
  if (force || f.getAttribute('data-src') !== u) { hfApplyAudio(); f.setAttribute('data-src', u); f.src = 'about:blank'; setTimeout(function () { if (hfActive) f.src = u; }, force ? 60 : 0); }
}
function hfVisible(on) {
  hfActive = on;
  if (on) { hfRender(); hfLoad(); }
  else { var f = $('hfframe'); f.removeAttribute('data-src'); f.src = 'about:blank'; }  // drop the connection when leaving the tab
}

/* ---------- tabs ---------- */
function updateStamp() {
  var t = state.tab, el = $('stamp'), txt = '';
  function at(d, label) { return d ? label + ' updated ' + new Date(d * 1000).toUTCString().slice(5, 22) + ' Z' : ''; }
  if (t === 'status') txt = at(state.aircraft && state.aircraft.updated, 'Aircraft data');
  else if (t === 'live') txt = at(state.aircraft && state.aircraft.updated, 'Aircraft data');
  else if (t === 'activity') txt = at(state.activity && state.activity.last, 'Activity log');
  else if (t === 'contracts') txt = at(state.contracts && state.contracts.updated, 'Contract data');
  else if (t === 'news') txt = at(state.news && state.news.updated, 'News feed');
  else if (t === 'hfgcs') txt = 'Live receiver stream';
  else if (SITES[t]) txt = at(state.aircraft && state.aircraft.updated, 'Aircraft data');
  else { var m = new Date(document.lastModified); txt = isNaN(m) ? '' : 'Page last updated ' + m.toUTCString().slice(5, 16); }
  el.textContent = txt;
}
function showTab(t) {
  if (TABS.indexOf(t) < 0) t = 'status';
  TABS.forEach(function (k) { $('tab-' + k).style.display = (k === t ? 'block' : 'none'); });
  var as = document.querySelectorAll('a[data-tab]');
  for (var i = 0; i < as.length; i++) as[i].className = (as[i].getAttribute('data-tab') === t ? 'on' : '');
  hfVisible(t === 'hfgcs');
  state.tab = t; updateStamp();
}
document.addEventListener('click', function (e) {
  var el = e.target.closest ? e.target.closest('a[data-tab]') : null;
  if (!el) return;
  e.preventDefault();
  var t = el.getAttribute('data-tab');
  history.replaceState(null, '', '#' + t);
  showTab(t);
  window.scrollTo(0, 0);
});

/* ---------- aircraft tables ---------- */
var AC_HEAD = '<tr><th>Callsign</th><th>Type</th><th>Reg/Hex</th><th>Alt (ft)</th><th>GS (kt)</th><th>Hdg</th><th>Squawk</th><th>%X%</th><th>Map</th></tr>';
function isEmerg(a) { return (a.emergency && a.emergency !== 'none') || ['7500', '7600', '7700'].indexOf(a.squawk) >= 0; }
function acRow(a, lastCell) {
  return '<tr><td class="' + (isEmerg(a) ? 'r' : 'y') + '">' + esc(a.callsign || '-') + '</td><td>' + esc(a.type || '-') +
    '</td><td class="mono">' + esc(a.reg || a.hex) + '</td><td>' + esc(a.alt) + '</td><td>' + esc(a.gs == null ? '' : Math.round(a.gs)) +
    '</td><td>' + esc(a.track == null ? '' : Math.round(a.track)) + '</td><td class="mono">' + esc(a.squawk || '') +
    '</td><td>' + lastCell + '</td><td><a target="_blank" rel="noopener" href="https://globe.adsbexchange.com/?icao=' + encodeURIComponent(a.hex) + '">[map]</a></td></tr>';
}
function nearest(a) {
  var best = null;
  SITE_KEYS.forEach(function (k) { var d = distNm(SITES[k].lat, SITES[k].lon, a.lat, a.lon); if (!best || d < best.d) best = { k: k, d: d }; });
  return best;
}
function freshness(ts) {
  var m = ageMin(ts);
  return m > STALE_MIN ? '<span class="r">data is ' + m + ' min old (feed may be stalled)</span>' : 'updated ' + utcTime(ts) + ' (' + m + ' min ago)';
}
function noData(el, what) {
  var msg = what + ' temporarily unavailable.';
  el.innerHTML = '<span class="empty">' + msg + '</span>';
}

function renderLive() {
  var st = $('livestat'), t = $('livetbl'), d = state.aircraft;
  if (!d) { t.innerHTML = ''; noData(st, 'Aircraft data'); return; }
  var rows = AC_HEAD.replace('%X%', 'Nearest site');
  d.aircraft.forEach(function (a) {
    var n = nearest(a);
    rows += acRow(a, esc(SITES[n.k].name) + ' (' + Math.round(n.d) + ' nm)');
  });
  if (!d.aircraft.length) rows += '<tr><td colspan="9" class="empty">No military ADS-B traffic in the Kentucky area at last check.</td></tr>';
  t.innerHTML = rows;
  st.innerHTML = '<span class="g">' + d.aircraft.length + ' aircraft</span> &bull; ' + freshness(d.updated);
}

function nearSite(k) {
  var s = SITES[k], list = [];
  if (!state.aircraft) return list;
  state.aircraft.aircraft.forEach(function (a) { var d = distNm(s.lat, s.lon, a.lat, a.lon); if (d <= RADIUS_NM) list.push([a, d]); });
  return list.sort(function (x, y) { return x[1] - y[1]; });
}

/* ---------- status ---------- */
function unique24h(site) {
  var a = state.activity; if (!a) return null;
  var cut = Date.now() / 1000 - 86400, seen = {}, n = 0;
  a.s.forEach(function (x) { if (x[0] >= cut && (!site || x[3] === site) && !seen[x[1]]) { seen[x[1]] = 1; n++; } });
  return n;
}
function renderStatus() {
  var t = $('statustbl'), note = $('statusnote');
  if (!state.aircraft && !state.activity) { t.innerHTML = ''; noData(note, 'Status data'); return; }
  var rows = '<tr><th>Area</th><th>Aircraft now</th><th>Unique, last 24h</th></tr>';
  SITE_KEYS.forEach(function (k) {
    var now = state.aircraft ? nearSite(k).length : '-', u = unique24h(k);
    rows += '<tr><td><a href="#' + k + '" data-tab="' + k + '">' + esc(SITES[k].name) + '</a> <span class="small">(' + RADIUS_NM + ' nm)</span></td><td class="' + (now > 0 ? 'g' : '') + '">' + now + '</td><td>' + (u == null ? '-' : u) + '</td></tr>';
  });
  var all = state.aircraft ? state.aircraft.aircraft.length : '-', ua = unique24h(null);
  rows += '<tr><td><b>All Kentucky area</b></td><td class="' + (all > 0 ? 'g' : '') + '">' + all + '</td><td>' + (ua == null ? '-' : ua) + '</td></tr>';
  var tf = state.tfr ? state.tfr.tfrs.length : '-';
  rows += '<tr><td><b>Active Kentucky TFRs</b></td><td class="' + (tf > 0 ? 'y' : '') + '" colspan="2">' + tf + '</td></tr>';
  t.innerHTML = rows;
  note.innerHTML = state.aircraft ? freshness(state.aircraft.updated) : '';
}

/* ---------- TFR ---------- */
function renderTfr() {
  var b = $('tfrbox'), d = state.tfr;
  if (!d) { noData(b, 'TFR data'); return; }
  if (!d.tfrs.length) { b.innerHTML = '<span class="g">No active Kentucky TFRs listed by the FAA.</span> <span class="small">checked ' + utcTime(d.updated) + '</span>'; return; }
  var h = '<table class="data"><tr><th>NOTAM</th><th>Type</th><th>Description</th><th>Modified</th></tr>';
  d.tfrs.forEach(function (x) {
    h += '<tr><td><a target="_blank" rel="noopener" href="' + esc(x.url) + '">' + esc(x.id) + '</a>' + (x.new ? ' <span class="y">NEW</span>' : '') + '</td><td>' + esc(x.type) + '</td><td>' + esc(x.desc) + '</td><td class="mono">' + esc(x.mod) + '</td></tr>';
  });
  b.innerHTML = h + '</table><div class="small">Source: FAA TFR list, Kentucky entries only, checked ' + utcTime(d.updated) + '. <a target="_blank" rel="noopener" href="https://tfr.faa.gov/tfr3/?page=list">Full FAA list</a></div>';
}

/* ---------- alert marquee ---------- */
function renderAlerts() {
  var items = [];
  if (state.aircraft) state.aircraft.aircraft.forEach(function (a) { if (isEmerg(a)) items.push('EMERGENCY SQUAWK ' + (a.squawk || '') + ': ' + (a.callsign || a.hex)); });
  if (state.tfr) state.tfr.tfrs.forEach(function (x) { items.push('TFR ' + x.id + ' (' + x.type + '): ' + x.desc); });
  $('alertwrap').style.display = items.length ? 'table' : 'none';
  var tx = $('alerttxt'), t = items.join('   ***   ');
  if (tx.textContent !== t) {
    tx.textContent = t;
    tx.style.animation = 'none';
    void tx.offsetWidth;
    tx.style.animationDuration = Math.max(12, Math.round((t.length * 0.16 + 60) / 1)) + 's';
    tx.style.animation = '';
    tx.style.animationDuration = Math.max(12, Math.round(t.length * 0.16 + 14)) + 's';
  }
}

/* ---------- activity graph ---------- */
function buckets(range, site) {
  var r = RANGES[range], size = r[0], n = r[1], now = Math.floor(Date.now() / 1000), start = now - size * n;
  var sets = [], i, all = {}, types = {}, uniq = 0;
  for (i = 0; i < n; i++) sets.push({});
  state.activity.s.forEach(function (x) {
    if (x[0] < start || (site !== 'all' && x[3] !== site)) return;
    var b = Math.min(n - 1, Math.floor((x[0] - start) / size));
    sets[b][x[1]] = 1;
    if (!all[x[1]]) { all[x[1]] = 1; uniq++; var ty = x[2] || '?'; types[ty] = (types[ty] || 0) + 1; }
  });
  var top = Object.keys(types).map(function (k) { return [k, types[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
  return { start: start, size: size, range: range, counts: sets.map(function (s) { return Object.keys(s).length; }), unique: uniq, top: top };
}
function drawChart(d) {
  var W = 640, H = 210, L = 34, B = 24, T = 8, R = 6, n = d.counts.length, max = Math.max(1, Math.max.apply(null, d.counts));
  var step = max <= 5 ? 1 : Math.ceil(max / 5); max = Math.ceil(max / step) * step;
  var bw = (W - L - R) / n, svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px;background:#000022;border:1px solid #336699">';
  for (var v = 0; v <= max; v += step) {
    var y = H - B - (v / max) * (H - B - T);
    svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="#223366"/><text x="' + (L - 4) + '" y="' + (y + 4) + '" fill="#99CCFF" font-size="10" text-anchor="end" font-family="Verdana">' + v + '</text>';
  }
  var every = Math.ceil(n / 8);
  d.counts.forEach(function (c, i) {
    var h = (c / max) * (H - B - T), x = L + i * bw, t = new Date((d.start + i * d.size) * 1000);
    svg += '<rect x="' + (x + 1) + '" y="' + (H - B - h) + '" width="' + Math.max(1, bw - 2) + '" height="' + h + '" fill="#00CC00"><title>' + t.toISOString().slice(0, 16).replace('T', ' ') + 'Z: ' + c + ' aircraft</title></rect>';
    if (i % every === 0) {
      var lab = d.range === '24h' ? pad2(t.getUTCHours()) + 'Z' : (d.size < 86400 ? pad2(t.getUTCMonth() + 1) + '/' + pad2(t.getUTCDate()) + ' ' + pad2(t.getUTCHours()) + 'Z' : pad2(t.getUTCMonth() + 1) + '/' + pad2(t.getUTCDate()));
      svg += '<text x="' + (x + bw / 2) + '" y="' + (H - 8) + '" fill="#99CCFF" font-size="10" text-anchor="middle" font-family="Verdana">' + lab + '</text>';
    }
  });
  return svg + '</svg>';
}
var CATS = [
  ['Helicopters and tiltrotors', /^(H\d|UH|AH|CH|MH|HH|V22|V-22|OH|EC|AS|B06|B407|S70|S92|R44|R66|A109|A139|A119)/],
  ['Tankers', /^(K35|KC|K10|KC10|K46|A332)/],
  ['Transports', /^(C130|C30J|C17|C5|C40|C12|C21|C32|C37|C295|C27|B190|DH8|AN\d|IL\d|E135|GLEX|GLF|CL6)/],
  ['Bombers', /^(B52|B1|B2|B21)/],
  ['Fighters and attack', /^(F\d|FA|A10|AV8|EF|TYPH|RFAL|A4|F16|F35|F15|F18|F22)/],
  ['ISR, command and drones', /^(E\d|P8|P3|RQ|MQ|RC|R135|U2|U28|E3|E6|E8|E4|EP|WC|OC)/],
  ['Trainers', /^(T6|T38|T1|T45|T7|TEX|PC\d|T34|T44|T53|SR22|DA4|P28)/]
];
function acCat(t) {
  t = String(t || '').toUpperCase();
  if (!t || t === '?') return 'Unknown type';
  for (var i = 0; i < CATS.length; i++) if (CATS[i][1].test(t)) return CATS[i][0];
  return 'Other';
}
function renderTypes(d) {
  var el = $('acttypes'), site = $('actsite').value, r = RANGES[state.range], now = Math.floor(Date.now() / 1000), start = now - r[0] * r[1];
  var seen = {}, cats = {}, types = {}, total = 0;
  state.activity.s.forEach(function (x) {
    if (x[0] < start || (site !== 'all' && x[3] !== site) || seen[x[1]]) return;
    seen[x[1]] = 1; total++;
    var ty = x[2] || '?', c = acCat(ty);
    cats[c] = (cats[c] || 0) + 1;
    (types[c] = types[c] || {})[ty] = (types[c][ty] || 0) + 1;
  });
  if (!total) { el.innerHTML = ''; return; }
  var rows = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; }).map(function (c) {
    var list = Object.keys(types[c]).sort(function (a, b) { return types[c][b] - types[c][a]; }).slice(0, 5).map(function (t) { return esc(t) + ' (' + types[c][t] + ')'; }).join(', ');
    return '<tr><td><b>' + esc(c) + '</b></td><td style="width:40%"><div style="background:#FFFF00;height:10px;width:' + Math.round(cats[c] / total * 100) + '%"></div></td><td>' + cats[c] + '</td><td class="small">' + list + '</td></tr>';
  }).join('');
  el.innerHTML = '<table class="data"><tr><th>Aircraft type group</th><th>Share</th><th>Unique</th><th>Common types</th></tr>' + rows + '</table>';
}
function renderActivity() {
  if (!state.activity) { $('actchart').innerHTML = ''; noData($('actstat'), 'Activity history'); return; }
  var d = buckets(state.range, $('actsite').value);
  $('actchart').innerHTML = drawChart(d);
  var tt = d.top.map(function (x) { return esc(x[0]) + ' (' + x[1] + ')'; }).join(', ') || 'none';
  var first = state.activity.first, partial = first > d.start ? ' <span class="y">(partial: logging began ' + new Date(first * 1000).toUTCString().slice(5, 22) + ' Z)</span>' : '';
  renderTypes(d);
  $('actstat').innerHTML = '<b>' + d.unique + '</b> unique aircraft in range &bull; top types: ' + tt + partial;
}

/* ---------- contracts, news, imagery ---------- */
function money(n) { return n == null ? '' : '$' + Math.round(n).toLocaleString('en-US'); }
function renderContracts() {
  var el = $('contractsbox'), d = state.contracts;
  if (!d) { el.innerHTML = '<span class="empty">Contract data temporarily unavailable.</span>'; return; }
  var h = '';
  SITE_KEYS.forEach(function (k) {
    var list = (d.sites && d.sites[k]) || [];
    h += '<h2 style="margin-top:8px">' + esc(SITES[k].name) + '</h2>';
    if (!list.length) { h += '<div class="empty">No matching awards found.</div>'; return; }
    h += '<table class="data"><tr><th>Date</th><th>Awardee</th><th>Value</th><th>Description</th><th>Link</th></tr>' +
      list.map(function (x) {
        return '<tr><td class="mono">' + esc(x.date) + '</td><td>' + esc(x.who) + '</td><td class="mono">' + money(x.amount) + '</td><td>' + esc(x.desc) + '</td><td><a target="_blank" rel="noopener" href="' + esc(safeUrl(x.url)) + '">Award</a></td></tr>';
      }).join('') + '</table>';
  });
  el.innerHTML = h;
}
function renderNews() {
  var el = $('newsbox'), d = state.news;
  if (!d) { el.innerHTML = '<span class="empty">News feed temporarily unavailable.</span>'; return; }
  var h = '';
  SITE_KEYS.forEach(function (k) {
    var list = (d.sites && d.sites[k]) || [];
    h += '<h2 style="margin-top:8px">' + esc(SITES[k].name) + '</h2>';
    if (!list.length) { h += '<div class="empty">No recent headlines.</div>'; return; }
    h += '<table class="data"><tr><th>Date</th><th>Headline</th><th>Source</th></tr>' + list.map(function (x) {
      var u = safeUrl(x.url);
      return '<tr><td class="mono">' + esc(x.date) + '</td><td>' + (u ? '<a target="_blank" rel="noopener" href="' + esc(u) + '">' + esc(x.title) + '</a>' : esc(x.title)) + '</td><td>' + esc(x.source) + '</td></tr>';
    }).join('') + '</table>';
  });
  el.innerHTML = h;
}
function renderImagery() {
  var el = $('imagerybox'), d = state.imagery;
  if (!d) { el.innerHTML = '<span class="empty">Imagery log temporarily unavailable.</span>'; return; }
  if (!d.length) { el.innerHTML = '<span class="empty">No imagery logged yet.</span>'; return; }
  var list = d.slice().sort(function (a, b) { var A = /^\d/.test(a.date) ? a.date : '0', B = /^\d/.test(b.date) ? b.date : '0'; return B.localeCompare(A); });
  el.innerHTML = '<table class="data"><tr><th>Date</th><th>Area</th><th>Observation</th><th>Image</th><th>Basis</th></tr>' + list.map(function (x) {
    var u = safeUrl(x.image) || (/^images\/[\w.-]+$/.test(x.image || '') ? x.image : null);
    return '<tr><td class="mono">' + esc(x.date) + '</td><td>' + esc((SITES[x.site] || {}).name || x.site) + '</td><td><b>' + esc(x.title) + '</b><div class="small">' + esc(x.note) + '</div></td><td>' +
      (u ? '<a target="_blank" rel="noopener" href="' + esc(u) + '"><img src="' + esc(u) + '" alt="' + esc(x.title) + '" style="width:160px;max-width:100%;height:auto;border:1px solid #6699FF"></a>' : '') +
      '</td><td class="' + (/^observed$/i.test(x.basis) ? 'g' : 'y') + '">' + esc(x.basis) + '</td></tr>';
  }).join('') + '</table>';
}

/* ---------- hand-edited content ---------- */
var CONF = { HIGH: 'g', MED: 'y', MEDIUM: 'y', LOW: 'r', CONFIRMED: 'g', REPORTED: 'y' };
function srcCell(e) {
  var u = safeUrl(e.url), label = esc(e.source || (u ? 'link' : '-'));
  return u ? '<a target="_blank" rel="noopener" href="' + esc(u) + '">' + label + '</a>' : label;
}
function confCell(c) { return c ? '<td class="' + (CONF[String(c).toUpperCase()] || '') + '">' + esc(c) + '</td>' : '<td></td>'; }
function sortByDate(list) { return list.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }); }
function movTable(list, withLoc) {
  var h = '<table class="data"><tr><th>Date (Z)</th>' + (withLoc ? '<th>Location</th>' : '') + '<th>Type</th><th>Description</th><th>Source</th><th>Conf.</th></tr>';
  sortByDate(list).forEach(function (e) {
    h += '<tr><td class="mono">' + esc(e.date) + '</td>' + (withLoc ? '<td>' + esc(e.location || '') + '</td>' : '') + '<td>' + esc(e.type || '') + '</td><td>' + esc(e.description) + '</td><td>' + srcCell(e) + '</td>' + confCell(e.confidence) + '</tr>';
  });
  return h + '</table>';
}
function renderMovements() {
  var el = $('movbox');
  if (!state.movements) { el.innerHTML = '<span class="empty">Movement log temporarily unavailable.</span>'; return; }
  el.innerHTML = state.movements.length ? movTable(state.movements, true) : '<span class="empty">No movements logged yet.</span>';
  SITE_KEYS.forEach(function (k) { renderSite(k); });
}
function renderEvents() {
  var el = $('evbox');
  if (!state.events) { el.innerHTML = '<span class="empty">Events list temporarily unavailable.</span>'; return; }
  if (!state.events.length) { el.innerHTML = '<span class="empty">No events logged yet.</span>'; return; }
  var h = '<table class="data"><tr><th>Date</th><th>Event</th><th>Source</th></tr>';
  sortByDate(state.events).forEach(function (e) { h += '<tr><td class="mono">' + esc(e.date) + '</td><td>' + esc(e.title) + (e.description ? '<br><span class="small">' + esc(e.description) + '</span>' : '') + '</td><td>' + srcCell(e) + '</td></tr>'; });
  el.innerHTML = h + '</table>';
}

/* ---------- installation tabs ---------- */
function renderSite(k) {
  var s = SITES[k], el = $('tab-' + k);
  var links = s.links.map(function (l) { return '<a target="_blank" rel="noopener" href="' + l[1] + '">' + l[0] + '</a>'; }).join(' &bull; ');
  var h = '<h2>' + s.name + '</h2><div class="in"><p style="margin-top:0">' + s.desc + '</p>' +
    '<table class="data"><tr><th>Airfield</th><td>' + s.airfield + '</td><th>Coords</th><td class="mono">' + s.lat + ', ' + s.lon + '</td></tr></table>' +
    '<p>Links: ' + links + ' &bull; <a target="_blank" rel="noopener" href="https://globe.adsbexchange.com/?lat=' + s.lat + '&lon=' + s.lon + '&zoom=10">ADS-B map</a> &bull; <a target="_blank" rel="noopener" href="https://www.google.com/maps/@' + s.lat + ',' + s.lon + ',13z/data=!3m1!1e1">Satellite</a> &bull; <a target="_blank" rel="noopener" href="https://notams.aim.faa.gov/">NOTAMs</a></p></div>';
  if (s.notes) {
    h += '<h2>Site Notes &amp; History</h2><div class="in"><table class="data"><tr><th>Topic</th><th>Detail</th><th>Basis</th></tr>' +
      s.notes.map(function (n) { return '<tr><td><b>' + n[0] + '</b></td><td>' + n[1] + '</td><td class="' + n[3] + '">' + n[2] + '</td></tr>'; }).join('') + '</table></div>';
  }
  if (s.recent) {
    h += '<h2>Recent Developments</h2><div class="in"><table class="data"><tr><th>When</th><th>What</th><th>Source</th></tr>' +
      s.recent.map(function (n) { return '<tr><td>' + n[0] + '</td><td>' + n[1] + '</td><td><a target="_blank" rel="noopener" href="' + safeUrl(n[2]) + '">' + n[3] + '</a></td></tr>'; }).join('') + '</table><div class="small">Compiled from public news and official releases. Dates are as reported.</div></div>';
  }
  if (s.facilities) {
    h += '<h2>Facilities</h2><div class="in"><table class="data"><tr><th>Facility</th><th>Image</th><th>Basis</th></tr>' +
      s.facilities.map(function (f) { return '<tr><td><b>' + f[0] + '</b><div class="small">' + f[2] + '</div></td><td><a target="_blank" rel="noopener" href="' + f[1] + '"><img src="' + f[1] + '" alt="' + f[0] + '" style="width:220px;max-width:100%;height:auto;border:1px solid #6699FF"></a></td><td class="' + f[4] + '">' + f[3] + '</td></tr>'; }).join('') + '</table>' +
      '<div class="small">Imagery viewed in Google Earth (&copy; Airbus where shown). Descriptions are observations from imagery, not official statements.</div></div>';
  }
  h += '<h2>Military Air Traffic &mdash; within ' + RADIUS_NM + ' nm</h2><div class="in">';
  if (!state.aircraft) {
    h += '<div class="empty">' + 'Aircraft data temporarily unavailable.' + '</div>';
  } else {
    var list = nearSite(k), u = unique24h(k);
    h += '<div class="small"><span class="' + (list.length ? 'g' : '') + '">' + list.length + ' aircraft now</span>' + (u != null ? ' &bull; ' + u + ' unique in last 24h' : '') + ' &bull; ' + freshness(state.aircraft.updated) + '</div><table class="data">' + AC_HEAD.replace('%X%', 'Dist');
    list.forEach(function (x) { h += acRow(x[0], Math.round(x[1]) + ' nm'); });
    if (!list.length) h += '<tr><td colspan="9" class="empty">No military ADS-B traffic within ' + RADIUS_NM + ' nm at last check.</td></tr>';
    h += '</table>';
  }
  h += '</div><h2>Local Activity Log</h2><div class="in">';
  var mine = (state.movements || []).filter(function (e) { return e.site === k; });
  h += mine.length ? movTable(mine, false) : '<span class="empty">No activity logged yet.</span>';
  el.innerHTML = h + '</div>';
}

/* ---------- loading ---------- */
function loadLive() {
  var base = dataBase();
  if (!base) { renderAll(); return; }
  var jobs = [
    getJSON(base + 'aircraft.json').then(function (d) { state.aircraft = d; }, function () {}),
    getJSON(base + 'tfr.json').then(function (d) { state.tfr = d; }, function () {}),
    getJSON(base + 'activity.json').then(function (d) { state.activity = d; }, function () {}),
    getJSON(base + 'contracts.json').then(function (d) { state.contracts = d; }, function () {}),
    getJSON(base + 'news.json').then(function (d) { state.news = d; }, function () {})
  ];
  Promise.all(jobs).then(renderAll);
}
function loadContent() {
  getJSON('content/imagery.json').then(function (d) { state.imagery = d; }, function () { state.imagery = null; }).then(renderImagery);
  getJSON('content/movements.json').then(function (d) { state.movements = d; }, function () { state.movements = null; }).then(renderMovements);
  getJSON('content/events.json').then(function (d) { state.events = d; }, function () { state.events = null; }).then(renderEvents);
}
function renderAll() {
  renderStatus(); renderTfr(); renderLive(); renderActivity(); renderAlerts(); renderContracts(); renderNews(); updateStamp();
  SITE_KEYS.forEach(function (k) { renderSite(k); });
}

/* ---------- init ---------- */
SITE_KEYS.forEach(function (k) { renderSite(k); });
$('rangebar').addEventListener('click', function (e) {
  var r = e.target.getAttribute && e.target.getAttribute('data-r');
  if (!r) return;
  e.preventDefault(); state.range = r;
  Array.prototype.forEach.call(document.querySelectorAll('#rangebar a'), function (a) { a.className = (a.getAttribute('data-r') === r ? 'on' : ''); });
  renderActivity();
});
$('actsite').addEventListener('change', renderActivity);
$('hfbtns').addEventListener('click', function (e) {
  var k = e.target.getAttribute && e.target.getAttribute('data-hf');
  if (!k) return;
  e.preventDefault(); hfSel = parseInt(k, 10); hfRender(); hfLoad();
});
$('hfbtns').addEventListener('click', function (e) {
  if (!(e.target.getAttribute && e.target.getAttribute('data-hfaudio'))) return;
  e.preventDefault(); hfAudio = !hfAudio; hfRender(); hfLoad(true);
});
// Opened by direct link (no click yet): reload once after the first click so audio can start.
document.addEventListener('pointerdown', function () {
  if (hfActive && hfAudio && !hfLoadedActivated) setTimeout(function () { hfLoad(true); }, 0);
});
window.addEventListener('resize', function () { if (hfActive && hfCanEmbed()) hfLayout(); });
tick(); setInterval(tick, 1000);
showTab((location.hash || '#status').slice(1));
loadContent(); loadLive();
setInterval(loadLive, 120000);
})();
