---
description: Cycle 003 - Add vocal waveform, playhead, and single-lane token layout to Token Editor
---

# Cycle 003: Audio Integration for Token Editor

## Goal
Add vocal stem waveform, playhead/seeker, playback controls, and fix token layout to single horizontal lane above the waveform.

---

## Key Requirements

1. **Vocal Waveform** - Display waveform of vocal stem (not band) behind/below tokens
2. **Single Token Lane** - All words at ONE consistent height above the waveform (not grouped by line)
3. **Playhead** - Red vertical line tracking current playback position
4. **Playback Controls** - Play/Pause/Stop buttons in toolbar
5. **Click-to-Seek** - Click on timeline to jump to that position

---

## Proposed Changes

### Phase 1: Single-Lane Token Layout

#### [MODIFY] `src/components/editor/TokenTimeline.jsx`

**Current**: Tokens grouped by `lineIndex` into multiple horizontal lanes (L1, L2, L3...)
**New**: All tokens in ONE horizontal lane, ordered by `startMs`

```jsx
// REMOVE: lineGroups grouping by lineIndex
// ADD: Single sorted array of all tokens by startMs
const sortedTokens = useMemo(() => 
  [...tokens].sort((a, b) => a.startMs - b.startMs), 
[tokens]);

// Render all tokens in one lane at fixed height (above waveform)
```

**Layout Change**:
```
BEFORE:          AFTER:
┌─────────────┐  ┌─────────────────────────────┐
│ L1: [word1] │  │ [word1][word2][word3][...] │ ← Single lane
│ L2: [word2] │  ├─────────────────────────────┤
│ L3: [word3] │  │ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~ │ ← Waveform
└─────────────┘  └─────────────────────────────┘
```

---

### Phase 2: Vocal Waveform Canvas

#### [NEW] `src/components/editor/VocalWaveform.jsx`

Renders waveform from vocal stem audio buffer.

**Props**:
- `vocalUrl` - URL to vocal stem file
- `pxPerMs` - Zoom level
- `trackDurationMs` - Total duration
- `height` - Canvas height (e.g., 100px)

**Implementation**:
1. Fetch vocal audio as ArrayBuffer
2. Decode with Web Audio API
3. Extract peaks/samples for visualization
4. Draw waveform using canvas 2D context
5. Re-render on zoom/scroll changes

---

### Phase 3: Playhead + Playback Controls

#### [MODIFY] `src/components/editor/TokenTimeline.jsx`

Add playhead:
```jsx
// New prop: currentTimeMs
// Render vertical line at position
<div 
  className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50"
  style={{ left: `${currentTimeMs * pxPerMs}px` }}
/>
```

#### [MODIFY] `src/components/editor/TokenEditorPanel.jsx`

Add to toolbar:
```jsx
import { Play, Pause, Square } from 'lucide-react';

// State
const [isPlaying, setIsPlaying] = useState(false);
const [currentTimeMs, setCurrentTimeMs] = useState(0);

// Buttons
<button onClick={handlePlay}><Play /></button>
<button onClick={handlePause}><Pause /></button>
<button onClick={handleStop}><Square /></button>
<span>{formatTime(currentTimeMs)}</span>
```

---

### Phase 4: Wire Up Audio Manager

#### [MODIFY] `src/components/karaoke-designs/IntegratedEcologicalOS.jsx`

Pass to TokenEditorPanel:
```jsx
<TokenEditorPanel
  lyricsJson={alignResult}
  trackDurationMs={duration * 1000}
  vocalUrl={splitResult?.vocalDownloadUrl ? `${API_URL}${splitResult.vocalDownloadUrl}` : null}
  audioManagerRef={audioManagerRef}
  onApply={...}
  onDiscard={...}
/>
```

---

## Verification Plan

1. Open Token Editor with alignment data
2. **Verify Single Lane**: All tokens should appear in ONE horizontal row
3. **Verify Waveform**: Vocal waveform visible below token lane
4. **Verify Playhead**: Red line at time=0, moves during playback
5. **Play/Pause**: Audio plays, playhead moves, pause stops
6. **Click-to-Seek**: Click on timeline jumps playhead and audio

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `TokenTimeline.jsx` | MODIFY | Single-lane layout, add playhead |
| `VocalWaveform.jsx` | NEW | Canvas-based vocal waveform |
| `TokenEditorPanel.jsx` | MODIFY | Play/Pause controls, wire audio |
| `IntegratedEcologicalOS.jsx` | MODIFY | Pass vocalUrl and audioManagerRef |
