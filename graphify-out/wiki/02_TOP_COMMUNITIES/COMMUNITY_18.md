---
type: community/narrative
community_id: 18
label: "Unified Search Service"
size: 5
cohesion: 0.00
character: code
---

# Unified Search Service

> **5 nodes** | **Cohesion: 0.00** (single file) | **File:** `server/library/search.js`

## For Humans

**Real-world analogy:** This is the **library catalog computer** — type in an artist or song name, and it searches both the local song database and YouTube simultaneously, merging results into one list. Handles deduplication and relevance ranking.

```
┌──────────────────────────────────────┐
│       UnifiedSearchService           │
│  ┌────────────────────────────────┐  │
│  │ .search(query)                 │  │
│  │  → .searchYouTube()            │  │
│  │  → .searchLocalLibrary()       │  │
│  │  → merge + deduplicate         │  │
│  │  → return ranked results       │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### Key Nodes
- **UnifiedSearchService** → Combined YouTube + local search
- **.searchYouTube()** → yt-dlp search
- **.search()** → Merged results with deduplication

### Cohesion: 0.00 (single file)

### Bridges
- **Download Engine (C0):** Search results → download jobs

## For LLMs

- **ID:** 18 · **Size:** 5 · **Cohesion:** 0.00
- **File:** `server/library/search.js`
