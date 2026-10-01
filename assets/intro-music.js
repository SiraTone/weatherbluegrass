// Quiet ambient score for the intro, synthesized with Web Audio (no audio files).
// Soft pad + sub bass + sparse arpeggio, a low chime on each scene change.
// score(ctx, dest, fromMs, opts) schedules everything from fromMs into the timeline,
// so it works with a live AudioContext or an OfflineAudioContext for testing.
// opts.length (s) and opts.scenes (chime times, s) let other trailers reuse the score.
(function () {
  'use strict';
  var BAR = 3.5;                       // seconds per chord
  var CHORDS = [                       // MIDI notes: root (bass), then pad voicing
    [45, [57, 60, 64, 71]],            // Am9
    [41, [57, 60, 64, 65]],            // Fmaj7
    [48, [60, 64, 67, 74]],            // Cadd9
    [43, [59, 62, 67, 64]]             // G6
  ];
  var DEFAULT_LEN = 28;                // seconds, matches intro END
  var DEFAULT_SCENES = [3, 9, 12.4, 17.2, 20, 23];

  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function reverb(ctx, secs) {
    var n = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c), seed = 11 + c * 7;
      for (var i = 0; i < n; i++) {
        seed = (seed * 16807) % 2147483647;
        d[i] = (seed / 1073741823.5 - 1) * Math.pow(1 - i / n, 3);
      }
    }
    var cv = ctx.createConvolver();
    cv.buffer = buf;
    return cv;
  }

  function env(g, t, a, peak, hold, r) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
  }

  function score(ctx, dest, fromMs, opts) {
    var from = (fromMs || 0) / 1000, t0 = ctx.currentTime - from;
    var LEN = (opts && opts.length) || DEFAULT_LEN, SCENES = (opts && opts.scenes) || DEFAULT_SCENES;

    var bus = ctx.createGain(); bus.gain.value = 1;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    var dry = ctx.createGain(); dry.gain.value = 0.7;
    var wet = ctx.createGain(); wet.gain.value = 0.45;
    var rv = reverb(ctx, 3.2);
    bus.connect(lp); lp.connect(dry); lp.connect(rv); rv.connect(wet);
    dry.connect(dest); wet.connect(dest);

    function at(s) { return t0 + s; }
    function live(s, dur) { return s + dur > from; }

    for (var b = 0; b * BAR < LEN; b++) {
      var s = b * BAR, ch = CHORDS[b % CHORDS.length], last = (b + 1) * BAR >= LEN;
      var dur = last ? BAR + 2.5 : BAR;
      if (!live(s, dur + 1.6)) continue;
      var st = Math.max(at(s), ctx.currentTime);

      // Pad: two detuned saws per voice through a slowly opening lowpass
      var padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.Q.value = 0.4;
      padF.frequency.setValueAtTime(500, st);
      padF.frequency.linearRampToValueAtTime(1100, st + dur);
      var padG = ctx.createGain(); env(padG, st, 1.2, 0.05, dur - 1.2, 1.6);
      padF.connect(padG); padG.connect(bus);
      ch[1].forEach(function (m) {
        [-6, 6].forEach(function (cents) {
          var o = ctx.createOscillator(); o.type = 'sawtooth';
          o.frequency.value = hz(m); o.detune.value = cents;
          o.connect(padF); o.start(st); o.stop(st + dur + 1.8);
        });
      });

      // Sub bass
      var bo = ctx.createOscillator(); bo.type = 'sine'; bo.frequency.value = hz(ch[0] - 12);
      var bg = ctx.createGain(); env(bg, st, 0.6, 0.12, dur - 0.6, 1.2);
      bo.connect(bg); bg.connect(bus); bo.start(st); bo.stop(st + dur + 1.4);

      // Sparse arpeggio (eighths at ~137 bpm, every other step), skip the first bar
      if (b > 0 && !last) {
        var notes = ch[1].concat([ch[1][1] + 12]);
        for (var k = 0; k < 8; k += 2) {
          var ns = s + k * (BAR / 8);
          if (ns < from) continue;
          var ao = ctx.createOscillator(); ao.type = 'triangle';
          ao.frequency.value = hz(notes[(k / 2 + b) % notes.length] + 12);
          var ag = ctx.createGain(); env(ag, at(ns), 0.01, 0.022, 0.05, 0.6);
          ao.connect(ag); ag.connect(bus); ao.start(at(ns)); ao.stop(at(ns) + 0.8);
        }
      }
    }

    // Chime on each scene change
    SCENES.forEach(function (s, i) {
      if (s < from) return;
      [0, 7].forEach(function (iv, j) {
        var o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.value = hz(81 + iv + (i % 2 ? 2 : 0));
        var g = ctx.createGain(); env(g, at(s), 0.005, j ? 0.012 : 0.02, 0, 2.2);
        o.connect(g); g.connect(bus); o.start(at(s)); o.stop(at(s) + 2.4);
      });
    });
  }

  window.CellScopeIntroMusic = { score: score, length: DEFAULT_LEN };
})();
