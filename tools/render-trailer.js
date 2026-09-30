// Renders the homepage intro to downloads/CellScope-Trailer.mp4 (1080p60, H.264 + AAC).
// Frame-exact: every CSS animation is paused and stepped on a virtual clock, one
// screenshot per 1/60 s, so the video is smooth regardless of machine speed.
// The trailer hides the site controls (skip, sound, progress, Enter site) and ends
// on the CellScope logo over the radar background instead of the "Enter site" card.
//
// Usage: FFMPEG=/path/to/ffmpeg node tools/render-trailer.js
// Needs Playwright (Chromium) and an ffmpeg build with libx264 and aac.
'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'downloads', 'CellScope-Trailer.mp4');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FPS = 60, W = 1920, H = 1080;
const LEN = 30000;            // ms
const OUTRO = 26500;          // swap the final card for the logo scene
const INTRO_END = 28000;      // the site's own auto-close timer, never fired here
const VOLUME = 0.7;           // about 6 dB above the site; still background level

function run(args, input) {
  return new Promise((res, rej) => {
    const p = spawn(FFMPEG, args, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    p.on('close', c => c === 0 ? res() : rej(new Error(err.slice(-2000))));
    if (input) input(p.stdin);
  });
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cs-trailer-'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

  await page.addInitScript(() => {
    // Capture the intro's timers instead of letting real time drive them.
    window.__timers = [];
    const realST = window.setTimeout;
    window.setTimeout = function (fn, ms) {
      if (document.querySelector('.intro')) { window.__timers.push({ fn, at: ms || 0 }); return 0; }
      return realST.apply(this, arguments);
    };
    window.AudioContext = window.webkitAudioContext = undefined;  // music is muxed separately
  });
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.addStyleTag({ content: '.intro-skip,.intro-sound,.intro-progress,.intro-enter{display:none!important}' });
  await page.waitForFunction(() => document.querySelector('.intro.is-playing'));
  await page.evaluate(() => Promise.all([...document.querySelectorAll('.intro img')].map(i => i.decode().catch(() => {}))));

  await page.evaluate(({ INTRO_END, OUTRO }) => {
    const born = new Map();
    let outro = false;
    window.__step = (vt) => {
      window.__timers.filter(t => !t.done && t.at <= vt && t.at < INTRO_END).forEach(t => { t.done = true; t.fn(); });
      if (!outro && vt >= OUTRO) {
        outro = true;
        const fin = document.querySelector('.iscene[data-id="final"]'), logo = document.querySelector('.iscene[data-id="logo"]');
        fin.classList.remove('on'); fin.classList.add('off');
        logo.classList.remove('off'); void logo.offsetWidth; logo.classList.add('on');
      }
      document.getAnimations().forEach(a => {
        if (!born.has(a)) born.set(a, vt);
        a.pause();
        a.currentTime = vt - born.get(a);
      });
    };
  }, { INTRO_END, OUTRO });

  // Video: screenshots piped straight into x264
  const frames = Math.round(LEN / 1000 * FPS);
  const video = path.join(tmp, 'video.mp4');
  await run(['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), video], async (stdin) => {
    for (let i = 0; i < frames; i++) {
      await page.evaluate(vt => window.__step(vt), i * 1000 / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!stdin.write(buf)) await new Promise(r => stdin.once('drain', r));
      if (i % 120 === 0) process.stdout.write(`frame ${i}/${frames}\n`);
    }
    stdin.end();
  });

  // Audio: the site's score rendered offline, faded in like the site and out at the end
  await page.addScriptTag({ path: path.join(ROOT, 'assets', 'intro-music.js') });
  const wav = await page.evaluate(async ({ LEN, VOLUME }) => {
    const sr = 48000, secs = LEN / 1000, ctx = new OfflineAudioContext(2, sr * secs, sr);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, 0);
    g.gain.linearRampToValueAtTime(VOLUME, 1.5);
    g.gain.setValueAtTime(VOLUME, secs - 2);
    g.gain.linearRampToValueAtTime(0, secs);
    g.connect(ctx.destination);
    window.CellScopeIntroMusic.score(ctx, g, 0);
    const buf = await ctx.startRendering(), n = buf.length, L = buf.getChannelData(0), R = buf.getChannelData(1);
    const out = new DataView(new ArrayBuffer(44 + n * 4));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); out.setUint32(16, 16, true);
    out.setUint16(20, 1, true); out.setUint16(22, 2, true); out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true);
    out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) {
      out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
      out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    }
    return Array.from(new Uint8Array(out.buffer));
  }, { LEN, VOLUME });
  const audio = path.join(tmp, 'audio.wav');
  fs.writeFileSync(audio, Buffer.from(wav));
  await browser.close();

  await run(['-y', '-i', video, '-i', audio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart', OUT]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('wrote', path.relative(ROOT, OUT), (fs.statSync(OUT).size / 1048576).toFixed(1) + ' MB');
})().catch(e => { console.error(e); process.exit(1); });
