---
type: community/narrative
community_id: 14
label: "Word Highlight Calculator"
size: 7
cohesion: 0.00
character: code
---

# Word Highlight Calculator

> **7 nodes** | **Cohesion: 0.00** (single class) | **Files:** `wordHighlightCalculator.js`, `LyricLine.jsx`, `LetterFillWord.jsx`

## For Humans

**Real-world analogy:** This is the **bouncing ball on the karaoke screen** — it calculates exactly which syllable or letter should be highlighted right now, millisecond by millisecond. The letter-by-letter fill animation that makes karaoke fun to watch? This is the math behind it.

```
┌──────────────────────────────────────┐
│   calculateBatchHighlights()         │
│  ┌────────────────────────────────┐  │
│  │  Input: tokens[], currentTime  │  │
│  │  Output: [{word, fillPercent}] │  │
│  └──────────┬─────────────────────┘  │
│             ▼                         │
│  ┌────────────────────────────────┐  │
│  │  LyricLine                     │  │
│  │  → renders one line with       │  │
│  │    letter-fill animation       │  │
│  └──────────┬─────────────────────┘  │
│             ▼                         │
│  ┌────────────────────────────────┐  │
│  │  LetterFillWord                │  │
│  │  → letter-by-letter CSS fill   │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### Key Nodes
- **calculateBatchHighlights()** → Computes fill state for all words at current time
- **LyricLine** → Renders one line with letter-fill animation
- **LetterFillWord** → Individual word with per-letter CSS fill effect

### Cohesion: 0.00 (single concern)
Pure math functions — no side effects, no external dependencies.

### Bridges
- **Lyrics Display (C11):** KaraokeLyricsDisplay consumes highlight data
- **Token Editor (C1):** Token timing data drives calculations

## For LLMs

- **ID:** 14 · **Size:** 7 · **Cohesion:** 0.00
- **Files:** `src/utils/wordHighlightCalculator.js`, `src/components/lyrics/LyricLine.jsx`, `LetterFillWord.jsx`
