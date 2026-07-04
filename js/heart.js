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
    constructor(nature) {
      this.nature = nature || Heart.randomNature();
      const n = this.nature;
      this.stress = n.initStress;
      this.comfort = n.initComfort;
      this.joy = 0;
      this.fatigue = 0;
      this.drowsy = 0;
      this.sinceTouch = 999;
      this.wakeStartle = 0; // 眠いところを触られてびくっとした分
    }

    // 生まれつきの性質。同じ種類でも、来る子はみんな少しずつちがう
    static randomNature() {
      // ごくまれに、ちいさな子や、おおきな子が来る
      let size = U.rand(0.92, 1.08);
      const roll = Math.random();
      if (roll < 0.05) size = U.rand(0.72, 0.82);
      else if (roll < 0.1) size = U.rand(1.18, 1.3);
      return {
        shy: U.rand(0, 1),               // 臆病さ。びくっとしやすく、なつくのに時間がかかる
        warmth: U.rand(0.7, 1.4),        // 人懐こさ。やさしさが染みやすい
        sensitivity: U.rand(0.7, 1.4),   // 打たれ弱さ
        drowsiness: U.rand(0.6, 1.5),    // 眠がり
        liveliness: U.rand(0.75, 1.25),  // 元気
        size,
        gold: Math.random() < 0.03,      // ごくごくまれに、金いろの子
        initStress: U.rand(0.05, 0.3),   // 現れたときの緊張
        initComfort: U.rand(0.3, 0.5),
      };
    }

    // 触れられた瞬間に呼ぶ。触れられ続けているあいだは、もうびくっとしない
    touch() {
      if (this.drowsy > 0.45 && this.sinceTouch > 0.5) this.wakeStartle = 1;
      this.sinceTouch = 0;
    }

    // やさしくされた。人懐こい子ほど染みる
    gentle(a) {
      a *= this.nature.warmth;
      this.comfort = U.clamp(this.comfort + a, 0, 1);
      this.stress = Math.max(0, this.stress - a * 0.9);
      this.joy = U.clamp(this.joy + a * 0.7, 0, 1);
    }

    // 乱暴にされた。打たれ弱い子ほどこたえる
    rough(a) {
      a *= this.nature.sensitivity;
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

      // かまわれないと、だんだん眠くなる。眠がりの子は早い
      if (this.sinceTouch > 6) {
        this.drowsy = Math.min(1, this.drowsy + dt * 0.06 * this.nature.drowsiness);
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
