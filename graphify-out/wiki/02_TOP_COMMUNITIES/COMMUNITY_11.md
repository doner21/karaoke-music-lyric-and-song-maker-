---
type: community/narrative
community_id: 11
label: "Lyrics Pagination"
size: 13
cohesion: 0.23
character: code
---

# Lyrics Pagination

> **13 nodes** | **Cohesion: 0.23** | **Primary files:** `src/utils/lyricsPagination.js`, `src/components/lyrics/PaginatedLyricsDisplay.jsx`, `KaraokeLyricsDisplay.jsx`

## For Humans

Splits long karaoke songs into readable "pages" of lyrics (like a teleprompter). Calculates which lyrics lines fit on screen based on timing and line count, then provides page-forward/page-back navigation.

### Key Nodes
- `getCurrentPage()` — determines which page of lyrics is currently visible
- `lyricsPagination.js` — page calculation with line grouping
- `PaginatedLyricsDisplay` — renders current page with animations
- `KaraokeLyricsDisplay` — full-screen lyrics overlay with word highlighting

## For LLMs
- **ID:** 11 | **Size:** 13 nodes | **Cohesion:** 0.23
- **Key files:** `src/utils/lyricsPagination.js`, `src/components/lyrics/PaginatedLyricsDisplay.jsx`, `KaraokeLyricsDisplay.jsx`
