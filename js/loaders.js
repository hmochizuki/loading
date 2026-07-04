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
      this.nature = heart.nature;
      this.phase = 'enter';
      this.phaseT = 0;
      this.age = 0;
      this.life = U.rand(36, 58);
      this.done = false;
      this.exitStyle = 'calm';
      this.exitDir = Math.random() < 0.5 ? -1 : 1;
      this.breath = U.rand(0, U.TAU);
      this.pressing = false;
      this.home = { x: 0, y: 0 }; // 画面中央からのずれ。旅をする子が使う

      this.sparkles = [];
      this.wiggle = new Spring(0, 60, 6);   // ごきげんな身震い
      this.mannerT = U.rand(5, 9) / this.nature.liveliness;
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
      this.breath += dt * (1.4 - this.heart.drowsy * 0.6 + this.heart.stress * 0.8)
        * (0.8 + this.nature.liveliness * 0.2);

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
          this.mannerT = U.rand(4, 8) / this.nature.liveliness;
          this.wiggle.kick(U.rand(2.2, 3.2) * (Math.random() < 0.5 ? -1 : 1));
          this.joyBurst(0, -18, 4);
        }
      }
      this.wiggle.update(dt);

      // なつき: なついた子は指のほうへ寄り、
      // 臆病な子はなつくまで、目をそらすように少し離れる
      const ptr = window.YW.view.pointer;
      let leanTarget = 0;
      if (ptr && t - ptr.t < 1.2 && this.phase === 'live') {
        const toward = U.clamp((ptr.x - window.YW.view.cx - this.home.x) * 0.045, -8, 8);
        const affinity = h.comfort - 0.3 - this.nature.shy * 0.35;
        if (affinity > 0) {
          leanTarget = toward * Math.min(1, affinity * 2.5) * (0.5 + h.comfort * 0.5);
        } else {
          leanTarget = -U.clamp(toward, -4, 4) * Math.min(1, -affinity * 3);
        }
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
          this.sparkleT = 0.18;
          this.joyBurst(U.rand(-28, 28), U.rand(-40, 0), 2);
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

    // うれしさのこぼれ方。それぞれのローディングが自分の流儀で上書きする
    joyBurst(x, y, n) {
      this.emitSparkles(x, y, n, 20);
    }

    // 行き先が画面からはみ出さないように
    clampTarget(tx, ty, marginX, marginY) {
      const v = window.YW.view;
      const mx = Math.max(60, v.w / 2 - marginX);
      const my = Math.max(60, v.h / 2 - marginY);
      return { x: U.clamp(tx, -mx, mx), y: U.clamp(ty, -my, my) };
    }

    // からだの見えなさ。とけて移動する子が上書きする(影も一緒に薄くなる)
    bodyAlpha() { return 1; }

    // --- こころへの共通の流し込み。main から呼ばれる ---

    tapAt(x, y) {
      this.heart.touch();
      // 小さくびくっ。臆病な子ほど大きい
      this.heart.stress = Math.min(1, this.heart.stress + 0.03 * (0.6 + this.nature.shy * 0.8));
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
          this.joyBurst(s.x - v.cx - this.home.x, s.y - v.cy - this.home.y, 2);
        }
      } else if (s.speed > 1.5) {
        this.heart.rough(Math.min(0.05, d * 0.0012));
      }
      this.onStroke(s);
    }

    pressFrame(info, dt) {
      this.heart.touch();
      this.pressing = true;
      const h = this.heart;
      if (!this._pressSeen) {
        this._pressSeen = true;
        this._lullMode = h.drowsy > 0.35; // 眠い子への長い静かな重みは、寝かしつけになる
        this.lull = 0;
      }
      if (this._lullMode) {
        this.lull += dt;
        // 触れられて目が覚めるぶんを打ち消して、ゆっくり深く眠っていく
        h.drowsy = Math.min(1, h.drowsy + dt * 0.62);
        h.comfort = Math.min(1, h.comfort + dt * 0.05);
        if (this.lull > 3 && this.phase === 'live') {
          this.phase = 'exit';
          this.phaseT = 0;
          this.exitStyle = 'sleepy'; // 手のなかで、眠りに落ちた
        }
      } else if (info.dur < 1.6) {
        h.gentle(0.09 * dt); // やさしく押されている
      } else if (info.dur > 2.2) {
        h.rough(0.09 * dt);  // 押されすぎ
      }
      this.onPress(info, dt);
    }

    released(info) {
      this.pressing = false;
      this._pressSeen = false;
      this._lullMode = false;
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
      if (this.nature.gold) c = U.mixColor(c, [242, 214, 150], 0.45); // 金いろの子
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
          // 二回はねてから、ふわっと昇っていく。はねは徐々に小さく
          const hopFade = U.clamp(1 - U.smooth((this.phaseT - 0.55) / 0.5), 0, 1);
          oy = -Math.abs(Math.sin(this.phaseT * Math.PI * 2.2)) * 16 * hopFade;
          if (this.phaseT > 0.9) {
            const k2 = (this.phaseT - 0.9) / 1.9;
            oy += -U.easeInCubic(k2) * 90;
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
      const b = (1 + Math.sin(this.breath) * (0.012 + h.comfort * 0.016)) * this.nature.size;

      return { alpha: U.clamp(alpha, 0, 1), ox, oy, sx: sx * b, sy: sy * b, rot };
    }

    // 頬の赤らみの濃さ。人懐こい子は赤らみやすい
    blushAlpha() {
      const h = this.heart;
      const th = 0.62 - this.nature.warmth * 0.12;
      const base = U.clamp((h.comfort - th) / 0.4, 0, 1) * 0.5 + h.joy * 0.45;
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
      ctx.translate(cx + pr.ox + this.home.x, cy + pr.oy + this.home.y);

      // 足もとのほのかな影
      ctx.save();
      ctx.globalAlpha = pr.alpha * 0.1 * this.bodyAlpha();
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
      this.shines = [];      // 弧を走る光
      this.mode = 'ring';    // 'ring' | 'snake' | 'coil'
      this.trail = null;     // 旅のからだ。中央基準の絶対座標
      this.target = null;
      this.headDir = 0;
      this.wigglePh = 0;
      this.wiggleAmp = 0;
      this.travelSpeed = 0;
      this.coilAng = 0;
      this.coilTurned = 0;
      this.settle = false;
    }

    // うれしさは、弧を走る光になる
    joyBurst(x, y, n) {
      for (let i = 0; i < Math.min(3, n) && this.shines.length < 8; i++) {
        this.shines.push({
          base: this.angle + U.rand(0, 1.5),
          speed: U.rand(2.5, 4.5),
          age: 0,
          dur: U.rand(0.6, 1.0),
        });
      }
    }

    onTap(x, y) {
      const v = window.YW.view;
      const tx = x - v.cx, ty = y - v.cy;
      if (this.mode === 'snake') {
        // 旅の途中で呼び直された。行き先を変える
        this._setTarget(tx, ty);
        return;
      }
      if (this.mode === 'coil') return;
      const lx = tx - this.home.x, ly = ty - this.home.y;
      if (Math.hypot(lx, ly) > 115) {
        // 離れたところから呼ばれた。ほどけて、会いにいく
        this._startSnake(tx, ty);
        return;
      }
      this.startle.kick(-7 * (0.7 + this.nature.shy * 0.6));
      this.angle += U.rand(-0.25, 0.25);
    }

    _setTarget(tx, ty) {
      this.target = this.clampTarget(tx, ty, 70, 90);
    }

    _startSnake(tx, ty) {
      const h = this.heart;
      // いまの弧のかたちのまま、からだにする
      const sweep = 4.3;
      const n = 30;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = this.angle + sweep - (i / (n - 1)) * sweep;
        pts.push({
          x: this.home.x + Math.cos(a) * 42,
          y: this.home.y + Math.sin(a) * 42,
        });
      }
      this.trail = pts;
      this.mode = 'snake';
      this.settle = false;
      this.headDir = Math.atan2(ty - pts[0].y, tx - pts[0].x);
      this.wigglePh = U.rand(0, U.TAU);
      this._setTarget(tx, ty);
      // 気分と性格で、旅の仕方が変わる
      const playful = U.clamp(h.comfort * 0.6 + h.joy * 0.6, 0, 1);
      this.wiggleAmp = h.stress > 0.45
        ? U.rand(0.05, 0.15)                  // こわいときは、まっすぐ急ぐ
        : U.rand(0.3, 0.6) + playful * 0.5;   // ごきげんなときは、くねくねと
      this.travelSpeed = (h.stress > 0.45 ? 230 : 150)
        * (0.8 + this.nature.liveliness * 0.3);
      h.touch();
    }

    _pushHead(nx, ny) {
      this.trail.unshift({ x: nx, y: ny });
      // からだの長さ(弧の長さぶん)を保つ
      let len = 0;
      for (let i = 1; i < this.trail.length; i++) {
        len += Math.hypot(this.trail[i].x - this.trail[i - 1].x, this.trail[i].y - this.trail[i - 1].y);
        if (len > 180) {
          this.trail.length = i + 1;
          break;
        }
      }
    }

    onRapid() {
      this.dizzy = Math.min(1, this.dizzy + 0.45);
    }

    onStroke(s) {
      if (this.mode !== 'ring') return;
      const v = window.YW.view;
      const dx = s.x - v.cx - this.home.x, dy = s.y - v.cy - this.home.y;
      const r = Math.hypot(dx, dy);
      if (r < 12 || r > 110) return;
      // リングの接線方向となぞりの向きを比べる。
      // イベントの回数でなく、なぞった距離で効かせる
      const dist = Math.min(40, Math.hypot(s.dx, s.dy));
      const dot = s.dx * (-dy) + s.dy * dx;
      const along = dot * this.dir;
      if (along > 0 && s.speed < 0.7) {
        // 回転に寄り添うなぞり。気持ちいい。
        this.glow = Math.min(1, this.glow + Math.min(0.07, dist * 0.014));
        this.heart.gentle(Math.min(0.012, dist * 0.0024));
        this.shineT -= dist;
        if (this.shineT <= 0) {
          // きらりと光が弧を走る
          this.shineT = 45;
          this.joyBurst(0, 0, 1);
        }
      } else if (along < 0 && Math.abs(dot) > 60) {
        this.confuse = Math.min(1, this.confuse + Math.min(0.2, dist * 0.04));
      }
      if (s.speed > 1.8) this.dizzy = Math.min(1, this.dizzy + Math.min(0.06, dist * 0.003));
    }

    onPress(info) {
      if (this.mode !== 'ring') return;
      this.squash.set(U.clamp((info.dur - 0.35) / 1.5, 0, 1));
    }

    onRelease() {
      this.squash.set(0);
    }

    subUpdate(dt, t) {
      for (let i = this.shines.length - 1; i >= 0; i--) {
        this.shines[i].age += dt;
        if (this.shines[i].age > this.shines[i].dur) this.shines.splice(i, 1);
      }

      if (this.mode === 'snake') {
        const head = this.trail[0];
        const want = Math.atan2(this.target.y - head.y, this.target.x - head.x);
        this.headDir += U.angNorm(want - this.headDir) * Math.min(1, dt * 4);
        this.wigglePh += dt * 7;
        const distT = Math.hypot(this.target.x - head.x, this.target.y - head.y);
        // 近づいたら、くねりをおさめる
        const wig = Math.sin(this.wigglePh) * this.wiggleAmp * U.clamp((distT - 60) / 120, 0, 1);
        const dirA = this.headDir + wig;
        const step = this.travelSpeed * dt;
        this._pushHead(head.x + Math.cos(dirA) * step, head.y + Math.sin(dirA) * step);
        if (distT < 48) {
          this.mode = 'coil';
          this.coilAng = Math.atan2(head.y - this.target.y, head.x - this.target.x);
          this.coilTurned = 0;
        }
      } else if (this.mode === 'coil') {
        // 頭から、目的地の輪に巻きついていく
        const w = (this.travelSpeed / 42) * dt;
        this.coilAng += w * this.dir;
        this.coilTurned += w;
        this._pushHead(
          this.target.x + Math.cos(this.coilAng) * 42,
          this.target.y + Math.sin(this.coilAng) * 42
        );
        if (this.coilTurned > 4.6) {
          // からだが輪にもどった
          this.mode = 'ring';
          this.angle = this.coilAng - 4.3 * this.dir;
          this.trail = null;
          this.settle = true;
        }
      }

      if (this.trail) {
        // 影と存在の中心は、からだの真ん中を追いかける
        const mid = this.trail[(this.trail.length / 2) | 0];
        this.home.x = U.damp(this.home.x, mid.x, 6, dt);
        this.home.y = U.damp(this.home.y, mid.y, 6, dt);
      } else if (this.settle) {
        this.home.x = U.damp(this.home.x, this.target.x, 8, dt);
        this.home.y = U.damp(this.home.y, this.target.y, 8, dt);
        if (Math.hypot(this.home.x - this.target.x, this.home.y - this.target.y) < 0.4) {
          this.settle = false;
        }
      }

      this.dizzy = Math.max(0, this.dizzy - dt * 0.3);
      this.confuse = Math.max(0, this.confuse - dt * 0.7);
      this.glow = Math.max(0, this.glow - dt * 0.35);
      this.squash.update(dt);
      this.startle.update(dt);

      const h = this.heart;
      let sp = 2.1
        * (0.8 + this.nature.liveliness * 0.2)
        * (1 - h.comfort * 0.45)     // 安心するとゆっくりになる
        * (1 - h.drowsy * 0.6)
        * (1 - U.clamp(this.squash.v, 0, 1) * 0.85)
        * (1 - this.confuse * 0.65);
      sp += h.stress * Math.sin(t * 12) * 1.4;
      if (this.dizzy > 0) sp += Math.sin(t * 8.5) * this.dizzy * 4.5;
      this.angle += this.dir * sp * dt + Math.sin(t * 17) * this.confuse * 0.02;
    }

    subDraw(ctx, t) {
      const col0 = this.bodyColor();
      if (this.trail) {
        // ほどけて、うねりながら旅をする
        ctx.strokeStyle = col0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 10;
        ctx.beginPath();
        for (let i = 0; i < this.trail.length; i++) {
          const p = this.trail[i];
          const x = p.x - this.home.x, y = p.y - this.home.y;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        return;
      }
      if (this.settle) {
        // 巻き直した直後。影が追いつくまで、輪は目的地に留まる
        ctx.translate(this.target.x - this.home.x, this.target.y - this.home.y);
      }

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

      // うれしさの光が、弧を走り抜ける
      for (const sh of this.shines) {
        const k = sh.age / sh.dur;
        const a0 = sh.base + sh.age * sh.speed * this.dir;
        ctx.save();
        ctx.globalAlpha *= (1 - k) * 0.85;
        ctx.strokeStyle = U.rgba(WARM, 1);
        ctx.shadowColor = U.rgba(WARM, 0.9);
        ctx.shadowBlur = 10;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(0, 0, r, a0, a0 + 0.22);
        ctx.stroke();
        ctx.restore();
      }

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
      this.crumbs = [];     // うれしくて跳ねる、点の子たち
      this.stroll = null;   // 小走りの行き先
      this.dots = [0, 1, 2].map(() => ({
        hop: new Spring(0, 110, 9),
        stretch: new Spring(0, 70, 11),
        hide: 0,
        hideT: 0,
      }));
    }

    // うれしさは、小さな点になって跳ねまわる
    joyBurst(x, y, n) {
      for (let i = 0; i < n + 1 && this.crumbs.length < 24; i++) {
        this.crumbs.push({
          x: U.clamp(x, -50, 50) + U.rand(-18, 18),
          y: -4,
          vx: U.rand(-28, 28),
          vy: U.rand(-95, -40),
          r: U.rand(1.8, 3.2),
          age: 0,
          dur: U.rand(0.9, 1.4),
        });
      }
    }

    dotX(i) { return (i - 1) * this.spacing; }

    nearest(x) {
      const lx = x - window.YW.view.cx - this.home.x;
      let bi = -1, bd = 46;
      for (let i = 0; i < 3; i++) {
        const d = Math.abs(lx - this.dotX(i));
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    }

    onTap(x, y) {
      const v = window.YW.view;
      const tx = x - v.cx, ty = y - v.cy;
      if (Math.hypot(tx - this.home.x, ty - this.home.y) > 110) {
        // 離れたところから呼ばれた。ぴょんぴょん小走りでかけていく
        this.stroll = this.clampTarget(tx, ty, 110, 80);
        this.heart.touch();
        return;
      }
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
          if (this.groove < 0.4) this.joyBurst(0, -16, 4);
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
      let speed = 3.1
        * (0.8 + this.nature.liveliness * 0.2)
        * (1 - h.drowsy * 0.55)
        * (1 - h.fatigue * 0.3)
        * (1 + this.groove * 0.2);

      if (this.stroll) {
        // 小走り。跳ねを速めて、みんなで寄り添って向かう
        speed *= 2.4;
        const dx = this.stroll.x - this.home.x, dy = this.stroll.y - this.home.y;
        const d = Math.hypot(dx, dy);
        const sp = 120 * (0.8 + this.nature.liveliness * 0.3) * (h.stress > 0.45 ? 1.5 : 1);
        if (d < 4) {
          this.stroll = null;
          this.joyBurst(0, -8, 2);
          for (const dd of this.dots) dd.hop.kick(-90); // 着いた、のひと跳ね
        } else {
          const step = Math.min(d, sp * dt);
          this.home.x += (dx / d) * step;
          this.home.y += (dy / d) * step;
        }
      }
      this.ph += dt * speed;
      // やさしくされると寄り添う。小走り中も寄り添う
      const near = this.stroll ? 22 : U.lerp(39, 26, h.comfort);
      this.spacing = U.damp(this.spacing, near, this.stroll ? 4 : 1.1, dt);
      // 点の子たちは、小さく弾んで消えていく
      for (let i = this.crumbs.length - 1; i >= 0; i--) {
        const c = this.crumbs[i];
        c.age += dt;
        c.vy += 320 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.y > 4 && c.vy > 0) {
          c.y = 4;
          c.vy *= -0.45;
          c.vx *= 0.8;
        }
        if (c.age > c.dur) this.crumbs.splice(i, 1);
      }
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
      const amp = 12 * (0.8 + this.nature.liveliness * 0.2)
        * (1 - h.drowsy * 0.7) * (1 - h.fatigue * 0.45) * (1 + this.groove * 0.6);
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

      for (const c of this.crumbs) {
        const k = c.age / c.dur;
        ctx.save();
        ctx.globalAlpha *= (1 - k) * 0.85;
        ctx.fillStyle = U.rgba(WARM, 1);
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r * (1 - k * 0.3), 0, U.TAU);
        ctx.fill();
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
      this.pulses = [];   // うれしさが端から端へ走る光
      this.trip = null;   // 尺取り虫の行き先
      this.tripPh = 0;
      this.stretchNow = 0;
      this.tiltNow = 0;
    }

    // うれしさは、バーを走り抜ける光になる
    joyBurst() {
      if (this.pulses.length < 4) this.pulses.push({ p: -0.08 });
    }

    onStroke(s) {
      if (this.trip) return;
      const v = window.YW.view;
      if (Math.abs(s.y - v.cy - this.home.y) > 80) return;
      if (s.dx > 0) {
        // 進むふり。でも完了はしない。
        this.target = Math.min(0.86, this.target + s.dx * 0.0015);
      } else if (s.dx < 0) {
        this.target = Math.max(0.05, this.target + s.dx * 0.002);
        this.retreat = 1;
      }
      if (s.speed > 1.5) this.tremble.kick(90);
    }

    onTap(x, y) {
      const v = window.YW.view;
      const tx = x - v.cx, ty = y - v.cy;
      if (Math.hypot(tx - this.home.x, ty - this.home.y) > 150) {
        // 離れたところから呼ばれた。尺取り虫のように、伸びては縮んで向かう
        this.trip = this.clampTarget(tx, ty, 115, 60);
        this.tripPh = 0;
        this.heart.touch();
        return;
      }
      this.tremble.kick(50);
    }

    onRapid() { this.tremble.kick(170); }

    onPress(info, dt) {
      this.pressBreath = Math.min(1, this.pressBreath + dt * 1.8);
    }

    subUpdate(dt) {
      if (!this.pressing) this.pressBreath = Math.max(0, this.pressBreath - dt * 0.7);
      this.tremble.update(dt);
      // ほんの少しずつ進むふりをして、そっと戻る
      this.target += dt * 0.0022 * (0.7 + this.nature.liveliness * 0.6);
      this.target = U.damp(this.target, 0.14 + this.heart.comfort * 0.12, 0.03, dt);
      this.fill = U.damp(this.fill, this.target, this.retreat > 0 ? 2.2 : 4.5, dt);
      this.retreat = Math.max(0, this.retreat - dt);

      if (this.trip) {
        // 尺取り虫: 縮んでいるあいだに進み、伸びてひと休み
        this.tripPh += dt * 5.2;
        const shrink = (1 - Math.cos(this.tripPh)) / 2; // 0..1 縮み具合
        this.stretchNow = U.damp(this.stretchNow, -shrink * 0.22, 10, dt);
        const dx = this.trip.x - this.home.x, dy = this.trip.y - this.home.y;
        const d = Math.hypot(dx, dy);
        const sp = 105 * (0.8 + this.nature.liveliness * 0.3)
          * (0.15 + shrink) * (this.heart.stress > 0.45 ? 1.5 : 1);
        if (d < 5) {
          this.trip = null;
          this.joyBurst();
        } else {
          const step = Math.min(d, sp * dt);
          this.home.x += (dx / d) * step;
          this.home.y += (dy / d) * step;
        }
        // 行き先へ、ほんの少し首をかしげる
        const want = U.clamp(Math.atan2(dy, Math.abs(dx) + 60), -0.3, 0.3);
        this.tiltNow = U.damp(this.tiltNow, want, 4, dt);
      } else {
        this.stretchNow = U.damp(this.stretchNow, 0, 6, dt);
        this.tiltNow = U.damp(this.tiltNow, 0, 4, dt);
      }

      for (let i = this.pulses.length - 1; i >= 0; i--) {
        this.pulses[i].p += dt * 1.5;
        if (this.pulses[i].p > 1.1) this.pulses.splice(i, 1);
      }
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
      // 尺取り虫の伸び縮みと、首のかしげ
      ctx.rotate(this.tiltNow);
      ctx.scale(1 + this.stretchNow, 1 - this.stretchNow * 0.6);
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

      // うれしさの光が、端から端へ走る
      for (const pu of this.pulses) {
        const a = 0.5 * Math.sin(Math.PI * U.clamp(pu.p, 0, 1));
        if (a <= 0.01) continue;
        const f0 = U.clamp(pu.p - 0.07, 0, 1);
        const f1 = U.clamp(pu.p + 0.07, 0, 1);
        if (f1 - f0 < 0.01) continue;
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.strokeStyle = U.rgba(WARM, 1);
        ctx.shadowColor = U.rgba(WARM, 0.9);
        ctx.shadowBlur = 9;
        ctx.lineWidth = 9;
        const n = 8;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const x = -this.w / 2 + this.w * U.lerp(f0, f1, i / n);
          const y = this._y(x, t);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

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
      this.joyBands = [];   // うれしさの一閃
      this.tele = null;     // とけて、あちらに現れる
    }

    // うれしさは、速い光の帯になって駆け抜ける
    joyBurst() {
      if (this.joyBands.length < 3) this.joyBands.push({ x: -1.9 });
    }

    // まだ形の定まらないものだから、とけるように移動する
    bodyAlpha() {
      if (!this.tele) return 1;
      const k = this.tele.t;
      if (k < 0.5) return 1 - U.smooth(k / 0.5);
      return U.smooth((k - 0.6) / 0.6);
    }

    onTap(x, y) {
      const v = window.YW.view;
      const tx = x - v.cx, ty = y - v.cy;
      if (!this.tele && Math.hypot(tx - this.home.x, ty - this.home.y) > 150) {
        // 離れたところから呼ばれた。輪郭をほどいて、そちらで結び直す
        this.tele = { t: 0, to: this.clampTarget(tx, ty, 120, 70), moved: false };
        this.heart.touch();
        return;
      }
      this.jx.kick(4);
      this.jy.kick(-4.5);
    }

    onRapid() {
      this.glitch = Math.min(1, this.glitch + 0.55);
    }

    onStroke(s) {
      this.chaseX = (s.x - window.YW.view.cx - this.home.x) / 130;
      this.chaseT = 0.5;
    }

    subUpdate(dt) {
      this.chaseT = Math.max(0, this.chaseT - dt);
      if (this.chaseT > 0) {
        // 光の帯が指についてくる
        this.shimmerX = U.damp(this.shimmerX, this.chaseX, 7, dt);
      } else {
        this.shimmerX += dt * 0.6 * (0.8 + this.nature.liveliness * 0.2) * (1 - this.heart.drowsy * 0.55);
        if (this.shimmerX > 1.7) this.shimmerX = -1.7;
      }
      if (this.tele) {
        this.tele.t += dt;
        // とけているあいだは、輪郭が少し揺らぐ
        this.glitch = Math.max(this.glitch, (1 - this.bodyAlpha()) * 0.5);
        if (!this.tele.moved && this.tele.t >= 0.55) {
          this.home.x = this.tele.to.x;
          this.home.y = this.tele.to.y;
          this.tele.moved = true;
        }
        if (this.tele.t > 1.2) {
          this.tele = null;
          this.joyBurst(); // 結び直せた、の一閃
        }
      }
      this.glitch = Math.max(0, this.glitch - dt * 0.65);
      for (let i = this.joyBands.length - 1; i >= 0; i--) {
        this.joyBands[i].x += dt * 3.4;
        if (this.joyBands[i].x > 2.1) this.joyBands.splice(i, 1);
      }
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
      const ba = this.bodyAlpha();
      if (ba <= 0.004) return;
      ctx.globalAlpha *= ba;
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

        // うれしさの一閃
        for (const jb of this.joyBands) {
          const jx = jb.x * 130;
          const jg = ctx.createLinearGradient(jx - 30, 0, jx + 30, 8);
          jg.addColorStop(0, 'rgba(255,244,214,0)');
          jg.addColorStop(0.5, 'rgba(255,244,214,0.24)');
          jg.addColorStop(1, 'rgba(255,244,214,0)');
          ctx.fillStyle = jg;
          ctx.fillRect(-110, -50, 220, 100);
        }
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
      this.roll = null;    // ころんと転がる旅
      this.rotBody = 0;    // 転がりの回転
    }

    _moundAt(x) {
      return this.mound * Math.exp(-(x * x) / (2 * 12 * 12));
    }

    // うれしさは、金色の砂になって舞い上がる
    joyBurst(x, y, n) {
      for (let k = 0; k < n + 2 && this.parts.length < 160; k++) {
        this.parts.push({
          x: U.rand(-10, 10),
          y: this.hh - 6 - this._moundAt(0) * 0.6,
          vx: U.rand(-16, 16),
          vy: U.rand(-85, -35),
          pop: true,
          gold: true,
        });
      }
    }

    onTap(x, y) {
      const v = window.YW.view;
      const tx = x - v.cx, ty = y - v.cy;
      if (!this.roll && Math.hypot(tx - this.home.x, ty - this.home.y) > 130) {
        // 離れたところから呼ばれた。ころんと倒れて、転がっていく
        this.roll = {
          phase: 'tip',
          t: 0,
          to: this.clampTarget(tx, ty, 80, 110),
          dir: Math.sign(tx - this.home.x) || 1,
        };
        this.heart.touch();
        return;
      }
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
      if (this.roll) return;
      // 傾けるようになぞると、流れが揺れる
      this.tilt.set(U.clamp(this.tilt.t + s.dx * 0.0012, -0.3, 0.3));
      this.tiltHold = 0.4;
    }

    onRapid() {
      this.clog = U.rand(1.2, 2.0); // 砂が詰まる
    }

    subUpdate(dt, t) {
      const h = this.heart;

      if (this.roll) {
        const r = this.roll;
        r.t += dt;
        if (r.phase === 'tip') {
          // ころん、と横になる
          this.rotBody = U.easeOutBack(r.t / 0.45) * (Math.PI / 2) * r.dir;
          if (r.t >= 0.45) { r.phase = 'go'; r.t = 0; }
        } else if (r.phase === 'go') {
          const dx = r.to.x - this.home.x, dy = r.to.y - this.home.y;
          const d = Math.hypot(dx, dy);
          const sp = 140 * (0.8 + this.nature.liveliness * 0.3);
          if (d < 6) {
            r.phase = 'stand';
            r.t = 0;
            r.from = this.rotBody;
            // いちばん近い「起きた向き」まで、少し余分に転がって立つ
            r.upright = Math.ceil((this.rotBody * r.dir) / U.TAU) * U.TAU * r.dir;
            if (Math.abs(r.upright - r.from) < 0.1) r.upright += U.TAU * r.dir;
          } else {
            const step = Math.min(d, sp * dt);
            this.home.x += (dx / d) * step;
            this.home.y += (dy / d) * step;
            this.rotBody += (step / (this.hh * 0.62)) * r.dir; // 転がるぶんだけ回る
          }
        } else if (r.phase === 'stand') {
          const k = U.clamp(r.t / 0.55, 0, 1);
          this.rotBody = U.lerp(r.from, r.upright, U.easeOutBack(k));
          if (k >= 1) {
            this.rotBody = 0;
            this.roll = null;
            this.topJig.kick(-60);      // 立ち上がって、砂がふわっと
            this.joyBurst(0, 0, 2);
          }
        }
      }

      this.tiltHold = Math.max(0, this.tiltHold - dt);
      if (this.tiltHold <= 0) this.tilt.set(U.damp(this.tilt.t, 0, 2.5, dt));
      this.tilt.update(dt);
      this.topJig.update(dt);

      this.prevClog = this.clog;
      this.clog = Math.max(0, this.clog - dt);

      // 流れの太さ。疲れると細くなる。転がっているあいだは砂も息をひそめる
      const flow = (this.clog > 0 || this.roll) ? 0
        : (0.8 + this.nature.liveliness * 0.2) * (1 - h.fatigue * 0.6) * (1 - h.drowsy * 0.45);
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
      if (!this.roll) {
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
      }
      if (this.parts.length > 160) this.parts.splice(0, this.parts.length - 160);

      // 山はゆっくり沈む(砂は尽きない)
      this.mound = Math.max(5, this.mound - dt * 0.12);
    }

    subDraw(ctx, t) {
      const h = this.heart;
      const hw = this.hw, hh = this.hh;
      ctx.rotate(this.tilt.v + this.rotBody);
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

      // 落ちる砂つぶ。金色の子はうれしさのしるし
      for (const p of this.parts) {
        if (p.gold) {
          ctx.save();
          ctx.fillStyle = 'rgba(255,224,150,0.95)';
          ctx.fillRect(p.x - 1.3, p.y - 1.3, 2.6, 2.6);
          ctx.restore();
        } else {
          ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        }
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
