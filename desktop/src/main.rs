//! Tone Builder Desktop — native standalone amp-sim scaffold (ASIO / WASAPI).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod ui;

use eframe::egui;
use ui::ToneBuilderApp;

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([640.0, 520.0])
            .with_min_inner_size([480.0, 400.0])
            .with_title("Tone Builder Desktop"),
        ..Default::default()
    };

    eframe::run_native(
        "Tone Builder Desktop",
        options,
        Box::new(|cc| Ok(Box::new(ToneBuilderApp::new(cc)))),
    )
}
