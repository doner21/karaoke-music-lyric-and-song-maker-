# Cycle 003 Plan: Audio Integration for Token Editor

**Goal**: Add vocal waveform, playhead, playback controls, and single-lane token layout.

---

## Key Changes

### 1. Single-Lane Token Layout
**Current**: Tokens grouped by line into multiple lanes (L1, L2, L3...)
**New**: All tokens in ONE horizontal row, ordered by time, above the waveform

```
NEW LAYOUT:
┌─────────────────────────────────┐
│ [word1][word2][word3][word4]... │ ← Single token lane
├─────────────────────────────────┤
│ ~~~~~~~~~~~~▲~~~~~~~~~▼~~~~~~~~~ │ ← Vocal waveform
└─────────────────────────────────┘
        ↑ Playhead (red line)
```

---

### 2. Vocal Waveform Visualization
- Fetch vocal stem URL
- Decode audio and extract peaks
- Draw waveform on canvas below token lane

### 3. Playhead + Controls
- Red vertical line at current time
- Play/Pause/Stop buttons in toolbar
- Click timeline to seek

---

## Files to Modify

| File | Action |
|------|--------|
| `TokenTimeline.jsx` | Single lane layout + playhead |
| `VocalWaveform.jsx` | NEW - canvas waveform |
| `TokenEditorPanel.jsx` | Play/Pause controls |
| `IntegratedEcologicalOS.jsx` | Pass vocalUrl + audioRef |

---

## Acceptance Criteria

- [ ] AC1: All tokens appear in ONE horizontal lane
- [ ] AC2: Vocal waveform displays below tokens
- [ ] AC3: Playhead line tracks current time
- [ ] AC4: Play/Pause buttons control audio
- [ ] AC5: Click on timeline seeks to position
