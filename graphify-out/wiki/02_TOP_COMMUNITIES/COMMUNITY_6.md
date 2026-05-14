---
type: community/narrative
community_id: 6
label: "Audio Stem Manager"
size: 21
cohesion: 0.00
character: code
---

# Audio Stem Manager

> **21 nodes** | **Cohesion: 0.00** | **Primary file:** `src/utils/AudioStemManager.js`

## For Humans

This is the **multi-track audio playback controller**. After splitting, you have multiple audio files (vocals.mp3, band.mp3, drums.mp3, bass.mp3). The Stem Manager loads them all, keeps them synchronized, and provides individual volume/mute controls. Think of it as a digital mixing console.

```
AudioStemManager.loadStems({ vocals: path1, band: path2, drums: path3 })
        ↓
  Web Audio API → decodeAudioData() for each stem
        ↓
  GainNode per stem → individual volume control
        ↓
  Master GainNode → combined output
        ↓
  .play() / .pause() → synchronized playback
  ._stopTimeUpdates() → clean teardown
```

### Key Nodes
- `AudioStemManager` — class managing all loaded stems
- `.loadStems()` — loads multiple audio files via Web Audio API
- `.play()` / `.pause()` — controls playback of ALL stems together
- `._stopTimeUpdates()` — stops the requestAnimationFrame time tracking loop

## For LLMs
- **ID:** 6 | **Size:** 21 nodes | **Cohesion:** 0.00 (single-class module)
- **Key file:** `src/utils/AudioStemManager.js`
- **API:** Web Audio API (AudioContext, GainNode, decodeAudioData)

### Cross-Community Connections
- **Karaoke Renderer (C5):** Provides stem audio for video rendering
- **Frontend UI (C10):** Stem controls displayed in karaoke maker interface
