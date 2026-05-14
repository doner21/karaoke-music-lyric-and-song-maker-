---
type: overview/architecture
---

# Architecture at a Glance

KaraokeBox is a full-stack application that downloads songs from YouTube, separates vocals from instrumentals using AI (Demucs/UVR-MDX-NET), syncs lyrics, and renders karaoke videos for export.

## Pipeline Flow

```
YouTube URL → [Download Engine] → audio.mp3
                                    ↓
                           [Splitter Service] → vocals.mp3 + band.mp3
                                    ↓
                           [Lyrics Fetcher] → synced lyrics JSON
                                    ↓
                           [Karaoke Renderer] → MP4 export
```

## Core Systems

### 1. Download Engine (Community 0)
Downloads audio from YouTube using yt-dlp. Has a strategy-based engine manager that tries yt-dlp first, falls back to mock/reliable downloaders. Manages job queues with deduplication.

### 2. Splitter Service (Community 2)
AI-powered vocal separation. Routes to Demucs (htdemucs model) for hybrid real splitting or UVR-MDX-NET for instrument-focused separation. Includes phase-inversion FFmpeg fallback and mock adapter for testing. Uses a wrapper script (`run_audio_separator.py`) to invoke Python audio-separator CLI reliably on Windows.

### 3. Orchestrator / Job Manager (Community 3)
Central job management. Handles download and split jobs with SQLite-backed persistence, deduplication, force re-queue, progress tracking, and polling. The SongRepository manages song metadata and artifacts.

### 4. Alignment Service (Community 4)
Syncs lyrics timing with audio using AudioShake API. Canonicalizes audio format before submission, processes alignment jobs with progress tracking.

### 5. Karaoke Renderer (Community 5)
GPU-accelerated WebGL karaoke frame rendering. Draws animated lyrics overlays with word highlighting, exports to MP4 via ffmpeg pipe. Used by both Electron and web export paths.

### 6. Audio Stem Manager (Community 6)
Coordinates playback of multiple audio stems (vocals, band, drums, bass). Handles loading, pausing, time synchronization between stems.

### 7. Lyrics Pipeline (Communities 1, 11, 14)
Token-based lyrics editor with undo stack, validation, pagination, and word-level highlight calculation. Fetches lyrics from Genius/AzLyrics.

### 8. Frontend UI (Communities 10, 16, 17)
React components for the karaoke maker interface, GPU capability detection, error boundaries, and the Integrated Ecological OS karaoke design system.
