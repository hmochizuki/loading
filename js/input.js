/* やさしく待って — 手つきを感じ取る
 *
 * handlers:
 *   touchStart(x, y)
 *   tap(x, y)
 *   rapid(count)                 連打
 *   stroke({x, y, dx, dy, speed})  なぞり。speed は px/ms
 *   release({dur, stroked})
 *   multi()                      複数指
 * ポーリング用:
 *   pressInfo(nowMs) -> {dur(sec), x, y} | null  動かず押し続けている
 */
(function () {
  'use strict';

  class InputSense {
    constructor(el, handlers) {
      this.el = el;
      this.h = handlers;
      this.p = null;      // 主ポインタ
      this.taps = [];     // 直近のタップ時刻 (ms)

      el.addEventListener('pointerdown', (e) => this._down(e));
      el.addEventListener('pointermove', (e) => this._move(e));
      el.addEventListener('pointerup', (e) => this._up(e));
      el.addEventListener('pointercancel', (e) => this._up(e));
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _down(e) {
      e.preventDefault();
      if (this.p) {
        // すでに一本指がいる。あわてている手つき。
        if (this.h.multi) this.h.multi();
        return;
      }
      try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* 気にしない */ }
      const now = performance.now();
      this.p = {
        id: e.pointerId,
        x: e.clientX, y: e.clientY,
        x0: e.clientX, y0: e.clientY,
        t0: now, lastT: now,
        dist: 0, speedEma: 0, stroked: false,
      };
      if (this.h.touchStart) this.h.touchStart(e.clientX, e.clientY);
    }

    _move(e) {
      if (!this.p || e.pointerId !== this.p.id) return;
      const p = this.p;
      const now = performance.now();
      const dtMs = now - p.lastT;
      if (dtMs <= 0) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      const d = Math.hypot(dx, dy);
      p.x = e.clientX;
      p.y = e.clientY;
      p.lastT = now;
      p.dist += d;
      const speed = d / dtMs;
      p.speedEma = p.speedEma * 0.7 + speed * 0.3;
      if (p.dist > 10) {
        p.stroked = true;
        if (this.h.stroke) {
          this.h.stroke({ x: p.x, y: p.y, dx, dy, speed: p.speedEma });
        }
      }
    }

    _up(e) {
      if (!this.p || e.pointerId !== this.p.id) return;
      const p = this.p;
      const now = performance.now();
      const dur = now - p.t0;
      if (!p.stroked && dur < 280) {
        this.taps.push(now);
        this.taps = this.taps.filter((t) => now - t < 1300);
        if (this.h.tap) this.h.tap(p.x, p.y);
        if (this.taps.length >= 3 && this.h.rapid) this.h.rapid(this.taps.length);
      }
      if (this.h.release) this.h.release({ dur: dur / 1000, stroked: p.stroked });
      this.p = null;
    }

    pressInfo(nowMs) {
      const p = this.p;
      if (p && !p.stroked) {
        const dur = nowMs - p.t0;
        if (dur > 420) return { dur: dur / 1000, x: p.x, y: p.y };
      }
      return null;
    }
  }

  window.YW.InputSense = InputSense;
})();
