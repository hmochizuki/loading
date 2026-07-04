/* やさしく待って — 舞台
 *
 * 画面には背景とローディングだけ。
 * ひとつが去ると、少し間をおいて次が現れる。
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

  let current = null;
  let gapT = 0.6; // 最初は少しだけ待って現れる

  // --- 背景の気配。とても控えめに、気分がにじむ ---
  const bgMood = { warm: 0, cold: 0 };
  const BG_BASE = [18, 20, 28];
  const BG_WARM = [26, 22, 27];
  const BG_COLD = [13, 15, 23];
  const BG_INNER_LIFT = 7;

  function drawBackground(t) {
    let c = U.mixColor(BG_BASE, BG_WARM, bgMood.warm);
    c = U.mixColor(c, BG_COLD, bgMood.cold);
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
  }

  // --- 手つきをローディングへ届ける ---
  function alive() {
    return current && current.phase !== 'exit' ? current : null;
  }

  const input = new InputSense(canvas, {
    touchStart() {
      const c = alive();
      if (c) c.heart.touch();
    },
    tap(x, y) {
      const c = alive();
      if (c) c.tapAt(x, y);
    },
    rapid(count) {
      const c = alive();
      if (c) c.rapidTaps(count);
    },
    stroke(s) {
      const c = alive();
      if (c) c.strokeMove(s);
    },
    release(info) {
      const c = alive();
      if (c) c.released(info);
    },
    multi() {
      const c = alive();
      if (c) c.multiTouch();
    },
  });

  // 検証用の小さな窓。ふだんは使わない。
  window.YW.stage = {
    get current() { return current; },
    spawn(i) { current = new loaderKinds[i](new Heart()); },
    skip() {
      if (current && current.phase !== 'exit') {
        current.phase = 'exit';
        current.phaseT = 0;
        current.exitStyle = current.heart.exitMood();
      }
    },
  };

  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    // 押しっぱなしはフレームごとに伝える
    if (current && current.phase !== 'exit') {
      const pi = input.pressInfo(now);
      if (pi) current.pressFrame(pi, dt);
      else if (current.pressing && !input.p) current.released({ dur: 0, stroked: false });
    }

    if (current) {
      current.update(dt, t);
      if (current.done) {
        current = null;
        gapT = U.rand(1.3, 2.4);
      }
    } else {
      gapT -= dt;
      if (gapT <= 0) {
        const Kind = nextKind();
        current = new Kind(new Heart());
      }
    }

    // 背景の気分はゆっくり追いかける
    const h = current ? current.heart : null;
    bgMood.warm = U.damp(bgMood.warm, h ? U.clamp(h.comfort * 0.4 + h.joy * 0.5, 0, 1) : 0, 0.5, dt);
    bgMood.cold = U.damp(bgMood.cold, h ? U.clamp(h.stress * 0.7 + h.fatigue * 0.3, 0, 1) : 0, 0.5, dt);

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    drawBackground(t);
    if (current) current.draw(ctx, view.cx, view.cy, t);

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
