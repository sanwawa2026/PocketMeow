import { type AcousticMetrics, type MeowEmotion } from '../schemas/cat';

export class MeowAudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private freqBuffer: Uint8Array<ArrayBuffer> | null = null;
  private startTimeMs = 0;
  private pitchHistory: number[] = [];
  private energyHistory: number[] = [];
  private trillChanges = 0;
  private prevPitch = 0;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public async startListening(): Promise<void> {
    const ctx = this.ensureContext();
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.sourceNode = ctx.createMediaStreamSource(this.mediaStream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.65;
    this.sourceNode.connect(this.analyser);

    this.freqBuffer = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    this.startTimeMs = performance.now();
    this.pitchHistory = [];
    this.energyHistory = [];
    this.trillChanges = 0;
    this.prevPitch = 0;
  }

  /**
   * Called each animation frame while recording to draw live spectrum & collect acoustic features (0 API latency)
   */
  public sampleSpectrum(barsCount = 24): number[] {
    if (!this.analyser || !this.freqBuffer || !this.ctx) {
      return new Array<number>(barsCount).fill(0.08);
    }

    this.analyser.getByteFrequencyData(this.freqBuffer);
    const len = this.freqBuffer.length;
    const sampleRate = this.ctx.sampleRate;
    const binHz = sampleRate / this.analyser.fftSize;

    let sumSq = 0;
    let peakVal = 0;
    let peakBin = 0;

    // Focus 120Hz..2800Hz feline/human vocal band
    const minBin = Math.max(1, Math.floor(120 / binHz));
    const maxBin = Math.min(len - 1, Math.ceil(2800 / binHz));

    for (let i = minBin; i <= maxBin; i++) {
      const v = this.freqBuffer[i] / 255;
      sumSq += v * v;
      if (v > peakVal) {
        peakVal = v;
        peakBin = i;
      }
    }

    const rms = Math.sqrt(sumSq / Math.max(1, maxBin - minBin + 1));
    const peakHz = peakBin * binHz;

    if (rms > 0.03) {
      this.energyHistory.push(rms);
      this.pitchHistory.push(peakHz);
      if (this.prevPitch > 0 && Math.abs(peakHz - this.prevPitch) > 95) {
        this.trillChanges++;
      }
      this.prevPitch = peakHz;
    }

    const bars: number[] = [];
    const stride = Math.max(1, Math.floor((maxBin - minBin) / barsCount));
    for (let b = 0; b < barsCount; b++) {
      const idx = Math.min(len - 1, minBin + b * stride);
      bars.push(Math.max(0.08, Math.min(1, this.freqBuffer[idx] / 220)));
    }
    return bars;
  }

  public stopAndAnalyze(): { emotion: MeowEmotion; metrics: AcousticMetrics } {
    const durationMs = Math.max(200, Math.round(performance.now() - this.startTimeMs));
    this.cleanupStream();

    const avgEnergy =
      this.energyHistory.length > 0
        ? this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
        : 0.18;

    const avgHz =
      this.pitchHistory.length > 0
        ? this.pitchHistory.reduce((a, b) => a + b, 0) / this.pitchHistory.length
        : 480;

    let contour: AcousticMetrics['contour'] = 'steady';
    if (this.trillChanges >= 3) {
      contour = 'trill';
    } else if (this.pitchHistory.length >= 4) {
      const half = Math.floor(this.pitchHistory.length / 2);
      const firstAvg = this.pitchHistory.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const secondAvg =
        this.pitchHistory.slice(half).reduce((a, b) => a + b, 0) /
        (this.pitchHistory.length - half);
      if (secondAvg - firstAvg > 65) contour = 'rising';
      else if (firstAvg - secondAvg > 65) contour = 'falling';
    }

    // Map local acoustic signature to feline intent
    let emotion: MeowEmotion = 'philosophical';
    if (contour === 'trill' && avgHz > 520) {
      emotion = 'affectionate';
    } else if (contour === 'rising' && avgEnergy > 0.25) {
      emotion = avgHz > 620 ? 'hungry' : 'demanding';
    } else if (avgHz < 340 && avgEnergy > 0.22) {
      emotion = 'annoyed';
    } else if (avgEnergy < 0.14 || durationMs < 600) {
      emotion = 'sleepy';
    } else if (avgHz >= 450) {
      emotion = 'demanding';
    }

    return {
      emotion,
      metrics: {
        peakHz: Math.round(avgHz),
        rmsEnergy: Number(Math.min(1, avgEnergy).toFixed(2)),
        durationMs,
        contour,
      },
    };
  }

  /**
   * Simulates an acoustic cat-meow profile when mic is unavailable or user taps quick demo meow
   */
  public simulateQuickMeow(): { emotion: MeowEmotion; metrics: AcousticMetrics } {
    const emotions: MeowEmotion[] = [
      'demanding',
      'annoyed',
      'affectionate',
      'hungry',
      'sleepy',
      'philosophical',
    ];
    const emotion = emotions[Math.floor(Math.random() * emotions.length)];
    const contours: AcousticMetrics['contour'][] = ['rising', 'trill', 'falling', 'steady'];
    const contour =
      emotion === 'hungry' || emotion === 'demanding'
        ? 'rising'
        : emotion === 'affectionate'
          ? 'trill'
          : contours[Math.floor(Math.random() * contours.length)];
    return {
      emotion,
      metrics: {
        peakHz: emotion === 'annoyed' ? 310 : emotion === 'hungry' ? 695 : 510,
        rmsEnergy: emotion === 'sleepy' ? 0.16 : 0.42,
        durationMs: 920,
        contour,
      },
    };
  }

  public cleanupStream(): void {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    this.analyser = null;
  }

  /**
   * Procedural Web Audio synthesized meow chirp (0 external audio files)
   */
  public playMeowChirp(pitchScale = 1.0): void {
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const subOsc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      subOsc.type = 'sine';

      const base = 520 * pitchScale;
      osc.frequency.setValueAtTime(base * 0.85, now);
      osc.frequency.exponentialRampToValueAtTime(base * 1.42, now + 0.11);
      osc.frequency.exponentialRampToValueAtTime(base * 0.92, now + 0.34);

      subOsc.frequency.setValueAtTime(base * 0.42, now);
      subOsc.frequency.exponentialRampToValueAtTime(base * 0.71, now + 0.11);
      subOsc.frequency.exponentialRampToValueAtTime(base * 0.46, now + 0.34);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1150, now);
      filter.Q.setValueAtTime(2.6, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(filter);
      subOsc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      subOsc.start(now);
      osc.stop(now + 0.4);
      subOsc.stop(now + 0.4);
    } catch {
      // Ignore autoplay errors silently
    }
  }

  /**
   * Procedural Web Audio purr rumble
   */
  public playPurr(): void {
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const master = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(28, now);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(2.2, now);
      lfoGain.gain.setValueAtTime(0.06, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, now);

      master.gain.setValueAtTime(0.001, now);
      master.gain.linearRampToValueAtTime(0.11, now + 0.12);
      master.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

      lfo.connect(lfoGain);
      lfoGain.connect(master.gain);
      osc.connect(filter);
      filter.connect(master);
      master.connect(ctx.destination);

      osc.start(now);
      lfo.start(now);
      osc.stop(now + 1.0);
      lfo.stop(now + 1.0);
    } catch {
      // Ignore
    }
  }

  /**
   * Procedural brass collar bell jingle
   */
  public playBellJingle(): void {
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;
      const freqs = [2480, 3120];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.04);
        gain.gain.setValueAtTime(0.06, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.04 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.3);
      });
    } catch {
      // Ignore
    }
  }
}
