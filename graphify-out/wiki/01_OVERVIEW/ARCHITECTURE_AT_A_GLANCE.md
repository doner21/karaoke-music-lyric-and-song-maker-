---
type: overview/architecture
---

# Architecture at a Glance (Deep Mode)

KaraokeBox is a full-stack desktop application that downloads songs from YouTube, separates vocals from instrumentals using AI (Demucs/UVR-MDX-NET), syncs lyrics, and renders karaoke videos for export.

**Deep Mode** reveals the architectural patterns, cross-cutting concerns, and data flows that AST-only analysis cannot capture.

## Pipeline Flow

```
YouTube URL → [Download Pipeline] → audio.mp3
                                        ↓
                               [Split Pipeline] → vocals.mp3 + band.mp3
                                        ↓
                               [Alignment Pipeline] → synced lyrics JSON
                                        ↓
                               [Render Pipeline] → MP4 export
```

## Architectural Patterns

| Pattern | Implementation | Where |
|---------|---------------|-------|
| **Adapter Pattern** | Splitter adapters, download adapters | `server/splitter/*adapter.js`, `server/downloader/adapters/` |
| **Strategy Pattern** | EngineManager selects download strategy | `server/downloader/engine-manager.js` |
| **Smart Router** | `initSplitterService()` routes by modelId | `server/splitter/index.js` |
| **Job Queue** | SQLite-backed JobManager | `server/orchestrator/index.js` |

## Cross-Cutting Concerns

| Concern | How Addressed |
|---------|---------------|
| **Stem Alignment Integrity** | Audio canonicalization (44.1kHz WAV) before ALL separation |
| **GPU/CPU Fallback** | Automatic: CUDA → CPU degradation in Demucs + UVR |
| **Windows Process Spawning** | `run_audio_separator.py` wrapper avoids pip .exe fragility |
| **Python venv Isolation** | All Python deps in `venv/`, wrapper survives rebuilds |

## Core Systems

### 1. Download Pipeline (Community 0)
YouTube → MP3 via yt-dlp. Strategy pattern: EngineManager tries YtDlpAdapter first, falls back to MockReliableAdapter.

### 2. Split Pipeline (Community 2)
AI vocal separation. Adapter pattern: Demucs, UVR-MDX-NET, FFmpeg phase-inversion, Mock. All adapters share canonicalization requirement.

### 3. Alignment Pipeline (Community 5)
AudioShake API for word-level lyrics timing. Canonicalizer ensures format compliance.

### 4. Render Pipeline (Community 4)
WebGL frame rendering → ffmpeg MP4 export. GPU-accelerated with CPU fallback.

### 5. Orchestrator (Community 3)
Central JobManager coordinates download, split, and alignment queues with SQLite persistence.

### 6. Audio Stem Manager (Community 6)
Multi-track synchronized playback via Web Audio API.

### 7. Lyrics Pipeline (Communities 1, 11, 14)
Token editor, pagination, word-level highlight calculation.

## External Services

| Service | Used By | Purpose |
|---------|---------|---------|
| yt-dlp CLI | YtDlpAdapter | YouTube audio download |
| AudioShake API | AudioShakeAdapter | Lyrics-to-audio alignment |
| FFmpeg | All splitters | Audio format conversion |
| Genius API | Lyrics fetcher | Lyrics retrieval |
| ONNX Runtime | UVRMDXNetAdapter | Neural network inference |
| Demucs Model | DemucsAdapter | Hybrid transformer separation |
| UVR-MDX-NET Model | UVRMDXNetAdapter | Instrument-focused separation |
