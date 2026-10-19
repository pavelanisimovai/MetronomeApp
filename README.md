# MyMetronome

Free, installable rhythm-training PWA. Train pulse, echo, memory, and continuity — with a precise Web Audio metronome underneath.

## Features (v1)

- **Train hub** — skill path across Pulse, Echo, Memory, Continuity + daily drill
- **Games** — Keep the Beat, Rhythm Echo, Rhythm Memory, Silent Bars (ms scoring, stars)
- **Metronome** — 30–250 BPM, tap tempo, time signatures, subdivisions, click sounds, visuals
- **Progress** — local streaks, skill meters, best scores (no account)
- **PWA** — offline after install

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Static output lands in `dist/` — deploy to Cloudflare Pages, Vercel, Netlify, or GitHub Pages.

## Stack

React 19 · TypeScript · Vite · Zustand · Web Audio API · vite-plugin-pwa
