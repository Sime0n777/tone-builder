import { getBlockType } from '../data/blockCatalog';
import type { ChainBlock, TonePreset } from '../types/tone';
import { channelDriveBias, getAmpVoice } from './ampModels';
import { cabKindFromTypeId, makeCabImpulse, makeReverbImpulse } from './impulse';
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
 * Factory amp-sim engine (algorithmic models — not neural captures).
 * Source (synth oscillators or live MediaStream) → drive → amp (preamp /
 * tone stack / power sag) → modulation/delay/reverb → cab IR → out.
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
      const style =
        typeId === 'fuzz-face' ? 'fuzz' : typeId === 'rat' ? 'hard' : 'tube';
      applyDriveCurve(shaper, Math.min(1, amt * boost), style, typeId === 'fuzz-face' ? 0.35 : 0.15);
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
    /**
     * Multi-stage algorithmic amp:
     *   input HPF → bright shelf → preamp gain → preamp shaper →
     *   tone stack (bass/mid/treble) → sag compressor → power shaper →
     *   presence/cut → master
     * Voicing comes from ampModels.ts (factory sims, not NAM/ToneX captures).
     */
    const voice = getAmpVoice(typeId);

    const entry = ctx.createGain();
    const inputHp = ctx.createBiquadFilter();
    inputHp.type = 'highpass';
    inputHp.frequency.value = voice.inputHpfHz;
    inputHp.Q.value = 0.7;

    const bright = ctx.createBiquadFilter();
    bright.type = 'highshelf';
    bright.frequency.value = voice.brightCapHz || 3000;
    bright.gain.value = 0;

    const preGain = ctx.createGain();
    const preShaper = ctx.createWaveShaper();
    preShaper.oversample = '4x';

    // Mild pre-EQ before tone stack (tightens mud on high-gain voices)
    const preTight = ctx.createBiquadFilter();
    preTight.type = 'lowshelf';
    preTight.frequency.value = 180;
    preTight.gain.value = voice.family === 'mesa' ? -2.5 : voice.family === 'marshall' ? -1.5 : 0;

    const bass = ctx.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = voice.bassFreqHz;

    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = voice.midFreqHz;
    mid.Q.value = voice.midQ;

    const treble = ctx.createBiquadFilter();
    treble.type = 'highshelf';
    treble.frequency.value = voice.trebleFreqHz;

    // Power-amp sag approximation via dynamics compressor
    const sag = ctx.createDynamicsCompressor();
    sag.threshold.value = -24;
    sag.knee.value = 12;
    sag.ratio.value = 1.5;
    sag.attack.value = 0.02;
    sag.release.value = 0.25;

    const powerGain = ctx.createGain();
    const powerShaper = ctx.createWaveShaper();
    powerShaper.oversample = '2x';

    const presence = ctx.createBiquadFilter();
    presence.type = voice.useCutControl ? 'highshelf' : 'peaking';
    presence.frequency.value = voice.presenceFreqHz;
    presence.Q.value = 0.7;

    const outGain = ctx.createGain();

    entry
      .connect(inputHp)
      .connect(bright)
      .connect(preGain)
      .connect(preShaper)
      .connect(preTight)
      .connect(bass)
      .connect(mid)
      .connect(treble)
      .connect(sag)
      .connect(powerGain)
      .connect(powerShaper)
      .connect(presence)
      .connect(outGain);

    const apply = (p: Record<string, number | string | boolean>) => {
      const userGain =
        Number(p.gain ?? p.volume ?? p.brilliantVol ?? 5) / 10;
      const channel = channelDriveBias(p.channel);
      const preAmt = Math.min(
        1,
        (voice.preampSensitivity * 0.35 + userGain * voice.preampDriveScale) *
          channel.driveMul,
      );

      applyDriveCurve(preShaper, preAmt, 'tube', voice.preampAsymmetry);
      preGain.gain.value = 0.55 + preAmt * 1.15;

      // Bright cap: Fender-style shelf when toggle on (and voice supports it)
      if (voice.brightCapHz > 0 && p.bright === true) {
        bright.frequency.value = voice.brightCapHz;
        // Bright is more pronounced at lower volumes (real bright-cap behavior)
        const brightScale = 1.15 - userGain * 0.45;
        bright.gain.value = voice.brightCapDb * Math.max(0.35, brightScale);
      } else {
        bright.gain.value = 0;
      }

      bass.gain.value =
        (Number(p.bass ?? 5) - 5) * (voice.family === 'fender' ? 3.2 : 2.8) +
        voice.bassBiasDb;
      const midVal = Number(p.middle ?? p.mid ?? 5);
      mid.gain.value =
        (midVal - 5) * (voice.family === 'marshall' ? 4.5 : 3.6) +
        voice.midBiasDb +
        channel.midExtraDb;
      treble.gain.value =
        (Number(p.treble ?? 5) - 5) * 3.4 + voice.trebleBiasDb;

      // Sag: more compression when preamp is pushed
      const sagAmt = voice.sag * (0.4 + preAmt * 0.6);
      sag.threshold.value = -12 - sagAmt * 18;
      sag.ratio.value = 1.2 + sagAmt * 3.5;
      sag.attack.value = 0.008 + (1 - sagAmt) * 0.025;
      sag.release.value = 0.12 + sagAmt * 0.22;

      const master = Number(p.master ?? p.volume ?? p.brilliantVol ?? 5) / 10;
      // Power stage: more saturation when master is up (pushing the power amp)
      const powerAmt = Math.min(
        1,
        master * voice.powerDriveScale * (0.5 + preAmt * 0.5),
      );
      applyDriveCurve(
        powerShaper,
        powerAmt * 0.85,
        voice.family === 'mesa' ? 'hard' : 'tube',
        voice.preampAsymmetry * 0.6,
      );
      powerGain.gain.value = 0.7 + powerAmt * 0.45;

      if (voice.useCutControl) {
        // Vox Cut: higher = less top (highshelf negative gain)
        const cut = Number(p.cut ?? 3);
        presence.type = 'highshelf';
        presence.frequency.value = voice.presenceFreqHz;
        presence.gain.value = -cut * 1.8 + voice.presenceBiasDb;
      } else {
        presence.type = 'peaking';
        presence.frequency.value = voice.presenceFreqHz;
        // Deluxe/Twin have no presence knob — mild fixed sparkle via bias
        const presKnob = Number(
          p.presence ?? (voice.family === 'fender' ? 5.5 : 5),
        );
        presence.gain.value =
          (presKnob - 5) * 2.6 + voice.presenceBiasDb;
      }

      // Normal channel contribution on AC30 (blend into pre gain slightly)
      if (typeId === 'ac30') {
        const normal = Number(p.normalVol ?? 0) / 10;
        preGain.gain.value += normal * 0.35;
      }

      outGain.gain.value = (0.26 + master * 0.48) * voice.outputTrim;
    };
    apply(params);

    return {
      entry,
      exit: outGain,
      nodes: [
        entry,
        inputHp,
        bright,
        preGain,
        preShaper,
        preTight,
        bass,
        mid,
        treble,
        sag,
        powerGain,
        powerShaper,
        presence,
        outGain,
      ],
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
    const kind = cabKindFromTypeId(typeId);
    const entry = ctx.createGain();
    const low = ctx.createBiquadFilter();
    low.type = 'highpass';
    const high = ctx.createBiquadFilter();
    high.type = 'lowpass';
    // On-axis / off-axis mid bump
    const bump = ctx.createBiquadFilter();
    bump.type = 'peaking';
    bump.frequency.value = 400;
    bump.Q.value = 0.8;
    // Mic presence / air EQ layered on top of IR
    const micEq = ctx.createBiquadFilter();
    micEq.type = 'peaking';
    micEq.frequency.value = 4500;
    micEq.Q.value = 0.9;
    const air = ctx.createBiquadFilter();
    air.type = 'highshelf';
    air.frequency.value = 7000;

    const conv = ctx.createConvolver();
    const wet = ctx.createGain();
    wet.gain.value = 0.72;
    const dry = ctx.createGain();
    dry.gain.value = 0.28;
    const exit = ctx.createGain();

    // Open-back room wash (short delayed bleed)
    const roomDelay = ctx.createDelay(0.08);
    roomDelay.delayTime.value = 0.018;
    const roomGain = ctx.createGain();
    roomGain.gain.value = 0;
    const roomLp = ctx.createBiquadFilter();
    roomLp.type = 'lowpass';
    roomLp.frequency.value = 3500;

    let lastKey = '';

    const rebuildIr = (p: Record<string, number | string | boolean>) => {
      const key = [
        String(p.mic ?? 'SM57'),
        Number(p.position ?? 3).toFixed(1),
        Number(p.distance ?? 2).toFixed(1),
        Number(p.room ?? 0).toFixed(1),
      ].join('|');
      if (key === lastKey && conv.buffer) return;
      lastKey = key;
      conv.buffer = makeCabImpulse(ctx, kind, {
        mic: String(p.mic ?? 'SM57'),
        position: Number(p.position ?? 3),
        distance: Number(p.distance ?? 2),
        room: Number(p.room ?? 0),
      });
    };

    entry.connect(low);
    low.connect(high);
    high.connect(bump);
    bump.connect(micEq);
    micEq.connect(air);
    air.connect(dry);
    air.connect(conv);
    conv.connect(wet);
    dry.connect(exit);
    wet.connect(exit);
    // Room path for open-back cabs
    air.connect(roomDelay);
    roomDelay.connect(roomLp);
    roomLp.connect(roomGain);
    roomGain.connect(exit);

    const apply = (p: Record<string, number | string | boolean>) => {
      rebuildIr(p);

      const dist = Number(p.distance ?? 2) / 10;
      const pos = Number(p.position ?? 3) / 10;
      const isOpen = kind === 'deluxe' || kind === 'blue';
      const defaultLow = kind === 'deluxe' ? 70 : kind === 'v30' ? 90 : 80;
      const defaultHi =
        kind === 'deluxe' ? 13000 : kind === 'blue' ? 11000 : kind === 'v30' ? 9500 : 10500;

      low.frequency.value = Number(p.lowCut ?? defaultLow);
      const distFactor = isOpen ? 0.28 : 0.4;
      const hi = Number(p.highCut ?? defaultHi) * (1 - dist * distFactor);
      high.frequency.value = Math.max(2200, hi);

      // Position: on-axis (low) = brighter mid bump; off-axis = darker scoop
      bump.frequency.value = 350 + pos * 250;
      bump.gain.value = (0.55 - pos) * 5.5;
      bump.Q.value = 0.65 + pos * 0.35;

      // Mic EQ extras (IR already colored; this makes knob changes immediate)
      const mic = String(p.mic ?? 'SM57');
      if (mic === 'SM57') {
        micEq.frequency.value = 5000;
        micEq.gain.value = 2.2;
        air.gain.value = -1.5 + (1 - pos) * 1.5;
      } else if (mic === 'MD421') {
        micEq.frequency.value = 3200;
        micEq.gain.value = 1.2;
        air.gain.value = 0.5;
      } else if (mic === 'R121') {
        micEq.frequency.value = 2800;
        micEq.gain.value = -1.5;
        air.gain.value = -4.5 - dist * 2;
      } else {
        // U87
        micEq.frequency.value = 8000;
        micEq.gain.value = 1.5;
        air.gain.value = 3.5 - dist * 2;
      }

      // Room wash (open-back)
      const room = Number(p.room ?? 0) / 10;
      roomGain.gain.value = isOpen ? room * 0.28 : room * 0.08;
      roomDelay.delayTime.value = 0.012 + dist * 0.035 + room * 0.015;
      roomLp.frequency.value = 4200 - dist * 1500;

      // More wet IR at closer mics; a touch of dry for clarity
      wet.gain.value = 0.62 + (1 - dist) * 0.2;
      dry.gain.value = 0.38 - (1 - dist) * 0.15;
    };
    apply(params);

    return {
      entry,
      exit,
      nodes: [
        entry,
        low,
        high,
        bump,
        micEq,
        air,
        conv,
        wet,
        dry,
        roomDelay,
        roomLp,
        roomGain,
        exit,
      ],
      apply,
    };
  }

}
