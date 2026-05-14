# Graph Report - .  (2026-05-14)

## Corpus Check
- 112 files · ~73,410 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 407 nodes · 516 edges · 64 communities (40 shown, 24 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_engine-interface.js, engine-manager.js, job-queue.js|engine-interface.js, engine-manager.js, job-queue.js]]
- [[_COMMUNITY_TokenEditorPanel.jsx, jsonAdapters.js, jsonAdapters.test.js|TokenEditorPanel.jsx, jsonAdapters.js, jsonAdapters.test.js]]
- [[_COMMUNITY_audio-separator-adapter.js, demucs-adapter.js, ffmpeg-splitter-adapter.js|audio-separator-adapter.js, demucs-adapter.js, ffmpeg-splitter-adapter.js]]
- [[_COMMUNITY_index.js, migrate_add_logs.js, repo.js|index.js, migrate_add_logs.js, repo.js]]
- [[_COMMUNITY_KaraokeRenderer.jsx, VerificationPanel.jsx, electronExport.js|KaraokeRenderer.jsx, VerificationPanel.jsx, electronExport.js]]
- [[_COMMUNITY_audioshake-adapter.js, canonicalizer.js, index.js|audioshake-adapter.js, canonicalizer.js, index.js]]
- [[_COMMUNITY_AudioStemManager.js|AudioStemManager.js]]
- [[_COMMUNITY_azlyrics.js, genius.js, lyricsParser.js|azlyrics.js, genius.js, lyricsParser.js]]
- [[_COMMUNITY_TimelineBlockContent.jsx, karaokeHelpers.js|TimelineBlockContent.jsx, karaokeHelpers.js]]
- [[_COMMUNITY_index.js, server-proxy.js, titleParser.js|index.js, server-proxy.js, titleParser.js]]
- [[_COMMUNITY_IntegratedEcologicalOS.jsx, gpuCapabilities.js, useKaraokeExport.js|IntegratedEcologicalOS.jsx, gpuCapabilities.js, useKaraokeExport.js]]
- [[_COMMUNITY_KaraokeLyricsDisplay.jsx, gapDetector.js, lyricsPagination.js|KaraokeLyricsDisplay.jsx, gapDetector.js, lyricsPagination.js]]
- [[_COMMUNITY_index.js, job-queue.js|index.js, job-queue.js]]
- [[_COMMUNITY_queue.js|queue.js]]
- [[_COMMUNITY_LyricLine.jsx, PaginatedLyricsDisplay.jsx, wordHighlightCalculator.js|LyricLine.jsx, PaginatedLyricsDisplay.jsx, wordHighlightCalculator.js]]
- [[_COMMUNITY_debug_separate.py|debug_separate.py]]
- [[_COMMUNITY_AudioErrorBoundary.jsx|AudioErrorBoundary.jsx]]
- [[_COMMUNITY_SimpleErrorBoundary.jsx|SimpleErrorBoundary.jsx]]
- [[_COMMUNITY_search.js|search.js]]
- [[_COMMUNITY_exportService.js|exportService.js]]
- [[_COMMUNITY_KaraokeComposition.jsx, Root.jsx, index.jsx|KaraokeComposition.jsx, Root.jsx, index.jsx]]
- [[_COMMUNITY_test_parity.js|test_parity.js]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]
- [[_COMMUNITY_run_audio_separator.py|run_audio_separator.py]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]
- [[_COMMUNITY_ARCHITECTURE|ARCHITECTURE]]

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

## Hyperedges (group relationships)
- **KaraokeBox Pipeline** — pipeline_download, pipeline_split, pipeline_align, pipeline_render [INFERRED 0.95]
- **Splitter Adapter Family** — DemucsAdapter, UVRMDXNetAdapter, FFmpegSplitterAdapter, AudioSeparatorAdapter, MockSplitterAdapter [INFERRED 0.90]
- **Stem Alignment Conservation** — arch_canonicalization, concern_alignment_integrity, DemucsAdapter, UVRMDXNetAdapter [INFERRED 0.90]

## Communities (64 total, 24 thin omitted)

### Community 0 - "engine-interface.js, engine-manager.js, job-queue.js"
Cohesion: 0.06
Nodes (5): MockReliableAdapter, YtDlpAdapter, DownloadEngine, EngineManager, JobQueue

### Community 1 - "TokenEditorPanel.jsx, jsonAdapters.js, jsonAdapters.test.js"
Cohesion: 0.13
Nodes (28): parseJSONToTokens(), tokensToExportJSON(), validateRoundtrip(), TokenEditorPanel(), applySnap(), clampMs(), createToken(), createTokenWithId() (+20 more)

### Community 2 - "audio-separator-adapter.js, demucs-adapter.js, ffmpeg-splitter-adapter.js"
Cohesion: 0.06
Nodes (7): AudioSeparatorAdapter, DemucsAdapter, FFmpegSplitterAdapter, initSplitterService(), log(), MockSplitterAdapter, UVRMDXNetAdapter

### Community 3 - "index.js, migrate_add_logs.js, repo.js"
Cohesion: 0.08
Nodes (4): getDB(), initDB(), SongRepository, JobManager

### Community 4 - "KaraokeRenderer.jsx, VerificationPanel.jsx, electronExport.js"
Cohesion: 0.17
Nodes (15): exportToMp4Electron(), flipVertical(), drawIntervalDisplay(), drawKaraokeFrame(), drawLyricsPage(), roundRect(), compileShader(), createProgram() (+7 more)

### Community 5 - "audioshake-adapter.js, canonicalizer.js, index.js"
Cohesion: 0.12
Nodes (3): AudioShakeAdapter, Canonicalizer, initAlignmentService()

### Community 7 - "azlyrics.js, genius.js, lyricsParser.js"
Cohesion: 0.25
Nodes (13): checkExists(), constructUrl(), generateUrlVariations(), getRandomUserAgent(), normalizeForUrl(), randomDelay(), scrapeFromUrl(), scrapeLyrics() (+5 more)

### Community 8 - "TimelineBlockContent.jsx, karaokeHelpers.js"
Cohesion: 0.17
Nodes (8): TimelineBlockContent(), audioBufferToWav(), clamp01(), encodeWAV(), floatTo16BitPCM(), interleave(), writeFloat32(), writeString()

### Community 9 - "index.js, server-proxy.js, titleParser.js"
Cohesion: 0.24
Nodes (9): checkAndUpdateOnStartup(), checkForUpdate(), getCurrentVersion(), getLatestVersion(), isNewerVersion(), performUpdate(), runCommand(), parseVideoTitle() (+1 more)

### Community 10 - "IntegratedEcologicalOS.jsx, gpuCapabilities.js, useKaraokeExport.js"
Cohesion: 0.19
Nodes (5): useKaraokeExport(), fmtTime(), IntegratedEcologicalOS(), detectGpuCapabilities(), resolveGpuConfig()

### Community 11 - "KaraokeLyricsDisplay.jsx, gapDetector.js, lyricsPagination.js"
Cohesion: 0.23
Nodes (8): usePlaybackTime(), KaraokeLyricsDisplay(), getActiveGap(), calculatePages(), findNextHighlightableWord(), findPageContainingLine(), getCurrentPage(), normalizeLyrics()

### Community 15 - "debug_separate.py"
Cohesion: 0.6
Nodes (5): fatal(), get_parser(), load_track(), log_config(), main()

### Community 19 - "exportService.js"
Cohesion: 0.7
Nodes (4): exportKaraokeVideo(), formatAssTime(), generateKaraokeAss(), hexToAssBgr()

### Community 21 - "test_parity.js"
Cohesion: 0.83
Nodes (3): extractConfig(), main(), runSplit()

### Community 22 - "ARCHITECTURE"
Cohesion: 0.5
Nodes (4): Alignment Pipeline, Download Pipeline, Render/Export Pipeline, Split Pipeline

## Knowledge Gaps
- **1 isolated node(s):** `Wrapper script to run audio_separator CLI entry point.  The audio_separator.util`
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.