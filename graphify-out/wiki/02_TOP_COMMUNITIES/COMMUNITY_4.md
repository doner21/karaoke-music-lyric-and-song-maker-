---
type: community/narrative
community_id: 4
label: "Audio Alignment Service"
size: 22
cohesion: 0.12
character: code
---

# Audio Alignment Service

> **22 nodes** | **Cohesion: 0.12** | **Primary files:** `alignment/index.js`, `audioshake-adapter.js`, `canonicalizer.js`, `job-queue.js`

## For Humans

This service syncs lyrics text with precise audio timestamps. It sends audio + lyrics to the **AudioShake API**, which returns word-level timing data (each word gets a start_ms and end_ms). Think of it as a professional transcriptionist that tells you exactly when each word is sung.

```
Lyrics text + audio → Canonicalizer (44.1kHz WAV)
                           ↓
                     AudioShakeAdapter.uploadLyricsAsset()
                           ↓
                     AudioShake API → word-level alignment JSON
                           ↓
                     AlignmentJobQueue.processAlign()
                           ↓
                     { tokens: [{ text: "Hello", start_ms: 1000, end_ms: 1500 }, ...] }
```

The **Canonicalizer** ensures audio is exactly 44.1kHz stereo WAV before upload — AudioShake rejects non-standard formats.

### Key Nodes
- `AudioShakeAdapter` — API client for lyrics-to-audio alignment
- `Canonicalizer` — ffmpeg pre-conversion for format compliance
- `AlignmentJobQueue` — manages alignment jobs with progress tracking
- `.uploadLyricsAsset()` — sends lyrics text + audio to AudioShake
- `.processAlign()` — polls alignment status until complete

## For LLMs
- **ID:** 4 | **Size:** 22 nodes | **Cohesion:** 0.12
- **Key files:** `server/alignment/index.js`, `audioshake-adapter.js`, `canonicalizer.js`, `job-queue.js`
- **External API:** AudioShake (lyrics alignment)
