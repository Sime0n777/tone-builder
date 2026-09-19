# Tone Builder

A polished web app for guitarists to design, preview, and document guitar tones — signal chains, parameters, notes, A/B compare, export, synth preview, and **live guitar input** through an audio interface.

## Features

- **Signal chain builder** — add, reorder, and remove drive, modulation, delay/reverb, amp, and cab/IR blocks
- **Block catalog** — Tube Screamer / Rat / Fuzz / Boost; Twin & Deluxe Reverb, Plexi, Rectifier, AC30; digital / tape / analog delays; spring, room, plate, hall reverbs; Greenback / Blue / Deluxe / V30 cabs
- **Parameter controls** — knobs, sliders, toggles, and selects with sensible defaults
- **Synth tone preview** — Play/Stop Web Audio preview (oscillator source → waveshaper drive/amp → EQ → delay/reverb → cab). Updates while playing when knobs change. Audio starts only after a user gesture (Play) for browser autoplay policy.
- **Live guitar input** — route your guitar via an audio interface (`getUserMedia`) into the same tone chain; device picker, monitoring arm button, and a simple input level meter
- **Tone library** — save, rename, duplicate, and delete presets (persisted in `localStorage`)
- **Seed tones** — Clean Jazz, Classic Rock Crunch, Modern High-Gain, Deluxe Blues, Ambient Wash
- **Tone notes** — free-text notes per preset
- **Compare mode** — side-by-side A/B between two saved tones; switch which graph is audible
- **Export** — copy a human-readable recipe or download JSON

## Stack

- TypeScript + Vite + React
- Web Audio API for approximate tone preview / live monitoring
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

1. Plug guitar → audio interface → computer. Prefer **headphones** (or interface direct/zero-latency monitoring) so speakers do not feedback into the room mics / open cabinet.
2. In the app, set **Source** to **Live input**.
3. Click **Enable input / Start monitoring** (this is the required user gesture + permission prompt).
4. After permission, pick your interface (or the correct input channel) from the **Input** dropdown. Use **Refresh** if you hot-plugged a device.
5. Play — signal runs through the active tone’s drive / mod / delay / reverb / amp / cab chain to the default output device.
6. Click **Stop monitoring** when finished.

Browser DSP that wrecks guitar tone is explicitly disabled on the capture stream:

- `echoCancellation: false`
- `noiseSuppression: false`
- `autoGainControl: false`

If permission is denied, no device is found, or the page is not secure, the UI shows a clear error.

## Build

```bash
npm run build
npm run preview   # optional: preview the production build
```

## Preview / live-input limitations

- The audio engine is intentionally approximate — enough to tell clean, crunch, and high-gain apart and to hear delay/reverb/cab color. It is **not** a full amp simulator or IR loader.
- Live input uses the browser’s `MediaStreamAudioSourceNode` path; expect some round-trip latency (OS + browser + buffer). Use headphones or hardware monitoring for feel.
- Capture is typically mono or mixed stereo depending on the OS/driver; stereo interface channels appear as separate devices or a combined stereo input depending on the browser.
- Supported where `navigator.mediaDevices.getUserMedia` works (Chromium, Firefox, Safari with secure context).

## License

Private project.
