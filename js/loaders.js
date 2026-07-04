/* やさしく待って — ローディングたち
 *
 * みんな LoaderBase を継ぐ。
 * 一生: enter -> live -> exit。exit の去り方はそのときの気分で決まる。
 * 触れられたときの反応は on〜 に書く。こころへの影響は main が共通で流す。
 */
(function () {
  'use strict';
  const { U, Spring } = window.YW;

  const BODY = [228, 228, 224];   // ふだんの色
  const COOL = [188, 196, 214];   // こわいときの色
  const WARM = [248, 238, 218];   // うれしいときの色

  class LoaderBase {
    constructor(heart) {
      this.heart = heart;
      this.phase = 'enter';
      this.phaseT = 0;
      this.age = 0;
      this.life = U.rand(36, 58);
      this.done = false;
      this.exitStyle = 'calm';
      this.exitDir = Math.random() < 0.5 ? -1 : 1;
      this.breath = U.rand(0, U.TAU);
      this.pressing = false;

      this.sparkles = [];
      this.wiggle = new Spring(0, 60, 6);   // ごきげんな身震い
      this.mannerT = U.rand(5, 9);
      this.gentleMeter = 0;                 // やさしくなぞられた蓄積
      this.blushBoost = 0;                  // なでられた直後の赤らみ
      this.lean = 0;                        // なつき。指のほうへ寄る
      this.nodT = 0;                        // こっくり居眠り
      this.nodY = 0;
      this.nodRot = 0;
      this.sparkleT = 0;
    }

    update(dt, t) {
      this.age += dt;
      this.phaseT += dt;
      this.heart.update(dt);
      this.breath += dt * (1.4 - this.heart.drowsy * 0.6 + this.heart.stress * 0.8);

      if (this.phase === 'enter') {
        if (this.phaseT > 1.1) { this.phase = 'live'; this.phaseT = 0; }
      } else if (this.phase === 'live') {
        const tiredEarly = this.heart.fatigue > 0.85 && this.age > 16;
        if (this.age > this.life || tiredEarly) {
          this.phase = 'exit';
          this.phaseT = 0;
          this.exitStyle = tiredEarly ? 'tired' : this.heart.exitMood();
        }
      } else if (this.phase === 'exit') {
        if (this.phaseT > 2.8) this.done = true;
      }

      const h = this.heart;

      // ごきげんな身震い: 安心していると、ときどき自分からふるっと揺れる
      if (this.phase === 'live' && h.comfort > 0.55 && h.stress < 0.3) {
        this.mannerT -= dt;
        if (this.mannerT <= 0) {
          this.mannerT = U.rand(4, 8);
          this.wiggle.kick(U.rand(2.2, 3.2) * (Math.random() < 0.5 ? -1 : 1));
          this.emitSparkles(0, -18, 5, 44);
        }
      }
      this.wiggle.update(dt);

      // なつき: 触れられている指のほうへ、そっと寄る
      const ptr = window.YW.view.pointer;
      let leanTarget = 0;
      if (ptr && t - ptr.t < 1.2 && h.comfort > 0.4 && this.phase === 'live') {
        leanTarget = U.clamp((ptr.x - window.YW.view.cx) * 0.045, -8, 8) * h.comfort;
      }
      this.lean = U.damp(this.lean, leanTarget, 3, dt);

      // 居眠り: 眠くなると、こっくり沈んでは戻る
      if (h.drowsy > 0.45 && this.phase === 'live') {
        this.nodT += dt;
        const k = (this.nodT % 3.4) / 3.4;
        const sink = k < 0.78 ? U.smooth(k / 0.78) : 1 - U.easeOutCubic((k - 0.78) / 0.22);
        this.nodY = sink * 8 * h.drowsy;
        this.nodRot = sink * 0.05 * h.drowsy;
      } else {
        this.nodY = U.damp(this.nodY, 0, 4, dt);
        this.nodRot = U.damp(this.nodRot, 0, 4, dt);
      }

      this.blushBoost = Math.max(0, this.blushBoost - dt * 0.4);

      // うれしい去りぎわには、キラキラがこぼれる
      if (this.phase === 'exit' && this.exitStyle === 'happy' && this.phaseT < 1.1) {
        this.sparkleT -= dt;
        if (this.sparkleT <= 0) {
          this.sparkleT = 0.16;
          this.emitSparkles(U.rand(-28, 28), U.rand(-40, 0), 2, 14);
        }
      }

      for (let i = this.sparkles.length - 1; i >= 0; i--) {
        const s = this.sparkles[i];
        s.age += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy -= 14 * dt; // ふわっと昇っていく
        if (s.age > s.dur) this.sparkles.splice(i, 1);
      }

      this.subUpdate(dt, t);
    }

    emitSparkles(x, y, n, spread) {
      for (let i = 0; i < n && this.sparkles.length < 40; i++) {
        this.sparkles.push({
          x: x + U.rand(-spread, spread),
          y: y + U.rand(-spread * 0.6, spread * 0.6),
          vx: U.rand(-9, 9),
          vy: U.rand(-22, -6),
          age: 0,
          dur: U.rand(0.7, 1.3),
          size: U.rand(2.2, 4.2),
          ph: U.rand(0, U.TAU),
        });
      }
    }

    // --- こころへの共通の流し込み。main から呼ばれる ---

    tapAt(x, y) {
      this.heart.touch();
      this.heart.stress = Math.min(1, this.heart.stress + 0.03); // 小さくびくっ
      this.onTap(x, y);
    }

    rapidTaps(count) {
      this.heart.rough(0.14 + 0.04 * Math.min(5, count - 3));
      this.onRapid(count);
    }

    strokeMove(s) {
      this.heart.touch();
      const d = Math.min(40, Math.hypot(s.dx, s.dy));
      if (s.speed < 0.5) {
        this.heart.gentle(Math.min(0.02, d * 0.0009));
        // なでられ続けると、赤らんでキラキラがこぼれる
        this.gentleMeter += d * 0.008;
        if (this.gentleMeter > 1) {
          this.gentleMeter = 0;
          this.blushBoost = Math.min(1, this.blushBoost + 0.7);
          const v = window.YW.view;
          this.emitSparkles(s.x - v.cx, s.y - v.cy, 2, 10);
        }
      } else if (s.speed > 1.5) {
        this.heart.rough(Math.min(0.05, d * 0.0012));
      }
      this.onStroke(s);
    }

    pressFrame(info, dt) {
      this.heart.touch();
      this.pressing = true;
      if (info.dur < 1.6) {
        this.heart.gentle(0.09 * dt); // やさしく押されている
      } else if (info.dur > 2.2) {
        this.heart.rough(0.09 * dt);  // 押されすぎ
      }
      this.onPress(info, dt);
    }

    released(info) {
      this.pressing = false;
      this.onRelease(info);
    }

    multiTouch() {
      this.heart.rough(0.08);
    }

    // --- 各ローディングが好きに上書きする ---
    onTap() {}
    onRapid() {}
    onStroke() {}
    onPress() {}
    onRelease() {}
    subUpdate() {}
    subDraw() {}

    // --- 見た目 ---

    bodyColor(aMul) {
      const h = this.heart;
      let c = U.mixColor(BODY, COOL, U.clamp(h.stress, 0, 1));
      c = U.mixColor(c, WARM, U.clamp(h.joy * 0.8 + h.comfort * 0.25, 0, 1) * 0.6);
      const a = U.clamp((0.92 - h.fatigue * 0.28) * (aMul == null ? 1 : aMul), 0, 1);
      return U.rgba(c, a);
    }

    presence(t) {
      const h = this.heart;
      let alpha = 1, ox = 0, oy = 0, sx = 1, sy = 1;

      if (this.phase === 'enter') {
        const k = this.phaseT / 1.1;
        alpha = U.easeOutCubic(k);
        const s = 0.85 + 0.15 * U.easeOutBack(k);
        sx = sy = s;
        oy = (1 - U.easeOutCubic(k)) * 14;
      } else if (this.phase === 'exit') {
        const k = U.clamp(this.phaseT / 2.8, 0, 1);
        if (this.exitStyle === 'happy') {
          // 二回はねてから、ふわっと昇っていく
          if (this.phaseT < 0.9) {
            oy = -Math.abs(Math.sin(this.phaseT * Math.PI * 2.2)) * 16;
          } else {
            const k2 = (this.phaseT - 0.9) / 1.9;
            oy = -U.easeInCubic(k2) * 90;
            alpha = 1 - U.smooth(k2);
            sx = sy = 1 + k2 * 0.08;
          }
        } else if (this.exitStyle === 'sleepy') {
          const k2 = U.smooth(k);
          sx = sy = 1 - 0.22 * k2;
          oy = 10 * k2;
          alpha = 1 - k2;
        } else if (this.exitStyle === 'tired') {
          const k2 = U.smooth(k);
          oy = 22 * k2;
          sy = 1 - 0.18 * k2;
          sx = 1 + 0.06 * k2;
          alpha = 1 - k2;
        } else if (this.exitStyle === 'uneasy') {
          const k2 = U.smooth(k);
          ox = this.exitDir * 46 * k2;
          oy = 6 * k2;
          alpha = 1 - k2;
        } else { // calm
          const k2 = U.smooth(k);
          oy = -10 * k2;
          alpha = 1 - k2;
        }
      }

      // こわいと小さく震える
      const st = h.stress + h.wakeStartle * 0.4;
      ox += U.noise(t * 12.7 + 5) * st * 3.2;
      oy += U.noise(t * 14.3) * st * 3.2;

      // 疲れると沈み、眠いとゆっくり揺れる
      oy += h.fatigue * 7 + h.drowsy * 4;
      ox += Math.sin(t * 0.7) * h.drowsy * 2.5;

      // なつき・こっくり
      ox += this.lean;
      oy += this.nodY;
      const rot = this.wiggle.v * 0.12 + this.nodRot + this.lean * 0.006;

      // 呼吸。安心しているほど深くなる
      const b = 1 + Math.sin(this.breath) * (0.012 + h.comfort * 0.016);

      return { alpha: U.clamp(alpha, 0, 1), ox, oy, sx: sx * b, sy: sy * b, rot };
    }

    // 頬の赤らみの濃さ
    blushAlpha() {
      const h = this.heart;
      const base = U.clamp((h.comfort - 0.55) / 0.4, 0, 1) * 0.5 + h.joy * 0.45;
      return U.clamp((base + this.blushBoost * 0.6) * (1 - h.stress), 0, 1);
    }

    blushSpot(ctx, x, y, r, mul) {
      const a = (this._blushA || 0) * (mul == null ? 1 : mul);
      if (a < 0.03) return;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(236,130,132,' + (a * 0.5).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(236,130,132,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, U.TAU);
      ctx.fill();
    }

    _drawSparkles(ctx) {
      for (const s of this.sparkles) {
        const k = s.age / s.dur;
        const tw = 0.55 + 0.45 * Math.sin(s.ph + s.age * 14); // またたき
        const a = (1 - k) * tw;
        const r = s.size * (1 - k * 0.4);
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.ph + s.age * 1.5);
        ctx.fillStyle = 'rgba(255,241,205,' + (a * 0.9).toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0);
        ctx.quadraticCurveTo(r * 0.18, r * 0.18, 0, r);
        ctx.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0);
        ctx.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r);
        ctx.fill();
        ctx.restore();
      }
    }

    draw(ctx, cx, cy, t) {
      const pr = this.presence(t);
      if (pr.alpha <= 0.002) return;
      ctx.save();
      ctx.translate(cx + pr.ox, cy + pr.oy);

      // 足もとのほのかな影
      ctx.save();
      ctx.globalAlpha = pr.alpha * 0.1;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(0, 84, 62 * pr.sx, 9 * pr.sx, 0, 0, U.TAU);
      ctx.fill();
      ctx.restore();

      ctx.rotate(pr.rot);
      ctx.scale(pr.sx, pr.sy);
      ctx.globalAlpha = pr.alpha;
      this._blushA = this.blushAlpha();
      this.subDraw(ctx, t);
      this._drawSparkles(ctx);
      ctx.restore();
    }
  }

  /* ============================================================
   * スピナー — 丸く回りつづける
   * ============================================================ */
  class SpinnerLoader extends LoaderBase {
    constructor(heart) {
      super(heart);
      this.angle = U.rand(0, U.TAU);
      this.dir = 1;
      this.dizzy = 0;      // 目を回している
      this.confuse = 0;    // 逆になぞられて戸惑っている
      this.glow = 0;       // 気持ちよさ
      this.squash = new Spring(0, 60, 10);
      this.startle = new Spring(0, 140, 11);
      this.shineT = 0;
    }

    onTap() {
      this.startle.kick(-7);
      this.angle += U.rand(-0.25, 0.25);
    }

    onRapid() {
      this.dizzy = Math.min(1, this.dizzy + 0.45);
    }

    onStroke(s) {
      const v = window.YW.view;
      const dx = s.x - v.cx, dy = s.y - v.cy;
      const r = Math.hypot(dx, dy);
      if (r < 12 || r > 110) return;
      // リングの接線方向となぞりの向きを比べる
      const dot = s.dx * (-dy) + s.dy * dx;
      const along = dot * this.dir;
      if (along > 0 && s.speed < 0.7) {
        // 回転に寄り添うなぞり。気持ちいい。
        this.glow = Math.min(1, this.glow + 0.07);
        this.heart.gentle(0.012);
        this.shineT -= 1;
        if (this.shineT <= 0) {
          // 弧の先から、きらりとこぼれる
          this.shineT = 9;
          this.emitSparkles(Math.cos(this.angle) * 44, Math.sin(this.angle) * 44, 1, 4);
        }
      } else if (along < 0 && Math.abs(dot) > 60) {
        this.confuse = Math.min(1, this.confuse + 0.22);
      }
      if (s.speed > 1.8) this.dizzy = Math.min(1, this.dizzy + 0.06);
    }

    onPress(info) {
      this.squash.set(U.clamp((info.dur - 0.35) / 1.5, 0, 1));
    }

    onRelease() {
      this.squash.set(0);
    }

    subUpdate(dt, t) {
      this.dizzy = Math.max(0, this.dizzy - dt * 0.3);
      this.confuse = Math.max(0, this.confuse - dt * 0.7);
      this.glow = Math.max(0, this.glow - dt * 0.35);
      this.squash.update(dt);
      this.startle.update(dt);

      const h = this.heart;
      let sp = 2.1
        * (1 - h.comfort * 0.45)     // 安心するとゆっくりになる
        * (1 - h.drowsy * 0.6)
        * (1 - U.clamp(this.squash.v, 0, 1) * 0.85)
        * (1 - this.confuse * 0.65);
      sp += h.stress * Math.sin(t * 12) * 1.4;
      if (this.dizzy > 0) sp += Math.sin(t * 8.5) * this.dizzy * 4.5;
      this.angle += this.dir * sp * dt + Math.sin(t * 17) * this.confuse * 0.02;
    }

    subDraw(ctx, t) {
      const sq = U.clamp(this.squash.v, 0, 1);
      const st = 1 + this.startle.v * 0.12;

      if (this.dizzy > 0) {
        ctx.translate(Math.cos(t * 7.6) * 4 * this.dizzy, Math.sin(t * 8.2) * 3 * this.dizzy);
      }
      ctx.translate(0, sq * 22);
      ctx.scale((1 + sq * 0.38) * st, (1 - sq * 0.5) * st);

      const r = 42;
      const sweep = 4.3
        - this.heart.stress * 1.1
        - sq * 0.9
        + Math.sin(this.breath) * 0.15
        + this.glow * 0.4;

      const col = this.bodyColor();
      ctx.lineCap = 'round';
      ctx.strokeStyle = col;

      // うっすら全周
      ctx.save();
      ctx.globalAlpha *= 0.13;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, U.TAU);
      ctx.stroke();
      ctx.restore();

      const shine = this.glow * 0.7 + this.heart.joy * 0.5;
      if (shine > 0.03) {
        ctx.shadowColor = U.rgba(WARM, 0.8);
        ctx.shadowBlur = shine * 18;
      }
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(0, 0, r, this.angle, this.angle + sweep);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 頬。リングの下のほうが、ほんのり染まる
      this.blushSpot(ctx, -27, 29, 10);
      this.blushSpot(ctx, 27, 29, 10);
    }
  }

  /* ============================================================
   * 3つの点 — 順番に跳ねる
   * ============================================================ */
  class DotsLoader extends LoaderBase {
    constructor(heart) {
      super(heart);
      this.ph = U.rand(0, U.TAU);
      this.spacing = 37;
      this.groove = 0;      // リズムが合って楽しい
      this.tapTimes = [];
      this.pressIdx = -1;
      this.wavePend = [];   // なでられてのウェーブ
      this.waveCd = 0;
      this.dots = [0, 1, 2].map(() => ({
        hop: new Spring(0, 110, 9),
        stretch: new Spring(0, 70, 11),
        hide: 0,
        hideT: 0,
      }));
    }

    dotX(i) { return (i - 1) * this.spacing; }

    nearest(x) {
      const lx = x - window.YW.view.cx;
      let bi = -1, bd = 46;
      for (let i = 0; i < 3; i++) {
        const d = Math.abs(lx - this.dotX(i));
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }

    onTap(x) {
      const i = this.nearest(x);
      if (i >= 0) {
        this.dots[i].hop.kick(-260);
      } else {
        for (const d of this.dots) d.hop.kick(-70);
      }
      // リズムを感じ取る
      const now = performance.now() / 1000;
      this.tapTimes.push(now);
      this.tapTimes = this.tapTimes.filter((tt) => now - tt < 4).slice(-6);
      if (this.tapTimes.length >= 4) {
        const iv = [];
        for (let k = 1; k < this.tapTimes.length; k++) iv.push(this.tapTimes[k] - this.tapTimes[k - 1]);
        const mean = iv.reduce((a, b) => a + b, 0) / iv.length;
        const dev = Math.max.apply(null, iv.map((v) => Math.abs(v - mean)));
        if (mean > 0.25 && mean < 0.95 && dev < mean * 0.28) {
          if (this.groove < 0.4) this.emitSparkles(0, -16, 4, 40);
          this.groove = Math.min(1, this.groove + 0.55);
          this.heart.gentle(0.08);
        }
      }
    }

    onRapid() {
      // ひとつが隠れてしまう
      const i = (Math.random() * 3) | 0;
      this.dots[i].hideT = U.rand(2, 3.5);
      this.groove = 0;
      this.tapTimes.length = 0;
    }

    onStroke(s) {
      // やさしくなでられると、順番に小さく跳ねてこたえる
      if (s.speed < 0.5 && this.waveCd <= 0 && Math.abs(s.dx) > 1) {
        this.waveCd = 1.6;
        const order = s.dx > 0 ? [0, 1, 2] : [2, 1, 0];
        this.wavePend = order.map((idx, k) => ({ idx, delay: k * 0.09 }));
      }
    }

    onPress(info) {
      if (this.pressIdx < 0) this.pressIdx = this.nearest(info.x);
      if (this.pressIdx >= 0) {
        this.dots[this.pressIdx].stretch.set(U.clamp((info.dur - 0.4) / 1.3, 0, 1));
      }
    }

    onRelease() {
      if (this.pressIdx >= 0) this.dots[this.pressIdx].stretch.set(0);
      this.pressIdx = -1;
    }

    subUpdate(dt) {
      const h = this.heart;
      this.groove = Math.max(0, this.groove - dt * 0.1);
      const speed = 3.1
        * (1 - h.drowsy * 0.55)
        * (1 - h.fatigue * 0.3)
        * (1 + this.groove * 0.2);
      this.ph += dt * speed;
      // やさしくされると寄り添う
      this.spacing = U.damp(this.spacing, U.lerp(39, 26, h.comfort), 1.1, dt);
      this.waveCd = Math.max(0, this.waveCd - dt);
      for (let i = this.wavePend.length - 1; i >= 0; i--) {
        const w = this.wavePend[i];
        w.delay -= dt;
        if (w.delay <= 0) {
          this.dots[w.idx].hop.kick(-130);
          this.wavePend.splice(i, 1);
        }
      }
      for (const d of this.dots) {
        d.hop.update(dt);
        d.stretch.update(dt);
        d.hideT = Math.max(0, d.hideT - dt);
        d.hide = U.damp(d.hide, d.hideT > 0 ? 1 : 0, 6, dt);
      }
    }

    subDraw(ctx) {
      const h = this.heart;
      const amp = 12 * (1 - h.drowsy * 0.7) * (1 - h.fatigue * 0.45) * (1 + this.groove * 0.6);
      const rDot = 9;
      ctx.fillStyle = this.bodyColor();
      for (let i = 0; i < 3; i++) {
        const d = this.dots[i];
        const scale = 1 - d.hide;
        if (scale < 0.02) continue;
        // groove のときはそろって跳ねる
        const off = i * 0.62 * (1 - this.groove);
        const bounce = Math.max(0, Math.sin(this.ph - off)) * amp;
        const stretch = U.clamp(d.stretch.v, 0, 1);
        const rx = rDot * (1 - stretch * 0.32) * scale;
        const ry = rDot * (1 + stretch * 1.5) * scale;
        const x = this.dotX(i);
        let y = -bounce + d.hop.v + h.drowsy * 3 + d.hide * 12;
        y -= (ry - rDot); // 伸びても足もとは変えない
        ctx.save();
        ctx.globalAlpha *= (1 - d.hide * 0.85);
        if (h.joy > 0.35) {
          ctx.shadowColor = U.rgba(WARM, 0.7);
          ctx.shadowBlur = h.joy * 12;
        }
        ctx.beginPath();
        ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, U.TAU);
        ctx.fill();
        this.blushSpot(ctx, x, y + 3, rx * 1.1);
        ctx.restore();
      }
    }
  }

  /* ============================================================
   * プログレスバー — 進むふりをする
   * ============================================================ */
  class BarLoader extends LoaderBase {
    constructor(heart) {
      super(heart);
      this.fill = 0.14;
      this.target = 0.14;
      this.tremble = new Spring(0, 160, 6);
      this.pressBreath = 0;
      this.retreat = 0;
      this.w = 190;
    }

    onStroke(s) {
      const v = window.YW.view;
      if (Math.abs(s.y - v.cy) > 80) return;
      if (s.dx > 0) {
        // 進むふり。でも完了はしない。
        this.target = Math.min(0.86, this.target + s.dx * 0.0015);
      } else if (s.dx < 0) {
        this.target = Math.max(0.05, this.target + s.dx * 0.002);
        this.retreat = 1;
      }
      if (s.speed > 1.5) this.tremble.kick(90);
    }

    onTap() { this.tremble.kick(50); }
    onRapid() { this.tremble.kick(170); }

    onPress(info, dt) {
      this.pressBreath = Math.min(1, this.pressBreath + dt * 1.8);
    }

    subUpdate(dt) {
      if (!this.pressing) this.pressBreath = Math.max(0, this.pressBreath - dt * 0.7);
      this.tremble.update(dt);
      // ほんの少しずつ進むふりをして、そっと戻る
      this.target += dt * 0.0022;
      this.target = U.damp(this.target, 0.14 + this.heart.comfort * 0.12, 0.03, dt);
      this.fill = U.damp(this.fill, this.target, this.retreat > 0 ? 2.2 : 4.5, dt);
      this.retreat = Math.max(0, this.retreat - dt);
    }

    // 疲れると右のほうが垂れる
    _y(x, t) {
      const sag = this.heart.fatigue;
      const k = (x + this.w / 2) / this.w;
      let y = sag * 15 * k * k;
      y += U.noise(t * 26 + x * 0.05) * Math.abs(this.tremble.v) * 0.25;
      return y;
    }

    _path(ctx, frac, t) {
      const n = 24;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const x = -this.w / 2 + this.w * frac * (i / n);
        const y = this._y(x, t);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    }

    subDraw(ctx, t) {
      const h = this.heart;
      ctx.lineCap = 'round';
      // わく
      ctx.strokeStyle = this.bodyColor(0.2);
      ctx.lineWidth = 14;
      this._path(ctx, 1, t);
      ctx.stroke();
      // なかみ。やさしく押されると呼吸のように満ち引きする
      let f = this.fill
        + Math.sin(this.breath * 1.1) * 0.035 * this.pressBreath
        + Math.sin(this.breath) * 0.012 * h.comfort;
      f = U.clamp(f, 0.03, 0.88);
      if (h.joy > 0.35) {
        ctx.shadowColor = U.rgba(WARM, 0.7);
        ctx.shadowBlur = h.joy * 12;
      }
      ctx.strokeStyle = this.bodyColor();
      ctx.lineWidth = 9;
      this._path(ctx, f, t);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 頬。すすんだ先っぽのあたりが染まる
      const fx = -this.w / 2 + this.w * f;
      this.blushSpot(ctx, fx, this._y(fx, t), 9);
    }
  }

  /* ============================================================
   * スケルトンUI — 光を流す長方形たち
   * ============================================================ */
  class SkeletonLoader extends LoaderBase {
    constructor(heart) {
      super(heart);
      this.shimmerX = -1.4;   // -1.6 .. 1.6 くらいで流す
      this.chaseX = 0;
      this.chaseT = 0;
      this.radius = new Spring(6, 40, 10);
      this.jx = new Spring(0, 130, 7);
      this.jy = new Spring(0, 130, 7);
      this.glitch = 0;
    }

    onTap() {
      this.jx.kick(4);
      this.jy.kick(-4.5);
    }

    onRapid() {
      this.glitch = Math.min(1, this.glitch + 0.55);
    }

    onStroke(s) {
      this.chaseX = (s.x - window.YW.view.cx) / 130;
      this.chaseT = 0.5;
    }

    subUpdate(dt) {
      this.chaseT = Math.max(0, this.chaseT - dt);
      if (this.chaseT > 0) {
        // 光の帯が指についてくる
        this.shimmerX = U.damp(this.shimmerX, this.chaseX, 7, dt);
      } else {
        this.shimmerX += dt * 0.6 * (1 - this.heart.drowsy * 0.55);
        if (this.shimmerX > 1.7) this.shimmerX = -1.7;
      }
      this.glitch = Math.max(0, this.glitch - dt * 0.65);
      this.radius.set(6 + this.heart.comfort * 7); // やさしくされると角が丸くなる
      this.radius.update(dt);
      this.jx.update(dt);
      this.jy.update(dt);
    }

    _shapes() {
      return [
        { kind: 'circle', x: -72, y: -20, r: 17 },
        { kind: 'rect', x: -44, y: -32, w: 140, h: 13 },
        { kind: 'rect', x: -44, y: -13, w: 104, h: 13 },
        { kind: 'rect', x: -89, y: 13, w: 178, h: 13 },
      ];
    }

    _tracePath(ctx, s, rad) {
      if (s.kind === 'circle') {
        ctx.moveTo(s.x + s.r, s.y);
        ctx.arc(s.x, s.y, s.r, 0, U.TAU);
      } else {
        const r = Math.min(rad, s.h / 2);
        ctx.roundRect(s.x, s.y, s.w, s.h, r);
      }
    }

    subDraw(ctx, t) {
      const h = this.heart;
      ctx.scale(1 + this.jx.v * 0.1, 1 + this.jy.v * 0.1);
      const rad = Math.max(2, this.radius.v);
      const shapes = this._shapes();

      for (let i = 0; i < shapes.length; i++) {
        const s = shapes[i];
        ctx.save();
        // 乱暴にされると欠けたように揺らぐ
        if (this.glitch > 0.02) {
          const fl = U.noise(t * 21 + i * 7.3);
          if (fl < -0.25) ctx.globalAlpha *= 0.35;
          ctx.translate(U.noise(t * 33 + i * 3.1) * 2.4 * this.glitch, 0);
        }
        ctx.fillStyle = this.bodyColor(0.16);
        ctx.beginPath();
        this._tracePath(ctx, s, rad);
        ctx.fill();

        // 光の帯
        ctx.clip();
        const bx = this.shimmerX * 130;
        const g = ctx.createLinearGradient(bx - 55, 0, bx + 55, 14);
        const shine = (0.13 + h.joy * 0.1) * (1 - h.fatigue * 0.7);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(244,242,235,' + shine.toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-110, -50, 220, 100);
        ctx.restore();
      }

      // 頬。丸いところの下のほうが、ふんわり染まる
      this.blushSpot(ctx, -72, -10, 13, 0.55);
    }
  }

  /* ============================================================
   * 砂時計 — 砂がゆっくり落ちる
   * ============================================================ */
  class HourglassLoader extends LoaderBase {
    constructor(heart) {
      super(heart);
      this.hw = 32;   // 半分の幅
      this.hh = 58;   // 半分の高さ
      this.tilt = new Spring(0, 40, 8);
      this.tiltHold = 0;
      this.mound = 7;
      this.topJig = new Spring(0, 120, 8);
      this.clog = 0;
      this.prevClog = 0;
      this.spawnT = 0;
      this.parts = [];
    }

    _moundAt(x) {
      return this.mound * Math.exp(-(x * x) / (2 * 12 * 12));
    }

    onTap() {
      this.topJig.kick(-70);
      // 砂が少し跳ねる
      for (let k = 0; k < 4; k++) {
        this.parts.push({
          x: U.rand(-9, 9),
          y: this.hh - 6 - this._moundAt(0) * 0.5,
          vx: U.rand(-18, 18),
          vy: U.rand(-75, -30),
          pop: true,
        });
      }
    }

    onStroke(s) {
      // 傾けるようになぞると、流れが揺れる
      this.tilt.set(U.clamp(this.tilt.t + s.dx * 0.0012, -0.3, 0.3));
      this.tiltHold = 0.4;
    }

    onRapid() {
      this.clog = U.rand(1.2, 2.0); // 砂が詰まる
    }

    subUpdate(dt, t) {
      const h = this.heart;
      this.tiltHold = Math.max(0, this.tiltHold - dt);
      if (this.tiltHold <= 0) this.tilt.set(U.damp(this.tilt.t, 0, 2.5, dt));
      this.tilt.update(dt);
      this.topJig.update(dt);

      this.prevClog = this.clog;
      this.clog = Math.max(0, this.clog - dt);

      // 流れの太さ。疲れると細くなる
      const flow = this.clog > 0 ? 0 : (1 - h.fatigue * 0.6) * (1 - h.drowsy * 0.45);
      this.spawnT -= dt;
      if (flow > 0.05 && this.spawnT <= 0) {
        this.spawnT = 0.05 / Math.max(0.2, flow);
        this.parts.push({
          x: U.rand(-1.6, 1.6), y: 2,
          vx: U.rand(-3, 3), vy: 22,
          pop: false,
        });
      }
      // 詰まりがほどけた瞬間、どっと落ちる
      if (this.prevClog > 0 && this.clog <= 0) {
        for (let k = 0; k < 8; k++) {
          this.parts.push({
            x: U.rand(-2.5, 2.5), y: U.rand(0, 6),
            vx: U.rand(-6, 6), vy: U.rand(25, 60),
            pop: false,
          });
        }
      }

      const G = 250;
      const ax = -Math.sin(this.tilt.v) * G * 0.4;
      const ay = Math.cos(this.tilt.v) * G;
      const floor = this.hh - 5;
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.vx += ax * dt;
        p.vy += ay * dt;
        p.x += p.vx * dt + U.noise(t * 6 + i) * 12 * dt;
        p.y += p.vy * dt;
        if (p.y >= floor - this._moundAt(p.x)) {
          if (!p.pop) this.mound = Math.min(15, this.mound + 0.05);
          this.parts.splice(i, 1);
        }
      }
      if (this.parts.length > 160) this.parts.splice(0, this.parts.length - 160);

      // 山はゆっくり沈む(砂は尽きない)
      this.mound = Math.max(5, this.mound - dt * 0.12);
    }

    subDraw(ctx, t) {
      const h = this.heart;
      const hw = this.hw, hh = this.hh;
      ctx.rotate(this.tilt.v);
      if (this.clog > 0) {
        ctx.translate(U.noise(t * 28) * 2 * Math.min(1, this.clog), 0);
      }

      const sand = U.mixColor([226, 214, 188], COOL, h.stress * 0.5);
      const sandCol = U.rgba(sand, 0.9 - h.fatigue * 0.2);

      // 上の砂。触られると表面が揺れる
      const jig = this.topJig.v * 0.4;
      const level = -hh * 0.42;
      ctx.fillStyle = sandCol;
      ctx.beginPath();
      const nTop = 14;
      for (let i = 0; i <= nTop; i++) {
        const yy = U.lerp(level, -3, i / nTop);
        const k = U.clamp((-yy) / hh, 0, 1);
        const w = U.lerp(2.5, hw - 7, Math.pow(k, 1.15));
        const ripple = (i === 0) ? jig + U.noise(t * 3) * 0.8 : 0;
        if (i === 0) ctx.moveTo(-w, yy + ripple);
        else ctx.lineTo(-w, yy);
      }
      for (let i = nTop; i >= 0; i--) {
        const yy = U.lerp(level, -3, i / nTop);
        const k = U.clamp((-yy) / hh, 0, 1);
        const w = U.lerp(2.5, hw - 7, Math.pow(k, 1.15));
        const ripple = (i === 0) ? jig + U.noise(t * 3 + 4) * 0.8 : 0;
        ctx.lineTo(w, yy + ripple);
      }
      ctx.closePath();
      ctx.fill();

      // 下の山
      ctx.beginPath();
      const nB = 20;
      ctx.moveTo(-hw + 7, hh - 5);
      for (let i = 0; i <= nB; i++) {
        const x = U.lerp(-hw + 7, hw - 7, i / nB);
        ctx.lineTo(x, hh - 5 - this._moundAt(x));
      }
      ctx.lineTo(hw - 7, hh - 5);
      ctx.closePath();
      ctx.fill();

      // 落ちる砂つぶ
      for (const p of this.parts) {
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      }
      // 詰まっている砂
      if (this.clog > 0) {
        for (let k = 0; k < 5; k++) {
          ctx.fillRect(U.noise(k * 9.7) * 4 - 1, -2 + k * 1.6, 2.2, 2.2);
        }
      }

      // ガラス
      ctx.strokeStyle = this.bodyColor(0.85);
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-hw, -hh);
      ctx.lineTo(hw, -hh);
      ctx.moveTo(-hw, hh);
      ctx.lineTo(hw, hh);
      ctx.moveTo(-hw + 4, -hh);
      ctx.bezierCurveTo(-hw + 4, -hh * 0.35, -4, -hh * 0.22, -3.5, 0);
      ctx.bezierCurveTo(-4, hh * 0.22, -hw + 4, hh * 0.35, -hw + 4, hh);
      ctx.moveTo(hw - 4, -hh);
      ctx.bezierCurveTo(hw - 4, -hh * 0.35, 4, -hh * 0.22, 3.5, 0);
      ctx.bezierCurveTo(4, hh * 0.22, hw - 4, hh * 0.35, hw - 4, hh);
      ctx.stroke();

      // 頬。上のふくらみが染まる
      this.blushSpot(ctx, -hw * 0.42, -hh * 0.48, 7);
      this.blushSpot(ctx, hw * 0.42, -hh * 0.48, 7);
    }
  }

  window.YW.loaderKinds = [
    SpinnerLoader,
    DotsLoader,
    BarLoader,
    SkeletonLoader,
    HourglassLoader,
  ];
})();
