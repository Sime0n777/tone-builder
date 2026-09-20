//! Low-latency audio engine: host selection, duplex I/O, amp-ish DSP callback.
pub mod backend;
pub mod dsp;
pub mod engine;

pub use engine::{AudioEngine, EngineStatus};
