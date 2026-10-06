/* Trailer players: replaces native controls with a play button, scrub bar, time, mute and fullscreen.
   Without JS the <video controls> fallback in the markup still works. */
(function () {
  var d = document;
  var ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4.4v16H6zM13.6 4H18v16h-4.4z"/></svg>',
    volOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5v5h3.6L12 19V5L6.6 9.5zM15 8.6a4.6 4.6 0 0 1 0 6.8l-1.3-1.5a2.6 2.6 0 0 0 0-3.8zM17.6 5.9a8.4 8.4 0 0 1 0 12.2l-1.3-1.5a6.4 6.4 0 0 0 0-9.2z"/></svg>',
    volOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5v5h3.6L12 19V5L6.6 9.5zM15.4 9.6l1.4-1.4 2.2 2.2 2.2-2.2 1.4 1.4-2.2 2.2 2.2 2.2-1.4 1.4-2.2-2.2-2.2 2.2-1.4-1.4 2.2-2.2z"/></svg>',
    fs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v2H6v4H4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z"/></svg>'
  };
  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function init(fig) {
    var v = fig.querySelector('video'), stage = fig.querySelector('.tp-stage');
    if (!v || !stage) return;
    v.removeAttribute('controls');
    var label = v.getAttribute('aria-label') || 'trailer';
    var big = d.createElement('button');
    big.className = 'tp-big'; big.type = 'button'; big.setAttribute('aria-label', 'Play ' + label);
    big.innerHTML = '<span>' + ICON.play + '</span>';
    var dur = d.createElement('div');
    dur.className = 'tp-dur'; dur.textContent = v.getAttribute('data-duration') || '';
    var bar = d.createElement('div');
    bar.className = 'tp-bar';
    bar.innerHTML =
      '<button class="tp-btn tp-pp" type="button" aria-label="Play or pause"><span class="i-play">' + ICON.play + '</span><span class="i-pause">' + ICON.pause + '</span></button>' +
      '<div class="tp-prog" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="tp-track"><div class="tp-buf"></div><div class="tp-fill"></div><div class="tp-knob"></div></div></div>' +
      '<span class="tp-time">0:00 / 0:00</span>' +
      '<button class="tp-btn tp-mute" type="button" aria-label="Mute"><span class="i-on">' + ICON.volOn + '</span><span class="i-off">' + ICON.volOff + '</span></button>' +
      '<button class="tp-btn tp-fs" type="button" aria-label="Fullscreen">' + ICON.fs + '</button>';
    stage.appendChild(big); stage.appendChild(dur); stage.appendChild(bar);
    var q = function (s) { return bar.querySelector(s); };
    var prog = q('.tp-prog'), fill = q('.tp-fill'), buf = q('.tp-buf'), knob = q('.tp-knob'), time = q('.tp-time');
    function total() { return isFinite(v.duration) && v.duration > 0 ? v.duration : 0; }
    function paint() {
      var t = total(), p = t ? v.currentTime / t * 100 : 0;
      fill.style.width = p + '%'; knob.style.left = p + '%';
      time.textContent = fmt(v.currentTime) + ' / ' + fmt(t);
      prog.setAttribute('aria-valuenow', Math.round(p));
      prog.setAttribute('aria-valuetext', fmt(v.currentTime) + ' of ' + fmt(t));
      if (t && v.buffered.length) buf.style.width = (v.buffered.end(v.buffered.length - 1) / t * 100) + '%';
    }
    function toggle() { if (v.paused || v.ended) v.play(); else v.pause(); }
    // only one trailer plays at a time
    function pauseOthers() {
      d.querySelectorAll('.tplayer video').forEach(function (o) { if (o !== v && !o.paused) o.pause(); });
    }
    var idleT;
    function wake() {
      fig.classList.remove('idle'); clearTimeout(idleT);
      if (!v.paused) idleT = setTimeout(function () { fig.classList.add('idle'); }, 2400);
    }
    v.addEventListener('play', function () {
      pauseOthers(); fig.classList.add('playing', 'started'); fig.classList.remove('ended'); wake();
    });
    v.addEventListener('pause', function () {
      fig.classList.remove('playing', 'idle'); big.setAttribute('aria-label', 'Resume ' + label);
    });
    v.addEventListener('ended', function () {
      fig.classList.remove('playing', 'idle'); fig.classList.add('ended'); big.setAttribute('aria-label', 'Replay ' + label);
    });
    ['timeupdate', 'loadedmetadata', 'progress', 'durationchange', 'seeked'].forEach(function (e) { v.addEventListener(e, paint); });
    v.addEventListener('loadedmetadata', function () { dur.textContent = fmt(v.duration); });
    big.addEventListener('click', function () { if (v.ended) v.currentTime = 0; toggle(); });
    v.addEventListener('click', toggle);
    q('.tp-pp').addEventListener('click', toggle);
    q('.tp-mute').addEventListener('click', function () { v.muted = !v.muted; });
    v.addEventListener('volumechange', function () { fig.classList.toggle('muted', v.muted); });
    q('.tp-fs').addEventListener('click', function () {
      if (d.fullscreenElement) d.exitFullscreen();
      else if (stage.requestFullscreen) stage.requestFullscreen();
      else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
    });
    // scrubbing: pointer drag + arrow keys
    function seekTo(ev) {
      var r = prog.getBoundingClientRect(), t = total();
      if (!t) return;
      v.currentTime = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)) * t;
      paint();
    }
    prog.addEventListener('pointerdown', function (ev) {
      prog.classList.add('drag'); prog.setPointerCapture(ev.pointerId); seekTo(ev);
    });
    prog.addEventListener('pointermove', function (ev) { if (prog.classList.contains('drag')) seekTo(ev); });
    ['pointerup', 'pointercancel'].forEach(function (e) {
      prog.addEventListener(e, function () { prog.classList.remove('drag'); });
    });
    prog.addEventListener('keydown', function (ev) {
      var t = total(), k = ev.key;
      if (k === 'ArrowRight') v.currentTime = Math.min(t, v.currentTime + 5);
      else if (k === 'ArrowLeft') v.currentTime = Math.max(0, v.currentTime - 5);
      else if (k === 'Home') v.currentTime = 0;
      else if (k === 'End') v.currentTime = t;
      else return;
      ev.preventDefault();
    });
    stage.addEventListener('mousemove', wake);
    stage.addEventListener('touchstart', wake, { passive: true });
    paint();
  }
  d.querySelectorAll('.tplayer').forEach(init);
})();
