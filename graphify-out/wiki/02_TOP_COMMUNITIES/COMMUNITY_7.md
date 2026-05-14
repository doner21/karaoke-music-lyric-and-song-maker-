---
type: community/narrative
community_id: 7
label: "Lyrics Services"
size: 16
cohesion: 0.25
character: code
---

# Lyrics Services

> **16 nodes** | **Cohesion: 0.25** (moderate) | **Files:** `azlyrics.js`, `genius.js`, `lyricsParser.js`

## For Humans

**Real-world analogy:** These are the **research librarians**. When you need lyrics for a song, they go out and fetch them — checking Genius first (clean API), then AzLyrics (web scraping). They parse the raw HTML/text into clean, structured lyrics data.

### Architecture

```
┌──────────────────────────────────────┐
│         Lyrics Lookup Flow           │
│                                      │
│  ┌──────────┐    ┌──────────────┐    │
│  │ Genius   │    │  AzLyrics    │    │
│  │ API      │    │  Scraper     │    │
│  │          │    │              │    │
│  │ REST API │    │ parseLyrics()│    │
│  │ clean    │    │ scrapeLyrics │    │
│  │ JSON     │    │ () HTML→text │    │
│  └────┬─────┘    └──────┬───────┘    │
│       │                 │            │
│       └────────┬────────┘            │
│                ▼                     │
│        ┌──────────────┐             │
│        │ lyricsParser │             │
│        │ (normalize)  │             │
│        └──────┬───────┘             │
│               ▼                     │
│        ┌──────────────┐             │
│        │ Clean Lyrics │             │
│        │    Text      │             │
│        └──────────────┘             │
└──────────────────────────────────────┘
```

### Key Nodes

| Node | Role |
|------|------|
| **genius.js** | Genius REST API client for lyrics search/fetch |
| **azlyrics.js** | Web scraper with rotating user agents |
| **parseLyrics()** | Extracts lyrics from AzLyrics HTML structure |
| **scrapeLyrics()** | Fetches page, parses, returns clean text |
| **lyricsParser.js** | Normalizes raw lyrics into structured format |

### Cohesion: 0.25 (moderate)
Shared purpose (lyrics acquisition) with independent implementations.

### Bridges
- **Alignment (C5):** Lyrics text is input to AudioShake alignment
- **Token Editor (C1):** Lyrics feed into the token editor

## For LLMs

- **ID:** 7 · **Size:** 16 · **Cohesion:** 0.25
- **Files:** `server/services/azlyrics.js`, `genius.js`, `server/utils/lyricsParser.js`
- **Top nodes:** azlyrics.js(7), parseLyrics()(5), scrapeLyrics()(4), getRandomUserAgent()(3)
