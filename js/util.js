/* やさしく待って — 小さな道具たち */
(function () {
  'use strict';

  const U = {
    TAU: Math.PI * 2,

    clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp(a, b, t) { return a + (b - a) * t; },
    // フレームレート非依存の追従
    damp(a, b, lambda, dt) { return U.lerp(a, b, 1 - Math.exp(-lambda * dt)); },
    rand(a, b) { return a + Math.random() * (b - a); },
    pick(arr) { return arr[(Math.random() * arr.length) | 0]; },

    easeOutCubic(t) { t = U.clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); },
    easeInCubic(t) { t = U.clamp(t, 0, 1); return t * t * t; },
    easeOutBack(t) {
      t = U.clamp(t, 0, 1);
      const c = 1.70158;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    },
    smooth(t) { t = U.clamp(t, 0, 1); return t * t * (3 - 2 * t); },

    // 角度差を -π..π に折り返す
    angNorm(a) {
      while (a > Math.PI) a -= U.TAU;
      while (a < -Math.PI) a += U.TAU;
      return a;
    },

    // なめらかなゆらぎ (-1..1 くらい)
    noise(t) {
      return Math.sin(t * 1.7) * 0.5 + Math.sin(t * 2.9 + 1.3) * 0.3 + Math.sin(t * 4.7 + 2.1) * 0.2;
    },

    mixColor(c1, c2, t) {
      return [
        U.lerp(c1[0], c2[0], t),
        U.lerp(c1[1], c2[1], t),
        U.lerp(c1[2], c2[2], t),
      ];
    },
    rgba(c, a) {
      return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')';
    },
  };

  // 小さなバネ。びくっとしたり、ぷるんとしたりするのに使う。
  class Spring {
    constructor(v, k, d) {
      this.v = v || 0;
      this.t = v || 0;
      this.vel = 0;
      this.k = k || 90;
      this.d = d || 12;
    }
    set(target) { this.t = target; return this; }
    kick(impulse) { this.vel += impulse; return this; }
    update(dt) {
      // 大きな dt でも暴れないよう小刻みに積分する
      let rest = Math.min(dt, 0.1);
      while (rest > 0) {
        const h = Math.min(rest, 1 / 120);
        const a = (this.t - this.v) * this.k - this.vel * this.d;
        this.vel += a * h;
        this.v += this.vel * h;
        rest -= h;
      }
      return this.v;
    }
  }

  // 古めのブラウザ向け
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

  window.YW = { U, Spring };
})();
