---
type: community/narrative
community_id: 19
label: "ASS Subtitle Export Service"
size: 5
cohesion: 0.70
character: code
---

# ASS Subtitle Export Service

> **5 nodes** | **Cohesion: 0.70** | **Primary file:** `server/services/exportService.js`

Generates ASS (Advanced SubStation Alpha) subtitle files from aligned lyrics data. ASS format supports karaoke-style per-syllable timing, colors, and positioning — used by video players and editing software for karaoke overlays.

### Key Nodes
- `generateKaraokeAss()` — produces ASS subtitle content from token data
- `hexToAssBgr()` — converts hex colors to ASS BGR format
- `formatAssTime()` — formats millisecond times as ASS timestamps (H:MM:SS.cc)

## For LLMs
- **ID:** 19 | **Size:** 5 nodes | **Cohesion:** 0.70 (tight — tightly focused utility)
- **Key file:** `server/services/exportService.js`
- **Format:** Advanced SubStation Alpha (.ass)
