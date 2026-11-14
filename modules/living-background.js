// F37 — Living colour background (section 4.1).
// One full-screen flow of colour: domain-warped fractal value noise in a small
// hand-written WebGL shader. No shapes, no cursor/touch reaction.
// Reacts only to: time (very slow), scrolling, page changes, theme changes.
// Falls back to a static CSS gradient (class "bg-static" on <html>) whenever
// WebGL is missing, the shader fails, reading mode is on or motion is reduced.
import { clamp, mq } from './util.js';

const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform float uTheme;   // 0 = dark, 1 = light (animated between)
uniform vec2 uOff;      // scroll + sweep offset
uniform float uBal;     // balance between the two colour families

float hash(vec2 p){
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.02 + vec2(13.7, 7.3); a *= 0.5; }
  return v / 0.875;
}
// fractal noise clusters around the middle: stretch it back to the full 0..1 range
float nrm(float v){ return clamp((v - 0.28) / 0.45, 0.0, 1.0); }

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / max(uRes.y, 1.0);
  vec2 p = vec2(uv.x * asp, uv.y) * 1.6 + vec2(3.0, 7.0) + uOff;
  float t = uTime;

  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.012)),
                fbm(p + vec2(5.2, 1.3) - vec2(t * 0.015, 0.0)));
  vec2 r = vec2(fbm(p + 2.0 * q + vec2(1.7, 9.2) + vec2(t * 0.010, t * 0.006)),
                fbm(p + 2.0 * q + vec2(8.3, 2.8) - vec2(0.0, t * 0.017)));
  float f = nrm(fbm(p + 2.8 * r));
  float m = nrm(fbm(p * 0.8 + 2.4 * r.yx + vec2(4.1, 2.6) + vec2(t * 0.008, -t * 0.011)));

  // ---------- dark: navy -> deep blue, burnt orange as one capped layer ----------
  vec3 navy = vec3(0.016, 0.027, 0.075);
  vec3 blue = vec3(0.090, 0.161, 0.400);
  vec3 ember = vec3(0.330, 0.140, 0.014);
  vec3 orange = vec3(0.620, 0.275, 0.024);
  vec3 amber = vec3(0.780, 0.400, 0.030);
  vec3 d = mix(navy, blue, smoothstep(0.15, 0.85, f));
  float o = smoothstep(0.36, 0.80, m + uBal);
  float glow = smoothstep(0.10, 0.90, nrm(r.x));
  d = mix(d, mix(ember, orange, glow), o * 0.92);
  d = mix(d, amber, smoothstep(0.80, 1.0, o) * smoothstep(0.70, 1.0, glow) * 0.28);
  d *= 1.15;
  d = min(d, vec3(0.78, 0.40, 0.50));

  // ---------- light: pearl -> light blue, a little lavender, a touch of green ----------
  vec3 pearl = vec3(0.969, 0.961, 0.984);
  vec3 lblue = vec3(0.600, 0.790, 0.950);
  vec3 lav = vec3(0.740, 0.680, 0.940);
  vec3 green = vec3(0.560, 0.860, 0.700);
  vec3 l = mix(pearl, lblue, smoothstep(0.02, 0.62, f));
  float lv = smoothstep(0.64, 0.94, m + uBal * 0.4) * 0.7;
  l = mix(l, lav, lv);
  float g = smoothstep(0.60, 0.77, fbm(p * 1.3 + r * 1.6 + vec2(21.4, 3.9))) * 0.7 * (1.0 - lv * 0.7);
  l = mix(l, green, g);

  vec3 col = mix(d, l, uTheme);

  // soft edge vignette
  vec2 c = uv - 0.5;
  float vig = smoothstep(0.35, 0.95, length(c * vec2(1.0, 1.15)));
  col *= 1.0 - vig * mix(0.34, 0.05, uTheme);

  gl_FragColor = vec4(col, 1.0);
}`;

function ease(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }

export function init(app) {
  const root = document.documentElement;
  const canvas = document.getElementById('bg-canvas');
  const state = { status: 'static', frames: 0, scale: 0, running: false };
  app.bg = state;

  const useStatic = () => root.classList.contains('reading') || mq('(prefers-reduced-motion: reduce)');
  const setStatic = (on) => { root.classList.toggle('bg-static', on); };

  if (!canvas || typeof canvas.getContext !== 'function' || typeof requestAnimationFrame !== 'function') {
    setStatic(true);
    return;
  }

  let gl = null;
  let prog = null;
  let uni = null;
  let raf = 0;
  let lost = false;

  const lowEnd = root.classList.contains('low-end') ||
    (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4) ||
    (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4);
  let scale = lowEnd ? 0.34 : 0.5;          // render well below screen size, CSS scales it up
  const minFrame = lowEnd ? 1000 / 30 : 1000 / 60;

  // animation state
  const t0 = performance.now();
  let pausedAt = 0;
  let pausedTotal = 0;
  let themeNow = app.theme === 'light' ? 1 : 0;
  let themeFrom = themeNow;
  let themeTo = themeNow;
  let themeStart = 0;
  let scrollTarget = 0;
  let scrollNow = 0;
  let lastScrollY = window.scrollY || 0;
  let drift = 0;
  let driftPos = 0;
  const seed = app.config && Array.isArray(app.config.bgSeed) ? app.config.bgSeed : [5, 3]; // where the flow starts (a balanced spot)
  let sweepBase = Number(seed[0]) || 0;
  let sweepBaseY = Number(seed[1]) || 0;
  let sweepFrom = 0;
  let sweepTo = 0;
  let sweepStart = -1e9;
  let balNow = 0;
  let lastFrame = 0;
  let slowCount = 0;
  let frameAvg = 16;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('shader: ' + log);
    }
    return s;
  }

  function setup() {
    const attrs = { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false };
    gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    if (!gl) throw new Error('no webgl');
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    uni = {
      res: gl.getUniformLocation(prog, 'uRes'),
      time: gl.getUniformLocation(prog, 'uTime'),
      theme: gl.getUniformLocation(prog, 'uTheme'),
      off: gl.getUniformLocation(prog, 'uOff'),
      bal: gl.getUniformLocation(prog, 'uBal'),
    };
  }

  function resize() {
    if (!gl) return;
    const w = Math.max(2, Math.round((window.innerWidth || 800) * scale));
    const h = Math.max(2, Math.round((window.innerHeight || 600) * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    state.scale = scale;
  }

  function scrollProgress() {
    const max = Math.max(1, (document.documentElement.scrollHeight || 1) - (window.innerHeight || 1));
    return clamp((window.scrollY || 0) / max, 0, 1);
  }

  function draw(now) {
    const time = (now - t0 - pausedTotal) / 1000;

    // theme blend
    if (themeNow !== themeTo) {
      const k = clamp((now - themeStart) / 1200, 0, 1);
      themeNow = themeFrom + (themeTo - themeFrom) * ease(k);
      if (k >= 1) themeNow = themeTo;
    }
    // scroll parallax with easing + a little inertia
    scrollNow += (scrollTarget - scrollNow) * 0.07;
    drift *= 0.94;
    driftPos += drift;
    // page-change sweep (about 1.2 s)
    const sk = clamp((now - sweepStart) / 1200, 0, 1);
    const sweep = sweepFrom + (sweepTo - sweepFrom) * ease(sk);
    const sweepPulse = Math.sin(sk * Math.PI);
    // balance: a bit warmer near the top, bluer in the middle, mixed near the bottom
    const sp = scrollProgress();
    const balTarget = 0.07 * Math.cos(sp * Math.PI * 1.5) * (1 - sp * 0.4) - 0.02 + sweepPulse * 0.07;
    balNow += (balTarget - balNow) * 0.05;

    gl.uniform2f(uni.res, canvas.width, canvas.height);
    gl.uniform1f(uni.time, time);
    gl.uniform1f(uni.theme, themeNow);
    gl.uniform2f(uni.off, sweepBase + sweep * 0.9 + driftPos * 0.3, -scrollNow * 0.55 - sweepBaseY - sweep * 0.35 - driftPos);
    gl.uniform1f(uni.bal, balNow);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    state.frames += 1;
  }

  function loop(now) {
    raf = 0;
    if (!state.running) return;
    raf = requestAnimationFrame(loop);
    const dt = now - lastFrame;
    if (dt < minFrame - 2) return;
    lastFrame = now;
    try {
      draw(now);
    } catch (err) {
      console.warn('[LNH] background stopped:', err);
      fail();
      return;
    }
    // adapt: if frames are slow for a while, render fewer pixels
    if (dt < 250) {
      frameAvg += (dt - frameAvg) * 0.1;
      if (frameAvg > Math.max(40, minFrame * 1.6)) slowCount += 1; else slowCount = Math.max(0, slowCount - 1);
      if (slowCount > 45 && scale > 0.2) {
        scale = Math.max(0.2, scale * 0.75);
        slowCount = 0;
        frameAvg = minFrame;
        resize();
      }
    }
  }

  function startLoop() {
    if (state.running || lost || !gl) return;
    if (pausedAt) { pausedTotal += performance.now() - pausedAt; pausedAt = 0; }
    state.running = true;
    state.status = 'webgl';
    setStatic(false);
    lastFrame = 0;
    resize();
    raf = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (!state.running) return;
    state.running = false;
    pausedAt = performance.now();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function fail() {
    stopLoop();
    gl = null;
    state.status = 'static';
    setStatic(true);
  }

  function refresh() {
    if (!gl || lost) { setStatic(true); return; }
    if (useStatic()) { stopLoop(); state.status = 'static'; setStatic(true); return; }
    if (document.visibilityState === 'hidden') { stopLoop(); state.status = 'paused'; return; }
    startLoop();
  }

  try {
    setup();
  } catch (err) {
    console.info('[LNH] living background not available, using the static gradient.');
    gl = null;
    setStatic(true);
    return;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; stopLoop(); setStatic(true); state.status = 'static'; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { lost = false; setup(); refresh(); } catch { fail(); }
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); }, { passive: true });

  let scrollTick = false;
  window.addEventListener('scroll', () => {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(() => {
      scrollTick = false;
      const y = window.scrollY || 0;
      const vh = window.innerHeight || 800;
      const dy = y - lastScrollY;
      lastScrollY = y;
      scrollTarget = y / vh;
      // faster scrolling adds a little extra drift that eases out
      drift = clamp(drift + clamp(dy / vh, -0.5, 0.5) * 0.012, -0.02, 0.02);
    });
  }, { passive: true });

  document.addEventListener('visibilitychange', refresh);
  try {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (m.addEventListener) m.addEventListener('change', refresh);
  } catch { /* ignore */ }

  app.on('reading', refresh);
  app.on('theme', (theme) => {
    themeFrom = themeNow;
    themeTo = theme === 'light' ? 1 : 0;
    themeStart = performance.now();
    if (!state.running) themeNow = themeTo;
  });
  app.on('sweep', () => {
    if (!state.running) return;
    const now = performance.now();
    const sk = clamp((now - sweepStart) / 1200, 0, 1);
    const current = sweepFrom + (sweepTo - sweepFrom) * ease(sk);
    sweepBase += current * 0.9;
    sweepBaseY += current * 0.35;
    sweepFrom = 0;
    sweepTo = 0.55;
    sweepStart = now;
  });

  state.sweep = () => app.sweep();
  state.refresh = refresh;
  refresh();
}
