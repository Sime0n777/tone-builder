# Tone Builder

A web **factory amp-sim** and tone-design workspace for guitarists: pick an amp and cab from the library, build a pedal chain, preview with synth or **live guitar input**, save presets, A/B compare, and export.

## Product model

- **Amp sims you select and play** — Deluxe Reverb, Twin Reverb, Plexi, Dual Rectifier, AC30 Top Boost, plus matching factory cabs (1×12 Deluxe, 2×12 Blue, 4×12 Greenback, 4×12 V30).
- **Algorithmic models** — hand-tuned Web Audio DSP (preamp gain staging, Fender/Marshall/Vox-style tone stacks, power-amp sag/presence, bright cap, cab IRs). These are **not** neural captures (NAM / ToneX); there is no “record your amp first” workflow.
- **Stay on the web app** — live interface input already routes through the same amp/cab chain.

## Features

- **Factory amp + cab library** — clearly voiced sims with mic / position / distance controls on cabs
- **Signal chain builder** — add, reorder, and remove drive, modulation, delay/reverb, amp, and cab blocks
- **Pedals** — Tube Screamer / Rat / Fuzz / Boost; digital / tape / analog delays; spring, room, plate, hall reverbs
- **Parameter controls** — knobs, sliders, toggles, and selects with sensible defaults
- **Synth tone preview** — Play/Stop oscillator source through the full chain; updates while playing when knobs change
- **Live guitar input** — audio interface via `getUserMedia` into the same tone chain; device picker, monitoring arm, input level meter
- **Tone library** — save, rename, duplicate, and delete presets (`localStorage`)
- **Seed tones** — Clean Jazz, Classic Rock Crunch, Modern High-Gain, Deluxe Blues, Ambient Wash
- **Compare mode** — side-by-side A/B; switch which graph is audible
- **Export** — copy a human-readable recipe or download JSON

## Stack

- TypeScript + Vite + React
- Web Audio API for algorithmic amp/cab DSP and live monitoring
- Local persistence via `localStorage` (no accounts / cloud sync)

## Getting started

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Synth preview

1. Select a tone.
2. Click **Play tone** to hear the oscillator preview.

### Live guitar / audio interface

**Secure context required:** browsers only allow microphone / interface capture on **localhost** or **HTTPS**. Plain `http://` on a LAN IP will fail.

1. Plug guitar → audio interface → computer. Prefer **headphones** (or interface direct/zero-latency monitoring) so speakers do not feedback.
2. In the app, set **Source** to **Live input**.
3. Click **Enable input / Start monitoring** (user gesture + permission prompt).
4. After permission, pick your interface from the **Input** dropdown. Use **Refresh** if you hot-plugged a device.
5. Play — signal runs through drive / mod / delay / reverb / **factory amp** / **factory cab** to the default output.
6. Click **Stop monitoring** when finished.

Browser DSP that wrecks guitar tone is disabled on the capture stream:

- `echoCancellation: false`
- `noiseSuppression: false`
- `autoGainControl: false`

## Build

```bash
npm run build
npm run preview   # optional: preview the production build
```

## Amp / cab DSP notes

- Amps use multi-stage algorithmic modeling: input HPF → bright shelf → preamp waveshaper → tone stack → power-amp sag (compressor) → power shaper → presence/cut → master.
- Cabs use short **generated** IRs (resonant modes + spectral envelope) plus mic/position/distance EQ — not commercial measured IR packs.
- Enough differentiation to tell Deluxe vs Plexi vs Rectifier vs AC30 apart and to hear cab/mic moves. Not a substitute for Neural DSP / ToneX capture fidelity.

## Limitations vs commercial sims

- No neural amp models (NAM) or capture training UI
- Generated cab IRs, not studio-measured packs
- Browser round-trip latency on live input (use headphones or hardware monitoring)
- Mono/stereo capture depends on OS/browser device enumeration

## License

Private project.
