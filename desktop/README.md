# Tone Builder Desktop

Native **Windows standalone** amp-sim scaffold with a real audio callback path (**ASIO** when enabled, **WASAPI** by default). This is **not** Electron and does **not** use the browser Web Audio API as the engine.

| | Web app (`/`) | Desktop (`desktop/`) |
|---|---|---|
| Runtime | Browser + Web Audio / AudioWorklet | Native process + cpal callback |
| Latency | Browser + OS shared path | WASAPI buffers or ASIO driver buffers |
| Goal | Tone design / NAM / presets | Low-latency monitoring & future native ship |

**Not ToneX-compatible.** Scaffold voice only (drive waveshaper + short cab IR/EQ) — not full AmpliTube feature parity.

## Stack

- **Rust** + **cpal** (audio I/O)
- **eframe / egui** (minimal native UI)
- Optional **`--features asio`** → cpal ASIO backend (Steinberg SDK at build time; your interface ASIO driver at runtime)

## What runs today

- Selectable backend: **WASAPI (default host on Windows)** or **ASIO** (if built with `asio`)
- Device list refresh, buffer sizes **64 / 128 / 256 / 512** frames
- Duplex path: **Input → gain/drive waveshaper → cab-ish EQ/short IR → Output**
- UI: device lists, buffer size, input/output meters, Drive / Level, Start / Stop
- Linux/macOS: same crate builds against the platform default host (useful for compile checks; ship target is Windows)

## ASIO status

| Mode | Status |
|------|--------|
| Default `cargo build --release` | **Ready** — Windows uses WASAPI (shared). Useful without the ASIO SDK. |
| `cargo build --release --features asio` | **Needs Steinberg ASIO SDK** (+ LLVM/Clang for bindgen) at *build* time; **needs an ASIO driver** (Focusrite ASIO, etc.) at *run* time. SDK is **not** vendored (license). See [`asio_sdk/README.md`](asio_sdk/README.md). |

WASAPI Exclusive is **not** fully exposed by stock cpal; this scaffold uses the default WASAPI host with **fixed small buffer sizes** as the interim low-latency path. Prefer ASIO for the real low-latency Windows target.

## Windows build (for Simo)

### Prerequisites

1. [rustup](https://rustup.rs/) — stable MSVC toolchain  
   ```powershell
   rustup default stable-x86_64-pc-windows-msvc
   ```
2. **Visual Studio 2022 Build Tools** (or full VS) with “Desktop development with C++”
3. (ASIO only) [LLVM](https://releases.llvm.org/) and Steinberg [ASIO SDK](https://www.steinberg.net/asiosdk)

### WASAPI build (no ASIO SDK)

```powershell
cd path\to\tone-builder\desktop
cargo build --release
.\target\release\tone-builder-desktop.exe
```

### ASIO build

```powershell
# After unzipping the ASIO SDK (accept Steinberg license):
$env:CPAL_ASIO_DIR = "C:\path\to\asiosdk_2.3.3_2019-06-14"
$env:LIBCLANG_PATH = "C:\Program Files\LLVM\bin"

cd path\to\tone-builder\desktop
cargo build --release --features asio
.\target\release\tone-builder-desktop.exe
```

In the UI, choose backend **ASIO**, pick your interface (e.g. Focusrite ASIO), buffer 64–128, Start. Use headphones.

### Driver notes

- Install the manufacturer ASIO driver (Focusrite Control / ASIO, Steinberg, etc.).
- ASIO4ALL can work as a last resort but is not ideal vs a real interface ASIO driver.
- The ASIO **SDK** is only for compiling host bindings — it does **not** replace a driver.

## Project layout

```
desktop/
  Cargo.toml          # features: default | asio
  asio_sdk/README.md  # how to drop in Steinberg SDK (not committed)
  src/
    main.rs           # eframe entry
    audio/
      backend.rs      # WASAPI default + ASIO host hooks, buffer sizes
      dsp.rs          # drive waveshaper + short cab IR/EQ
      engine.rs       # duplex streams, meters, Start/Stop
    ui/app.rs         # egui controls
```

## Dev commands

```powershell
cargo check
cargo test
cargo run
cargo run --features asio   # Windows + SDK
```

## License / IP

Private project scaffold. Steinberg ASIO SDK remains under Steinberg’s terms — do not commit the SDK into this repo. NAM / ToneX: desktop scaffold does not claim ToneX compatibility.
