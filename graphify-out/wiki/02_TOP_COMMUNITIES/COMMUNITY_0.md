---
type: community/narrative
community_id: 0
label: "Download Engine"
size: 39
cohesion: 0.06
character: code
---

# Download Engine

> **39 nodes** | **Cohesion: 0.06** | **Primary files:** `engine-manager.js`, `engine-interface.js`, `yt-dlp.js`, `mock-reliable.js`

## For Humans

This is the **audio acquisition pipeline** — think of it as the "shipping and receiving department." When a user pastes a YouTube URL, this system downloads the audio and converts it to MP3.

### How it works

```
YouTube URL → EngineManager.getExecutionOrder()
                  ↓
            tries yt-dlp first (primary strategy)
                  ↓
            yt-dlp -x --audio-format mp3 → audio.mp3
                  ↓
            falls back to MockReliableAdapter if yt-dlp fails
```

**EngineManager** is the dispatcher — it picks which download engine to use. **YtDlpAdapter** shells out to `yt-dlp` (a Python CLI) with ffmpeg for audio extraction. **MockReliableAdapter** is a testing fallback. **JobQueue** handles deduplication (same song, same params → skip) and persistence via the orchestrator.

### Key Nodes
- `EngineManager` — strategy selector: tries yt-dlp, falls back to mock
- `DownloadEngine` — interface that all download adapters implement
- `YtDlpAdapter` — spawns `python -m yt_dlp` with proper ffmpeg location
- `MockReliableAdapter` — returns pre-cached test audio for development
- `JobQueue` — SQLite-backed job deduplication and tracking

## For LLMs

- **ID:** 0
- **Size:** 39 nodes
- **Cohesion:** 0.06 (loose — adapters share interface but operate independently)
- **Key files:** `server/downloader/engine-manager.js`, `engine-interface.js`, `adapters/yt-dlp.js`, `adapters/mock-reliable.js`

### Cross-Community Connections
- **Orchestrator (C3):** JobManager calls EngineManager to submit download jobs
- **Splitter (C2):** Download output (audio.mp3) feeds into splitter input
