# Graph Report - .  (2026-05-14)

## Corpus Check
- 112 files · ~73,410 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 387 nodes · 512 edges · 48 communities (39 shown, 9 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 26|Community 26]]

## God Nodes (most connected - your core abstractions)
1. `AudioStemManager` - 21 edges
2. `JobManager` - 14 edges
3. `SongRepository` - 12 edges
4. `AudioShakeAdapter` - 11 edges
5. `EngineManager` - 10 edges
6. `drawKaraokeFrame()` - 10 edges
7. `insertToken()` - 9 edges
8. `Canonicalizer` - 8 edges
9. `AlignmentJobQueue` - 8 edges
10. `DownloadEngine` - 8 edges

## Surprising Connections (you probably didn't know these)
- `scrapeLyrics()` --calls--> `parseLyrics()`  [INFERRED]
  server/services/azlyrics.js → server/utils/lyricsParser.js
- `scrapeFromUrl()` --calls--> `parseLyrics()`  [INFERRED]
  server/services/azlyrics.js → server/utils/lyricsParser.js
- `getLyrics()` --calls--> `parseLyrics()`  [INFERRED]
  server/services/genius.js → server/utils/lyricsParser.js
- `TimelineBlockContent()` --calls--> `clamp01()`  [INFERRED]
  src/components/TimelineBlockContent.jsx → src/utils/karaokeHelpers.js
- `TokenEditorPanel()` --calls--> `useTokenEditor()`  [INFERRED]
  src/components/editor/TokenEditorPanel.jsx → src/editor/useTokenEditor.js

## Communities (48 total, 9 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (5): MockReliableAdapter, YtDlpAdapter, DownloadEngine, EngineManager, JobQueue

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (28): parseJSONToTokens(), tokensToExportJSON(), validateRoundtrip(), TokenEditorPanel(), applySnap(), clampMs(), createToken(), createTokenWithId() (+20 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (7): AudioSeparatorAdapter, DemucsAdapter, FFmpegSplitterAdapter, initSplitterService(), log(), MockSplitterAdapter, UVRMDXNetAdapter

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (4): getDB(), initDB(), SongRepository, JobManager

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (3): AudioShakeAdapter, Canonicalizer, initAlignmentService()

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (14): exportToMp4Electron(), flipVertical(), drawIntervalDisplay(), drawKaraokeFrame(), drawLyricsPage(), roundRect(), compileShader(), createProgram() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.16
Nodes (9): TimelineBlockContent(), audioBufferToWav(), clamp01(), encodeWAV(), floatTo16BitPCM(), interleave(), prettyTime(), writeFloat32() (+1 more)

### Community 8 - "Community 8"
Cohesion: 0.25
Nodes (13): checkExists(), constructUrl(), generateUrlVariations(), getRandomUserAgent(), normalizeForUrl(), randomDelay(), scrapeFromUrl(), scrapeLyrics() (+5 more)

### Community 9 - "Community 9"
Cohesion: 0.24
Nodes (9): checkAndUpdateOnStartup(), checkForUpdate(), getCurrentVersion(), getLatestVersion(), isNewerVersion(), performUpdate(), runCommand(), parseVideoTitle() (+1 more)

### Community 10 - "Community 10"
Cohesion: 0.19
Nodes (5): useKaraokeExport(), fmtTime(), IntegratedEcologicalOS(), detectGpuCapabilities(), resolveGpuConfig()

### Community 11 - "Community 11"
Cohesion: 0.23
Nodes (8): usePlaybackTime(), KaraokeLyricsDisplay(), getActiveGap(), calculatePages(), findNextHighlightableWord(), findPageContainingLine(), getCurrentPage(), normalizeLyrics()

### Community 15 - "Community 15"
Cohesion: 0.6
Nodes (5): fatal(), get_parser(), load_track(), log_config(), main()

### Community 19 - "Community 19"
Cohesion: 0.7
Nodes (4): exportKaraokeVideo(), formatAssTime(), generateKaraokeAss(), hexToAssBgr()

### Community 21 - "Community 21"
Cohesion: 0.83
Nodes (3): extractConfig(), main(), runSplit()

## Knowledge Gaps
- **1 isolated node(s):** `Wrapper script to run audio_separator CLI entry point.  The audio_separator.util`
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.