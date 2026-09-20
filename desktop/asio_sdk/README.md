# ASIO SDK drop-in (not vendored)

Steinberg’s **ASIO SDK** is proprietary. It is **not** bundled in this repo.

## Why

Tone Builder Desktop enables ASIO through cpal’s `asio` feature. Building that feature needs the SDK headers / sources on the machine that compiles the app.

## Setup (Windows)

1. Download the ASIO SDK from Steinberg: https://www.steinberg.net/asiosdk  
   Accept Steinberg’s license terms.
2. Unzip so you have a folder that contains the SDK (often named like `asiosdk_2.3.3_2019-06-14` with `common/`, `host/`, etc.).
3. Point cpal at it (PowerShell):

   ```powershell
   $env:CPAL_ASIO_DIR = "C:\path\to\asiosdk_2.3.3_2019-06-14"
   ```

   Or drop/extract under this `asio_sdk/` directory and set `CPAL_ASIO_DIR` to that path.
4. Install **LLVM** (for bindgen) and set:

   ```powershell
   $env:LIBCLANG_PATH = "C:\Program Files\LLVM\bin"
   ```
5. Build with ASIO:

   ```powershell
   cd desktop
   cargo build --release --features asio
   ```

cpal may also auto-download the SDK into a temp folder if `CPAL_ASIO_DIR` is unset; a local path is more reliable and license-clear for your workflow.

## Runtime

You still need a working **ASIO driver** on the PC (Focusrite ASIO, ASIO4ALL, manufacturer ASIO, etc.). The SDK is only for *building* the host bindings — it is not a driver.

## Default build (no SDK)

```powershell
cargo build --release
```

Uses the Windows default host (**WASAPI**, shared mode) with selectable buffer sizes. Useful without the SDK; for lowest latency prefer ASIO once the SDK + driver are in place.
