//! Simple but real amp-ish processing: input → gain/drive waveshaper → cab EQ/IR → output.
//!
//! This is a scaffold voice — not a full factory amp library and not ToneX.

#![allow(clippy::needless_range_loop)]

/// Shared UI ↔ audio params (copied into the RT path each callback block).
#[derive(Clone, Copy, Debug)]
pub struct AmpParams {
    pub drive: f32, // 0..1
    pub level: f32, // 0..1
}

impl Default for AmpParams {
    fn default() -> Self {
        Self {
            drive: 0.35,
            level: 0.7,
        }
    }
}

/// One-pole / biquad-ish cab tone stack + short FIR IR for “cab-ish” body.
pub struct AmpProcessor {
    sample_rate: f32,
    // Pre-emphasis / bright
    hp_z: f32,
    // Presence / low-pass after drive
    lp_z: f32,
    // Short impulse response delay line (cab body)
    ir: Vec<f32>,
    ir_buf: Vec<f32>,
    ir_pos: usize,
    // Soft saturator state
    dc_z: f32,
}

impl AmpProcessor {
    pub fn new(sample_rate: f32) -> Self {
        let ir = Self::build_short_cab_ir(sample_rate);
        let ir_len = ir.len();
        Self {
            sample_rate: sample_rate.max(1.0),
            hp_z: 0.0,
            lp_z: 0.0,
            ir,
            ir_buf: vec![0.0; ir_len],
            ir_pos: 0,
            dc_z: 0.0,
        }
    }

    #[allow(dead_code)]
    pub fn set_sample_rate(&mut self, sample_rate: f32) {
        if (sample_rate - self.sample_rate).abs() < 1.0 {
            return;
        }
        *self = Self::new(sample_rate);
    }

    /// Process mono samples in place.
    pub fn process_block(&mut self, samples: &mut [f32], params: AmpParams) {
        let drive = params.drive.clamp(0.0, 1.0);
        let level = params.level.clamp(0.0, 1.0);

        // Gain into waveshaper: ~0 dB .. ~+36 dB equivalent feel
        let pre_gain = 1.0 + drive * drive * 48.0;
        let out_gain = level * level * 0.85;

        // High-pass ~80 Hz, low-pass ~5.5 kHz (cab-ish), coefficients per sample rate
        let hp_coeff = (-2.0 * std::f32::consts::PI * 80.0 / self.sample_rate).exp();
        let lp_coeff = (-2.0 * std::f32::consts::PI * 5500.0 / self.sample_rate).exp();

        for s in samples.iter_mut() {
            let mut x = *s;

            // Input HPF (guitar / interface rumble)
            let hp = x - self.hp_z;
            self.hp_z = x + (self.hp_z - x) * hp_coeff;
            x = hp;

            // Drive into soft clip (asymmetric tube-ish)
            x *= pre_gain;
            x = soft_clip_asymmetric(x, 0.15 + drive * 0.55);

            // Mild DC block
            let y = x - self.dc_z;
            self.dc_z += y * 0.0005;
            x = y;

            // Cab LPF
            self.lp_z += (1.0 - lp_coeff) * (x - self.lp_z);
            x = self.lp_z;

            // Short FIR cab IR
            x = self.convolve_ir(x);

            *s = (x * out_gain).clamp(-1.0, 1.0);
        }
    }

    fn convolve_ir(&mut self, input: f32) -> f32 {
        let n = self.ir.len();
        if n == 0 {
            return input;
        }
        self.ir_buf[self.ir_pos] = input;
        let mut acc = 0.0_f32;
        let mut idx = self.ir_pos;
        for tap in 0..n {
            acc += self.ir_buf[idx] * self.ir[tap];
            idx = if idx == 0 { n - 1 } else { idx - 1 };
        }
        self.ir_pos = (self.ir_pos + 1) % n;
        acc
    }

    /// Tiny synthetic cab IR (~3–4 ms): early reflection + decaying HF roll-off feel.
    fn build_short_cab_ir(sample_rate: f32) -> Vec<f32> {
        let len = ((sample_rate * 0.0035) as usize).clamp(16, 256);
        let mut ir = vec![0.0_f32; len];
        for i in 0..len {
            let t = i as f32 / sample_rate;
            // Direct + early bump
            let direct = if i == 0 {
                0.85
            } else if i == 1 {
                0.35
            } else {
                0.0
            };
            let body = (-t * 900.0).exp() * (t * 2.0 * std::f32::consts::PI * 180.0).sin() * 0.22;
            let mid = (-t * 1400.0).exp() * (t * 2.0 * std::f32::consts::PI * 720.0).sin() * 0.12;
            ir[i] = direct + body + mid;
        }
        // Normalize energy
        let energy: f32 = ir.iter().map(|v| v * v).sum::<f32>().sqrt().max(1e-6);
        for v in ir.iter_mut() {
            *v /= energy;
        }
        ir
    }
}

#[inline]
fn soft_clip_asymmetric(x: f32, amount: f32) -> f32 {
    // Positive: softer tanh; negative: harder fold for even harmonics
    let a = amount.clamp(0.05, 0.95);
    if x >= 0.0 {
        (x * (1.0 + a)).tanh()
    } else {
        let y = (x * (1.0 + a * 1.35)).tanh();
        y * (0.92 + 0.08 * (1.0 - a))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn silence_stays_quiet() {
        let mut p = AmpProcessor::new(48_000.0);
        let mut buf = [0.0_f32; 64];
        p.process_block(&mut buf, AmpParams::default());
        assert!(buf.iter().all(|s| s.abs() < 1e-4));
    }

    #[test]
    fn drive_increases_energy() {
        let mut p = AmpProcessor::new(48_000.0);
        let mut low = [0.1_f32; 128];
        let mut high = [0.1_f32; 128];
        p.process_block(
            &mut low,
            AmpParams {
                drive: 0.1,
                level: 0.7,
            },
        );
        let mut p2 = AmpProcessor::new(48_000.0);
        p2.process_block(
            &mut high,
            AmpParams {
                drive: 0.9,
                level: 0.7,
            },
        );
        let e = |b: &[f32]| b.iter().map(|s| s * s).sum::<f32>();
        assert!(e(&high) > e(&low));
    }
}
