import { getBlockType } from '../data/blockCatalog';
import type { ChainBlock, TonePreset } from '../types/tone';
import { makeCabImpulse, makeReverbImpulse } from './impulse';
import { applyDriveCurve, driveAmountFromParams } from './waveshaper';

export type PreviewNote = 'E2' | 'A2' | 'D3' | 'G3' | 'B3' | 'E4';
export type SourceMode = 'synth' | 'live';

const NOTE_FREQ: Record<PreviewNote, number> = {
  E2: 82.41,
  A2: 110.0,
  D3: 146.83,
  G3: 196.0,
  B3: 246.94,
  E4: 329.63,
};

interface Stage {
  entry: AudioNode;
  exit: AudioNode;
  nodes: AudioNode[];
  apply: (params: Record<string, number | string | boolean>) => void;
}

interface BuiltGraph {
  input: GainNode;
  output: GainNode;
  paramBindings: { blockId: string; apply: Stage['apply'] }[];
  disposables: AudioNode[];
}

/**
 * Approximate guitar-tone preview.
 * Source (synth oscillators or live MediaStream) → drive/amp → EQ →
 * modulation/delay/reverb → cab → out.
 */
export class ToneEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sourceGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private noiseSource: AudioBufferSourceNode | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserData: Uint8Array<ArrayBuffer> | null = null;
  private graph: BuiltGraph | null = null;
  private playing = false;
  private sourceMode: SourceMode = 'synth';
  private note: PreviewNote = 'A2';
  private muted = false;
  private currentChain: ChainBlock[] = [];

  get isPlaying() {
    return this.playing;
  }

  get mode(): SourceMode {
    return this.sourceMode;
  }

  get isLive() {
    return this.sourceMode === 'live' && this.playing;
  }

  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      const target = muted ? 0.0001 : 0.32;
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
    }
  }

  setNote(note: PreviewNote) {
    this.note = note;
    if (!this.playing || !this.ctx || this.sourceMode !== 'synth') return;
    const freq = NOTE_FREQ[note];
    const t = this.ctx.currentTime;
    this.oscillators.forEach((osc, i) => {
      const mult = i === 0 ? 1 : i === 1 ? 2.002 : 3.01;
      osc.frequency.setTargetAtTime(freq * mult, t, 0.015);
    });
  }

  /** Synth / note preview (oscillator source). */
  async start(preset: TonePreset, note: PreviewNote = this.note): Promise<void> {
    const ctx = await this.ensureContext();
    this.stopSourcesOnly();
    this.teardownGraph();

    this.sourceMode = 'synth';
    this.note = note;
    this.currentChain = preset.chain.map((b) => ({
      ...b,
      params: { ...b.params },
    }));

    this.graph = this.buildGraph(ctx, preset.chain);
    this.graph.output.connect(this.master!);

    this.sourceGain = ctx.createGain();
    this.sourceGain.gain.value = 0.2;
    this.sourceGain.connect(this.graph.input);

    this.startSources(ctx, NOTE_FREQ[note]);
    this.playing = true;
    this.setMuted(this.muted);
  }

  /**
   * Live guitar / interface input via MediaStreamAudioSourceNode into the
   * same DSP graph. Monitoring runs until stop().
   */
  async startLive(preset: TonePreset, stream: MediaStream): Promise<void> {
    const ctx = await this.ensureContext();
    this.stopSourcesOnly();
    this.teardownGraph();

    this.sourceMode = 'live';
    this.mediaStream = stream;
    this.currentChain = preset.chain.map((b) => ({
      ...b,
      params: { ...b.params },
    }));

    this.graph = this.buildGraph(ctx, preset.chain);
    this.graph.output.connect(this.master!);

    this.sourceGain = ctx.createGain();
    // Interface levels vary; keep headroom — end-of-chain limiter catches peaks.
    this.sourceGain.gain.value = 0.85;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyserData = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));

    this.mediaSource = ctx.createMediaStreamSource(stream);
    this.mediaSource.connect(this.sourceGain);
    this.sourceGain.connect(this.analyser);
    this.analyser.connect(this.graph.input);

    this.playing = true;
    this.setMuted(this.muted);
  }

  /** Peak-ish input level 0–1 for a simple meter (live mode). */
  getInputLevel(): number {
    if (!this.analyser || !this.analyserData || !this.playing) return 0;
    this.analyser.getByteTimeDomainData(this.analyserData);
    let peak = 0;
    for (let i = 0; i < this.analyserData.length; i++) {
      const v = Math.abs(this.analyserData[i]! - 128) / 128;
      if (v > peak) peak = v;
    }
    return Math.min(1, peak * 1.4);
  }

  updatePreset(preset: TonePreset) {
    if (!this.playing || !this.ctx || !this.sourceGain || !this.master) return;
    this.currentChain = preset.chain.map((b) => ({
      ...b,
      params: { ...b.params },
    }));
    this.teardownGraph();
    this.graph = this.buildGraph(this.ctx, preset.chain);

    if (this.sourceMode === 'live' && this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {
        /* */
      }
      this.analyser.connect(this.graph.input);
    } else {
      this.sourceGain.connect(this.graph.input);
    }
    this.graph.output.connect(this.master);
  }

  updateParams(preset: TonePreset) {
    if (!this.playing || !this.graph) return;
    const same =
      preset.chain.length === this.currentChain.length &&
      preset.chain.every(
        (b, i) =>
          b.id === this.currentChain[i]?.id && b.typeId === this.currentChain[i]?.typeId,
      );

    if (!same) {
      this.updatePreset(preset);
      return;
    }

    this.currentChain = preset.chain.map((b) => ({
      ...b,
      params: { ...b.params },
    }));
    for (const block of preset.chain) {
      this.graph.paramBindings.find((b) => b.blockId === block.id)?.apply(block.params);
    }
  }

  stop() {
    this.stopSourcesOnly();
    this.teardownGraph();
    this.playing = false;
    this.sourceMode = 'synth';
  }

  dispose() {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.master = null;
    }
  }

  private stopSourcesOnly() {
    for (const osc of this.oscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        /* */
      }
    }
    this.oscillators = [];
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
      } catch {
        /* */
      }
      this.noiseSource = null;
    }
    if (this.mediaSource) {
      try {
        this.mediaSource.disconnect();
      } catch {
        /* */
      }
      this.mediaSource = null;
    }
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {
        /* */
      }
      this.analyser = null;
      this.analyserData = null;
    }
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        try {
          track.stop();
        } catch {
          /* */
        }
      }
      this.mediaStream = null;
    }
    if (this.sourceGain) {
      try {
        this.sourceGain.disconnect();
      } catch {
        /* */
      }
      this.sourceGain = null;
    }
  }

  private teardownGraph() {
    if (!this.graph) return;
    for (const n of this.graph.disposables) {
      try {
        n.disconnect();
      } catch {
        /* */
      }
    }
    this.graph = null;
  }

  private startSources(ctx: AudioContext, freq: number) {
    const mix = ctx.createGain();
    mix.gain.value = 1;
    mix.connect(this.sourceGain!);

    const partials: { mult: number; gain: number; type: OscillatorType }[] = [
      { mult: 1, gain: 1, type: 'sawtooth' },
      { mult: 2.002, gain: 0.32, type: 'sawtooth' },
      { mult: 3.01, gain: 0.1, type: 'triangle' },
    ];

    for (const p of partials) {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.value = freq * p.mult;
      const g = ctx.createGain();
      g.gain.value = p.gain;
      osc.connect(g);
      g.connect(mix);
      osc.start();
      this.oscillators.push(osc);
    }

    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 1400;
    nf.Q.value = 0.6;
    const ng = ctx.createGain();
    ng.gain.value = 0.035;
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(mix);
    noise.start();
    this.noiseSource = noise;
  }

  private buildGraph(ctx: AudioContext, chain: ChainBlock[]): BuiltGraph {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const disposables: AudioNode[] = [input, output];
    const paramBindings: BuiltGraph['paramBindings'] = [];

    const chainNodes: AudioNode[] = [input];

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 65;
    disposables.push(hp);
    chainNodes.push(hp);

    for (const block of chain) {
      const def = getBlockType(block.typeId);
      if (!def) continue;

      let stage: Stage | null = null;
      switch (def.category) {
        case 'drive':
          stage = this.createDrive(ctx, block.params, def.typeId);
          break;
        case 'amp':
          stage = this.createAmp(ctx, block.params, def.typeId);
          break;
        case 'modulation':
          stage = this.createMod(ctx, block.params, def.typeId);
          break;
        case 'delay':
          stage = this.createDelay(ctx, block.params, def.typeId);
          break;
        case 'reverb':
          stage = this.createReverb(ctx, block.params, def.typeId);
          break;
        case 'cab':
          stage = this.createCab(ctx, block.params, def.typeId);
          break;
      }
      if (!stage) continue;

      disposables.push(...stage.nodes);
      chainNodes.push(stage.entry);
      if (stage.exit !== stage.entry) chainNodes.push(stage.exit);
      paramBindings.push({ blockId: block.id, apply: stage.apply });
    }

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 10;
    limiter.ratio.value = 5;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    disposables.push(limiter);
    chainNodes.push(limiter, output);

    for (let i = 0; i < chainNodes.length - 1; i++) {
      chainNodes[i]!.connect(chainNodes[i + 1]!);
    }

    return { input, output, paramBindings, disposables };
  }

  private createDrive(
    ctx: AudioContext,
    params: Record<string, number | string | boolean>,
    typeId: string,
  ): Stage {
    const inGain = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    shaper.oversample = '2x';
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    const outGain = ctx.createGain();
    inGain.connect(shaper);
    shaper.connect(tone);
    tone.connect(outGain);

    const apply = (p: Record<string, number | string | boolean>) => {
      if (typeId === 'boost') {
        applyDriveCurve(shaper, 0.04);
        inGain.gain.value = 1;
        outGain.gain.value = Math.pow(10, Number(p.gain ?? 6) / 20) * 0.3;
        tone.frequency.value = p.bright ? 9000 : 5000;
        return;
      }
      const amt = driveAmountFromParams('drive', p);
      const boost = typeId === 'fuzz-face' ? 1.25 : typeId === 'rat' ? 1.15 : 1;
      applyDriveCurve(shaper, Math.min(1, amt * boost));
      inGain.gain.value = 0.65 + amt * 0.9;
      tone.frequency.value = 700 + Number(p.tone ?? p.filter ?? 5) * 520;
      outGain.gain.value = 0.4 + (Number(p.level ?? p.volume ?? 5) / 10) * 0.45;
    };
    apply(params);
    return { entry: inGain, exit: outGain, nodes: [inGain, shaper, tone, outGain], apply };
  }

  private createAmp(
    ctx: AudioContext,
    params: Record<string, number | string | boolean>,
    typeId: string,
  ): Stage {
    const inGain = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    shaper.oversample = '2x';
    const bass = ctx.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = 120;
    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 750;
    mid.Q.value = 0.9;
    const treble = ctx.createBiquadFilter();
    treble.type = 'highshelf';
    treble.frequency.value = 3200;
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 4500;
    presence.Q.value = 0.7;
    const outGain = ctx.createGain();

    inGain.connect(shaper);
    shaper.connect(bass);
    bass.connect(mid);
    mid.connect(treble);
    treble.connect(presence);
    presence.connect(outGain);

    const apply = (p: Record<string, number | string | boolean>) => {
      const amt = driveAmountFromParams('amp', p);
      // Twin: clean headroom; Deluxe: earlier blackface breakup; AC30: chimey grind
      const cleanBias =
        typeId === 'twin-reverb'
          ? 0.22
          : typeId === 'deluxe-reverb'
            ? 0.45
            : typeId === 'ac30'
              ? 0.38
              : 1;
      applyDriveCurve(shaper, Math.min(1, amt * cleanBias));
      inGain.gain.value = 0.5 + amt * (typeId === 'deluxe-reverb' ? 0.7 : 0.55);

      bass.gain.value = (Number(p.bass ?? 5) - 5) * 3;
      const midVal = Number(p.middle ?? p.mid ?? 5);
      mid.gain.value =
        (midVal - 5) * 4 +
        (typeId === 'rectifier' ? -3 : typeId === 'deluxe-reverb' ? 1.2 : 0);
      treble.gain.value =
        (Number(p.treble ?? 5) - 5) * 3.5 +
        (p.bright === true ? (typeId === 'deluxe-reverb' ? 2.2 : 3) : 0);
      if (typeId === 'ac30') {
        presence.gain.value = (5 - Number(p.cut ?? 3)) * 1.6;
      } else if (typeId === 'deluxe-reverb') {
        // Mild presence lift — open combo sparkle without twin shimmer
        presence.gain.value = (Number(p.presence ?? 5.5) - 5) * 2 + 1;
      } else {
        presence.gain.value = (Number(p.presence ?? 5) - 5) * 2.5;
      }
      const master = Number(p.master ?? p.volume ?? p.brilliantVol ?? 5) / 10;
      outGain.gain.value = 0.28 + master * 0.5;
    };
    apply(params);
    return {
      entry: inGain,
      exit: outGain,
      nodes: [inGain, shaper, bass, mid, treble, presence, outGain],
      apply,
    };
  }

  private createMod(
    ctx: AudioContext,
    params: Record<string, number | string | boolean>,
    typeId: string,
  ): Stage {
    const entry = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const exit = ctx.createGain();
    const delay = ctx.createDelay(0.08);
    const feedback = ctx.createGain();
    feedback.gain.value = 0;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';

    entry.connect(dry);
    dry.connect(exit);
    entry.connect(delay);
    delay.connect(wet);
    delay.connect(feedback);
    feedback.connect(delay);
    wet.connect(exit);
    lfo.connect(lfoGain);
    lfo.start();

    let tremConnected = false;

    const apply = (p: Record<string, number | string | boolean>) => {
      const rate = Number(p.rate ?? 1);
      const depth = Number(p.depth ?? 5) / 10;
      const mix = Number(p.mix ?? 50) / 100;
      lfo.frequency.value = Math.max(0.05, rate);

      try {
        lfoGain.disconnect();
      } catch {
        /* */
      }
      tremConnected = false;

      if (typeId === 'tremolo') {
        delay.delayTime.value = 0.001;
        lfoGain.gain.value = depth * 0.4;
        dry.gain.value = 1 - depth * 0.3;
        wet.gain.value = 0;
        feedback.gain.value = 0;
        lfoGain.connect(dry.gain);
        tremConnected = true;
      } else {
        const base = typeId === 'flanger' ? 0.0025 : typeId === 'phaser' ? 0.004 : 0.011;
        delay.delayTime.value = base;
        lfoGain.gain.value = base * depth * 0.85;
        lfoGain.connect(delay.delayTime);
        dry.gain.value = 1 - mix * 0.55;
        wet.gain.value = mix;
        feedback.gain.value =
          typeId === 'flanger' || typeId === 'phaser'
            ? (Number(p.feedback ?? 3) / 10) * 0.55
            : 0;
      }
      void tremConnected;
    };
    apply(params);

    return {
      entry,
      exit,
      nodes: [entry, dry, wet, exit, delay, feedback, lfo, lfoGain],
      apply,
    };
  }

  private createDelay(
    ctx: AudioContext,
    params: Record<string, number | string | boolean>,
    typeId: string,
  ): Stage {
    const entry = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const delay = ctx.createDelay(2.5);
    const feedback = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const exit = ctx.createGain();

    // Tape wow/flutter LFO modulates delay time
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.7;
    lfoGain.gain.value = 0;
    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    lfo.start();

    entry.connect(dry);
    entry.connect(delay);
    delay.connect(filter);
    filter.connect(wet);
    filter.connect(feedback);
    feedback.connect(delay);
    dry.connect(exit);
    wet.connect(exit);

    const apply = (p: Record<string, number | string | boolean>) => {
      const timeSec = Math.min(2.4, Number(p.time ?? 350) / 1000);
      delay.delayTime.value = timeSec;
      feedback.gain.value = (Number(p.feedback ?? 35) / 100) * 0.85;
      const mix = Number(p.mix ?? 30) / 100;
      dry.gain.value = 1 - mix * 0.35;
      wet.gain.value = mix;

      if (typeId === 'digital-delay') {
        // Clean digital: wider bandwidth via Hi-Cut, no wow
        filter.frequency.value = 2500 + Number(p.highCut ?? 5) * 1100;
        filter.Q.value = 0.4;
        lfoGain.gain.value = 0;
      } else if (typeId === 'tape-echo') {
        // Warm tape: darker repeats + wow depth
        filter.frequency.value = 1400 + Number(p.wow ?? 3) * 180;
        filter.Q.value = 0.7;
        lfo.frequency.value = 0.45 + Number(p.wow ?? 3) * 0.08;
        lfoGain.gain.value = (Number(p.wow ?? 3) / 10) * Math.min(0.012, timeSec * 0.04);
      } else {
        // Analog BBD: mid warmth, slight softness
        filter.frequency.value = 1600 + Number(p.highCut ?? 4) * 400;
        filter.Q.value = 0.55;
        lfoGain.gain.value = 0;
      }
    };
    apply(params);
    return {
      entry,
      exit,
      nodes: [entry, dry, wet, delay, feedback, filter, exit, lfo, lfoGain],
      apply,
    };
  }

  private createReverb(
    ctx: AudioContext,
    params: Record<string, number | string | boolean>,
    typeId: string,
  ): Stage {
    const entry = ctx.createGain();
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const preDelay = ctx.createDelay(0.2);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    const conv = ctx.createConvolver();
    const exit = ctx.createGain();

    const decay = Number(params.decay ?? params.dwell ?? 2);
    let seconds: number;
    let impulseDecay: number;
    if (typeId === 'spring-reverb') {
      seconds = 1.1;
      impulseDecay = 1.6;
    } else if (typeId === 'room-reverb') {
      // Shorter, denser room vs hall
      seconds = Math.min(1.6, Math.max(0.25, decay * 0.85));
      impulseDecay = 2.8;
    } else if (typeId === 'plate-reverb') {
      seconds = Math.min(2.8, Math.max(0.6, decay));
      impulseDecay = 2.1;
    } else {
      // hall
      seconds = Math.min(4, Math.max(0.8, decay));
      impulseDecay = 2.3;
    }
    conv.buffer = makeReverbImpulse(ctx, seconds, impulseDecay);

    entry.connect(dry);
    entry.connect(preDelay);
    preDelay.connect(conv);
    conv.connect(tone);
    tone.connect(wet);
    dry.connect(exit);
    wet.connect(exit);

    const apply = (p: Record<string, number | string | boolean>) => {
      const mix = Number(p.mix ?? 25) / 100;
      dry.gain.value = 1 - mix * 0.5;
      wet.gain.value = mix * 0.85;
      preDelay.delayTime.value = Math.min(0.18, Number(p.predelay ?? 0) / 1000);
      // Tone: brighter at high values (plate/room/spring)
      const toneVal = Number(p.tone ?? p.damping ?? 5);
      if (typeId === 'hall-reverb') {
        // Hall uses damping (higher = darker)
        tone.frequency.value = 9000 - toneVal * 600;
      } else {
        tone.frequency.value = 1800 + toneVal * 900;
      }
    };
    apply(params);
    return {
      entry,
      exit,
      nodes: [entry, dry, wet, preDelay, tone, conv, exit],
      apply,
    };
  }

  private createCab(
    ctx: AudioContext,
    params: Record<string, number | string | boolean>,
    typeId: string,
  ): Stage {
    const entry = ctx.createGain();
    const low = ctx.createBiquadFilter();
    low.type = 'highpass';
    const high = ctx.createBiquadFilter();
    high.type = 'lowpass';
    const bump = ctx.createBiquadFilter();
    bump.type = 'peaking';
    bump.frequency.value = 400;
    bump.Q.value = 0.8;
    const conv = ctx.createConvolver();
    const kind = typeId.includes('v30')
      ? 'v30'
      : typeId.includes('green')
        ? 'greenback'
        : typeId.includes('blue')
          ? 'blue'
          : typeId.includes('deluxe')
            ? 'deluxe'
            : 'generic';
    conv.buffer = makeCabImpulse(ctx, kind);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    const dry = ctx.createGain();
    dry.gain.value = 0.5;
    const exit = ctx.createGain();

    entry.connect(low);
    low.connect(high);
    high.connect(bump);
    bump.connect(dry);
    bump.connect(conv);
    conv.connect(wet);
    dry.connect(exit);
    wet.connect(exit);

    const apply = (p: Record<string, number | string | boolean>) => {
      const dist = Number(p.distance ?? 2) / 10;
      const defaultLow = typeId.includes('deluxe') ? 70 : 80;
      const defaultHi = typeId.includes('deluxe') ? 12000 : 10000;
      low.frequency.value = Number(p.lowCut ?? defaultLow);
      // Open-back deluxe keeps more air; closed cabs darken with distance faster
      const distFactor = typeId.includes('deluxe') || typeId.includes('blue') ? 0.22 : 0.35;
      const hi = Number(p.highCut ?? defaultHi) * (1 - dist * distFactor);
      high.frequency.value = Math.max(2500, hi);
      bump.gain.value = (0.5 - Number(p.position ?? 3) / 10) * 4;
      // Room knob (open-back cabs): slight wet tilt via bump Q / entry
      if (p.room !== undefined) {
        bump.Q.value = 0.6 + Number(p.room) * 0.05;
      }
    };
    apply(params);
    return {
      entry,
      exit,
      nodes: [entry, low, high, bump, conv, wet, dry, exit],
      apply,
    };
  }
}
