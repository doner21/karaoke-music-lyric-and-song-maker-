---
type: community/narrative
community_id: 14
label: "Word Highlight Calculator"
size: 7
cohesion: 0.00
character: code
---

# Word Highlight Calculator

> **7 nodes** | **Cohesion: 0.00** | **Primary files:** `src/utils/wordHighlightCalculator.js`, `src/components/lyrics/LyricLine.jsx`

## For Humans

Calculates which syllable/letter within a word should be highlighted at any given playback time. Drives the letter-by-letter fill animation in the karaoke display (like a bouncing ball effect). Works at millisecond precision using the alignment timing data.

### Key Nodes
- `calculateBatchHighlights()` — computes highlight state for all words at once
- `LyricLine` — renders a single line with letter-fill animation

## For LLMs
- **ID:** 14 | **Size:** 7 nodes | **Cohesion:** 0.00
- **Key files:** `src/utils/wordHighlightCalculator.js`, `src/components/lyrics/LyricLine.jsx`
