# Lyric Highlighting + Timing System Implementation Plan

**Branch:** `lyrics_test_0.0.1`
**Project:** karaoke-box
**Goal:** Implement a karaoke lyric timing + highlighting system that couples with existing alignment pipeline and playback infrastructure.

---

## Executive Summary

Implement a new `KaraokeLyricsDisplay` component that renders large, readable lyrics with precise word-level highlighting synchronized to AudioShake timing JSON. The system must handle pagination, instrumental gap detection, past/current/future state differentiation, and real-time presentation controls while preserving editor formatting integrity.

---

## Phase 1: Core Data Layer + Normalization

### 1.1 Create Timing Data Normalizer
**File:** `src/utils/lyricsTimingNormalizer.js`

```
Purpose: Transform KaraokeTimingJSON_v1 (from canonicalizer) into render-ready structure

Input: Canonical JSON from /align/result/:jobId
Output: {
  lines: [
    {
      lineIndex: number,
      text: string,
      startTime: number,
      endTime: number,
      words: [
        {
          wordIndex: number,
          text: string,
          startTime: number,
          endTime: number,
          syllables?: [{ text, startTime, endTime }] // if available
        }
      ]
    }
  ],
  gaps: [
    { type: 'instrumental' | 'outro', startTime, endTime, duration }
  ],
  totalDuration: number
}

Tasks:
- [ ] Parse lyrics[] array from canonical JSON
- [ ] Flatten sentence → words with absolute indices
- [ ] Detect gaps >= 8.0s between word.endTime and next word.startTime
- [ ] Classify final gap as 'outro' if extends to end-of-song
- [ ] Preserve syllable data if present in source
```

### 1.2 Create Playback Time Hook
**File:** `src/hooks/usePlaybackTime.js`

```
Purpose: Single source of truth for playback time (drives all highlighting)

Integrates with: Existing AudioContext in IntegratedEcologicalOS.jsx

API:
- playbackTimeSeconds: number (current position)
- isPlaying: boolean
- seek(timeSeconds): void
- play(): void
- pause(): void

Implementation:
- [ ] Use requestAnimationFrame for drift-free updates
- [ ] Expose current time from AudioContext.currentTime - startOffset
- [ ] Fire callbacks on seek to notify dependent systems
- [ ] Target 60fps update rate for smooth highlighting
```

---

## Phase 2: Highlighting Engine

### 2.1 Create Word Highlight Calculator
**File:** `src/utils/wordHighlightCalculator.js`

```
Purpose: Compute highlight progress for each word given playbackTimeSeconds

Function: calculateHighlightState(normalizedLyrics, playbackTimeSeconds)

Returns: {
  activeLineIndex: number,
  activeWordIndex: number,
  wordStates: Map<`${lineIndex}:${wordIndex}`, {
    state: 'past' | 'current' | 'future',
    progress: number (0-1, for current word letter-fill),
    syllableProgress?: number (if syllables exist)
  }>
}

Timing Rules:
- [ ] Word is 'current' when: startTime <= t < endTime
- [ ] Word is 'past' when: t >= endTime
- [ ] Word is 'future' when: t < startTime
- [ ] Progress = (t - startTime) / (endTime - startTime), clamped 0-1
- [ ] For syllables: compute per-syllable progress within word interval
```

### 2.2 Create Letter-Fill Renderer
**File:** `src/components/lyrics/LetterFillWord.jsx`

```
Purpose: Render single word with left-to-right letter-fill highlight

Visual Layers (CSS/Canvas):
1. Base Layer: White text + white neon glow (always visible)
2. Highlight Layer: Colored fill overlay (no glow)

Props:
- text: string
- progress: number (0-1)
- state: 'past' | 'current' | 'future'
- highlightColor: string (pastel green/purple/yellow)
- fontSize: number

Implementation Options:
A) CSS clip-path approach:
   - Two overlapping <span> elements
   - Base: white text + text-shadow glow
   - Highlight: colored text with clip-path: inset(0 ${100-progress*100}% 0 0)

B) Canvas approach:
   - Measure text width
   - Draw white text + blur filter for glow
   - Clip rect for highlight portion
   - Draw colored text in clipped region

Tasks:
- [ ] Implement base white text with CSS text-shadow glow
- [ ] Implement colored overlay with percentage-based clipping
- [ ] Ensure highlight has NO glow/shadow effects
- [ ] Handle syllable-level progress if syllables array exists
```

---

## Phase 3: Pagination System

### 3.1 Create Pagination Calculator
**File:** `src/utils/lyricsPagination.js`

```
Purpose: Divide lines into pages, determine current page from playback time

Function: calculatePages(normalizedLines, linesPerPage)
Returns: Page[] where Page = { pageIndex, lines[], startTime, endTime }

Function: getCurrentPage(pages, playbackTimeSeconds)
Returns: { currentPage, shouldTransition, nextPage }

Page Turn Rules:
- [ ] Page turns ONLY after final word on current page completes (word.endTime)
- [ ] Never turn mid-word or mid-highlight
- [ ] Pre-load next page data for smooth transition
- [ ] On seek: instantly jump to correct page (no animation)

Tasks:
- [ ] Group lines into pages of N (2, 3, or 4)
- [ ] Calculate page boundaries from first word start to last word end
- [ ] Expose page transition timing for brief "preview" of next page
```

### 3.2 Create Paginated Display Component
**File:** `src/components/lyrics/PaginatedLyricsDisplay.jsx`

```
Purpose: Render current page of lyrics with proper highlighting

Props:
- normalizedLyrics: NormalizedLyrics
- playbackTimeSeconds: number
- linesPerPage: 2 | 3 | 4
- highlightColor: string
- fontSize: number

State Management:
- [ ] Track currentPageIndex
- [ ] Compute word states for visible lines only (performance)
- [ ] Handle page transitions with brief overlap timing

Layout:
- [ ] Center lyrics vertically and horizontally
- [ ] Large, readable font (configurable)
- [ ] Clear visual separation between lines
```

---

## Phase 4: State Differentiation (Past/Current/Future)

### 4.1 Implement Visual State Styling
**File:** `src/components/lyrics/LyricLine.jsx`

```
Past Lyrics Styling:
- [ ] Reduce opacity to ~0.4-0.5 (faded but legible)
- [ ] Maintain white color + reduced glow intensity
- [ ] Apply instantly on state change (no gradual transition)

Current Lyrics Styling:
- [ ] Full opacity (1.0)
- [ ] Active letter-fill highlight
- [ ] Most prominent visual weight

Future Lyrics Styling:
- [ ] Opacity ~0.8 (slightly less prominent than current)
- [ ] White text with full glow
- [ ] Clearly distinct from past state

Seek Behavior:
- [ ] On seek: immediately recompute all states
- [ ] No "catch-up" animations - instant state sync
- [ ] Past/current/future determined purely from playbackTimeSeconds
```

---

## Phase 5: Instrumental Gap + Countdown

### 5.1 Create Gap Detector
**File:** `src/utils/gapDetector.js`

```
Already partially exists in: karaokeHelpers.js (computeInstrumentalGap, computeOutroGap)

Enhance to:
- [ ] Detect ALL gaps >= 8.0 seconds
- [ ] Classify as 'instrumental' or 'outro'
- [ ] Return array of gap objects with timing

Gap Definition:
- Gap starts: when previous word.endTime occurs
- Gap ends: 3.0 seconds before next word.startTime (countdown buffer)
- Countdown displays during gap, ends 3.0s early
```

### 5.2 Create Countdown Component
**File:** `src/components/lyrics/CountdownBar.jsx`

```
Purpose: Display progress bar during instrumental/outro gaps

Props:
- gapType: 'instrumental' | 'outro'
- gapStartTime: number
- gapEndTime: number (actual end, not countdown end)
- playbackTimeSeconds: number

Display:
- [ ] Show label: "Instrumental" or "Outro"
- [ ] Progress bar filling left-to-right
- [ ] Countdown ends 3.0s before next lyrics begin
- [ ] Hide when lyrics resume

Tasks:
- [ ] Calculate countdown progress
- [ ] Style consistent with karaoke aesthetic
- [ ] Smooth animation via requestAnimationFrame
```

---

## Phase 6: Real-Time Controls

### 6.1 Create Presentation Controls Component
**File:** `src/components/lyrics/LyricsControls.jsx`

```
Controls:
1. Lines Per Page: [2] [3] [4] toggle buttons
2. Highlight Color: [Green] [Purple] [Yellow] picker
3. Font Size: [S] [M] [L] [XL] selector

Color Palette (dark-ish pastels):
- Green: #7CB87C or similar
- Purple: #9B7CB8 or similar
- Yellow: #C9B857 or similar

Tasks:
- [ ] Instant application (no confirmation needed)
- [ ] Persist preferences to localStorage
- [ ] Expose as props to LyricsDisplay component
```

### 6.2 Integrate Controls with Display
**File:** `src/components/lyrics/KaraokeLyricsDisplay.jsx` (main orchestrator)

```
Purpose: Top-level component combining all lyrics display functionality

Props:
- timingJson: KaraokeTimingJSON_v1 (from alignment result)
- audioRef: ref to audio element or AudioContext
- onSeek: callback when user seeks via lyrics click

State:
- linesPerPage: number
- highlightColor: string
- fontSize: number

Children:
- PaginatedLyricsDisplay
- CountdownBar (conditional)
- LyricsControls

Tasks:
- [ ] Wire playback time to highlight calculator
- [ ] Handle page transitions
- [ ] Show/hide countdown based on gap detection
- [ ] Apply user preferences in real-time
```

---

## Phase 7: Seek/Transport Coupling

### 7.1 Implement Seek Handler
**Location:** `src/components/lyrics/KaraokeLyricsDisplay.jsx`

```
On Seek Event:
1. [ ] Receive new playbackTimeSeconds
2. [ ] Recalculate ALL word states immediately
3. [ ] Jump to correct page instantly (no animation)
4. [ ] Update countdown state if in gap
5. [ ] Reset any transition animations

No Gradual Catch-Up:
- State must be 100% deterministic from time value
- No "smoothing" or "lerping" to correct position
- Instant snap to correct visual state
```

### 7.2 Click-to-Seek Feature (Optional Enhancement)
```
Allow users to click on a word/line to seek to that position
- [ ] Calculate word.startTime from click target
- [ ] Call seek(wordStartTime)
- [ ] Useful for navigation during editing
```

---

## Phase 8: Editor Integration + Formatting Preservation

### 8.1 Audit Alignment Pipeline for Formatting
**Files to review:**
- `server/alignment/canonicalizer.js`
- `server/alignment/audioshake-adapter.js`

```
Current Issue: Alignment may destroy spaces/newlines

Tasks:
- [ ] Trace how lyricsText flows through alignment submission
- [ ] Ensure newlines are preserved in canonical output
- [ ] Verify spaces between words are maintained
- [ ] Add integration test: submit formatted lyrics → verify output formatting
```

### 8.2 Update Canonicalizer
**File:** `server/alignment/canonicalizer.js`

```
Enhancements:
- [ ] Preserve original line breaks from input lyrics
- [ ] Map AudioShake tokens back to original text positions
- [ ] Maintain word spacing (no run-together words)
- [ ] Add whitespace preservation flag if needed
```

### 8.3 Editor Display Sync
**File:** `src/components/karaoke-designs/IntegratedEcologicalOS.jsx`

```
Tasks:
- [ ] After alignment completes, display formatted lyrics in editor
- [ ] Preserve user's original formatting when possible
- [ ] Show diff/warning if alignment modified formatting
```

---

## Phase 9: Integration with Existing UI

### 9.1 Add Lyrics Display to IntegratedEcologicalOS
**File:** `src/components/karaoke-designs/IntegratedEcologicalOS.jsx`

```
Integration Points:
- [ ] Add new "Karaoke Preview" mode/tab
- [ ] Pass alignJob result (timing JSON) to KaraokeLyricsDisplay
- [ ] Wire existing audio playback to lyrics display
- [ ] Add controls panel to UI

Layout Consideration:
- Full-screen lyrics display for karaoke mode
- Or split view: editor left, preview right
```

### 9.2 Replace/Enhance Existing Preview
**File:** `src/components/KaraokeRenderer.jsx`

```
Options:
A) Replace canvas renderer with new component
B) Keep canvas for video export, use new component for live preview
C) Unify both under same highlighting logic

Recommendation: Option B
- Canvas renderer optimized for video export
- New component optimized for live interactive preview
- Share highlighting calculation logic between both
```

---

## File Structure Summary

```
src/
├── hooks/
│   └── usePlaybackTime.js          [NEW]
├── utils/
│   ├── lyricsTimingNormalizer.js   [NEW]
│   ├── wordHighlightCalculator.js  [NEW]
│   ├── lyricsPagination.js         [NEW]
│   ├── gapDetector.js              [NEW - or enhance karaokeHelpers.js]
│   └── karaokeHelpers.js           [EXISTING - may enhance]
├── components/
│   └── lyrics/
│       ├── KaraokeLyricsDisplay.jsx    [NEW - main orchestrator]
│       ├── PaginatedLyricsDisplay.jsx  [NEW]
│       ├── LyricLine.jsx               [NEW]
│       ├── LetterFillWord.jsx          [NEW]
│       ├── CountdownBar.jsx            [NEW]
│       └── LyricsControls.jsx          [NEW]
server/
└── alignment/
    └── canonicalizer.js            [MODIFY - formatting preservation]
```

---

## Implementation Order

1. **Phase 1** - Data normalization (foundation)
2. **Phase 2** - Highlighting engine (core feature)
3. **Phase 4** - State differentiation (visual clarity)
4. **Phase 3** - Pagination (layout)
5. **Phase 5** - Gap detection + countdown
6. **Phase 6** - Controls (user customization)
7. **Phase 7** - Seek coupling (interaction)
8. **Phase 8** - Editor formatting (bug fix)
9. **Phase 9** - UI integration (final assembly)

---

## Completion Checklist

Copy this checklist and verify each item before marking complete:

```
[ ] Each timed word highlights as a smooth left→right letter-fill over its exact duration
[ ] Base lyric text is always white with a persistent white neon glow
[ ] Highlight is colored fill only (explicitly no highlight glow)
[ ] Highlight timing matches AudioShake JSON exactly (no perceptible lag vs vocals)
[ ] Already-sung lyrics fade down in prominence and remain clearly distinct from current/upcoming
[ ] Current vs upcoming lyrics remain perceptually clear at all times
[ ] User can choose 2/3/4 lines per page in real time
[ ] Page turns only after the last highlighted word on current page completes
[ ] No-lyrics >= 8s triggers countdown bar that ends 3s early
[ ] "Instrumental" vs "Outro" labeling follows the definitions exactly
[ ] Highlight colors are dark-ish pastel green/purple/yellow + real-time picker
[ ] Multiple font sizes + real-time switching
[ ] Seek scrubs lyrics + pages + countdown + fading state together and resyncs immediately
[ ] Alignment/re-align no longer destroys spaces/newlines in the lyrics editor
[ ] Single time source drives highlighting with no drift
```

---

## Technical Notes

### Timing Reliability
- Use `requestAnimationFrame` for highlight updates (not setInterval)
- AudioContext.currentTime is the single source of truth
- All state is deterministic from `playbackTimeSeconds`

### Visual Layering (Critical)
```css
/* Base layer - always visible */
.lyric-word-base {
  color: white;
  text-shadow: 0 0 10px rgba(255,255,255,0.8),
               0 0 20px rgba(255,255,255,0.6),
               0 0 30px rgba(255,255,255,0.4);
}

/* Highlight layer - no glow */
.lyric-word-highlight {
  color: var(--highlight-color);
  text-shadow: none;
  clip-path: inset(0 var(--clip-right) 0 0);
}
```

### Performance Considerations
- Only calculate states for visible page
- Memoize pagination when linesPerPage doesn't change
- Debounce preference saves to localStorage
- Use CSS transforms for animations (GPU accelerated)

---

## Dependencies

No new dependencies required. Uses existing:
- React 18
- Web Audio API
- CSS clip-path (browser support excellent)
- requestAnimationFrame

---

*Generated for karaoke-box project, branch: lyrics_test_0.0.1*
