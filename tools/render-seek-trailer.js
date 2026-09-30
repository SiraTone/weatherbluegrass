// Renders a trailer page that exposes window.TRAILER = { length, seek(ms), scenes, music? } to MP4
// (1080p60, H.264 + AAC). Audio is the CellScope score from assets/intro-music.js unless the page
// sets TRAILER.music = { src, global, peakDb, fadeIn }: src is a script path relative to the repo
// root exposing window[global].score(ctx, dest, fromMs), rendered then normalized to peakDb.
// seek(ms) must draw the whole frame for that time, so capture is frame-exact.
//
// Usage: FFMPEG=/path/to/ffmpeg node tools/render-seek-trailer.js trailers/canada-radar.html downloads/Out.mp4
// Needs Playwright (Chromium) and an ffmpeg build with libx264 and aac.
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const ROOT = path.resolve(__dirname, '..');
const [pageArg, outArg] = process.argv.slice(2);
if (!pageArg || !outArg) { console.error('usage: render-seek-trailer.js <page.html> <out.mp4>'); process.exit(2); }
const PAGE = path.resolve(ROOT, pageArg), OUT = path.resolve(ROOT, outArg);
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FPS = 60, W = 1920, H = 1080, VOLUME = 0.7;

function run(args, feed) {
  return new Promise((res, rej) => {
    const p = spawn(FFMPEG, args, { stdio: [feed ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    p.on('close', c => c === 0 ? res() : rej(new Error(err.slice(-2000))));
    if (feed) feed(p.stdin);
  });
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-trailer-'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.addInitScript(() => { window.__TRAILER_CAPTURE = true; });
  await page.goto('file://' + PAGE);
  await page.waitForFunction(() => window.TRAILER);
  await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
  const { length, scenes, music } = await page.evaluate(() => ({ length: TRAILER.length, scenes: TRAILER.scenes || [], music: TRAILER.music || null }));

  const frames = Math.round(length / 1000 * FPS);
  const video = path.join(tmp, 'video.mp4');
  await run(['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), video], async (stdin) => {
    for (let i = 0; i < frames; i++) {
      await page.evaluate(ms => TRAILER.seek(ms), i * 1000 / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!stdin.write(buf)) await new Promise(r => stdin.once('drain', r));
      if (i % 300 === 0) console.log(`frame ${i}/${frames}`);
    }
    stdin.end();
  });

  await page.addScriptTag({ path: path.join(ROOT, music ? music.src : 'assets/intro-music.js') });
  const wav = await page.evaluate(async ({ length, scenes, VOLUME, music }) => {
    const sr = 48000, secs = length / 1000, ctx = new OfflineAudioContext(2, Math.round(sr * secs), sr);
    const g = ctx.createGain();
    const vol = music ? 1 : VOLUME, fadeIn = music ? (music.fadeIn || 0) : 1.5;
    g.gain.setValueAtTime(fadeIn ? 0 : vol, 0);
    if (fadeIn) g.gain.linearRampToValueAtTime(vol, fadeIn);
    g.gain.setValueAtTime(vol, secs - 2);
    g.gain.linearRampToValueAtTime(0, secs);
    g.connect(ctx.destination);
    if (music) window[music.global].score(ctx, g, 0);
    else CellScopeIntroMusic.score(ctx, g, 0, { length: secs - 2, scenes });
    const buf = await ctx.startRendering(), n = buf.length, L = buf.getChannelData(0), R = buf.getChannelData(1);
    if (music && music.peakDb !== undefined) {
      let pk = 0;
      for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
      const k = pk ? Math.pow(10, music.peakDb / 20) / pk : 1;
      for (let i = 0; i < n; i++) { L[i] *= k; R[i] *= k; }
    }
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
  }, { length, scenes, VOLUME, music });
  const audio = path.join(tmp, 'audio.wav');
  fs.writeFileSync(audio, Buffer.from(wav));
  await browser.close();

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await run(['-y', '-i', video, '-i', audio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart', OUT]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('wrote', path.relative(ROOT, OUT), (fs.statSync(OUT).size / 1048576).toFixed(1) + ' MB');
})().catch(e => { console.error(e); process.exit(1); });
