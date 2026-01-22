# Agent Handoff: Audio Stem Transport & Synchronization Fixes
**Date:** 2026-01-22
**Topic:** Transport Coupling, Stem Playback, and Initialization Race Conditions

## Context
This application integrates three distinct playback systems that must be tightly synchronized:
1.  **AudioStemManager (Custom):** Uses `AudioContext` and `HTMLAudioElement` for vocal/band stems.
2.  **ElectronYouTubePlayer (React Wrapper):** Wraps YouTube Iframe API.
3.  **KaraokeRenderer/UI:** React state (`currentTime`, `duration`, `isPlaying`).

## Critical Issues Resolved

### 1. "First Song" Scrubbing Bug (The Duration Race Condition)
**Symptom:** When the first song is loaded, the seek bar refuses to scrub (stuck at 0). Subsequent songs work.
**Root Cause:**
*   `hydrateSongState` (Async) loads stems and sets `duration` from the stem metadata (correct).
*   Simultaneously, `ElectronYouTubePlayer` mounts and fires `onReady`.
*   **The Race:** `onReady` fired *after* hydration started but *before* the component state fully settled, or simply stomped on the state. It set `duration` to `player.getDuration()` which was `0` (metadata not loaded).
*   Because `useStems` logic was inside a closure in `onReady`, it didn't know stems were active, so it aggressively updated the global duration.

**The Fix:**
*   **Ref-based Guard in `onReady`:** Used `useStemsRef` (synced via Effect) to check the *current* real-time value of `useStems` inside the callback.
*   **Logic:** `if (!useStemsRef.current) setDuration(...)`. This prevents YouTube from overwriting the authoritative Stem Duration.

### 2. Video Playback Persistence (Auto-Play Leak)
**Symptom:** Switching songs would leave the *previous* video playing or start the new video immediately while audio was stopped.
**Root Cause:**
*   `ElectronYouTubePlayer` had `autoplay={true}` prop.
*   `onReady` handler explicitly called `setIsPlaying(true)`.
*   Changing `videoId` triggered a reload which auto-started playback before the rest of the system was ready.

**The Fix:**
*   **Disable Auto-Play:** Set `autoplay={false}`.
*   **Remove Auto-Start:** Removed `setIsPlaying(true)` from `onReady`.
*   **Result:** Application always starts/transitions to a **STOPPED** state. User must explicitly press Play.

### 3. "Stop All" State Management
**Symptom:** State leakage between song switches (previous song playing while new one loads).
**The Fix:**
*   Implemented `stopAllPlayback()` helper function in `IntegratedEcologicalOS.jsx`.
*   **Behavior:**
    1.  Stops AudioStemManager.
    2.  Pauses YouTube, Seeks to 0, **Unmutes** (critical reset).
    3.  Resets React State (`isPlaying=false`, `currentTime=0`).
*   **Usage:** Called immediately at start of `handleSongSelect` and on component Mount.

## Key Code Locations
*   **`src/components/karaoke-designs/IntegratedEcologicalOS.jsx`**
    *   `stopAllPlayback` (Helper)
    *   `handleSongSelect` (Orchestrator)
    *   `ElectronYouTubePlayer` props (`onReady`, `autoplay`)
*   **`src/utils/AudioStemManager.js`**
    *   `loadStems` now returns `{ success, duration }` to allow immediate synchronous duration updates.

## Future Considerations
If modifying transport logic, **ALWAYS** check `useStemsRef` inside callbacks (`onReady`, `onStateChange`). The React state `useStems` may be stale in these event handlers.
