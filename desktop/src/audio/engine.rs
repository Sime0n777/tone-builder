//! Duplex audio engine: input ring → amp DSP → output, with live meters and knobs.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{BufferSize, SampleFormat, SampleRate, StreamConfig};
use parking_lot::Mutex;
use rtrb::{Consumer, Producer, RingBuffer};

use super::backend::{
    AudioBackendKind, BufferSizeChoice, find_device, host_for,
};
use super::dsp::{AmpParams, AmpProcessor};

const RING_CAPACITY: usize = 8192;

#[derive(Clone, Debug, Default)]
pub struct EngineStatus {
    pub running: bool,
    pub backend: String,
    pub sample_rate: u32,
    pub buffer_frames: u32,
    pub input_peak: f32,
    pub output_peak: f32,
    pub last_error: Option<String>,
    pub asio_compiled: bool,
}

/// Atomically updated from UI; read in audio callbacks.
pub struct EngineParams {
    pub drive: AtomicU32, // f32 bits
    pub level: AtomicU32,
    pub input_peak_bits: AtomicU32,
    pub output_peak_bits: AtomicU32,
}

impl EngineParams {
    pub fn new() -> Self {
        Self {
            drive: AtomicU32::new(0.35_f32.to_bits()),
            level: AtomicU32::new(0.7_f32.to_bits()),
            input_peak_bits: AtomicU32::new(0),
            output_peak_bits: AtomicU32::new(0),
        }
    }

    pub fn set_drive(&self, v: f32) {
        self.drive.store(v.clamp(0.0, 1.0).to_bits(), Ordering::Relaxed);
    }

    pub fn set_level(&self, v: f32) {
        self.level.store(v.clamp(0.0, 1.0).to_bits(), Ordering::Relaxed);
    }

    fn amp_params(&self) -> AmpParams {
        AmpParams {
            drive: f32::from_bits(self.drive.load(Ordering::Relaxed)),
            level: f32::from_bits(self.level.load(Ordering::Relaxed)),
        }
    }

    pub fn input_peak(&self) -> f32 {
        f32::from_bits(self.input_peak_bits.load(Ordering::Relaxed))
    }

    pub fn output_peak(&self) -> f32 {
        f32::from_bits(self.output_peak_bits.load(Ordering::Relaxed))
    }
}

impl Default for EngineParams {
    fn default() -> Self {
        Self::new()
    }
}

struct SharedMeter {
    params: Arc<EngineParams>,
    peak_in: f32,
    peak_out: f32,
}

impl SharedMeter {
    fn note_input(&mut self, samples: &[f32]) {
        let mut p = 0.0_f32;
        for &s in samples {
            p = p.max(s.abs());
        }
        self.peak_in = self.peak_in * 0.92 + p * 0.08;
        if p > self.peak_in {
            self.peak_in = p;
        }
        self.params
            .input_peak_bits
            .store(self.peak_in.to_bits(), Ordering::Relaxed);
    }

    fn note_output(&mut self, samples: &[f32]) {
        let mut p = 0.0_f32;
        for &s in samples {
            p = p.max(s.abs());
        }
        self.peak_out = self.peak_out * 0.92 + p * 0.08;
        if p > self.peak_out {
            self.peak_out = p;
        }
        self.params
            .output_peak_bits
            .store(self.peak_out.to_bits(), Ordering::Relaxed);
    }
}

/// Holds live cpal streams. Dropping stops audio.
struct LiveStreams {
    _input: cpal::Stream,
    _output: cpal::Stream,
}

pub struct AudioEngine {
    params: Arc<EngineParams>,
    running: Arc<AtomicBool>,
    streams: Option<LiveStreams>,
    status: Arc<Mutex<EngineStatus>>,
}

impl AudioEngine {
    pub fn new() -> Self {
        Self {
            params: Arc::new(EngineParams::new()),
            running: Arc::new(AtomicBool::new(false)),
            streams: None,
            status: Arc::new(Mutex::new(EngineStatus {
                asio_compiled: cfg!(feature = "asio"),
                ..Default::default()
            })),
        }
    }

    pub fn params(&self) -> Arc<EngineParams> {
        Arc::clone(&self.params)
    }

    pub fn status_snapshot(&self) -> EngineStatus {
        let mut s = self.status.lock().clone();
        s.running = self.running.load(Ordering::Relaxed);
        s.input_peak = self.params.input_peak();
        s.output_peak = self.params.output_peak();
        s.asio_compiled = cfg!(feature = "asio");
        s
    }

    pub fn stop(&mut self) {
        self.running.store(false, Ordering::SeqCst);
        self.streams = None;
        let mut s = self.status.lock();
        s.running = false;
    }

    pub fn start(
        &mut self,
        backend: AudioBackendKind,
        input_name: Option<&str>,
        output_name: Option<&str>,
        buffer: BufferSizeChoice,
    ) -> Result<(), String> {
        self.stop();

        let host = host_for(backend)?;
        let in_dev = match input_name {
            Some(n) if !n.is_empty() => find_device(&host, n, true),
            _ => host.default_input_device(),
        }
        .ok_or_else(|| "No input device found".to_string())?;

        let out_dev = match output_name {
            Some(n) if !n.is_empty() => find_device(&host, n, false),
            _ => host.default_output_device(),
        }
        .ok_or_else(|| "No output device found".to_string())?;

        let in_name = in_dev.name().unwrap_or_else(|_| "input".into());
        let out_name = out_dev.name().unwrap_or_else(|_| "output".into());

        let in_supp = in_dev
            .default_input_config()
            .map_err(|e| format!("input config: {e}"))?;
        let out_supp = out_dev
            .default_output_config()
            .map_err(|e| format!("output config: {e}"))?;

        let sample_rate = SampleRate(out_supp.sample_rate().0);
        let frames = buffer.frames();

        let mut in_cfg: StreamConfig = in_supp.clone().into();
        in_cfg.sample_rate = sample_rate;
        in_cfg.buffer_size = BufferSize::Fixed(frames);
        // Mono capture preferred when available; keep device channel count if needed
        if in_cfg.channels > 2 {
            in_cfg.channels = 1;
        }

        let mut out_cfg: StreamConfig = out_supp.clone().into();
        out_cfg.sample_rate = sample_rate;
        out_cfg.buffer_size = BufferSize::Fixed(frames);

        let (producer, consumer) = RingBuffer::<f32>::new(RING_CAPACITY);
        let producer = Arc::new(Mutex::new(producer));
        let consumer = Arc::new(Mutex::new(consumer));

        let params = Arc::clone(&self.params);
        let params_out = Arc::clone(&self.params);
        let running = Arc::clone(&self.running);
        let running_out = Arc::clone(&self.running);

        let err_in = Arc::clone(&self.status);
        let err_out = Arc::clone(&self.status);

        let in_format = in_supp.sample_format();
        let out_format = out_supp.sample_format();

        let input_stream = build_input_stream(
            &in_dev,
            &in_cfg,
            in_format,
            producer,
            params,
            running,
            err_in,
        )?;

        let output_stream = build_output_stream(
            &out_dev,
            &out_cfg,
            out_format,
            consumer,
            params_out,
            running_out,
            err_out,
            sample_rate.0 as f32,
        )?;

        input_stream
            .play()
            .map_err(|e| format!("input play: {e}"))?;
        output_stream
            .play()
            .map_err(|e| format!("output play: {e}"))?;

        self.running.store(true, Ordering::SeqCst);
        {
            let mut s = self.status.lock();
            s.running = true;
            s.backend = format!(
                "{} | in: {} | out: {}",
                backend.label(),
                in_name,
                out_name
            );
            s.sample_rate = sample_rate.0;
            s.buffer_frames = frames;
            s.last_error = None;
        }

        self.streams = Some(LiveStreams {
            _input: input_stream,
            _output: output_stream,
        });

        Ok(())
    }
}

impl Default for AudioEngine {
    fn default() -> Self {
        Self::new()
    }
}

fn build_input_stream(
    device: &cpal::Device,
    config: &StreamConfig,
    format: SampleFormat,
    producer: Arc<Mutex<Producer<f32>>>,
    params: Arc<EngineParams>,
    running: Arc<AtomicBool>,
    status: Arc<Mutex<EngineStatus>>,
) -> Result<cpal::Stream, String> {
    let channels = config.channels as usize;
    let mut meter = SharedMeter {
        params,
        peak_in: 0.0,
        peak_out: 0.0,
    };

    let err_fn = move |e| {
        status.lock().last_error = Some(format!("input stream: {e}"));
    };

    match format {
        SampleFormat::F32 => device
            .build_input_stream(
                config,
                move |data: &[f32], _| {
                    if !running.load(Ordering::Relaxed) {
                        return;
                    }
                    let mut mono = Vec::with_capacity(data.len() / channels.max(1));
                    for frame in data.chunks(channels) {
                        let s = frame.first().copied().unwrap_or(0.0);
                        mono.push(s);
                    }
                    meter.note_input(&mono);
                    let mut prod = producer.lock();
                    for s in mono {
                        let _ = prod.push(s);
                    }
                },
                err_fn,
                None,
            )
            .map_err(|e| format!("build input f32: {e}")),
        SampleFormat::I16 => device
            .build_input_stream(
                config,
                move |data: &[i16], _| {
                    if !running.load(Ordering::Relaxed) {
                        return;
                    }
                    let mut mono = Vec::with_capacity(data.len() / channels.max(1));
                    for frame in data.chunks(channels) {
                        let s = frame.first().copied().unwrap_or(0) as f32 / 32768.0;
                        mono.push(s);
                    }
                    meter.note_input(&mono);
                    let mut prod = producer.lock();
                    for s in mono {
                        let _ = prod.push(s);
                    }
                },
                err_fn,
                None,
            )
            .map_err(|e| format!("build input i16: {e}")),
        other => Err(format!("unsupported input format: {other:?}")),
    }
}

fn build_output_stream(
    device: &cpal::Device,
    config: &StreamConfig,
    format: SampleFormat,
    consumer: Arc<Mutex<Consumer<f32>>>,
    params: Arc<EngineParams>,
    running: Arc<AtomicBool>,
    status: Arc<Mutex<EngineStatus>>,
    sample_rate: f32,
) -> Result<cpal::Stream, String> {
    let channels = config.channels as usize;
    let mut processor = AmpProcessor::new(sample_rate);
    let mut meter = SharedMeter {
        params: Arc::clone(&params),
        peak_in: 0.0,
        peak_out: 0.0,
    };
    let mut scratch: Vec<f32> = Vec::with_capacity(512);

    let err_fn = move |e| {
        status.lock().last_error = Some(format!("output stream: {e}"));
    };

    match format {
        SampleFormat::F32 => device
            .build_output_stream(
                config,
                move |data: &mut [f32], _| {
                    let frames = data.len() / channels.max(1);
                    scratch.resize(frames, 0.0);

                    if running.load(Ordering::Relaxed) {
                        let mut cons = consumer.lock();
                        for i in 0..frames {
                            scratch[i] = cons.pop().unwrap_or(0.0);
                        }
                        drop(cons);
                        processor.process_block(&mut scratch, params.amp_params());
                    } else {
                        scratch.fill(0.0);
                    }

                    meter.note_output(&scratch);
                    for (fi, frame) in data.chunks_mut(channels).enumerate() {
                        let s = scratch.get(fi).copied().unwrap_or(0.0);
                        for ch in frame.iter_mut() {
                            *ch = s;
                        }
                    }
                },
                err_fn,
                None,
            )
            .map_err(|e| format!("build output f32: {e}")),
        SampleFormat::I16 => device
            .build_output_stream(
                config,
                move |data: &mut [i16], _| {
                    let frames = data.len() / channels.max(1);
                    scratch.resize(frames, 0.0);

                    if running.load(Ordering::Relaxed) {
                        let mut cons = consumer.lock();
                        for i in 0..frames {
                            scratch[i] = cons.pop().unwrap_or(0.0);
                        }
                        drop(cons);
                        processor.process_block(&mut scratch, params.amp_params());
                    } else {
                        scratch.fill(0.0);
                    }

                    meter.note_output(&scratch);
                    for (fi, frame) in data.chunks_mut(channels).enumerate() {
                        let s = scratch.get(fi).copied().unwrap_or(0.0);
                        let v = (s * 32767.0).clamp(-32768.0, 32767.0) as i16;
                        for ch in frame.iter_mut() {
                            *ch = v;
                        }
                    }
                },
                err_fn,
                None,
            )
            .map_err(|e| format!("build output i16: {e}")),
        other => Err(format!("unsupported output format: {other:?}")),
    }
}
