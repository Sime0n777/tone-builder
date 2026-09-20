//! Host / device enumeration hooks for ASIO (feature) and default WASAPI / platform host.

use cpal::traits::{DeviceTrait, HostTrait};

/// Selectable callback buffer sizes (frames per callback).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BufferSizeChoice {
    Frames64 = 64,
    Frames128 = 128,
    Frames256 = 256,
    Frames512 = 512,
}

impl BufferSizeChoice {
    pub const ALL: [BufferSizeChoice; 4] = [
        BufferSizeChoice::Frames64,
        BufferSizeChoice::Frames128,
        BufferSizeChoice::Frames256,
        BufferSizeChoice::Frames512,
    ];

    pub fn frames(self) -> u32 {
        self as u32
    }

    pub fn label(self) -> &'static str {
        match self {
            BufferSizeChoice::Frames64 => "64",
            BufferSizeChoice::Frames128 => "128",
            BufferSizeChoice::Frames256 => "256",
            BufferSizeChoice::Frames512 => "512",
        }
    }
}

impl Default for BufferSizeChoice {
    fn default() -> Self {
        BufferSizeChoice::Frames128
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AudioBackendKind {
    /// Platform default — on Windows this is WASAPI (shared). Interim low-latency path.
    DefaultWasapi,
    /// Steinberg ASIO (requires `--features asio` build + SDK + driver).
    Asio,
}

impl AudioBackendKind {
    pub fn label(self) -> &'static str {
        match self {
            AudioBackendKind::DefaultWasapi => "WASAPI (default)",
            AudioBackendKind::Asio => "ASIO",
        }
    }

    pub fn is_available(self) -> bool {
        match self {
            AudioBackendKind::DefaultWasapi => true,
            AudioBackendKind::Asio => cfg!(feature = "asio"),
        }
    }
}

#[derive(Clone, Debug)]
pub struct DeviceInfo {
    pub name: String,
    pub is_input: bool,
    pub is_output: bool,
}

/// List backends the UI can offer.
pub fn available_backends() -> Vec<AudioBackendKind> {
    let mut v = vec![AudioBackendKind::DefaultWasapi];
    if cfg!(feature = "asio") {
        v.push(AudioBackendKind::Asio);
    }
    v
}

/// Open a cpal Host for the chosen backend.
pub fn host_for(kind: AudioBackendKind) -> Result<cpal::Host, String> {
    match kind {
        AudioBackendKind::DefaultWasapi => Ok(cpal::default_host()),
        AudioBackendKind::Asio => {
            #[cfg(feature = "asio")]
            {
                cpal::host_from_id(cpal::HostId::Asio)
                    .map_err(|e| format!("ASIO host unavailable: {e}"))
            }
            #[cfg(not(feature = "asio"))]
            {
                Err(
                    "ASIO support was not compiled in. Rebuild with: cargo build --features asio \
                     (Windows + Steinberg ASIO SDK + LLVM). See desktop/asio_sdk/README.md."
                        .into(),
                )
            }
        }
    }
}

/// Enumerate devices for a backend (input and/or output capable names).
pub fn enumerate_hosts(kind: AudioBackendKind) -> Result<Vec<DeviceInfo>, String> {
    let host = host_for(kind)?;
    let mut out = Vec::new();

    if let Ok(devices) = host.devices() {
        for device in devices {
            let name = device.name().unwrap_or_else(|_| "<unknown>".into());
            let is_input = device.default_input_config().is_ok();
            let is_output = device.default_output_config().is_ok();
            if is_input || is_output {
                out.push(DeviceInfo {
                    name,
                    is_input,
                    is_output,
                });
            }
        }
    }

    // Prefer listing defaults even if devices() is empty on some hosts
    if out.is_empty() {
        if let Some(d) = host.default_input_device() {
            if let Ok(name) = d.name() {
                out.push(DeviceInfo {
                    name,
                    is_input: true,
                    is_output: false,
                });
            }
        }
        if let Some(d) = host.default_output_device() {
            if let Ok(name) = d.name() {
                out.push(DeviceInfo {
                    name,
                    is_input: false,
                    is_output: true,
                });
            }
        }
    }

    Ok(out)
}

pub fn find_device(host: &cpal::Host, name: &str, want_input: bool) -> Option<cpal::Device> {
    let devices = host.devices().ok()?;
    for d in devices {
        let Ok(n) = d.name() else { continue };
        if n != name {
            continue;
        }
        if want_input && d.default_input_config().is_ok() {
            return Some(d);
        }
        if !want_input && d.default_output_config().is_ok() {
            return Some(d);
        }
    }
    if want_input {
        host.default_input_device()
    } else {
        host.default_output_device()
    }
}
