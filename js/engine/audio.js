// =========================================================
// BLACKLINE // OPS — Procedural Web Audio Combat Synthesizer
// =========================================================

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.dryBus = null;
    this.reverbSend = null;
    this.noiseBuffer = null;
    this.volume = 0.8;
    this.unlocked = false;
    this.playedBootChime = false;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx({ latencyHint: "interactive" });

      // Master volume BEFORE soft-clipping protective limiter
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume * 1.45;

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -3;
      compressor.knee.value = 8;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.12;

      this.masterGain.connect(compressor);
      compressor.connect(this.ctx.destination);
      this.dryBus = this.masterGain;

      // Procedural outdoor arena echo impulse response
      const irLen = Math.floor(this.ctx.sampleRate * 0.65);
      const irBuf = this.ctx.createBuffer(2, irLen, this.ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = irBuf.getChannelData(ch);
        for (let i = 0; i < irLen; i++) {
          const decay = Math.pow(1 - i / irLen, 3.0);
          data[i] = (Math.random() * 2 - 1) * decay;
        }
      }
      const convolver = this.ctx.createConvolver();
      convolver.buffer = irBuf;

      const reverbFilter = this.ctx.createBiquadFilter();
      reverbFilter.type = "lowpass";
      reverbFilter.frequency.value = 2400;

      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = 0.22;
      this.reverbSend.connect(convolver);
      convolver.connect(reverbFilter);
      reverbFilter.connect(this.masterGain);

      // Shared 2-second white noise buffer
      const nLen = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, nLen, this.ctx.sampleRate);
      const nd = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < nLen; i++) {
        nd[i] = Math.random() * 2 - 1;
      }
    }

    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().then(() => {
        this._wakeStream();
      }).catch(() => {});
    } else {
      this._wakeStream();
    }
    this.unlocked = true;
  }

  _wakeStream() {
    if (!this.ctx || this.ctx.state !== "running") return;
    // Play 1-sample silent pulse to ensure PipeWire/ALSA stream activates immediately
    try {
      const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
    } catch {
      // ignore
    }
    if (!this.playedBootChime) {
      this.playedBootChime = true;
      this._playTone("triangle", 660, 880, 0.08, 0.16, 0, 0.05);
      this._playTone("triangle", 880, 1180, 0.12, 0.16, 0, 0.08, 0.07);
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(val) ? val : 0.8));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume * 1.45, this.ctx.currentTime, 0.02);
    }
  }

  _ready() {
    if (!this.ctx) return false;
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
      return false;
    }
    return this.ctx.state === "running";
  }

  _routeNode(pan = 0, reverbAmount = 0.25) {
    const safePan = Number.isFinite(pan) ? Math.max(-1, Math.min(1, pan)) : 0;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = safePan;
    panner.connect(this.dryBus);
    if (reverbAmount > 0 && this.reverbSend) {
      const send = this.ctx.createGain();
      send.gain.value = reverbAmount;
      panner.connect(send);
      send.connect(this.reverbSend);
    }
    return panner;
  }

  _playNoise(duration, filterType, freqStart, freqEnd, gainStart, pan = 0, reverb = 0.2, delay = 0) {
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = filterType === "bandpass" ? 0.9 : 0.7;
    filter.frequency.setValueAtTime(Math.max(40, freqStart), t);
    if (freqEnd !== freqStart) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + duration);
    }

    // Punchy hold-then-decay envelope so transient keeps real body
    const peak = Math.max(0.001, gainStart);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.linearRampToValueAtTime(peak * 0.65, t + duration * 0.22);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);

    const out = this._routeNode(pan, reverb);
    src.connect(filter);
    filter.connect(g);
    g.connect(out);

    src.start(t);
    src.stop(t + duration + 0.02);
  }

  _playTone(type, freqStart, freqEnd, duration, gainStart, pan = 0, reverb = 0.05, delay = 0) {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freqStart), t);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
    }

    const peak = Math.max(0.001, gainStart);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.linearRampToValueAtTime(peak * 0.7, t + duration * 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);

    const out = this._routeNode(pan, reverb);
    osc.connect(g);
    g.connect(out);

    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  playGunshot(profile = "rifle", isPlayer = true, pan = 0, distance = 0) {
    if (!this._ready()) return;
    const safeDist = Number.isFinite(distance) ? Math.max(0, distance) : 0;
    const atten = isPlayer ? 1.0 : Math.max(0.04, 1 / (1 + safeDist * 0.075));
    if (atten < 0.05) return;
    const rev = isPlayer ? 0.24 : 0.4;

    switch (profile) {
      case "smgSD":
        this._playTone("triangle", 190, 60, 0.085, 0.4 * atten, pan, 0.08);
        this._playNoise(0.08, "bandpass", 2300, 900, 0.34 * atten, pan, 0.08);
        this._playTone("sine", 860, 280, 0.035, 0.16 * atten, pan, 0.03);
        break;

      case "heavyRifle":
        this._playTone("sawtooth", 155, 44, 0.16, 0.65 * atten, pan, rev);
        this._playNoise(0.22, "lowpass", 3600, 480, 0.85 * atten, pan, rev);
        this._playNoise(0.06, "bandpass", 1900, 1100, 0.48 * atten, pan, 0.12);
        break;

      case "shotgun":
        this._playTone("sine", 145, 34, 0.25, 0.9 * atten, pan, rev);
        this._playNoise(0.32, "lowpass", 4400, 320, 1.0 * atten, pan, rev + 0.14);
        this._playNoise(0.08, "bandpass", 1600, 800, 0.55 * atten, pan, 0.15);
        if (isPlayer) {
          this._playNoise(0.05, "bandpass", 1900, 1300, 0.28, pan, 0.05, 0.34);
          this._playNoise(0.05, "bandpass", 2400, 1600, 0.3, pan, 0.05, 0.43);
        }
        break;

      case "sniper":
        this._playTone("sawtooth", 210, 36, 0.28, 0.85 * atten, pan, rev + 0.2);
        this._playNoise(0.4, "lowpass", 5800, 260, 1.0 * atten, pan, rev + 0.22);
        this._playTone("square", 1300, 220, 0.08, 0.36 * atten, pan, 0.2);
        if (isPlayer) {
          this._playNoise(0.05, "bandpass", 2800, 1900, 0.24, pan, 0.04, 0.48);
          this._playNoise(0.05, "bandpass", 2200, 1500, 0.26, pan, 0.04, 0.62);
        }
        break;

      case "lmg":
        this._playTone("sawtooth", 175, 52, 0.12, 0.54 * atten, pan, rev);
        this._playNoise(0.16, "bandpass", 2400, 640, 0.78 * atten, pan, rev);
        this._playTone("square", 980, 380, 0.035, 0.2 * atten, pan, 0.05);
        break;

      case "heavyPistol":
        this._playTone("triangle", 230, 56, 0.16, 0.72 * atten, pan, rev);
        this._playNoise(0.18, "bandpass", 3200, 580, 0.82 * atten, pan, rev);
        break;

      case "autoPistol":
        this._playTone("triangle", 250, 74, 0.1, 0.48 * atten, pan, rev);
        this._playNoise(0.11, "bandpass", 2900, 820, 0.56 * atten, pan, rev);
        break;

      case "rifle":
      default:
        this._playTone("sawtooth", 180, 48, 0.14, 0.58 * atten, pan, rev);
        this._playNoise(0.18, "lowpass", 4200, 560, 0.78 * atten, pan, rev);
        this._playNoise(0.055, "bandpass", 2200, 1300, 0.42 * atten, pan, 0.08);
        break;
    }
  }

  playHitmarker(isHeadshot = false, isArmor = false, isKill = false) {
    if (!this._ready()) return;
    if (isHeadshot) {
      this._playTone("triangle", 2600, 1300, 0.065, 0.48, 0, 0.03);
      this._playNoise(0.055, "bandpass", 3400, 2200, 0.42, 0, 0.02);
    } else if (isArmor) {
      this._playTone("square", 1450, 620, 0.055, 0.34, 0, 0.02);
      this._playNoise(0.045, "highpass", 2600, 1800, 0.36, 0, 0.02);
    } else {
      this._playTone("triangle", 1950, 920, 0.048, 0.38, 0, 0.01);
      this._playNoise(0.035, "bandpass", 2800, 1800, 0.28, 0, 0.01);
    }

    if (isKill) {
      this._playTone("sine", 260, 95, 0.11, 0.4, 0, 0.04, 0.02);
    }
  }

  playReload(stage = "start") {
    if (!this._ready()) return;
    if (stage === "start") {
      this._playNoise(0.06, "bandpass", 950, 520, 0.24, 0.15, 0.02);
    } else if (stage === "magOut") {
      this._playTone("square", 640, 260, 0.045, 0.24, 0.18, 0.03);
      this._playNoise(0.085, "bandpass", 2100, 850, 0.36, 0.18, 0.03, 0.015);
    } else if (stage === "magIn") {
      this._playTone("triangle", 200, 72, 0.095, 0.48, 0.1, 0.04);
      this._playNoise(0.06, "bandpass", 1600, 1100, 0.4, 0.1, 0.03);
      this._playTone("square", 920, 480, 0.04, 0.24, 0.1, 0.02, 0.035);
    } else if (stage === "rack") {
      this._playNoise(0.055, "bandpass", 2800, 1700, 0.38, 0.08, 0.03);
      this._playTone("triangle", 520, 310, 0.045, 0.3, 0.08, 0.02);
      this._playNoise(0.06, "bandpass", 3200, 1900, 0.44, 0.08, 0.04, 0.085);
      this._playTone("triangle", 360, 150, 0.055, 0.34, 0.08, 0.03, 0.085);
    } else if (stage === "shell") {
      this._playTone("triangle", 480, 220, 0.05, 0.32, 0.12, 0.02);
      this._playNoise(0.05, "bandpass", 2400, 1400, 0.32, 0.12, 0.02);
    } else {
      this._playTone("triangle", 320, 160, 0.06, 0.32, 0.1, 0.03);
      this._playNoise(0.05, "bandpass", 2600, 1400, 0.34, 0.1, 0.03, 0.08);
    }
  }

  playDryFire() {
    if (!this._ready()) return;
    this._playTone("square", 1100, 420, 0.035, 0.28, 0, 0.01);
  }

  playFootstep(isSprint = false, isSlide = false) {
    if (!this._ready()) return;
    if (isSlide) {
      this._playNoise(0.36, "bandpass", 1200, 360, 0.42, 0, 0.05);
      return;
    }
    const vol = isSprint ? 0.26 : 0.17;
    const freq = isSprint ? 140 : 110;
    this._playTone("sine", freq, 42, 0.09, vol, 0, 0.03);
    this._playNoise(0.07, "lowpass", 700, 260, vol * 0.9, 0, 0.03);
  }

  playKnife(hit = false) {
    if (!this._ready()) return;
    this._playNoise(0.13, "bandpass", 1900, 520, 0.44, 0, 0.03);
    if (hit) {
      this._playTone("sine", 180, 55, 0.14, 0.65, 0, 0.05);
      this._playNoise(0.09, "lowpass", 1400, 400, 0.55, 0, 0.04);
    }
  }

  playGrenadeBounce(distance = 5, pan = 0) {
    if (!this._ready()) return;
    const safeDist = Number.isFinite(distance) ? Math.max(0, distance) : 5;
    const atten = Math.max(0.06, 1 / (1 + safeDist * 0.12));
    this._playTone("sine", 1480, 920, 0.055, 0.32 * atten, pan, 0.15);
  }

  playExplosion(distance = 0, pan = 0) {
    if (!this._ready()) return;
    const safeDist = Number.isFinite(distance) ? Math.max(0, distance) : 0;
    const atten = Math.max(0.12, 1 / (1 + safeDist * 0.045));
    this._playTone("sine", 115, 24, 0.62, 1.0 * atten, pan, 0.35);
    this._playNoise(0.75, "lowpass", 2600, 120, 1.0 * atten, pan, 0.45);
    this._playNoise(0.28, "bandpass", 1400, 420, 0.72 * atten, pan, 0.3, 0.04);
  }

  playFlashbang(distance = 0) {
    if (!this._ready()) return;
    const safeDist = Number.isFinite(distance) ? Math.max(0, distance) : 0;
    const atten = Math.max(0.14, 1 / (1 + safeDist * 0.06));
    this._playNoise(0.22, "highpass", 1800, 900, 0.9 * atten, 0, 0.25);
    if (safeDist < 10) {
      this._playTone("sine", 4200, 3900, 0.65, 0.24 * atten, 0, 0.05);
    }
  }

  playHurt() {
    if (!this._ready()) return;
    this._playTone("sine", 130, 44, 0.16, 0.62, 0, 0.05);
    this._playNoise(0.11, "lowpass", 950, 250, 0.46, 0, 0.04);
  }

  playUavPing() {
    if (!this._ready()) return;
    this._playTone("sine", 980, 1320, 0.16, 0.32, 0, 0.12);
    this._playTone("sine", 1320, 1620, 0.2, 0.26, 0, 0.12, 0.12);
  }

  playAirstrikeJet() {
    if (!this._ready()) return;
    this._playNoise(1.5, "bandpass", 280, 1250, 0.72, -0.4, 0.3);
    this._playNoise(1.25, "bandpass", 1250, 240, 0.65, 0.4, 0.3, 0.45);
    this._playTone("sine", 1400, 340, 0.48, 0.28, 0, 0.2, 0.35);
    this._playTone("sine", 1280, 310, 0.48, 0.28, 0.2, 0.2, 0.55);
  }

  playStreakReady() {
    if (!this._ready()) return;
    this._playTone("triangle", 523.25, 523.25, 0.14, 0.34, 0, 0.12);
    this._playTone("triangle", 659.25, 659.25, 0.14, 0.34, 0, 0.12, 0.09);
    this._playTone("triangle", 783.99, 783.99, 0.24, 0.4, 0, 0.15, 0.18);
  }

  playPickup() {
    if (!this._ready()) return;
    this._playTone("triangle", 440, 880, 0.12, 0.32, 0, 0.05);
    this._playNoise(0.065, "bandpass", 2200, 1500, 0.26, 0, 0.03, 0.06);
  }
}
