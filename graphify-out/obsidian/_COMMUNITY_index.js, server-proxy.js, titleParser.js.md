---
type: community
cohesion: 0.24
members: 15
---

# index.js, server-proxy.js, titleParser.js

**Cohesion:** 0.24 - loosely connected
**Members:** 15 nodes

## Members
- [[checkAndUpdateOnStartup()]] - code - server/services/ytdlp-updater.js
- [[checkForUpdate()]] - code - server/services/ytdlp-updater.js
- [[generateWaveform()]] - code - server/utils/waveform.js
- [[getCurrentVersion()]] - code - server/services/ytdlp-updater.js
- [[getLatestVersion()]] - code - server/services/ytdlp-updater.js
- [[index.js_3]] - code - server/downloader/index.js
- [[isNewerVersion()]] - code - server/services/ytdlp-updater.js
- [[normalizeVideo()]] - code - server-proxy.js
- [[parseVideoTitle()]] - code - server/utils/titleParser.js
- [[performUpdate()]] - code - server/services/ytdlp-updater.js
- [[runCommand()]] - code - server/services/ytdlp-updater.js
- [[server-proxy.js]] - code - server-proxy.js
- [[titleParser.js]] - code - server/utils/titleParser.js
- [[waveform.js]] - code - server/utils/waveform.js
- [[ytdlp-updater.js]] - code - server/services/ytdlp-updater.js

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/indexjs_server-proxyjs_titleParserjs
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_azlyrics.js, genius.js, lyricsParser.js]]
- 1 edge to [[_COMMUNITY_audio-separator-adapter.js, demucs-adapter.js, ffmpeg-splitter-adapter.js]]
- 1 edge to [[_COMMUNITY_audioshake-adapter.js, canonicalizer.js, index.js]]
- 1 edge to [[_COMMUNITY_index.js, migrate_add_logs.js, repo.js]]

## Top bridge nodes
- [[server-proxy.js]] - degree 11, connects to 4 communities