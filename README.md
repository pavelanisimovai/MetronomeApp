# MyMetronome

Free, installable rhythm practice for first-time learners and experienced musicians. Listen to an example, practise without stars, then try it yourself. The count-in sets the tempo; your first tap starts the round.

## Learning and practice

- **Learn:** a recommended path through steady beat, copying, memory and silence. All 40 lessons are also available in the exercise library.
- **Guide me / Quick start:** choose how much preparation you want. After the count-in, the example repeats for as long as you need, with no score or deadline. The first tap counts as beat one and starts a full round. Practice rounds do not affect scores.
- **Three-lesson sessions:** pause between lessons, resume within the browser tab, and finish with a session summary.
- **Fair feedback:** extra taps and rests count. Live feedback and results use the same chronological matcher. Three stars require at least 92% and no extra taps.
- **Metronome:** 30–250 BPM, tap tempo, meters, subdivisions and synthesized click sounds.
- **Accessibility:** keyboard and touch input, reduced motion, optional spoken instructions, clear pattern descriptions and high-contrast text.
- **Progress:** local learning coverage, recent timing scores and repeated successful attempts. Earlier results are preserved separately from scores earned under the updated rules.
- **Offline:** app and lessons work after the service worker has cached the first visit. System fonts and synthesized sounds need no external resources. Optional speech depends on device voices.

## Development

Use Node.js 24 or later (unit tests use native TypeScript stripping).

```bash
npm ci
npm run dev
```

The frontend needs no backend or credentials. Append `?nosw=1` during development to bypass cached service-worker content. Device audio must be enabled through a user interaction.

## Sound on iPhone

The app requests a playback audio session when supported by Safari, and resumes suspended or interrupted audio directly from the user's tap. Unsupported browsers keep the normal Web Audio startup path. An unsuccessful or stalled resume shows a retry action instead of silently starting an exercise.

If there is still no sound, use Settings → Play a test sound. Turn up media volume, check the Bluetooth output, and try disabling Silent Mode; older iOS versions can mute browser audio even when other apps remain audible. Open embedded browser pages in Safari. After a call or returning to the app, restart playback.

## Build and test

```bash
npm run build
npm run lint
npm run test:unit
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

With preview running in another terminal:

```bash
npm run test:smoke
npm run test:a11y
```

Browser scripts use `/usr/bin/chromium` if present, or Playwright's installed Chromium. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to choose another executable. On a machine without a browser, use `npx playwright install chromium` first. `APP_URL` can override the preview origin.

The unit suite covers scoring, musical phase alignment for every lesson, curriculum ordering and date rules. The browser suite checks guided practice, correct and incorrect rounds, native input, small screens, audio cancellation, memory, calibration, interruptions, session completion, old saved data and offline persistence. `SMOKE_FILTER` selects a browser check by name; a filter that matches nothing fails.

`npm run test:a11y` checks WCAG A/AA rules with axe on core pages and exercise states. Automated checks do not replace screen-reader, enlarged-text, real touch/audio-device or participant testing. See [release validation](docs/release-validation.md).

For walkthrough screenshots: `node scripts/demo-playwright.mjs`. Output defaults to `/tmp/metronome-demo`; use `SCREENSHOT_DIR` to change it and `HEADED=1` for a visible browser.

## Timing and saved data

Exercises wait after the count-in while the example loops. No response clicks, misses, results or achievement records start automatically. The first tap cancels the example and anchors the response to its first expected note; subsequent intervals are graded at the lesson's tempo, including rests and extra taps. Memory patterns hide only when that tap starts the response. Restarting returns to unscored listening.

Input and visuals use `AudioContext.getOutputTimestamp()` when available, otherwise the audio context clock. The response anchor subtracts the configured latency offset; grading and response visuals use the same corrected reference, so calibration does not penalize the first tap or shorten the response. Calibration can compensate for consistent device/tapping delay; it cannot guarantee physical-device latency accuracy.

A session owns and cancels all scheduled sound sources on exit or pause. Backgrounded or interrupted lessons restart with a fresh count-in and no penalty. Memory assistance is explicit in level data; the Silent Recall lesson has no answer clicks.

Existing progress uses an additive storage upgrade: original bests and stars remain in the saved record, while `verifiedStars` and related fields track the new scoring rules. Old stars do not automatically certify the revised curriculum. No-input rounds and unscored practice do not create achievement records. Practice-session position is stored only for the current browser tab.

Static output is in `dist/`. Deploy with SPA fallback routing to `index.html` (including `/play/*` and `/practice`).
