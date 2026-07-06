/* やさしく待って — 舞台
 *
 * 画面には背景とローディングだけ。
 * ひとつが去ると、少し間をおいて次が現れる。
 * ごくまれに、ふたりで来ることもある。
 */
(function () {
  'use strict';
  const { U, Heart, InputSense, loaderKinds } = window.YW;

  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');

  const view = { w: 0, h: 0, cx: 0, cy: 0, dpr: 1 };
  window.YW.view = view;

  function resize() {
    view.dpr = Math.min(2, window.devicePixelRatio || 1);
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    view.cx = view.w / 2;
    view.cy = view.h / 2 - view.h * 0.03;
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  // 動きを控えめにしたい人へ
  try {
    window.YW.reduceMotion = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { window.YW.reduceMotion = false; }

  // --- 出番の順番。ひとまわりごとに混ぜ直す ---
  let deck = [];
  function nextKind() {
    if (deck.length === 0) {
      deck = loaderKinds.slice();
      for (let i = deck.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
      }
    }
    return deck.pop();
  }

  let actors = [];
  let gapT = 0.6; // 最初は少しだけ待って現れる
  let lastTouched = null;

  function traveling(a) {
    return !!(a.stroll || a.trip || a.tele || a.roll || a.settle
      || (a.mode && a.mode !== 'ring'));
  }

  function nearestActor(x, y) {
    let best = null, bd = Infinity;
    for (const a of actors) {
      if (a.phase === 'exit') continue;
      const d = Math.hypot(x - (view.cx + a.home.x), y - (view.cy + a.home.y));
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  function spawnNext() {
    const Kind = nextKind();
    const a = new Kind(new Heart());
    actors = [a];
    // ごくまれに、ふたりで来る
    if (view.w >= 430 && Math.random() < 0.12) {
      const Kind2 = nextKind();
      const b = new Kind2(new Heart());
      a.home.x = -88;
      b.home.x = 88;
      b.breath += 1.7; // 呼吸まではそろえない
      actors.push(b);
    }
  }

  // --- 星の思い出 ---
  // 去っていった子は、消えたあたりの空に、ごく薄い星になって残る。
  // しあわせに去った子は、少しだけあたたかい色になる。
  const STAR_KEY = 'yasashiku-matte-stars';
  let stars = [];
  try {
    const raw = JSON.parse(localStorage.getItem(STAR_KEY) || '[]');
    if (Array.isArray(raw)) stars = raw.filter((s) => s && typeof s.x === 'number').slice(0, 140);
  } catch (e) { /* 思い出せなくても、責めない */ }

  function rememberStar(loader) {
    const mood = loader.exitStyle;
    const warm = mood === 'happy' || mood === 'sleepy';
    const px = U.clamp((view.cx + loader.home.x) / view.w + U.rand(-0.02, 0.02), 0.05, 0.95);
    const py = U.clamp(
      (view.cy + loader.home.y - (mood === 'happy' ? 170 : 110)) / view.h + U.rand(-0.02, 0.02),
      0.03, 0.5
    );
    stars.push({
      x: px,
      y: py,
      b: warm ? U.rand(0.55, 0.9) : U.rand(0.25, 0.5),
      w: warm ? 1 : 0,
      p: U.rand(0, U.TAU),
    });
    if (stars.length > 140) stars.shift(); // 古い思い出は、そっと薄れる
    try { localStorage.setItem(STAR_KEY, JSON.stringify(stars)); } catch (e) { /* それでもいい */ }
  }

  function drawStars(t) {
    for (const s of stars) {
      const tw = 0.7 + 0.3 * Math.sin(t * 0.35 + s.p); // とてもゆっくりまたたく
      const a = (0.06 + s.b * 0.13) * tw;
      ctx.fillStyle = s.w
        ? 'rgba(255,241,219,' + a.toFixed(3) + ')'
        : 'rgba(208,219,240,' + a.toFixed(3) + ')';
      const r = s.b > 0.7 ? 1.7 : 1.2;
      ctx.fillRect(s.x * view.w - r / 2, s.y * view.h - r / 2, r, r);
    }
  }

  // --- 背景の気配。とても控えめに、気分がにじむ ---
  const bgMood = { warm: 0, cold: 0 };
  const BG_BASE = [18, 20, 28];
  const BG_WARM = [26, 22, 27];
  const BG_COLD = [13, 15, 23];
  const BG_INNER_LIFT = 7;

  // 時刻の気配。一緒に待っている時間帯が、ほんのわずかに色ににじむ
  let hourTintCache = { at: -1, c: [0, 0, 0] };
  function hourTint() {
    const now = Date.now();
    if (now - hourTintCache.at < 30000) return hourTintCache.c;
    const d = new Date();
    const hr = d.getHours() + d.getMinutes() / 60;
    const bell = (center, width) => {
      let x = Math.abs(hr - center);
      x = Math.min(x, 24 - x); // 日をまたぐ
      return Math.max(0, 1 - x / width);
    };
    const dawn = bell(7, 2.5);   // 朝は、ほのかに白む
    const dusk = bell(18, 2.5);  // 夕は、ほんのり暖かい
    const deep = bell(2.5, 3);   // 夜ふけは、少し深く
    hourTintCache = {
      at: now,
      c: [dawn * 4 + dusk * 4 - deep * 3, dawn * 4 + dusk * 1.5 - deep * 3, dawn * 5 - deep * 1],
    };
    return hourTintCache.c;
  }

  function drawBackground(t) {
    let c = U.mixColor(BG_BASE, BG_WARM, bgMood.warm);
    c = U.mixColor(c, BG_COLD, bgMood.cold);
    const ht = hourTint();
    c = [c[0] + ht[0], c[1] + ht[1], c[2] + ht[2]];
    const inner = [c[0] + BG_INNER_LIFT, c[1] + BG_INNER_LIFT, c[2] + BG_INNER_LIFT];
    const g = ctx.createRadialGradient(
      view.cx, view.cy - 30, 40,
      view.cx, view.cy, Math.max(view.w, view.h) * 0.75
    );
    g.addColorStop(0, U.rgba(inner, 1));
    g.addColorStop(1, U.rgba(c, 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);

    // ごくうすいゆらぎ
    const gx = view.cx + U.noise(t * 0.1) * 60;
    const gy = view.cy - 80 + U.noise(t * 0.13 + 3) * 40;
    const gr = Math.min(view.w, view.h) * 0.45;
    const soft = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    soft.addColorStop(0, 'rgba(255,255,255,0.022)');
    soft.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = soft;
    ctx.fillRect(0, 0, view.w, view.h);

    drawStars(t);
  }

  // --- 手つきをローディングへ届ける。ふたりいるときは、近いほうへ ---
  function notePointer(x, y) {
    view.pointer = { x, y, t: performance.now() / 1000 };
  }

  const input = new InputSense(canvas, {
    touchStart(x, y) {
      notePointer(x, y);
      const c = nearestActor(x, y);
      if (c) { lastTouched = c; c.heart.touch(); }
    },
    tap(x, y) {
      notePointer(x, y);
      const c = nearestActor(x, y);
      if (c) { lastTouched = c; c.tapAt(x, y); }
    },
    rapid(count) {
      const c = lastTouched && lastTouched.phase !== 'exit' ? lastTouched : null;
      if (c) c.rapidTaps(count);
    },
    stroke(s) {
      notePointer(s.x, s.y);
      const c = nearestActor(s.x, s.y);
      if (c) { lastTouched = c; c.strokeMove(s); }
    },
    release(info) {
      if (lastTouched && actors.includes(lastTouched)) lastTouched.released(info);
    },
    multi() {
      for (const c of actors) {
        if (c.phase !== 'exit') c.multiTouch();
      }
    },
  });

  // --- ふたりの時間 ---
  function duoUpdate(dt) {
    if (actors.length !== 2) {
      for (const a of actors) a.justWiggled = false;
      return;
    }
    const [a, b] = actors;
    if (a.phase === 'exit' || b.phase === 'exit') return;

    // そばにいたい。でも、くっつきすぎない
    if (!traveling(a) && !traveling(b)) {
      const dx = b.home.x - a.home.x;
      const adx = Math.abs(dx) || 1;
      const dir = dx / adx;
      if (adx < 132) {
        const push = (132 - adx) * 1.2 * dt;
        a.home.x -= dir * push;
        b.home.x += dir * push;
      } else if (adx > 215) {
        const pull = Math.min((adx - 215) * 0.6, 30) * dt;
        a.home.x += dir * pull;
        b.home.x -= dir * pull;
      }
    }

    // 共感: 片方の不安は、もう片方にも少し伝わる
    if (a.heart.stress > 0.5) b.heart.stress = Math.min(1, b.heart.stress + dt * 0.04);
    if (b.heart.stress > 0.5) a.heart.stress = Math.min(1, a.heart.stress + dt * 0.04);

    // つられて身震い
    if (a.justWiggled) { a.justWiggled = false; b.echoDelay = U.rand(0.35, 0.8); }
    if (b.justWiggled) { b.justWiggled = false; a.echoDelay = U.rand(0.35, 0.8); }
    for (const x of actors) {
      if (x.echoDelay != null) {
        x.echoDelay -= dt;
        if (x.echoDelay <= 0) {
          x.echoDelay = null;
          x.wiggle.kick(U.rand(1.8, 2.6) * (Math.random() < 0.5 ? -1 : 1));
          x.joyBurst(0, -14, 2);
          x.heart.gentle(0.04);
        }
      }
    }
  }

  // 検証用の小さな窓。ふだんは使わない。
  window.YW.stage = {
    get current() { return actors[0] || null; },
    get actors() { return actors; },
    spawn(i, duoIdx) {
      actors = [new loaderKinds[i](new Heart())];
      if (duoIdx != null) {
        const b = new loaderKinds[duoIdx](new Heart());
        actors[0].home.x = -88;
        b.home.x = 88;
        actors.push(b);
      }
    },
    skip() {
      for (const c of actors) {
        if (c.phase !== 'exit') {
          c.phase = 'exit';
          c.phaseT = 0;
          c.exitStyle = c.heart.exitMood();
        }
      }
    },
  };

  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    // 押しっぱなしはフレームごとに、近い子へ伝える
    const pi = input.pressInfo(now);
    if (pi) {
      const c = nearestActor(pi.x, pi.y);
      if (c) {
        lastTouched = c;
        view.pointer = { x: pi.x, y: pi.y, t: now / 1000 };
        c.pressFrame(pi, dt);
      }
    } else if (!input.p) {
      for (const a of actors) {
        if (a.pressing) a.released({ dur: 0, stroked: false });
      }
    }

    for (let i = actors.length - 1; i >= 0; i--) {
      actors[i].update(dt, t);
      if (actors[i].done) {
        rememberStar(actors[i]);
        const gone = actors.splice(i, 1)[0];
        if (lastTouched === gone) lastTouched = null;
        if (actors.length === 1) {
          // ひとり残されて、少し所在なさげ
          const r = actors[0].heart;
          r.comfort = Math.max(0, r.comfort - 0.15);
          r.stress = Math.min(1, r.stress + 0.06);
        }
        if (actors.length === 0) gapT = U.rand(1.3, 2.4);
      }
    }
    duoUpdate(dt);

    if (actors.length === 0) {
      gapT -= dt;
      if (gapT <= 0) spawnNext();
    }

    // 背景の気分はゆっくり追いかける。いちばん強い気持ちがにじむ
    let warmT = 0, coldT = 0;
    for (const a of actors) {
      const h = a.heart;
      warmT = Math.max(warmT, U.clamp(h.comfort * 0.4 + h.joy * 0.5, 0, 1));
      coldT = Math.max(coldT, U.clamp(h.stress * 0.7 + h.fatigue * 0.3, 0, 1));
    }
    bgMood.warm = U.damp(bgMood.warm, warmT, 0.5, dt);
    bgMood.cold = U.damp(bgMood.cold, coldT, 0.5, dt);

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    drawBackground(t);
    for (const a of actors) a.draw(ctx, view.cx, view.cy, t);

    // すみをそっと暗く
    const v = ctx.createRadialGradient(
      view.cx, view.cy, Math.min(view.w, view.h) * 0.35,
      view.cx, view.cy, Math.max(view.w, view.h) * 0.85
    );
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, view.w, view.h);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
