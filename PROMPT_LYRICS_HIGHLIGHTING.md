# Implementation Prompt: Karaoke Lyric Highlighting System

**Branch:** `lyrics_test_0.0.1`
**Project:** karaoke-box (Electron + React + Vite)

---

## Your Task

Implement a karaoke lyric timing + highlighting system for the karaoke-box application. The system must render large readable lyrics that highlight in sync with AudioShake timing JSON, support real-time presentation controls, and maintain editor formatting integrity.

---

## Existing Architecture (Reference These Files)

```
Key Files:
- src/components/karaoke-designs/IntegratedEcologicalOS.jsx  → Main UI, has alignment workflow
- src/utils/karaokeHelpers.js                                → Existing timing helpers
- src/utils/karaokeDrawer.js                                 → Canvas rendering (for export)
- server/alignment/canonicalizer.js                          → Transforms AudioShake output
- server/alignment/job-queue.js                              → Alignment job processing

Data Flow:
1. User submits lyrics → /align/submit
2. AudioShake processes → returns word-level timing
3. Canonicalizer outputs KaraokeTimingJSON_v1 format
4. Frontend fetches → /align/result/:jobId
5. Your component renders lyrics with highlighting
```

---

## Files to Create

### 1. `src/utils/lyricsTimingNormalizer.js`
Normalize KaraokeTimingJSON_v1 into render-ready structure with lines, words, syllables (if present), and detected gaps.

### 2. `src/hooks/usePlaybackTime.js`
Hook providing single source of truth for playback time. Use requestAnimationFrame for drift-free 60fps updates tied to AudioContext.currentTime.

### 3. `src/utils/wordHighlightCalculator.js`
Calculate highlight state for each word given current time:
- Returns: `{ state: 'past'|'current'|'future', progress: 0-1 }`
- Progress used for letter-fill animation

### 4. `src/utils/lyricsPagination.js`
Divide lines into pages (2/3/4 lines). Page turns ONLY after final word on page completes.

### 5. `src/components/lyrics/LetterFillWord.jsx`
Single word component with left-to-right letter-fill highlight:
- **Base layer:** White text + white neon glow (always visible)
- **Highlight layer:** Colored fill overlay ONLY (no glow on highlight)
- Use CSS clip-path for reveal animation

### 6. `src/components/lyrics/LyricLine.jsx`
Render a line of words with state-based styling:
- Past: opacity 0.4-0.5, faded but legible
- Current: full opacity, active highlighting
- Future: opacity 0.8, clearly distinct from past

### 7. `src/components/lyrics/PaginatedLyricsDisplay.jsx`
Render current page of lyrics. Handle page transitions.

### 8. `src/components/lyrics/CountdownBar.jsx`
Display during gaps >= 8 seconds:
- Show "Instrumental" or "Outro" label
- Progress bar, ends 3 seconds before next lyrics

### 9. `src/components/lyrics/LyricsControls.jsx`
Real-time controls:
- Lines per page: 2/3/4
- Highlight color: dark-ish pastel green/purple/yellow
- Font size: S/M/L/XL

### 10. `src/components/lyrics/KaraokeLyricsDisplay.jsx`
Main orchestrator component. Wire everything together.

---

## Hard Requirements (Must All Pass)

### Highlighting
- [ ] Per-word left-to-right letter-fill over exact JSON timing interval
- [ ] If syllables exist: highlight syllables sequentially within word
- [ ] Base text: white + white neon glow (always on)
- [ ] Highlight: colored fill ONLY (no glow/bloom/shadow on highlight)
- [ ] Timing matches AudioShake JSON exactly (start <= t < end)

### State Differentiation
- [ ] Past lyrics: faded (opacity ~0.4-0.5), clearly distinct from current
- [ ] Current lyrics: most prominent, active highlighting
- [ ] Future lyrics: less prominent than current, distinct from past
- [ ] On seek: instantly recompute all states (no gradual catch-up)

### Pagination
- [ ] Support 2, 3, or 4 lines per page (user selectable)
- [ ] Page turn ONLY after last highlighted word on page completes
- [ ] Never turn mid-word or mid-highlight
- [ ] On seek: instantly jump to correct page

### Gaps & Countdown
- [ ] Detect gaps >= 8.0 seconds between words
- [ ] Show countdown bar during gaps
- [ ] Countdown ends 3.0 seconds before next lyric
- [ ] Label: "Instrumental" for mid-song gaps, "Outro" for final gap

### Controls
- [ ] Highlight colors: dark-ish pastel green/purple/yellow
- [ ] Font sizes: multiple options, instant switching
- [ ] All changes apply instantly (no confirmation)

### Transport
- [ ] Single time source (playbackTimeSeconds from AudioContext)
- [ ] requestAnimationFrame for updates (no drift)
- [ ] Seek scrubs ALL state together: highlights, pages, countdown, fading

### Editor Integrity
- [ ] Alignment must not destroy spaces/newlines in lyrics
- [ ] Review/fix canonicalizer.js if needed

---

## Visual Layering (Critical CSS)

```css
/* Base layer - white text with glow */
.word-base {
  color: white;
  text-shadow:
    0 0 10px rgba(255,255,255,0.8),
    0 0 20px rgba(255,255,255,0.6),
    0 0 30px rgba(255,255,255,0.4);
}

/* Highlight layer - colored fill, NO glow */
.word-highlight {
  color: var(--highlight-color);
  text-shadow: none;
  clip-path: inset(0 calc(100% - var(--progress) * 100%) 0 0);
  position: absolute;
  top: 0;
  left: 0;
}

/* State styling */
.word-past { opacity: 0.45; }
.word-current { opacity: 1; }
.word-future { opacity: 0.8; }
```

---

## Timing Formula

```javascript
function getWordState(word, playbackTimeSeconds) {
  const t = playbackTimeSeconds;

  if (t >= word.endTime) {
    return { state: 'past', progress: 1 };
  }
  if (t >= word.startTime) {
    const progress = (t - word.startTime) / (word.endTime - word.startTime);
    return { state: 'current', progress: Math.min(1, Math.max(0, progress)) };
  }
  return { state: 'future', progress: 0 };
}
```

---

## Gap Detection

```javascript
function detectGaps(words, songDuration, minGapSeconds = 8.0) {
  const gaps = [];
  for (let i = 0; i < words.length - 1; i++) {
    const gapStart = words[i].endTime;
    const gapEnd = words[i + 1].startTime;
    if (gapEnd - gapStart >= minGapSeconds) {
      gaps.push({ type: 'instrumental', startTime: gapStart, endTime: gapEnd });
    }
  }
  // Check for outro
  const lastWord = words[words.length - 1];
  if (songDuration - lastWord.endTime >= minGapSeconds) {
    gaps.push({ type: 'outro', startTime: lastWord.endTime, endTime: songDuration });
  }
  return gaps;
}
```

---

## Integration Point

Add to `IntegratedEcologicalOS.jsx`:

```jsx
import KaraokeLyricsDisplay from '../lyrics/KaraokeLyricsDisplay';

// In render, when alignment is complete:
{alignJob?.state === 'done' && alignmentResult && (
  <KaraokeLyricsDisplay
    timingJson={alignmentResult}
    playbackTimeSeconds={currentPlaybackTime}
    onSeek={handleSeek}
  />
)}
```

---

## Completion Checklist

Before marking complete, verify ALL items:

```
[ ] Each word highlights left→right over exact duration
[ ] Base text is white with persistent white neon glow
[ ] Highlight is colored fill only (NO highlight glow)
[ ] Timing matches JSON exactly (no lag)
[ ] Past lyrics clearly faded, distinct from current/future
[ ] Current vs future lyrics perceptually clear
[ ] User can choose 2/3/4 lines per page in real time
[ ] Page turns only after last word on page completes
[ ] No-lyrics >= 8s triggers countdown ending 3s early
[ ] "Instrumental" vs "Outro" labeled correctly
[ ] Highlight colors are dark-ish pastels + real-time picker
[ ] Multiple font sizes + instant switching
[ ] Seek resyncs everything immediately
[ ] Alignment preserves spaces/newlines
[ ] Single time source, no drift
```

If any item fails, continue refining until all pass.

---

*Branch: lyrics_test_0.0.1 | Project: karaoke-box*
