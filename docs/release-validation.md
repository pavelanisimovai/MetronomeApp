# Guided-learning release validation

Implemented: unified chronological scoring with rest/extra-tap penalties; beat-aligned count-ins and visuals; cancellable audio; replayable examples and unscored practice; interruption recovery; concealed memory patterns; a one-missing-click introductory silence lesson; coaching results; progressive curriculum; a three-lesson session; honest coverage and preserved legacy results; keyboard/native activation; small-screen primary controls; motion/contrast improvements; offline system fonts; optional spoken prompts; sound check and guided/manual timing calibration.

## Verified in the cloud workspace — 2026-10-20

Production build, lint and whitespace checks passed. All 12 unit tests and all 12 browser product checks passed against the production preview using Linux Chromium. The browser checks include all 40 lesson routes, scored rounds in all four game types, a stable tap-pad position across the count-in, three input methods without duplicate taps, audio cancellation, calibration, a complete three-lesson session and offline progress persistence.

All 10 axe accessibility scans completed with zero detected violations; incomplete rules still need manual review. Mobile screenshots of Learn and guided practice were also inspected. These results do not certify physical audio latency, Safari, assistive technology or usability with children and adults; the remaining validation is listed below.

The iPhone audio follow-up passed build, lint, 19 unit tests, 13 browser product checks and all 10 accessibility scans. New tests simulate the optional audio-session API and Safari's interrupted state, verify recovery using a real Chromium audio context, and check rejected/stalled activation. They do not emulate the iPhone's hardware mute switch or certify audible output on iOS.

## Automated release gates

Run the production build and lint, then `npm run test:unit`. With preview on port 4173, run `npm run test:smoke` and `npm run test:a11y`.

- Correct rhythms pass; dense tapping/rest taps cannot earn the same mastery.
- Live and final matching agree, including positive/negative offsets and dense subdivisions.
- Every level's response/count-in/visual index shares its musical grid.
- Exit cancels scheduled sounds. Interruption produces a restartable, unscored pause.
- Native link/button behavior and keyboard shortcuts coexist without double taps.
- Guided practice does not save achievement scores; unattended rounds do not count as practice.
- All 40 lesson routes load; all four game types can score correct rounds.
- Practice sessions resume and finish; existing saved results survive; offline reload retains progress.
- Automated accessibility scans report no violations. Manually review incomplete axe rules.

## Required physical-device checks before a public beta

These cannot be certified by a Linux Chromium run:

- iPhone audio recovery fix: verify the sound check, lesson example, calibration and metronome with Silent Mode both on and off; repeat in Safari and as an installed Home Screen app. Interrupt playback with a call/background transition and restart from a fresh tap. Older iOS versions without `navigator.audioSession` may still require Silent Mode off.
- iPhone/Safari and Android/Chrome: user-gesture audio unlock, speakers, wired/Bluetooth headphones, vibration support, audio output switching, phone-call interruption and background/foreground transitions.
- Physical tap-to-sound timing, first-beat predictability, latency-offset sign and repeatability. Check fallback behavior where output timestamps are unavailable.
- Screen reader and switch/voice input; keyboard alone; 200% text; landscape; safe areas; touch target stability. Confirm phase announcements do not mask the beat.
- PWA installation, an offline cold start after caching, update behavior and storage eviction.
- Optional speech voices both online and offline. Prompts must finish or cancel before the rhythm starts.

## Formative usability sessions

Recruit 5–6 children across early/later primary ages with guardian consent and appropriate supervision, 5–6 adult beginners, and a few practising musicians. This is formative research, not a statistically representative market study.

Ask participants to find the first lesson, explain listening versus tapping, play a pattern with a rest, replay an example, recover after a difficult round, choose a next lesson, and use the metronome. Record facilitator assistance, misunderstanding, missed first beats, repeated rest errors and abandonment points. Pilot beginner tempos instead of assuming slower is always easier.

Initial gates to refine after baseline testing:

- At least 80% in each novice cohort complete the guided first lesson without facilitator instruction after orientation.
- At least 80% can explain when to listen, tap and stay quiet.
- Learners can describe a result and choose a useful next action.
- No unresolved blocker in core touch, keyboard, accessibility or audio interruption behavior.

Prioritize learning improvement and successful independent attempts over raw time spent or streaks. No remote analytics or recording is introduced by this release. Optional themes, shared-device profiles, more lessons and account features remain later product decisions.
