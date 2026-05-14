---
type: community/narrative
community_id: 8
label: "AzLyrics Scraper"
size: 16
cohesion: 0.25
character: code
---

# AzLyrics Scraper

> **16 nodes** | **Cohesion: 0.25** | **Primary file:** `server/services/azlyrics.js`

Web scraper for AzLyrics.com. Fetches lyrics pages, parses the lyrics block from HTML, and extracts clean text. Uses rotating user agents and rate limiting to avoid blocking.

### Key Nodes
- `scrapeLyrics()` — fetches and parses a single lyrics page
- `parseLyrics()` — extracts lyric text from AzLyrics HTML structure
- `getRandomUserAgent()` — rotates browser UA strings
- `search()` — finds lyrics URLs by artist + song title

## For LLMs
- **ID:** 8 | **Size:** 16 nodes | **Cohesion:** 0.25
- **Key file:** `server/services/azlyrics.js`
- **External dependency:** AzLyrics.com (no API, HTML scraping)
