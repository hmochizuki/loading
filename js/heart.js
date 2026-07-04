/* やさしく待って — ローディングのこころ
 *
 * 数字はぜんぶ 0..1。
 *   stress  : こわい・落ち着かない
 *   comfort : 安心している
 *   joy     : うれしい
 *   fatigue : 疲れ。なかなか抜けない
 *   drowsy  : 眠気。かまわれないと増える
 */
(function () {
  'use strict';
  const { U } = window.YW;

  class Heart {
    constructor() {
      this.stress = 0.14;
      this.comfort = 0.4;
      this.joy = 0;
      this.fatigue = 0;
      this.drowsy = 0;
      this.sinceTouch = 999;
      this.wakeStartle = 0; // 眠いところを触られてびくっとした分
    }

    // 触れられた瞬間に呼ぶ
    touch() {
      if (this.drowsy > 0.45) this.wakeStartle = 1;
      this.sinceTouch = 0;
    }

    // やさしくされた
    gentle(a) {
      this.comfort = U.clamp(this.comfort + a, 0, 1);
      this.stress = Math.max(0, this.stress - a * 0.9);
      this.joy = U.clamp(this.joy + a * 0.7, 0, 1);
    }

    // 乱暴にされた
    rough(a) {
      this.stress = U.clamp(this.stress + a, 0, 1);
      this.fatigue = U.clamp(this.fatigue + a * 0.3, 0, 1);
      this.comfort = Math.max(0, this.comfort - a * 0.6);
      this.joy = Math.max(0, this.joy - a * 0.8);
    }

    update(dt) {
      this.sinceTouch += dt;

      // こわさは、安心しているほど早くほどける
      this.stress *= Math.exp(-dt * (0.22 + this.comfort * 0.3));
      this.joy *= Math.exp(-dt * 0.16);
      this.comfort = U.damp(this.comfort, 0.4, 0.05, dt);
      this.wakeStartle = Math.max(0, this.wakeStartle - dt * 1.6);

      // かまわれないと、だんだん眠くなる
      if (this.sinceTouch > 6) {
        this.drowsy = Math.min(1, this.drowsy + dt * 0.06);
      } else {
        this.drowsy = Math.max(0, this.drowsy - dt * 0.5);
      }

      // 疲れは、ほとんど抜けない
      this.fatigue = Math.max(0, this.fatigue - dt * 0.005);
    }

    // 去りぎわの気分
    exitMood() {
      if (this.fatigue > 0.65) return 'tired';
      if (this.drowsy > 0.55) return 'sleepy';
      if (this.joy > 0.4 || this.comfort > 0.72) return 'happy';
      if (this.stress > 0.45) return 'uneasy';
      return 'calm';
    }
  }

  window.YW.Heart = Heart;
})();
