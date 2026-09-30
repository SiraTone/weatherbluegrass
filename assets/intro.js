// CellScope first-release intro: a skippable trailer that plays on page load.
// Every animation is CSS transform/opacity so it runs on the compositor at display refresh rate.
// JS only swaps scene classes on a timer; nothing is drawn per frame.
(function () {
  'use strict';
  var d = document;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var SCENES = [
    { at: 0,     id: 'logo'   },
    { at: 3000,  id: 'graphs' },
    { at: 9000,  id: 'cs1'    },
    { at: 12400, id: 'bench'  },
    { at: 17200, id: 'models' },
    { at: 20000, id: 'app'    },
    { at: 23000, id: 'final'  }
  ];
  var END = 28000;

  var GRAPHS = [
    ['temperature', 'Temperature'], ['wind-speed', 'Wind speed'], ['gust-meter', 'Gust meter'],
    ['cloud-cover', 'Cloud cover'], ['dewpoint', 'Dewpoint'], ['feels-like', 'Feels like']
  ];
  // Day-5 500 hPa anomaly correlation, same sources as benchmarks.html
  var BENCH = [
    { name: 'AIFS', v: 0.935, c: '#c084fc', note: 'est.' },
    { name: 'ECMWF IFS', v: 0.93, c: '#3fe0ff', note: '' },
    { name: 'GFS', v: 0.905, c: '#ff9f43', note: '' }
  ];
  var BMIN = 0.85, BMAX = 0.95;

  var root = d.createElement('div');
  root.className = 'intro';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'CellScope first release intro');
  root.style.setProperty('--intro-len', END + 'ms');
  root.innerHTML =
    '<div class="intro-radar" aria-hidden="true"><div class="intro-rings"></div><div class="intro-sweep"></div></div>' +
    '<div class="intro-vignette" aria-hidden="true"></div>' +
    '<div class="intro-stage">' +

    '<section class="iscene" data-id="logo">' +
      '<img class="intro-badge" src="assets/logo.svg" width="120" height="120" alt="">' +
      '<p class="intro-word">CELLSCOPE</p>' +
      '<p class="intro-kicker">First release · 2026</p>' +
    '</section>' +

    '<section class="iscene iscene--graphs" data-id="graphs">' +
      '<p class="intro-no">01</p>' +
      '<h2>Broadcast Weather Graphs</h2>' +
      '<div class="intro-carousel"><div class="intro-ring">' +
        GRAPHS.map(function (g, i) {
          return '<figure style="--i:' + i + '"><img src="assets/' + g[0] + '.png" alt="" decoding="async"><figcaption>' + g[1] + '</figcaption></figure>';
        }).join('') +
      '</div></div>' +
      '<p class="intro-sub">Six auto-generated timelines · your location, units, and colors</p>' +
    '</section>' +

    '<section class="iscene" data-id="cs1">' +
      '<p class="intro-no">02</p>' +
      '<h2>CS1.0 Weather AI Model</h2>' +
      '<div class="intro-stack">' +
        ['model-cs10', 'model-cs11', 'model-cs12'].map(function (n, i) {
          return '<img style="--i:' + i + '" src="assets/' + n + '.png" alt="" decoding="async">';
        }).join('') +
      '</div>' +
    '</section>' +

    '<section class="iscene" data-id="bench">' +
      '<p class="intro-no">03</p>' +
      '<h2>AI Model Benchmarks</h2>' +
      '<div class="intro-bench">' +
        '<p class="intro-bench-head"><span>Day 5 · 500 hPa anomaly correlation</span><span>higher is better</span></p>' +
        BENCH.map(function (b, i) {
          var pct = (b.v - BMIN) / (BMAX - BMIN);
          return '<div class="ib-row" style="--i:' + i + ';--c:' + b.c + ';--p:' + pct.toFixed(3) + '">' +
            '<span class="ib-name">' + b.name + '</span>' +
            '<span class="ib-track"><span class="ib-bar"></span></span>' +
            '<span class="ib-val">' + b.v.toFixed(3).replace(/0$/, '') + (b.note ? ' <small>' + b.note + '</small>' : '') + '</span>' +
          '</div>';
        }).join('') +
        '<p class="intro-bench-foot"><span>' + BMIN.toFixed(2) + '</span><span>WMO verification</span><span>' + BMAX.toFixed(2) + '</span></p>' +
      '</div>' +
    '</section>' +

    '<section class="iscene" data-id="models">' +
      '<p class="intro-no">04</p>' +
      '<h2>Model Visualization Suite</h2>' +
      '<div class="intro-tags">' +
        ['HRRR', 'GFS', 'ECMWF', 'ICON', 'NAM', 'CS1.0'].map(function (n, i) {
          return '<span style="--i:' + i + '">' + n + '</span>';
        }).join('') +
      '</div>' +
    '</section>' +

    '<section class="iscene" data-id="app">' +
      '<p class="intro-no">05</p>' +
      '<h2>CellScope Radar App</h2>' +
      '<div class="intro-window"><div class="intro-bar"><i></i><i></i><i></i><span>CellScope Radar</span></div>' +
        '<img src="assets/radar-3d.png" alt="" decoding="async"></div>' +
      '<p class="intro-sub">Windows demo available now</p>' +
    '</section>' +

    '<section class="iscene" data-id="final">' +
      '<img class="intro-badge intro-badge--sm" src="assets/logo.svg" width="72" height="72" alt="">' +
      '<h2>See the storm the way the atmosphere sees it.</h2>' +
      '<p class="intro-sub">Graphs. Models. Benchmarks. Radar. First release.</p>' +
      '<button class="btn intro-enter" type="button">Enter site <span class="arr">→</span></button>' +
    '</section>' +

    '</div>' +
    '<div class="intro-progress" aria-hidden="true"><span></span></div>' +
    '<button class="intro-skip" type="button">Skip intro ›</button>';

  d.body.appendChild(root);
  d.documentElement.classList.add('intro-open');

  // Decode every image up front (the logo scene covers the wait) so no scene
  // change stalls a frame on image decoding.
  root.querySelectorAll('img').forEach(function (img) {
    if (img.decode) img.decode().catch(function () {});
  });

  var scenes = {};
  root.querySelectorAll('.iscene').forEach(function (s) { scenes[s.getAttribute('data-id')] = s; });
  var skip = root.querySelector('.intro-skip');
  skip.focus({ preventScroll: true });

  /* ---------- timeline ---------- */
  var timers = [], current = null, done = false;
  function show(id) {
    if (current) { scenes[current].classList.remove('on'); scenes[current].classList.add('off'); }
    scenes[id].classList.remove('off');
    scenes[id].classList.add('on');
    if (id === 'final') root.querySelector('.intro-enter').focus({ preventScroll: true });
    current = id;
  }
  // Start on the next frame so the first scene's transition actually runs.
  requestAnimationFrame(function () {
    root.classList.add('is-playing');
    SCENES.forEach(function (s) { timers.push(setTimeout(function () { show(s.id); }, s.at)); });
    timers.push(setTimeout(close, END));
  });

  function close() {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    root.classList.add('is-leaving');
    d.documentElement.classList.remove('intro-open');
    removeEventListener('keydown', onKey);
    setTimeout(function () { root.remove(); }, 700);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  skip.addEventListener('click', close);
  root.querySelector('.intro-enter').addEventListener('click', close);
  addEventListener('keydown', onKey);
})();
