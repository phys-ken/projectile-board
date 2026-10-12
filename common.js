'use strict';
const G = 9.8;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const THEMES = {
  dark:  { bg:'#0f2f2c', grid:'rgba(255,255,255,.13)', major:'rgba(255,255,255,.34)', fg:'#f6f6ee', dim:'#bcd0c6', ground:'#c98a3c',
           axis:'#ffffff', vec:'#ffffff', vx:'#4dd2ff', vy:'#ffe14d', accent:'#ffe14d', g:'#35f060',
           balls:['#ff6b6b','#ffa24d','#5be37d','#ff8fd0','#b99cff'] },
  light: { bg:'#fbfbf5', grid:'rgba(0,0,0,.12)', major:'rgba(0,0,0,.4)', fg:'#111', dim:'#556', ground:'#9a6a28',
           axis:'#111111', vec:'#111111', vx:'#0b74c9', vy:'#c25400', accent:'#c25400', g:'#0a8a2a',
           balls:['#d62828','#e07a00','#1a8f3c','#c2185b','#6a3fd1'] },
};
let theme = THEMES.dark;
function setTheme(name) {
  theme = THEMES[name];
  document.documentElement.dataset.theme = name;
  try { localStorage.setItem('sim-theme', name); } catch (e) {}
}
function initTheme() {
  let n = 'dark';
  try { n = localStorage.getItem('sim-theme') || 'dark'; } catch (e) {}
  setTheme(THEMES[n] ? n : 'dark');
}

function fitCanvas(canvas) {
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  return { w, h, dpr };
}

function arrow(ctx, x0, y0, x1, y1, color, lw) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  if (L < 1) return;
  const ux = dx / L, uy = dy / L, hl = Math.min(L * 0.6, lw * 4.2), hw = hl * 0.5;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * hl * 0.7, y1 - uy * hl * 0.7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - ux * hl + uy * hw, y1 - uy * hl - ux * hw);
  ctx.lineTo(x1 - ux * hl - uy * hw, y1 - uy * hl + ux * hw);
  ctx.closePath(); ctx.fill();
}

function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

const SERIF = '"Times New Roman","Noto Serif JP",serif';

class Clock {
  constructor(onChange) {
    this.t = 0; this.T = 1; this.speed = 0.5; this.playing = false; this.loop = true; this.hold = 0;
    this.onChange = onChange; this.last = 0; requestAnimationFrame((n) => this.tick(n));
  }
  tick(now) {
    if (this.playing) {
      if (this.t >= this.T) {
        if (!this.loop) this.playing = false;
        else if (!this.hold) this.hold = now + 1400;
        else if (now >= this.hold) { this.t = 0; this.hold = 0; }
        this.onChange();
      } else {
        const dt = Math.min(0.1, (now - this.last) / 1000);
        this.t = Math.min(this.T, this.t + dt * this.speed);
        this.onChange();
      }
    }
    this.last = now; requestAnimationFrame((n) => this.tick(n));
  }
  toggle() { this.hold = 0; if (this.t >= this.T) this.t = 0; this.playing = !this.playing; this.onChange(); }
  pause() { this.hold = 0; this.playing = false; this.onChange(); }
  reset() { this.hold = 0; this.playing = false; this.t = 0; this.onChange(); }
  seek(t) { this.hold = 0; this.t = clamp(t, 0, this.T); this.onChange(); }
}

function segment(el, options, get, set) {
  el.innerHTML = '';
  const btns = options.map(([label, val]) => {
    const b = document.createElement('button'); b.textContent = label;
    b.onclick = () => { set(val); refresh(); }; el.appendChild(b); return [b, val];
  });
  function refresh() { const cur = get(); btns.forEach(([b, v]) => b.classList.toggle('on', v === cur)); }
  refresh(); return refresh;
}
function toggleBtn(el, get, set) {
  const refresh = () => el.classList.toggle('on', !!get());
  el.onclick = () => { set(!get()); refresh(); }; refresh(); return refresh;
}

function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.style.display = 'block';
  clearTimeout(toast.t); toast.t = setTimeout(() => (el.style.display = 'none'), 4200);
}
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  const cur = d.fullscreenElement || d.webkitFullscreenElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (cur) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
  if (req) { try { const p = req.call(el); if (p && p.catch) p.catch(() => toast('全画面にできませんでした')); } catch (e) { toast('全画面にできませんでした'); } }
  else toast('このブラウザは全画面に対応していません。共有ボタン →「ホーム画面に追加」から開くと全画面になります。');
}
function setMini(on) { document.body.classList.toggle('mini', on); window.dispatchEvent(new Event('resize')); }
function setDrawer(on) { document.body.classList.toggle('drawer', on); }
function wireShell() {
  $('bMini').onclick = () => setMini(true);
  $('bUnmini').onclick = () => setMini(false);
  $('bGear').onclick = () => setDrawer(!document.body.classList.contains('drawer'));
  $('dClose').onclick = () => setDrawer(false);
  $('bFull').onclick = toggleFullscreen;
  $('bFull2').onclick = toggleFullscreen;
  document.addEventListener('fullscreenchange', () => window.dispatchEvent(new Event('resize')));
  document.addEventListener('webkitfullscreenchange', () => window.dispatchEvent(new Event('resize')));
  let last = 0;
  document.addEventListener('touchend', (e) => { const n = Date.now(); if (n - last < 350) e.preventDefault(); last = n; }, { passive: false });
}
