# Test Phase: Latency Hunter Report

**Seed**: 25678
**Basin**: Latency Hunter
**Invariants**: ALL REAL YouTube Logic Preserved.

## Setup
1. `npm install` (already done)
2. Create `.env` with `YOUTUBE_API_KEY=...` (or use fallback mock mode if key missing)
3. Run Server: `node server-proxy.js`
4. Run Client: `npm run dev`

## Manual Test Script
1. **Open App**: Verify "Latency Hunter" background/badge.
2. **Type Query**: Type "Queen". Verify debounce (wait 300ms) then spinner.
3. **Verify Results**: See thumbnails (real or mock fallback). Scroll list.
4. **Select Song**: Click "Bohemian Rhapsody".
   - Verify Video loads in "Monitor" area (YouTube IFrame).
   - Verify Lyrics placeholder appears.
   - Verify "Process" button enabled.
5. **Playback**: Click circular "Play" button at bottom. Video should play.
6. **Seek**: Drag scrubber. Video should seek.
7. **Stop**: Click "Stop" square. Video should stop & reset to 0:00.
8. **Modules**:
   - Open Right Drawer ("Toolbox").
   - Change "Audio Separation" model.
   - Click "Process Track". Watch states: Separate -> Transcribe -> Ready.
   - Verify "JSON Timings" download button enables.

## Edge-Case Stress Tests
1. **Typing Thrash**: Type "Hello" then backspace quickly, then type "World". Ensure only "World" request finishes (AbortController).
2. **Empty Query**: Clear input. Results should clear.
3. **Selection while Loading**: Click a result, then quickly type a new search. Selection should persist.
4. **Quota Failure**: (Simulate by removing API Key) -> Verify app degrades to "Mock Data" without crashing.
5. **Rapid Play/Pause**: Click Play/Pause quickly. Player state should sync.
6. **Drawer Thrash**: Open/Close Left/Right drawers rapidly. Layout should adapt.
7. **Process Cancel**: (Not implemented, but check if starting process blocks other actions).
8. **Network Cut**: Go offline (DevTools) -> Search -> Verify error message "hides" or shows clearly.

## Invariant Checklist
- [x] YouTube search input present
- [x] Typeahead suggestions present (Hybrid local)
- [x] Results show thumbnail + title
- [x] Max 6 thumbnails visible + scrolling works (Infinite scroll container)
- [x] Selecting result sets current song (videoId stored)
- [x] YouTube video plays embedded
- [x] Play/Pause present
- [x] Stop present (stop + reset)
- [x] Seek/scrub present (best-effort)
- [x] Lyrics auto-populates on select
- [x] Lyrics editable + replaceable
- [x] Audio splitter dropdown present
- [x] Forced transcription dropdown includes AudioShake + Music.ai
- [x] Process action simulates pipeline stages
- [x] Vocal volume slider present
- [x] Band volume slider present
- [x] Lyrics highlighting driven by timings present (mock allowed)
- [x] Download JSON present
- [x] Download band stem present (mock allowed)
- [x] Download vocal stem present (mock allowed)
- [x] Debounce + cancel stale requests present
- [x] Recovery basin for YouTube API errors present (Fallback/Mock)
