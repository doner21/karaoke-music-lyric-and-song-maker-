---
type: community/narrative
community_id: 11
label: "Lyrics Display & Pagination"
size: 13
cohesion: 0.23
character: code
---

# Lyrics Display & Pagination

> **13 nodes** | **Cohesion: 0.23** (moderate) | **Files:** `PaginatedLyricsDisplay.jsx`, `KaraokeLyricsDisplay.jsx`, `lyricsPagination.js`, `gapDetector.js`

## For Humans

**Real-world analogy:** This is the **teleprompter operator**. Long songs have many lyrics lines — way more than fit on one screen. This system splits them into readable "pages" and advances through them in sync with the music, like a broadcast teleprompter. It also detects gaps between lines for natural page breaks.

### Architecture

```
┌───────────────────────────────────────┐
│      PaginatedLyricsDisplay           │
│  ┌─────────────────────────────────┐  │
│  │  getCurrentPage()               │  │
│  │  → which page is visible now?   │  │
│  └──────────┬──────────────────────┘  │
│             ▼                          │
│  ┌─────────────────────────────────┐  │
│  │  lyricsPagination.js            │  │
│  │  → calculate pages from tokens  │  │
│  │  → group lines by timing        │  │
│  └──────────┬──────────────────────┘  │
│             ▼                          │
│  ┌─────────────────────────────────┐  │
│  │  gapDetector.js                 │  │
│  │  → find natural breaks between  │  │
│  │    lines for page transitions   │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
      │
      ▼
┌───────────────────────────────────────┐
│     KaraokeLyricsDisplay              │
│  → full-screen overlay                │
│  → word highlighting animations       │
│  → countdown bar, letter fill         │
└───────────────────────────────────────┘
```

### Key Nodes
- **getCurrentPage()** → Which page is visible at current playback time
- **lyricsPagination.js** → Calculates page breaks from token timing
- **gapDetector.js** → Finds natural pauses between lines
- **KaraokeLyricsDisplay** → Full-screen lyrics overlay with animations

### Cohesion: 0.23 (moderate)
Shared data flow (tokens → pages → display) creates moderate coupling.

### Bridges
- **Token Editor (C1):** Edited tokens drive display updates
- **Highlight Calc (C14):** Word-level animation timing

## For LLMs

- **ID:** 11 · **Size:** 13 · **Cohesion:** 0.23
- **Files:** `src/components/lyrics/PaginatedLyricsDisplay.jsx`, `KaraokeLyricsDisplay.jsx`, `src/utils/lyricsPagination.js`, `gapDetector.js`
