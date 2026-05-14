# Intake: Fix MP4 Exporter to Respect Stem Volume Settings

**Date**: 2026-05-14
**Mission**: Fix the MP4 exporter so that it records the audio output that the user has configured (via stem volume sliders), rather than always exporting both stems at full volume.

## Problem Statement

The MP4 exporter always records both stems (band + vocal) at full volume regardless of the volume settings the user has configured in the player UI. The user should be able to:

1. Lower the vocal stem volume (e.g., to 0) → the exported MP4 should have little/no vocals
2. Lower the band stem volume → the exported MP4 should have little/no instrumental
3. Adjust any combination and have the export reflect those settings

## Current Behavior

The exporter records the MP4 with both stems at default full volume, ignoring the stem volume sliders.

## Expected Behavior

The exporter should record whatever audio mix is configured in the player UI:
- If vocal volume is set to 0, the exported MP4 should have no vocals
- If band volume is set to 0.5, the instrumental should be at half volume
- The export should perfectly mirror what the user hears in the playback preview

## Relevant Files

- `src/components/karaoke-designs/IntegratedEcologicalOS.jsx` — Main player UI, volume state, export trigger
- `src/hooks/useKaraokeExport.js` — Export orchestration hook
- `src/utils/electronExport.js` — Client-side export (canvas rendering + IPC)
- `electron/main.js` — Server-side FFmpeg encoding, audio mixing handlers
- `src/utils/AudioStemManager.js` — Real-time audio stem playback with gain control
- `src/utils/fastExport.js` — Alternative WebCodecs-based export (for browser)

## Data Flow (Current)

1. `IntegratedEcologicalOS.jsx` manages `bandVolume` and `vocalVolume` state (sliders)
2. These are passed to `useKaraokeExport()` hook
3. Hook passes `bandVol` and `vocalVol` to `exportToMp4Electron()`
4. `exportToMp4Electron()` sends them via IPC to Electron main process
5. Main process `export-start` / `export-start-streaming` handlers store them
6. `export-finalize` / `export-finalize-streaming` use them in FFmpeg amix filter

## Suspected Root Cause (Researcher Hypothesis)

The `electron/main.js` handlers use `bandVol || 1` and `vocalVol || 1` which coerces `0` to `1` because `0` is falsy in JavaScript. This means if the user sets vocal volume to 0, the exporter receives 1 instead.

```js
// In export-start and export-start-streaming handlers:
bandVol: bandVol || 1,  // 0 || 1 = 1  ← BUG
vocalVol: vocalVol || 1, // 0 || 1 = 1  ← BUG
```

## Success Criteria

1. Export with vocal volume=0 and band volume=1 produces MP4 with only instrumental audio (no vocals audible)
2. Export with band volume=0 and vocal volume=1 produces MP4 with only vocals
3. Export with both volumes at 0.5 produces quieter mix
4. Tests validate that the volume values are correctly propagated through the entire pipeline
5. No regressions in existing export functionality

## Workflow

1. **Researcher** — Analyze the full data flow from volume sliders to FFmpeg command, identify all bugs
2. **Planner** — Produce structured fix plan with exact code changes and test strategy
3. **Executor** — Implement fixes, write real-world tests, validate with evidence
