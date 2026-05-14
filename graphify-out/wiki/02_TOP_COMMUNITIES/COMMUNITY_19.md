---
type: community/narrative
community_id: 19
label: "ASS Subtitle Export Service"
size: 5
cohesion: 0.70
character: code
---

# ASS Subtitle Export Service

> **5 nodes** | **Cohesion: 0.70** (tight) | **File:** `server/services/exportService.js`

## For Humans

**Real-world analogy:** This is the **subtitle typesetter** — it takes aligned lyrics with precise timings and formats them as ASS (Advanced SubStation Alpha) subtitle files. ASS format supports karaoke-style per-syllable timing with custom colors and positioning — the gold standard for karaoke subtitles used by video players worldwide.

```
┌──────────────────────────────────────┐
│          exportService.js            │
│  ┌────────────────────────────────┐  │
│  │ generateKaraokeAss()           │  │
│  │  Input:  Token[]               │  │
│  │  Output: .ass subtitle file    │  │
│  └──────────┬─────────────────────┘  │
│             │ uses                    │
│  ┌──────────┴─────────────────────┐  │
│  │ formatAssTime(ms)              │  │
│  │  → H:MM:SS.cc format           │  │
│  └──────────┬─────────────────────┘  │
│             │ uses                    │
│  ┌──────────┴─────────────────────┐  │
│  │ hexToAssBgr(hexColor)          │  │
│  │  → #FF0000 → &H0000FF&         │  │
│  │  (ASS uses BGR byte order)     │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### Key Nodes

| Node | Role |
|------|------|
| **generateKaraokeAss()** | Produces complete ASS subtitle content from tokens |
| **hexToAssBgr()** | Converts hex colors to ASS BGR format (reversed bytes) |
| **formatAssTime()** | Formats milliseconds as ASS timestamps (H:MM:SS.cc) |

### Cohesion: 0.70 (tightest community)
All functions are tightly coupled — they form a single ASS export pipeline. This is the highest-cohesion community in the graph.

### Bridges
- **Karaoke Renderer (C4):** ASS subtitles can be muxed into MP4 exports

## For LLMs

- **ID:** 19 · **Size:** 5 · **Cohesion:** 0.70
- **File:** `server/services/exportService.js`
- **Format:** Advanced SubStation Alpha (.ass)
