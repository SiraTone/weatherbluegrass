// CellScope first-release intro: a skippable 3D trailer that plays on page load.
// The storm is rendered live on a canvas (voxel point cloud); product scenes use CSS 3D.
(function () {
  'use strict';
  var d = document;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var SCENES = [
    { at: 0,     id: 'logo'   },
    { at: 3200,  id: 'storm'  },
    { at: 7600,  id: 'graphs' },
    { at: 11400, id: 'cs1'    },
    { at: 14600, id: 'models' },
    { at: 17600, id: 'app'    },
    { at: 20600, id: 'final'  }
  ];
  var END = 25500;

  var root = d.createElement('div');
  root.className = 'intro';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'CellScope first release intro');
  root.innerHTML =
    '<canvas class="intro-storm" aria-hidden="true"></canvas>' +
    '<div class="intro-vignette" aria-hidden="true"></div>' +
    '<div class="intro-stage">' +

    '<section class="iscene" data-id="logo">' +
      '<div class="intro-badge"><span>CS</span></div>' +
      '<p class="intro-word">CELLSCOPE</p>' +
      '<p class="intro-kicker">First release · 2026</p>' +
    '</section>' +

    '<section class="iscene iscene--left" data-id="storm">' +
      '<p class="intro-no">01</p>' +
      '<h2>3D Storm Visualization</h2>' +
      '<p class="intro-sub">True-3D reflectivity volume · 10 kft to 50 kft</p>' +
    '</section>' +

    '<section class="iscene" data-id="graphs">' +
      '<p class="intro-no">02</p>' +
      '<h2>3D Weather Graphs</h2>' +
      '<div class="intro-ring">' +
        ['temperature', 'wind-speed', 'gust-meter', 'cloud-cover', 'dewpoint', 'feels-like'].map(function (n, i) {
          return '<img style="--i:' + i + '" src="assets/' + n + '.png" alt="">';
        }).join('') +
      '</div>' +
    '</section>' +

    '<section class="iscene" data-id="cs1">' +
      '<p class="intro-no">03</p>' +
      '<h2>CS1.0 Weather AI Model</h2>' +
      '<div class="intro-stack">' +
        ['model-cs10', 'model-cs11', 'model-cs12'].map(function (n, i) {
          return '<img style="--i:' + i + '" src="assets/' + n + '.png" alt="">';
        }).join('') +
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
        '<img src="assets/radar-3d.png" alt=""></div>' +
      '<p class="intro-sub">Windows demo available now</p>' +
    '</section>' +

    '<section class="iscene" data-id="final">' +
      '<div class="intro-badge intro-badge--sm"><span>CS</span></div>' +
      '<h2>See the storm the way the atmosphere sees it.</h2>' +
      '<p class="intro-sub">Five products. One look. First release.</p>' +
      '<button class="btn intro-enter" type="button">Enter site <span class="arr">→</span></button>' +
    '</section>' +

    '</div>' +
    '<div class="intro-progress" aria-hidden="true"><span></span></div>' +
    '<button class="intro-skip" type="button">Skip intro ›</button>';

  d.body.appendChild(root);
  d.documentElement.classList.add('intro-open');

  var scenes = {};
  root.querySelectorAll('.iscene').forEach(function (s) { scenes[s.getAttribute('data-id')] = s; });
  var bar = root.querySelector('.intro-progress span');
  var skip = root.querySelector('.intro-skip');
  skip.focus({ preventScroll: true });

  /* ---------- 3D voxel storm ---------- */
  var cv = root.querySelector('.intro-storm');
  var ctx = cv.getContext('2d');
  var W, H, DPR;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.width = Math.round(innerWidth * DPR);
    H = cv.height = Math.round(innerHeight * DPR);
  }
  resize();
  addEventListener('resize', resize);

  // Supercell-ish reflectivity field in a unit box: x,z horizontal, y height 0..1
  function field(x, z, y) {
    var core = Math.exp(-((x - 0.1) * (x - 0.1) + z * z) / 0.05);
    var flank = 0.65 * Math.exp(-((x + 0.35) * (x + 0.35) / 0.22 + (z - 0.12) * (z - 0.12) / 0.03));
    var hx = x - 0.28, hz = z + 0.22, hr = Math.sqrt(hx * hx + hz * hz), ha = Math.atan2(hz, hx);
    var hook = (ha > -0.4 && ha < 2.6) ? 0.55 * Math.exp(-((hr - 0.14) * (hr - 0.14)) / 0.002) : 0;
    var base = Math.max(core, flank, hook);
    var top = 0.25 + 0.72 * core + 0.3 * flank;
    var f = y < top ? base * (1 - 0.35 * y) : 0;
    if (y > 0.78 && y < 0.95) f = Math.max(f, 0.5 * Math.exp(-((x - 0.55) * (x - 0.55) / 0.25 + z * z / 0.06)));
    return f;
  }
  function color(dbz) {
    if (dbz < 30) return '46,204,64';
    if (dbz < 40) return '255,210,63';
    if (dbz < 50) return '255,140,26';
    if (dbz < 60) return '255,45,45';
    return '255,60,240';
  }
  var pts = [];
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  for (var t = 0; t < 60000 && pts.length < 3200; t++) {
    var x = rnd() * 2 - 1, z = rnd() * 2 - 1, y = rnd();
    var f = field(x, z, y);
    if (f > 0.18 && rnd() < f + 0.15) {
      var dbz = 18 + 55 * f;
      pts.push({ x: x, y: y * 0.9, z: z, c: color(dbz), a: 0.35 + 0.55 * f });
    }
  }
  // Wireframe box (matches the site's height-tagged render)
  var box = [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [-1, .9, -1], [1, .9, -1], [1, .9, 1], [-1, .9, 1]];
  var edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

  var cam = { yaw: 0.6, pitch: 0.42, dist: 3.4, dim: 1 };
  function proj(p, cy, sy, cp, sp, scale) {
    var x = p[0], y = p[1] - 0.4, z = p[2];
    var rx = x * cy - z * sy, rz = x * sy + z * cy;
    var ry = y * cp - rz * sp; rz = y * sp + rz * cp;
    var k = scale / (cam.dist + rz);
    return [W / 2 + rx * k, H * 0.52 - ry * k, rz];
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    var scale = Math.min(W, H) * 1.35;
    ctx.globalAlpha = cam.dim;
    ctx.strokeStyle = 'rgba(160,200,120,.35)';
    ctx.lineWidth = DPR;
    ctx.beginPath();
    edges.forEach(function (e) {
      var a = proj(box[e[0]], cy, sy, cp, sp, scale), b = proj(box[e[1]], cy, sy, cp, sp, scale);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    });
    ctx.stroke();
    ctx.fillStyle = 'rgba(160,200,120,.7)';
    ctx.font = (11 * DPR) + 'px ui-monospace,Consolas,monospace';
    for (var k = 1; k <= 5; k++) {
      var l = proj([-1, k * 0.18, -1], cy, sy, cp, sp, scale);
      ctx.fillText(k * 10 + ' kft', l[0] - 52 * DPR, l[1]);
    }
    var list = pts.map(function (p) {
      var q = proj([p.x, p.y, p.z], cy, sy, cp, sp, scale);
      return { sx: q[0], sy: q[1], z: q[2], p: p };
    }).sort(function (a, b) { return b.z - a.z; });
    for (var i = 0; i < list.length; i++) {
      var o = list[i], s = (5.2 * DPR * scale / 1000) / (cam.dist + o.z) * 2.2;
      ctx.fillStyle = 'rgba(' + o.p.c + ',' + (o.p.a * cam.dim) + ')';
      ctx.fillRect(o.sx - s / 2, o.sy - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- timeline ---------- */
  var start = performance.now(), current = null, raf, done = false;
  function ease(a, b, t) { t = Math.max(0, Math.min(1, t)); t = t * t * (3 - 2 * t); return a + (b - a) * t; }
  function tick(now) {
    var t = now - start;
    // Camera: sweep around, dive in on the storm scene, then settle back as a dim backdrop
    cam.yaw = 0.6 + t * 0.00025;
    cam.dist = t < 3200 ? ease(5.5, 3.6, t / 3200) : t < 7600 ? ease(3.6, 2.5, (t - 3200) / 4400) : ease(2.5, 3.8, (t - 7600) / 1500);
    cam.pitch = t < 7600 ? ease(0.55, 0.3, t / 7600) : 0.42;
    cam.dim = t < 3200 ? ease(0.25, 0.6, t / 3200) : t < 7600 ? 1 : t < 20600 ? ease(1, 0.28, (t - 7600) / 900) : ease(0.28, 0.7, (t - 20600) / 1500);
    draw();

    var active = SCENES[0].id;
    SCENES.forEach(function (s) { if (t >= s.at) active = s.id; });
    if (active !== current) {
      if (current) { scenes[current].classList.remove('on'); scenes[current].classList.add('off'); }
      scenes[active].classList.remove('off');
      scenes[active].classList.add('on');
      if (active === 'final') root.querySelector('.intro-enter').focus({ preventScroll: true });
      current = active;
    }
    bar.style.transform = 'scaleX(' + Math.min(1, t / END) + ')';
    if (t >= END) return close();
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  function close() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    root.classList.add('is-leaving');
    d.documentElement.classList.remove('intro-open');
    removeEventListener('keydown', onKey);
    setTimeout(function () { root.remove(); removeEventListener('resize', resize); }, 700);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  skip.addEventListener('click', close);
  root.querySelector('.intro-enter').addEventListener('click', close);
  addEventListener('keydown', onKey);
})();
