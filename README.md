# Tone Builder

A polished web app for guitarists to design, preview, and document guitar tones — signal chains, parameters, notes, A/B compare, export, and a live Web Audio approximate preview.

## Features

- **Signal chain builder** — add, reorder, and remove drive, modulation, delay/reverb, amp, and cab/IR blocks
- **Parameter controls** — knobs, sliders, toggles, and selects with sensible defaults
- **Live tone preview** — Play/Stop Web Audio preview (oscillator source → waveshaper drive/amp → EQ → delay/reverb → cab). Updates while playing when knobs change. Audio starts only after a user gesture (Play) for browser autoplay policy.
- **Tone library** — save, rename, duplicate, and delete presets (persisted in `localStorage`)
- **Seed tones** — Clean Jazz, Classic Rock Crunch, Modern High-Gain, Ambient Wash
- **Tone notes** — free-text notes per preset
- **Compare mode** — side-by-side A/B between two saved tones; switch which graph is audible
- **Export** — copy a human-readable recipe or download JSON

## Stack

- TypeScript + Vite + React
- Web Audio API for approximate tone preview
- Local persistence via `localStorage` (no accounts / cloud sync)

## Getting started

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Click **Play tone** to hear the preview.

## Build

```bash
npm run build
npm run preview   # optional: preview the production build
```

## Preview limitations

The audio engine is intentionally approximate — enough to tell clean, crunch, and high-gain apart and to hear delay/reverb/cab color. It is **not** a full amp simulator or IR loader.

## Out of scope (v1)

- Full amp/cab IR accuracy / real guitar input
- User accounts / cloud sync
- Social marketplace

## License

Private project.
