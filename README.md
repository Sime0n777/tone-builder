# Tone Builder

A web **gear-suite amp-sim** and tone-design workspace with an AmpliTube-style rig layout: **pedalboard → amp → cab → rack/FX**. Preview with synth or **live guitar input**, save presets, A/B compare, export, and import third-party **Neural Amp Modeler (`.nam`)** models.

## Product model

- **Factory algorithmic sims** — Deluxe / Twin Reverb, Bassman, Plexi, JCM800, Dual Rectifier, SLO-100, AC30, plus matching cabs. Hand-tuned Web Audio DSP (not neural captures).
- **NAM import** — load `.nam` files from ToneHunt (etc.) into an IndexedDB model library and run them through a WASM AudioWorklet (`neural-amp-modeler-wasm`).
- **ToneX is not supported** — `.tnx` / ToneX models are rejected with a clear error. Do not expect ToneX compatibility.

## Features

- **AmpliTube-style signal rig** — visual zones for Pedalboard, Amp, Cab, Rack/FX
- **Gear suite browser** — Stomp / Amp / Cab / Rack / NAM tabs
- **Factory library** — drives, compressor, gate, EQ, amps, cabs, delays, room/plate/spring/hall, Deluxe retained
- **NAM (`.nam`) import** — file picker + drag-and-drop onto the amp zone / Third-party models drop zone; realtime WASM inference when possible, with algorithmic fallback that still shows the loaded NAM identity
- **Live guitar input** — audio interface via `getUserMedia`
- **Synth preview**, presets, A/B compare, export (recipe / JSON)

## NAM import

1. Open the **NAM** tab in the gear suite, or use the drop zone on the **Amp** zone.
2. Import a `.nam` file (e.g. from [ToneHunt](https://tonehunt.org/)).
3. The model is stored in **IndexedDB** and inserted as a **NAM Amp** block.
4. On play/monitor, Tone Builder loads the model into the NAM WASM worklet for realtime inference.

**Unsupported:** ToneX / `.tnx` (proprietary). Use `.nam` only.

Engine assets live in `public/engine/` (`nam-worklet.js`, `nam-engine.wasm`) from the `neural-amp-modeler-wasm` package.

## Stack

- TypeScript + Vite + React
- Web Audio API (algorithmic DSP)
- `neural-amp-modeler-wasm` (NAM WASM + AudioWorklet)
- `localStorage` presets · IndexedDB NAM library

## Getting started

```bash
npm install --legacy-peer-deps
npm run dev
```

`--legacy-peer-deps` is needed because the NAM package peers React 18 while this app uses React 19 (engine-only import).

Open the URL Vite prints (usually `http://localhost:5173`).

### Live guitar / audio interface

**Secure context required** (localhost or HTTPS). Prefer headphones.

1. Source → **Live input** → **Enable input / Start monitoring**
2. Pick your interface; play through the rig.

Capture constraints disable browser DSP that wrecks guitar tone (`echoCancellation` / `noiseSuppression` / `autoGainControl` off).

## Build

```bash
npm run build
npm run preview
```

## Limitations

- NAM inference needs a browser with AudioWorklet + WASM; large models may need the Slim control (A2 models)
- If NAM WASM fails to attach/load, a strengthened algorithmic path runs while the NAM model name/metadata remain visible
- Generated cab IRs, not studio-measured packs
- Browser round-trip latency on live input
- **No ToneX**

## License

Private project. NAM models you import retain their own licenses (ToneHunt creators, etc.).
