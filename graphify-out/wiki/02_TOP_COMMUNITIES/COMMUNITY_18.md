---
type: community/narrative
community_id: 18
label: "Unified Search Service"
size: 5
cohesion: 0.00
character: code
---

# Unified Search Service

> **5 nodes** | **Cohesion: 0.00** | **Primary file:** `server/library/search.js`

## For Humans

Single search endpoint that queries both YouTube (via yt-dlp) and a local song library. Returns unified results for the search bar in the UI. Handles deduplication and result ranking.

### Key Nodes
- `UnifiedSearchService` — unified search across YouTube + local library
- `.searchYouTube()` — yt-dlp YouTube search
- `.search()` — combined search with result merging

## For LLMs
- **ID:** 18 | **Size:** 5 nodes | **Cohesion:** 0.00
- **Key file:** `server/library/search.js`
