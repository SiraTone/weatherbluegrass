// Upbeat 128 BPM track for the 3D view trailer, synthesized with Web Audio (no audio files).
// Same interface as assets/intro-music.js: score(ctx, dest, fromMs) schedules the whole
// 16-bar arrangement (30 s + ring-out), so it renders in an OfflineAudioContext.
//
// Arrangement (bars of 1.875 s):
//   0-3   filtered groove (the "flat radar" section), riser in bar 3
//   4-11  drop: four-on-the-floor, claps, hats, pumping bass, stabs, arp from bar 6, fill in bar 11
//   12-13 breakdown: pad + arp, riser into 14
//   14-15 final drop, last chord rings out
(function () {
  'use strict';
  var BPM = 128, B = 60 / BPM, BAR = 4 * B, BARS = 16;
  var PROG = [                                  // bass root, chord (MIDI)
    [33, [57, 60, 64]],                         // Am
    [29, [53, 57, 60]],                         // F
    [36, [60, 64, 67]],                         // C
    [31, [55, 59, 62]]                          // G
  ];
  var IMPACTS = [0, 4, 14];                     // bars that open with a hit

  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function noiseBuf(ctx, secs) {
    var n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), s = 99;
    for (var i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; }
    return b;
  }
  function reverb(ctx, secs) {
    var n = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c), s = 5 + c * 13;
      for (var i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 1073741823.5 - 1) * Math.pow(1 - i / n, 2.5); }
    }
    var cv = ctx.createConvolver(); cv.buffer = buf; return cv;
  }

  function score(ctx, dest, fromMs) {
    var t0 = ctx.currentTime - (fromMs || 0) / 1000;
    function at(bar, beat) { return t0 + bar * BAR + (beat || 0) * B; }
    var NOISE = noiseBuf(ctx, 2);

    // Buses: drums and music -> main lowpass (for the filtered sections) -> compressor -> out
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.14;
    comp.connect(dest);
    var mainLP = ctx.createBiquadFilter(); mainLP.type = 'lowpass'; mainLP.Q.value = 0.9; mainLP.connect(comp);
    var drums = ctx.createGain(); drums.gain.value = 1; drums.connect(mainLP);
    var music = ctx.createGain(); music.gain.value = 1; music.connect(mainLP);     // sidechained to the kick
    var fx = ctx.createGain(); fx.gain.value = 1; fx.connect(comp);                // risers/impacts bypass the filter
    var rv = reverb(ctx, 2.4), send = ctx.createGain(), ret = ctx.createGain();
    send.connect(rv); rv.connect(ret); ret.gain.value = 0.28; ret.connect(comp);

    // Filter automation: closed for the "flat" intro, opens on the drop; dips in the breakdown
    var F = mainLP.frequency;
    F.setValueAtTime(650, at(0));
    F.linearRampToValueAtTime(900, at(2));
    F.exponentialRampToValueAtTime(3200, at(3, 3.9));
    F.setValueAtTime(19000, at(4));
    F.setValueAtTime(19000, at(12));
    F.exponentialRampToValueAtTime(1400, at(12, 0.5));
    F.exponentialRampToValueAtTime(9000, at(13, 3.9));
    F.setValueAtTime(19000, at(14));

    function env(g, t, a, peak, d) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }
    function noise(t, dur) { var s = ctx.createBufferSource(); s.buffer = NOISE; s.start(t, (t * 7.3) % 1); s.stop(t + dur); return s; }

    function kick(t, lvl) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
      env(g, t, 0.002, lvl || 0.95, 0.36);
      o.connect(g); g.connect(drums); o.start(t); o.stop(t + 0.42);
      // sidechain pump on the music bus
      music.gain.setValueAtTime(0.32, t);
      music.gain.linearRampToValueAtTime(1, t + 0.22);
    }
    function clap(t, lvl) {
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.8;
      var g = ctx.createGain(), L = lvl || 0.5;
      g.gain.setValueAtTime(0.0001, t);
      [0, 0.011, 0.022].forEach(function (o) { g.gain.linearRampToValueAtTime(L, t + o + 0.002); g.gain.linearRampToValueAtTime(L * 0.3, t + o + 0.009); });
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      var n = noise(t, 0.25); n.connect(bp); bp.connect(g); g.connect(drums); g.connect(send);
    }
    function hat(t, open, lvl) {
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
      var g = ctx.createGain(); env(g, t, 0.001, lvl || 0.16, open ? 0.2 : 0.045);
      var n = noise(t, open ? 0.25 : 0.07); n.connect(hp); hp.connect(g); g.connect(drums);
    }
    function snare(t, lvl) {
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.7;
      var g = ctx.createGain(); env(g, t, 0.001, lvl, 0.12);
      var n = noise(t, 0.14); n.connect(bp); bp.connect(g); g.connect(drums);
    }
    function bass(t, m, dur) {
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
      lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(260, t + dur);
      var g = ctx.createGain(); env(g, t, 0.004, 0.34, dur);
      var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m);
      var s = ctx.createOscillator(); s.type = 'sine'; s.frequency.value = hz(m);
      var sg = ctx.createGain(); sg.gain.value = 0.9;
      o.connect(lp); lp.connect(g); s.connect(sg); sg.connect(g); g.connect(music);
      o.start(t); s.start(t); o.stop(t + dur + 0.05); s.stop(t + dur + 0.05);
    }
    function stab(t, notes, dur, lvl) {
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 1;
      var g = ctx.createGain(); env(g, t, 0.004, lvl || 0.07, dur);
      lp.connect(g); g.connect(music); g.connect(send);
      notes.forEach(function (m) {
        [-10, 10].forEach(function (c) {
          var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m + 12); o.detune.value = c;
          o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
        });
      });
    }
    function pad(t, notes, dur) {
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.045, t + 0.35);
      g.gain.setValueAtTime(0.045, t + dur - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.9);
      lp.connect(g); g.connect(music); g.connect(send);
      notes.forEach(function (m) {
        [-7, 7].forEach(function (c) {
          var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = c;
          o.connect(lp); o.start(t); o.stop(t + dur + 1);
        });
      });
    }
    function arp(t, m, lvl) {
      var o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = hz(m);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
      var g = ctx.createGain(); env(g, t, 0.003, lvl || 0.045, 0.13);
      o.connect(lp); lp.connect(g); g.connect(music); g.connect(send); o.start(t); o.stop(t + 0.2);
    }
    function riser(t, dur, lvl) {
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
      var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lvl || 0.3, t + dur);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.03);
      var n = ctx.createBufferSource(); n.buffer = NOISE; n.loop = true; n.start(t); n.stop(t + dur + 0.05);
      n.connect(bp); bp.connect(g); g.connect(fx); g.connect(send);
    }
    function impact(t) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.9);
      env(g, t, 0.003, 0.85, 1.3); o.connect(g); g.connect(fx); o.start(t); o.stop(t + 1.4);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500;
      var ng = ctx.createGain(); env(ng, t, 0.002, 0.45, 0.7);
      var n = noise(t, 0.8); n.connect(lp); lp.connect(ng); ng.connect(fx); ng.connect(send);
    }

    for (var bar = 0; bar < BARS; bar++) {
      var ch = PROG[bar % 4], drop = (bar >= 4 && bar <= 11) || bar >= 14, breakdown = bar === 12 || bar === 13;
      var last = bar === BARS - 1;

      if (IMPACTS.indexOf(bar) >= 0) impact(at(bar));

      // drums
      if (!breakdown) {
        for (var k = 0; k < 4; k++) {
          if (last && k > 0) break;                    // final bar: one hit, then ring out
          kick(at(bar, k), drop ? 0.95 : 0.75);
        }
        if (!last) {
          [1, 3].forEach(function (b) { clap(at(bar, b), drop ? 0.55 : 0.35); });
          for (var e = 0; e < 8; e++) if (e % 2) hat(at(bar, e / 2), drop && e === 7, drop ? 0.16 : 0.1);
          if (drop && bar >= 8) for (var s = 0; s < 16; s++) if (s % 4 === 1 || s % 4 === 3) hat(at(bar, s / 4), false, 0.07);
        }
      }
      if (bar === 11 || bar === 3) for (var r = 0; r < 8; r++) snare(at(bar, 2 + r / 4), 0.12 + r * 0.04);  // fill

      // bass: pumping offbeat eighths in drops, held note otherwise
      if (drop && !last) for (var q = 0; q < 4; q++) bass(at(bar, q + 0.5), ch[0], B * 0.42);
      else if (!breakdown) bass(at(bar), ch[0], last ? BAR * 1.5 : BAR * 0.9);

      // chords
      if (drop && !last) { [0.5, 1.5, 2.5, 3.5].forEach(function (b) { stab(at(bar, b), ch[1], B * 0.35, 0.065); }); }
      else if (last) pad(at(bar), ch[1].concat([ch[1][0] + 12]), BAR * 1.2);
      else pad(at(bar), ch[1], BAR);

      // arp: 16ths from bar 6, through the breakdown
      if ((bar >= 6 && bar <= 13) || (bar >= 14 && !last)) {
        var notes = ch[1].concat([ch[1][0] + 12]);
        for (var a = 0; a < 16; a++) arp(at(bar, a / 4), notes[(a * (a % 3 === 0 ? 1 : 2)) % 4] + 12, breakdown ? 0.05 : 0.035);
      }
    }
    riser(at(3), BAR, 0.28);
    riser(at(10, 2), BAR * 1.5, 0.22);
    riser(at(13), BAR, 0.3);
  }

  window.CellScopeUpbeat = { score: score, bpm: BPM, bars: BARS };
})();
