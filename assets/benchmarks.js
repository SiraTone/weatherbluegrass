/* Benchmarks: leaderboard + accuracy explorer, driven by one data table. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  /* d5/d10: day-5 and day-10 500 hPa NH ACC. pub: which of those are directly published. */
  var MODELS = [
    { id: 'ecmwf', name: 'ECMWF IFS', center: 'ECMWF', type: 'physics', grid: '~9 km', color: '#3fe0ff', d5: 0.930, d10: 0.800, pub: ['d5', 'd10'],
      note: 'Cycle 49r1, 51-member ensemble. Leads WMO 500 hPa verification among physics models.' },
    { id: 'aifs', name: 'AIFS', center: 'ECMWF', type: 'ai', grid: '~28 km', color: '#c084fc', d5: 0.935, d10: 0.810, pub: [],
      note: 'ECMWF operational AI system. Narrow edge over IFS aloft; weaker on heavy precipitation.' },
    { id: 'graphcast', name: 'GraphCast', center: 'Google DeepMind', type: 'ai', grid: '0.25°', color: '#60a5fa', d5: 0.934, d10: 0.805, pub: [],
      note: 'Graph neural network. Beat HRES on ~90% of targets in its 2023 Science paper.' },
    { id: 'aurora', name: 'Aurora', center: 'Microsoft', type: 'ai', grid: '0.1°', color: '#2dd4bf', d5: 0.933, d10: 0.803, pub: [],
      note: 'Foundation model fine-tuned for weather. Reported gains over IFS HRES at 0.1°.' },
    { id: 'fuxi', name: 'FuXi', center: 'Fudan University', type: 'ai', grid: '0.25°', color: '#f87171', d5: 0.930, d10: 0.808, pub: [],
      note: 'Cascaded ML model tuned for 15-day range; strongest relative skill past day 9.' },
    { id: 'pangu', name: 'Pangu-Weather', center: 'Huawei', type: 'ai', grid: '0.25°', color: '#fb923c', d5: 0.925, d10: 0.790, pub: [],
      note: '3D Earth-specific transformer. First ML model to match IFS at medium range (Nature, 2023).' },
    { id: 'ukmo', name: 'UKMO UM', center: 'Met Office', type: 'physics', grid: '~10 km', color: '#f472b6', d5: 0.915, d10: 0.775, pub: [],
      note: 'Strong on the North Atlantic and frontal systems. Frequently blended into ensembles.' },
    { id: 'gfs', name: 'GFS', center: 'NOAA NCEP', type: 'physics', grid: '~13 km', color: '#ff9f43', d5: 0.905, d10: 0.760, pub: ['d5'],
      note: 'Free and open data, 16-day range. Individual cycles have beaten ECMWF at 500 hPa.' },
    { id: 'icon', name: 'ICON', center: 'DWD', type: 'physics', grid: '~13 km', color: '#4ade80', d5: 0.905, d10: 0.765, pub: [],
      note: 'Open source since January 2024. Matches the leaders at short range over Europe.' },
    { id: 'gem', name: 'GEM', center: 'ECCC (Canada)', type: 'physics', grid: '~15 km', color: '#a3e635', d5: 0.895, d10: 0.750, pub: [],
      note: 'Canadian global model. Solid mid-pack performer, strong over North America.' },
    { id: 'arpege', name: 'ARPEGE', center: 'Météo-France', type: 'physics', grid: '~5–24 km', color: '#e879f9', d5: 0.893, d10: 0.745, pub: [],
      note: 'Stretched grid, finest over France. Global scores trail the leaders at range.' },
    { id: 'kim', name: 'KIM', center: 'KMA (Korea)', type: 'physics', grid: '~12 km', color: '#94a3b8', d5: 0.890, d10: 0.740, pub: [],
      note: 'Korean Integrated Model on a cubed-sphere grid, operational since 2020.' },
    { id: 'gsm', name: 'GSM', center: 'JMA', type: 'physics', grid: '~13 km', color: '#facc15', d5: 0.890, d10: 0.740, pub: [],
      note: 'Steady global model, best work in West Pacific typhoon season.' },
    { id: 'access', name: 'ACCESS-G', center: 'BoM (Australia)', type: 'physics', grid: '~12 km', color: '#38bdf8', d5: 0.880, d10: 0.725, pub: [],
      note: 'Based on the UM. Southern Hemisphere focus; NH scores trail.' },
    { id: 'cma', name: 'CMA-GFS', center: 'CMA (China)', type: 'physics', grid: '~25 km', color: '#fca5a5', d5: 0.875, d10: 0.720, pub: [],
      note: 'GRAPES-based global model, steadily improving through recent upgrades.' },
    { id: 'navgem', name: 'NAVGEM', center: 'US Navy FNMOC', type: 'physics', grid: '~31 km', color: '#cbd5e1', d5: 0.865, d10: 0.705, pub: [],
      note: 'Navy global model. Coarsest grid on the board and last on day-5 skill.' }
  ];

  /* Fit ACC(d) = 1 - a*d^b through the day-5 and day-10 anchors. */
  MODELS.forEach(function (m) {
    var e5 = 1 - m.d5, e10 = 1 - m.d10;
    var b = Math.log(e10 / e5) / Math.LN2, a = e5 / Math.pow(5, b);
    m.acc = function (d) { return 1 - a * Math.pow(d, b); };
    m.horizon = Math.pow(0.2 / a, 1 / b);
    m.pts = [];
    for (var d = 1; d <= 10; d++) m.pts.push({ d: d, v: m.acc(d), pub: (d === 5 && m.pub.indexOf('d5') > -1) || (d === 10 && m.pub.indexOf('d10') > -1) });
  });
  var PROFILES = {"ecmwf": {"skills": [10, 9, 9, 9, 9, 9], "good": ["Best physics model at 500 hPa, the WMO headline score", "Heavy and extreme precipitation, where AI models still lag", "Tropical cyclone tracks and intensity via the 51-member ensemble", "Skill horizon past day 10"], "bad": ["Data is licensed; full-resolution fields historically cost money", "Slower to run than AI models, about 1 hour per cycle on a supercomputer"]}, "aifs": {"skills": [10, 9, 7, 8, 8, 9], "good": ["Narrowly beats IFS on upper-air error scores", "Fast: a 10-day forecast in minutes on a GPU", "Strong tropical cyclone tracks"], "bad": ["Coarser ~28 km grid smooths small-scale detail", "Underestimates heavy rain peaks and intensity extremes", "Relies on IFS analyses to start each run"]}, "graphcast": {"skills": [10, 9, 6, 8, 8, 8], "good": ["Beat ECMWF HRES on ~90% of 1,380 targets in its 2023 Science paper", "Excellent cyclone track forecasts", "Runs in under a minute on one TPU"], "bad": ["Blurs fields at long lead times, losing sharp features", "Weak on extreme precipitation and peak intensity", "Trained on reanalysis; not a full physical model, so no guaranteed conservation laws"]}, "aurora": {"skills": [10, 9, 7, 8, 8, 8], "good": ["High 0.1° resolution for an AI model", "Foundation model that also does air quality and ocean waves", "Reported gains over IFS HRES on most targets"], "bad": ["Newer and less proven in real-time operations", "Expensive to fine-tune; fewer independent verifications", "Extremes and rare events still underrepresented in training"]}, "fuxi": {"skills": [9, 8, 6, 7, 8, 10], "good": ["Tuned for 15-day forecasts; best relative skill past day 9", "Cascade design reduces error build-up at long range"], "bad": ["Slightly behind the leaders at short range", "Smooth output underplays convective rainfall", "Limited independent operational verification"]}, "pangu": {"skills": [9, 8, 5, 8, 7, 7], "good": ["First ML model to match IFS at medium range (Nature, 2023)", "Very fast: global forecast in seconds", "Good cyclone tracks"], "bad": ["No precipitation output in its original release", "Falls behind newer AI models past day 7", "Underestimates cyclone intensity"]}, "ukmo": {"skills": [9, 9, 8, 8, 9, 8], "good": ["North Atlantic storms and frontal systems", "UK and Western Europe surface detail", "Strong wind forecasts"], "bad": ["Global scores trail ECMWF at range", "Limited free data access"]}, "gfs": {"skills": [8, 7, 7, 8, 7, 7], "good": ["Fully free and open data, updated 4 times a day", "16-day range, longest standard range here", "Good hurricane tracks in recent versions"], "bad": ["Known warm and cold surface biases in some seasons", "Tends to overdo precipitation amounts and convective feedback", "Trails ECMWF by about a day of skill at range"]}, "icon": {"skills": [8, 9, 8, 7, 8, 7], "good": ["Short-range detail over Europe matching the leaders", "Open source since January 2024", "Good 2 m temperature forecasts"], "bad": ["Loses ground at longer lead times", "Tropical cyclone guidance weaker than ECMWF and GFS"]}, "gem": {"skills": [8, 8, 7, 7, 7, 7], "good": ["Strong over North America and Canadian winter", "Good snowfall and cold-air forecasts"], "bad": ["Mid-pack at 500 hPa globally", "Can over-deepen some mid-latitude lows"]}, "arpege": {"skills": [7, 8, 8, 6, 7, 6], "good": ["Stretched grid gives very fine detail over France", "Good Mediterranean rain events"], "bad": ["Coarse far from France, so global scores suffer", "Shorter forecast range than most"]}, "kim": {"skills": [7, 7, 7, 7, 7, 7], "good": ["Cubed-sphere grid with no pole problems", "Solid East Asia performance"], "bad": ["Young model with a short track record", "Trails leaders across most global scores"]}, "gsm": {"skills": [7, 7, 7, 9, 7, 7], "good": ["West Pacific typhoon tracks", "Steady and consistent run to run"], "bad": ["Middle of the pack at 500 hPa", "Less skill over the Atlantic and Europe"]}, "access": {"skills": [7, 7, 7, 7, 7, 6], "good": ["Southern Hemisphere and Australian region", "Built on the proven Met Office UM"], "bad": ["Northern Hemisphere scores trail", "Smaller verification footprint"]}, "cma": {"skills": [7, 6, 7, 7, 6, 6], "good": ["East Asian monsoon rainfall", "Improving quickly with recent upgrades"], "bad": ["Coarser ~25 km grid", "Global skill still behind the leading centers"]}, "navgem": {"skills": [6, 6, 6, 6, 6, 5], "good": ["Maritime and naval weather products", "Useful as an independent ensemble member"], "bad": ["Coarsest grid on the board (~31 km)", "Lowest 500 hPa skill in this group", "Being phased toward newer systems"]}};
  var SKILLS = ["Upper air (500 hPa)","Surface temperature","Precipitation","Tropical cyclones","Wind","Extended range"];
  MODELS.forEach(function (m) { var p = PROFILES[m.id]; m.skills = p.skills; m.good = p.good; m.bad = p.bad; });
  var BY = {}; MODELS.forEach(function (m) { BY[m.id] = m; });

  /* ---------- Leaderboard ---------- */
  var body = document.getElementById('lbBody');
  var sortKey = 'd5', filter = 'all', open = null;
  var active = { ecmwf: true, gfs: true, aifs: true, icon: true };

  function fmt(v) { return v.toFixed(3); }
  function renderBoard() {
    if (!body) return;
    var rows = MODELS.filter(function (m) { return filter === 'all' || m.type === filter; })
      .slice().sort(function (a, b) { return b[sortKey] - a[sortKey]; });
    var lo = Math.min.apply(null, rows.map(function (m) { return m[sortKey]; }));
    var hi = Math.max.apply(null, rows.map(function (m) { return m[sortKey]; }));
    var html = '', rank = 0, key = function (m) { return (sortKey === 'horizon' ? m.horizon : m[sortKey]).toFixed(sortKey === 'horizon' ? 1 : 3); };
    rows.forEach(function (m, i) {
      if (i === 0 || key(rows[i - 1]) !== key(m)) rank = i + 1;
      var tied = (i > 0 && key(rows[i - 1]) === key(m)) || (i < rows.length - 1 && key(rows[i + 1]) === key(m));
      var pct = hi === lo ? 100 : 18 + 82 * (m[sortKey] - lo) / (hi - lo);
      var medal = rank <= 3 ? ' lb-rank--' + rank : '';
      function cell(k) {
        var val = k === 'horizon' ? m.horizon.toFixed(1) + ' d' : fmt(m[k]);
        var pubTag = m.pub.indexOf(k) > -1 ? ' <span class="lb-tag lb-tag--pub">pub</span>' : '';
        var bar = k === sortKey ? '<span class="lb-bar"><i style="width:' + pct.toFixed(1) + '%;background:' + m.color + '"></i></span>' : '';
        return '<td class="lb-num' + (k === sortKey ? ' is-sorted' : '') + '">' + '<span class="lb-val">' + val + pubTag + '</span>' + bar + '</td>';
      }
      html += '<tr data-id="' + m.id + '" tabindex="0" aria-expanded="' + (open === m.id) + '" class="' + (active[m.id] ? 'is-on' : '') + (open === m.id ? ' is-open' : '') + '">' +
        '<td><span class="lb-rank' + medal + '">' + (tied ? 'T' : '') + rank + '</span></td>' +
        '<td><span class="lb-model"><span class="dot" style="background:' + m.color + '"></span><span><strong>' + m.name + '</strong><small>' + m.center + '</small></span></span></td>' +
        '<td class="lb-hide-sm"><span class="lb-tag lb-tag--' + m.type + '">' + (m.type === 'ai' ? 'AI' : 'Physics') + '</span></td>' +
        '<td class="lb-hide-sm lb-grid">' + m.grid + '</td>' +
        cell('d5') + cell('d10') + cell('horizon') + '</tr>';
      if (open === m.id) html += detail(m, rank, tied, rows.length);
    });
    body.innerHTML = html;
  }
  function detail(m, rank, tied, n) {
    var bars = SKILLS.map(function (lab, i) {
      var v = m.skills[i];
      return '<li><span>' + lab + '</span><span class="md-meter"><i style="width:' + v * 10 + '%;background:' + m.color + '"></i></span><b>' + v + '</b></li>';
    }).join('');
    function list(a) { return a.map(function (t) { return '<li>' + t + '</li>'; }).join(''); }
    return '<tr class="lb-detail"><td colspan="7"><div class="md">' +
      '<div class="md-head"><div><h3>' + m.name + '</h3><p>' + m.note + '</p></div>' +
      '<button class="btn btn-sm md-plot" type="button" data-plot="' + m.id + '">' + (active[m.id] ? 'Remove from chart' : 'Plot on chart') + '</button></div>' +
      '<div class="md-stats">' +
        '<div><small>Rank</small><b>' + (tied ? 'T' : '') + rank + '<em>/' + n + '</em></b></div>' +
        '<div><small>Day 5 ACC</small><b>' + fmt(m.d5) + '</b></div>' +
        '<div><small>Day 10 ACC</small><b>' + fmt(m.d10) + '</b></div>' +
        '<div><small>Skillful to</small><b>' + m.horizon.toFixed(1) + '<em> days</em></b></div>' +
        '<div><small>Grid</small><b>' + m.grid + '</b></div>' +
      '</div>' +
      '<div class="md-grid">' +
        '<div><h4>Skill profile <small>editorial 1–10</small></h4><ul class="md-skills">' + bars + '</ul></div>' +
        '<div><h4 class="md-good">Really good at</h4><ul class="md-list md-list--good">' + list(m.good) + '</ul>' +
        '<h4 class="md-bad">Weak spots</h4><ul class="md-list md-list--bad">' + list(m.bad) + '</ul></div>' +
      '</div></div></td></tr>';
  }
  if (body) {
    body.addEventListener('click', function (e) {
      var pb = e.target.closest('[data-plot]');
      if (pb) { toggle(pb.getAttribute('data-plot'), true); return; }
      var tr = e.target.closest('tr[data-id]'); if (tr) expand(tr.getAttribute('data-id'));
    });
    body.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var tr = e.target.closest('tr[data-id]'); if (tr && e.target === tr) { e.preventDefault(); expand(tr.getAttribute('data-id')); }
    });
  }
  document.querySelectorAll('.lb-sort').forEach(function (b) {
    b.addEventListener('click', function () {
      sortKey = b.getAttribute('data-sort');
      document.querySelectorAll('.lb-sort').forEach(function (o) { o.removeAttribute('aria-sort'); });
      b.setAttribute('aria-sort', 'descending');
      renderBoard();
    });
  });
  document.querySelectorAll('.seg-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      filter = b.getAttribute('data-filter');
      document.querySelectorAll('.seg-btn').forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      renderBoard();
    });
  });

  /* ---------- Explorer ---------- */
  var svg = document.getElementById('accChart');
  var tip = document.getElementById('chartTip');
  var info = document.getElementById('modelInfo');
  var chips = document.getElementById('chips');
  var W = 760, H = 400, ML = 48, MR = 108, MT = 16, MB = 40, YMIN = 0.65, YMAX = 1.0;
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function X(d) { return ML + (d - 1) / 9 * (W - ML - MR); }
  function Y(v) { return MT + (1 - (v - YMIN) / (YMAX - YMIN)) * (H - MT - MB); }
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function smooth(p) {
    var s = 'M' + p[0].x + ' ' + p[0].y;
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
      s += 'C' + (p1.x + (p2.x - p0.x) / 6) + ' ' + (p1.y + (p2.y - p0.y) / 6) + ' ' +
        (p2.x - (p3.x - p1.x) / 6) + ' ' + (p2.y - (p3.y - p1.y) / 6) + ' ' + p2.x + ' ' + p2.y;
    }
    return s;
  }

  if (chips) {
    chips.innerHTML = MODELS.map(function (m) {
      return '<button class="chip" type="button" style="--c:' + m.color + '" data-model="' + m.id + '" aria-pressed="false"><span class="dot" aria-hidden="true"></span>' + m.name + '</button>';
    }).join('');
    chips.addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (c) toggle(c.getAttribute('data-model'), false);
    });
  }
  function expand(id) {
    open = open === id ? null : id;
    renderBoard();
    var tr = body.querySelector('tr[data-id="' + id + '"]');
    if (tr) tr.focus({ preventScroll: true });
  }
  function syncChips() {
    if (!chips) return;
    chips.querySelectorAll('.chip').forEach(function (c) {
      c.setAttribute('aria-pressed', active[c.getAttribute('data-model')] ? 'true' : 'false');
    });
  }
  function toggle(id, fromBoard) {
    active[id] = !active[id];
    if (!active[id]) delete active[id];
    syncChips(); renderBoard(); renderChart(active[id] ? id : null);
    showInfo(id);
    if (fromBoard && active[id]) { var ex = document.getElementById('explorer'); if (ex && ex.scrollIntoView) ex.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); }
  }
  function setActive(ids) {
    active = {}; ids.forEach(function (i) { active[i] = true; });
    syncChips(); renderBoard(); renderChart(null);
  }
  function showInfo(id) {
    if (!info) return;
    var m = BY[id]; if (!m) return;
    info.innerHTML = '<h3><span class="dot" style="background:' + m.color + '"></span>' + m.name + ' <small>' + m.center + ' · ' + (m.type === 'ai' ? 'AI' : 'Physics') + ' · ' + m.grid + '</small></h3>' +
      '<p>' + m.note + '</p><p class="lb-stats">Day 5 <b>' + fmt(m.d5) + '</b> · Day 10 <b>' + fmt(m.d10) + '</b> · Skillful to <b>day ' + m.horizon.toFixed(1) + '</b></p>';
  }

  var cross, focusGroup;
  function renderChart(animateId) {
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var defs = el('defs', {}, svg);
    el('rect', { x: ML, y: Y(1), width: W - ML - MR, height: Y(0.8) - Y(1), 'class': 'chart-band' }, svg);
    for (var v = 0.65; v <= 1.0001; v += 0.05) {
      el('line', { x1: ML, y1: Y(v), x2: W - MR, y2: Y(v), 'class': 'chart-grid' }, svg);
      el('text', { x: ML - 8, y: Y(v) + 4, 'text-anchor': 'end', 'class': 'chart-axis' }, svg).textContent = v.toFixed(2);
    }
    el('line', { x1: ML, y1: Y(0.8), x2: W - MR, y2: Y(0.8), 'class': 'chart-thresh' }, svg);
    el('text', { x: ML + 6, y: Y(0.8) - 6, 'class': 'chart-axis chart-axis--hi' }, svg).textContent = 'SKILLFUL ≥ 0.80';
    for (var d = 1; d <= 10; d++) {
      el('line', { x1: X(d), y1: H - MB, x2: X(d), y2: H - MB + 5, 'class': 'chart-grid' }, svg);
      el('text', { x: X(d), y: H - MB + 20, 'text-anchor': 'middle', 'class': 'chart-axis' }, svg).textContent = 'D' + d;
    }
    el('text', { x: ML + (W - ML - MR) / 2, y: H - 4, 'text-anchor': 'middle', 'class': 'chart-axis' }, svg).textContent = 'Lead time (days)';

    var ids = MODELS.filter(function (m) { return active[m.id]; }).map(function (m) { return m.id; });
    if (!ids.length) {
      el('text', { x: ML + (W - ML - MR) / 2, y: H / 2, 'text-anchor': 'middle', 'class': 'chart-empty' }, svg).textContent = 'Select a model to plot';
    }
    var labels = [];
    ids.forEach(function (id) {
      var m = BY[id];
      var pts = m.pts.map(function (p) { return { x: X(p.d), y: Y(p.v), p: p }; });
      var g = el('g', { 'class': 'chart-series', 'data-id': id }, svg);
      var grad = el('linearGradient', { id: 'g-' + id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      el('stop', { offset: '0%', 'stop-color': m.color, 'stop-opacity': 0.22 }, grad);
      el('stop', { offset: '100%', 'stop-color': m.color, 'stop-opacity': 0 }, grad);
      var line = smooth(pts);
      if (ids.length <= 4) el('path', { d: line + 'L' + X(10) + ' ' + (H - MB) + 'L' + X(1) + ' ' + (H - MB) + 'Z', fill: 'url(#g-' + id + ')', 'class': 'chart-area' }, g);
      var path = el('path', { d: line, 'class': 'chart-line', stroke: m.color }, g);
      if (id === animateId && !RM && path.getTotalLength) {
        var len = path.getTotalLength();
        path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
        path.getBoundingClientRect();
        path.style.transition = 'stroke-dashoffset .9s cubic-bezier(.22,.8,.28,1)';
        path.style.strokeDashoffset = 0;
      }
      pts.forEach(function (pt) {
        if (pt.p.pub) el('circle', { cx: pt.x, cy: pt.y, r: 5, fill: m.color, stroke: '#04060c', 'stroke-width': 2 }, g);
      });
      labels.push({ y: Y(m.d10), m: m, g: g });
    });
    /* End labels, de-overlapped */
    labels.sort(function (a, b) { return a.y - b.y; });
    var gap = Math.min(14, (H - MB - MT) / Math.max(1, labels.length));
    for (var i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < gap) labels[i].y = labels[i - 1].y + gap;
    for (i = labels.length - 1; i >= 0; i--) {
      var max = i === labels.length - 1 ? H - MB : labels[i + 1].y - gap;
      if (labels[i].y > max) labels[i].y = max;
    }
    labels.forEach(function (l) {
      el('text', { x: X(10) + 8, y: l.y + 4, 'class': 'chart-end', fill: l.m.color }, l.g).textContent = l.m.name;
    });
    cross = el('g', { 'class': 'chart-hover', visibility: 'hidden' }, svg);
    el('line', { y1: MT, y2: H - MB, 'class': 'chart-cross' }, cross);
    focusGroup = el('g', {}, cross);
    var hit = el('rect', { x: ML, y: MT, width: W - ML - MR, height: H - MT - MB, fill: 'transparent', 'class': 'chart-hit' }, svg);
    hit.addEventListener('mousemove', function (e) { hover(e.clientX); });
    hit.addEventListener('click', function (e) { hover(e.clientX); });
    hit.addEventListener('mouseleave', unhover);
  }

  function hover(clientX) {
    var ids = Object.keys(active);
    if (!ids.length) return unhover();
    var r = svg.getBoundingClientRect();
    var sx = (clientX - r.left) / r.width * W;
    var d = Math.max(1, Math.min(10, Math.round((sx - ML) / (W - ML - MR) * 9 + 1)));
    var x = X(d);
    cross.setAttribute('visibility', 'visible');
    cross.firstChild.setAttribute('x1', x); cross.firstChild.setAttribute('x2', x);
    while (focusGroup.firstChild) focusGroup.removeChild(focusGroup.firstChild);
    var rows = MODELS.filter(function (m) { return active[m.id]; })
      .map(function (m) { return { m: m, v: m.acc(d), p: m.pts[d - 1] }; })
      .sort(function (a, b) { return b.v - a.v; });
    rows.forEach(function (row) {
      el('circle', { cx: x, cy: Y(row.v), r: 4.5, fill: '#0a1120', stroke: row.m.color, 'stroke-width': 2.5 }, focusGroup);
    });
    tip.innerHTML = '<strong>Day ' + d + '</strong>' + rows.map(function (row) {
      return '<span class="tip-row"><i style="background:' + row.m.color + '"></i>' + row.m.name +
        '<b>' + fmt(row.v) + (row.p.pub ? ' ●' : '') + '</b></span>';
    }).join('') + '<span class="src">● published · others consensus estimates</span>';
    tip.style.left = (x / W * 100) + '%';
    tip.style.top = (MT / H * 100) + '%';
    tip.classList.toggle('flip', d >= 7);
    tip.hidden = false;
  }
  function unhover() {
    if (cross) cross.setAttribute('visibility', 'hidden');
    if (tip) tip.hidden = true;
  }

  function on(id, fn) { var n = document.getElementById(id); if (n) n.addEventListener('click', fn); }
  on('showAll', function () { setActive(MODELS.map(function (m) { return m.id; })); });
  on('clearAll', function () { setActive([]); });
  on('showTop', function () {
    setActive(MODELS.slice().sort(function (a, b) { return b.d5 - a.d5; }).slice(0, 5).map(function (m) { return m.id; }));
  });

  syncChips(); renderBoard(); renderChart(null); showInfo('ecmwf');
})();
