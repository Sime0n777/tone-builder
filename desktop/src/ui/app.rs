//! Minimal native UI: backend/device/buffer, input meter, Drive/Level, Start/Stop.

use eframe::egui;

use crate::audio::backend::{
    available_backends, enumerate_hosts, AudioBackendKind, BufferSizeChoice, DeviceInfo,
};
use crate::audio::{AudioEngine, EngineStatus};

pub struct ToneBuilderApp {
    engine: AudioEngine,
    backends: Vec<AudioBackendKind>,
    backend: AudioBackendKind,
    devices: Vec<DeviceInfo>,
    input_idx: usize,
    output_idx: usize,
    buffer: BufferSizeChoice,
    drive: f32,
    level: f32,
    status_msg: String,
    refresh_error: Option<String>,
}

impl ToneBuilderApp {
    pub fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        let backends = available_backends();
        let backend = backends[0];
        let mut app = Self {
            engine: AudioEngine::new(),
            backends,
            backend,
            devices: Vec::new(),
            input_idx: 0,
            output_idx: 0,
            buffer: BufferSizeChoice::Frames128,
            drive: 0.35,
            level: 0.7,
            status_msg: "Idle — pick devices and Start.".into(),
            refresh_error: None,
        };
        app.refresh_devices();
        app
    }

    fn refresh_devices(&mut self) {
        match enumerate_hosts(self.backend) {
            Ok(list) => {
                self.devices = list;
                self.refresh_error = None;
                let inputs: Vec<usize> = self
                    .devices
                    .iter()
                    .enumerate()
                    .filter(|(_, d)| d.is_input)
                    .map(|(i, _)| i)
                    .collect();
                let outputs: Vec<usize> = self
                    .devices
                    .iter()
                    .enumerate()
                    .filter(|(_, d)| d.is_output)
                    .map(|(i, _)| i)
                    .collect();
                self.input_idx = inputs.first().copied().unwrap_or(0);
                self.output_idx = outputs.first().copied().unwrap_or(0);
            }
            Err(e) => {
                self.devices.clear();
                self.refresh_error = Some(e);
            }
        }
    }

    fn input_choices(&self) -> Vec<(usize, &str)> {
        self.devices
            .iter()
            .enumerate()
            .filter(|(_, d)| d.is_input)
            .map(|(i, d)| (i, d.name.as_str()))
            .collect()
    }

    fn output_choices(&self) -> Vec<(usize, &str)> {
        self.devices
            .iter()
            .enumerate()
            .filter(|(_, d)| d.is_output)
            .map(|(i, d)| (i, d.name.as_str()))
            .collect()
    }

    fn start(&mut self) {
        let in_name = self.devices.get(self.input_idx).map(|d| d.name.as_str());
        let out_name = self.devices.get(self.output_idx).map(|d| d.name.as_str());
        match self
            .engine
            .start(self.backend, in_name, out_name, self.buffer)
        {
            Ok(()) => {
                self.status_msg = format!(
                    "Running — {} @ {} frames",
                    self.backend.label(),
                    self.buffer.frames()
                );
            }
            Err(e) => {
                self.status_msg = format!("Start failed: {e}");
            }
        }
    }

    fn stop(&mut self) {
        self.engine.stop();
        self.status_msg = "Stopped.".into();
    }
}

impl eframe::App for ToneBuilderApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Keep knobs → engine params live
        self.engine.params().set_drive(self.drive);
        self.engine.params().set_level(self.level);

        let st: EngineStatus = self.engine.status_snapshot();
        ctx.request_repaint_after(std::time::Duration::from_millis(33));

        egui::CentralPanel::default().show(ctx, |ui| {
            ui.heading("Tone Builder Desktop");
            ui.label("Native low-latency scaffold — ASIO (optional) / WASAPI — not Electron / Web Audio.");
            ui.separator();

            ui.horizontal(|ui| {
                ui.label("Backend:");
                let prev_backend = self.backend;
                egui::ComboBox::from_id_salt("backend")
                    .selected_text(self.backend.label())
                    .show_ui(ui, |ui| {
                        for b in self.backends.clone() {
                            let label = if b.is_available() {
                                b.label().to_string()
                            } else {
                                format!("{} (rebuild with --features asio)", b.label())
                            };
                            if b.is_available() {
                                ui.selectable_value(&mut self.backend, b, label);
                            } else {
                                ui.add_enabled(false, egui::Button::new(label));
                            }
                        }
                    });
                if self.backend != prev_backend {
                    self.refresh_devices();
                }
                if ui.button("Refresh devices").clicked() {
                    self.refresh_devices();
                }
            });

            if !st.asio_compiled {
                ui.colored_label(
                    egui::Color32::from_rgb(200, 160, 60),
                    "ASIO not compiled in this binary. Default path is WASAPI (shared). \
                     On Windows: cargo build --release --features asio (see desktop/asio_sdk/README.md).",
                );
            } else {
                ui.colored_label(
                    egui::Color32::from_rgb(80, 180, 100),
                    "ASIO feature compiled — select ASIO backend if your driver is installed \
                     (Focusrite ASIO, etc.).",
                );
            }

            if let Some(err) = &self.refresh_error {
                ui.colored_label(egui::Color32::RED, err);
            }

            ui.add_space(6.0);

            let inputs: Vec<(usize, String)> = self
                .input_choices()
                .into_iter()
                .map(|(i, n)| (i, n.to_string()))
                .collect();
            let outputs: Vec<(usize, String)> = self
                .output_choices()
                .into_iter()
                .map(|(i, n)| (i, n.to_string()))
                .collect();
            let in_label = self
                .devices
                .get(self.input_idx)
                .map(|d| d.name.clone())
                .unwrap_or_else(|| "(none)".into());
            let out_label = self
                .devices
                .get(self.output_idx)
                .map(|d| d.name.clone())
                .unwrap_or_else(|| "(none)".into());

            ui.horizontal(|ui| {
                ui.label("Input:");
                egui::ComboBox::from_id_salt("input")
                    .selected_text(in_label)
                    .width(280.0)
                    .show_ui(ui, |ui| {
                        for (idx, name) in &inputs {
                            ui.selectable_value(&mut self.input_idx, *idx, name);
                        }
                    });
            });

            ui.horizontal(|ui| {
                ui.label("Output:");
                egui::ComboBox::from_id_salt("output")
                    .selected_text(out_label)
                    .width(280.0)
                    .show_ui(ui, |ui| {
                        for (idx, name) in &outputs {
                            ui.selectable_value(&mut self.output_idx, *idx, name);
                        }
                    });
            });

            ui.horizontal(|ui| {
                ui.label("Buffer size (frames):");
                for b in BufferSizeChoice::ALL {
                    ui.selectable_value(&mut self.buffer, b, b.label());
                }
            });

            ui.add_space(8.0);
            ui.separator();

            ui.horizontal(|ui| {
                ui.vertical(|ui| {
                    ui.label("Drive");
                    ui.add(egui::Slider::new(&mut self.drive, 0.0..=1.0).show_value(true));
                    ui.label("Level");
                    ui.add(egui::Slider::new(&mut self.level, 0.0..=1.0).show_value(true));
                });

                ui.add_space(24.0);

                ui.vertical(|ui| {
                    ui.label("Input meter");
                    let peak = st.input_peak.clamp(0.0, 1.0);
                    let (_, rect) = ui.allocate_space(egui::vec2(160.0, 18.0));
                    ui.painter()
                        .rect_filled(rect, 3.0, egui::Color32::from_gray(40));
                    let mut fill = rect;
                    fill.set_width(rect.width() * peak);
                    let color = if peak > 0.9 {
                        egui::Color32::from_rgb(220, 60, 60)
                    } else if peak > 0.7 {
                        egui::Color32::from_rgb(220, 180, 40)
                    } else {
                        egui::Color32::from_rgb(60, 180, 90)
                    };
                    ui.painter().rect_filled(fill, 3.0, color);
                    ui.label(format!("{:.0}%", peak * 100.0));

                    ui.add_space(4.0);
                    ui.label("Output meter");
                    let opeak = st.output_peak.clamp(0.0, 1.0);
                    let (_, rect) = ui.allocate_space(egui::vec2(160.0, 18.0));
                    ui.painter()
                        .rect_filled(rect, 3.0, egui::Color32::from_gray(40));
                    let mut fill = rect;
                    fill.set_width(rect.width() * opeak);
                    ui.painter()
                        .rect_filled(fill, 3.0, egui::Color32::from_rgb(90, 140, 220));
                });
            });

            ui.add_space(12.0);

            ui.horizontal(|ui| {
                let running = st.running;
                if ui
                    .add_enabled(!running, egui::Button::new("Start").min_size(egui::vec2(100.0, 32.0)))
                    .clicked()
                {
                    self.start();
                }
                if ui
                    .add_enabled(running, egui::Button::new("Stop").min_size(egui::vec2(100.0, 32.0)))
                    .clicked()
                {
                    self.stop();
                }
            });

            ui.add_space(8.0);
            ui.separator();
            ui.label(&self.status_msg);
            if let Some(err) = &st.last_error {
                ui.colored_label(egui::Color32::RED, format!("Stream: {err}"));
            }
            if st.sample_rate > 0 {
                ui.monospace(format!(
                    "sr={} Hz · buffer={} · {}",
                    st.sample_rate, st.buffer_frames, st.backend
                ));
            }

            ui.add_space(8.0);
            ui.small(
                "Signal: Input → gain/drive waveshaper → short cab IR/EQ → Output. \
                 Scaffold voice only — not ToneX, not full AmpliTube parity. \
                 Prefer headphones. Install your interface ASIO driver for lowest latency.",
            );
        });
    }
}
