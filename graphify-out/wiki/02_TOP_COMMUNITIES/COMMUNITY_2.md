---
type: community/narrative
community_id: 2
label: "Vocal Splitter Service"
size: 33
cohesion: 0.06
character: code
---

# Vocal Splitter Service

> **33 nodes** | **Cohesion: 0.06** | **Primary files:** `index.js`, `demucs-adapter.js`, `uvr-mdx-net-adapter.js`, `audio-separator-adapter.js`, `run_audio_separator.py`

## For Humans

This is the **AI stem separation engine** — the heart of KaraokeBox. It takes a mixed audio file and separates it into vocals and instrumental (2-stem) or vocals, drums, bass, and other (4-stem).

### How it works

```
audio.mp3 → initSplitterService() — health check all adapters
                ↓
         Smart Router: modelId-based dispatch
                ↓
    ┌───────────┼───────────┐
    ↓           ↓           ↓
Demucs      UVR-MDX-NET   FFmpeg (fallback)
(htdemucs)  (Inst_Main)   (phase inversion)
    ↓           ↓           ↓
vocals.mp3 + band.mp3 (or drums/bass/other for 4-stem)
```

### Adapter Chain (tried in order)
1. **DemucsAdapter** — Facebook's Hybrid Transformer Demucs model. GPU-capable. Used for "Hybrid Real Splitting." Spawns `python -m demucs`.
2. **UVRMDXNetAdapter** — Ultimate Vocal Remover MDX-NET model. Best for instrument-focused separation. Spawns Python via `run_audio_separator.py` wrapper to avoid Windows `.exe` spawn issues.
3. **FFmpegSplitterAdapter** — Phase inversion fallback (no AI, just subtracts channels)
4. **MockSplitterAdapter** — Testing fallback with simulated output

### Key Fix (2026-05-14)
The UVR adapter was broken because `audio-separator.exe` (pip wrapper) fails with `spawn UNKNOWN` on Windows, and `-m audio_separator.separator` isn't a runnable module. The fix: `run_audio_separator.py` wrapper script that calls `audio_separator.utils.cli.main()` directly, surviving venv rebuilds.

## For LLMs

- **ID:** 2
- **Size:** 33 nodes
- **Cohesion:** 0.06 (loose — adapters are independent implementations of same interface)
- **Key files:** `server/splitter/index.js` (router), `demucs-adapter.js`, `uvr-mdx-net-adapter.js`, `audio-separator-adapter.js`, `ffmpeg-splitter-adapter.js`, `mock-adapter.js`, `run_audio_separator.py`
- **Test scripts:** `scripts/test_cpu_baseline.js`, `scripts/test_gpu_split.js`, `scripts/test_parity.js`

### Cross-Community Connections
- **Orchestrator (C3):** JobManager submits split jobs to Queue
- **Download Engine (C0):** Provides input audio.mp3
- **Splitter Queue (C13):** Manages job lifecycle
