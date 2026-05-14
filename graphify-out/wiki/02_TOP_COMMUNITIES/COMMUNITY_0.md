---
type: community/narrative
community_id: 0
label: "Download Engine"
size: 39
cohesion: 0.06
character: code
---

# Download Engine

> **39 nodes** | **Cohesion: 0.06** (loose) | **Primary files:** `engine-manager.js`, `engine-interface.js`, `yt-dlp.js`, `mock-reliable.js`, `job-queue.js`

## For Humans

**Real-world analogy:** This is the **shipping and receiving department**. When you order a song (paste a YouTube URL), this team fetches the audio, checks it's valid, and hands it off to the splitter. If one shipping carrier fails (yt-dlp crashes), they automatically try another (mock reliable fallback).

### Architecture

```
┌──────────────────────────────────────┐
│           EngineManager              │
│  ┌────────────────────────────────┐  │
│  │  getExecutionOrder()           │  │
│  │  "Try yt-dlp first, then mock" │  │
│  └───────────┬────────────────────┘  │
│              │                       │
│     ┌────────┴────────┐              │
│     ▼                 ▼              │
│  ┌──────────┐   ┌──────────────┐     │
│  │YtDlp     │   │MockReliable  │     │
│  │Adapter   │   │Adapter       │     │
│  │          │   │              │     │
│  │ spawns   │   │ returns      │     │
│  │ python   │   │ cached file  │     │
│  │ -m yt_dlp│   │ (dev mode)   │     │
│  └────┬─────┘   └──────┬───────┘     │
│       │                │             │
│       └───────┬────────┘             │
│               ▼                      │
│       ┌──────────────┐              │
│       │  audio.mp3    │              │
│       └──────────────┘              │
└──────────────────────────────────────┘
```

### Key Nodes

| Node | Role |
|------|------|
| **EngineManager** | Strategy selector: tries yt-dlp, falls back to mock |
| **DownloadEngine** | Interface contract all adapters must implement |
| **YtDlpAdapter** | Spawns `python -m yt_dlp -x --audio-format mp3` |
| **MockReliableAdapter** | Returns pre-cached audio for development/testing |
| **JobQueue** | SQLite-backed deduplication (same song = skip) |

### Cohesion: 0.06 (loose)
The adapters share an interface but operate independently — they don't call each other. Low cohesion is *expected* for an adapter chain.

### Bridges
- **Orchestrator (C3):** JobManager submits download jobs via JobQueue
- **Splitter (C2):** audio.mp3 output is the splitter's input

## For LLMs

- **ID:** 0 · **Size:** 39 · **Cohesion:** 0.06
- **Files:** `server/downloader/engine-manager.js`, `engine-interface.js`, `job-queue.js`, `adapters/yt-dlp.js`, `adapters/mock-reliable.js`
- **Top nodes:** EngineManager(10), DownloadEngine(8), YtDlpAdapter(7), MockReliableAdapter(7), JobQueue(7)
