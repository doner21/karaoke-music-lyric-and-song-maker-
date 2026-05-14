---
type: community
cohesion: 0.25
members: 16
---

# azlyrics.js, genius.js, lyricsParser.js

**Cohesion:** 0.25 - loosely connected
**Members:** 16 nodes

## Members
- [[attemptSlugify()]] - code - server/services/genius.js
- [[azlyrics.js]] - code - server/services/azlyrics.js
- [[checkExists()]] - code - server/services/azlyrics.js
- [[constructUrl()]] - code - server/services/azlyrics.js
- [[generateUrlVariations()]] - code - server/services/azlyrics.js
- [[genius.js]] - code - server/services/genius.js
- [[getLyrics()]] - code - server/services/genius.js
- [[getRandomUserAgent()]] - code - server/services/azlyrics.js
- [[lyricsParser.js]] - code - server/utils/lyricsParser.js
- [[normalizeForUrl()]] - code - server/services/azlyrics.js
- [[parseLyrics()]] - code - server/utils/lyricsParser.js
- [[randomDelay()]] - code - server/services/azlyrics.js
- [[scrapeFromUrl()]] - code - server/services/azlyrics.js
- [[scrapeLyrics()]] - code - server/services/azlyrics.js
- [[searchLyrics()]] - code - server/services/azlyrics.js
- [[searchSong()]] - code - server/services/genius.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/azlyricsjs_geniusjs_lyricsParserjs
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_index.js, server-proxy.js, titleParser.js]]

## Top bridge nodes
- [[getLyrics()]] - degree 3, connects to 1 community
- [[searchSong()]] - degree 3, connects to 1 community