---
type: community/narrative
community_id: 5
label: "Audio Alignment Service"
size: 22
cohesion: 0.12
character: code
---

# Audio Alignment Service

> **22 nodes** | **Cohesion: 0.12** (loose) | **Files:** `alignment/index.js`, `audioshake-adapter.js`, `canonicalizer.js`, `job-queue.js`

## For Humans

**Real-world analogy:** This is the **transcriptionist who timestamps every word**. You give them a song and its lyrics text, and they return a precise timeline: "the word 'Hello' starts at 1.032 seconds and ends at 1.547 seconds." They use the AudioShake API (a professional alignment service) and make sure the audio is in exactly the right format before sending.

### Architecture

```
┌─────────────────────────────────────────┐
│        AlignmentJobQueue                │
│  ┌───────────────────────────────────┐  │
│  │  .processAlign()                 │  │
│  │    → submit to AudioShake        │  │
│  │    → poll until complete         │  │
│  │    → save aligned JSON           │  │
│  └──────────┬────────────────────────┘  │
│             │                            │
│             ▼                            │
│  ┌───────────────────────────────────┐  │
│  │      AudioShakeAdapter            │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ .uploadLyricsAsset()        │  │  │
│  │  │   → POST lyrics + audio     │  │  │
│  │  │   → receive alignment job   │  │  │
│  │  └─────────────────────────────┘  │  │
│  └──────────┬────────────────────────┘  │
│             │                            │
│             ▼                            │
│  ┌───────────────────────────────────┐  │
│  │        Canonicalizer              │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │ ffmpeg -ar 44100 -ac 2      │  │  │
│  │  │ → input_canonical.wav       │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘

     ┌────────────────────────┐
     │    AudioShake API      │
     │    (external service)  │
     │                        │
     │    lyrics + audio →    │
     │    word-level timings  │
     └────────────────────────┘
```

### Key Nodes

| Node | Role |
|------|------|
| **AudioShakeAdapter** | API client for lyrics-to-audio alignment |
| **Canonicalizer** | FFmpeg pre-conversion: 44.1kHz stereo WAV |
| **AlignmentJobQueue** | FIFO queue with progress polling |
| **.uploadLyricsAsset()** | Sends lyrics + audio to AudioShake |

### Cohesion: 0.12 (loose)
Adapter, queue, and canonicalizer are loosely coupled stages in a linear pipeline.

### Bridges
- **Orchestrator (C3):** JobManager submits alignment jobs
- **Lyrics Services (C7):** Provides lyrics text
- **Token Editor (C1):** Consumes aligned JSON for editing

## For LLMs

- **ID:** 5 · **Size:** 22 · **Cohesion:** 0.12
- **Files:** `server/alignment/index.js`, `audioshake-adapter.js`, `canonicalizer.js`, `job-queue.js`
- **Top nodes:** AudioShakeAdapter(7), Canonicalizer(5), .uploadLyricsAsset()(4)
