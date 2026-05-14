---
type: community/narrative
community_id: 6
label: "Audio Stem Manager"
size: 21
cohesion: 0.00
character: code
---

# Audio Stem Manager

> **21 nodes** | **Cohesion: 0.00** (single class) | **File:** `src/utils/AudioStemManager.js`

## For Humans

**Real-world analogy:** This is the **digital mixing console**. After splitting, you have 2-4 audio tracks (vocals, band, drums, bass). The Stem Manager loads them all into the Web Audio API, keeps them perfectly synchronized, and gives each track its own volume fader — like a sound engineer's mixing board.

### Architecture

```
┌────────────────────────────────────┐
│        AudioStemManager            │
│  ┌──────────────────────────────┐  │
│  │ .loadStems({                 │  │
│  │   vocals: path1,             │  │
│  │   band: path2,               │  │
│  │   drums: path3               │  │
│  │ })                           │  │
│  └──────────┬───────────────────┘  │
│             ▼                      │
│  ┌──────────────────────────────┐  │
│  │  Web Audio API               │  │
│  │  ┌────────┐  ┌────────┐     │  │
│  │  │Vocals  │  │ Band   │ ... │  │
│  │  │GainNode│  │GainNode│     │  │
│  │  └───┬────┘  └───┬────┘     │  │
│  │      └─────┬─────┘           │  │
│  │            ▼                 │  │
│  │     ┌──────────┐            │  │
│  │     │Master    │            │  │
│  │     │GainNode  │→ speakers  │  │
│  │     └──────────┘            │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ .play() / .pause()           │  │
│  │  → synchronized across ALL   │  │
│  │    stems simultaneously       │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### Key Nodes

| Node | Role |
|------|------|
| **AudioStemManager** | Multi-track controller class |
| **.loadStems()** | decodeAudioData for each stem, create GainNodes |
| **.play()/.pause()** | Synchronized play/pause across all stems |
| **_stopTimeUpdates()** | Clean teardown of rAF time tracking loop |

### Cohesion: 0.00 (single class)
Everything is in one class — cohesion metrics don't apply. All methods serve the same object.

### Bridges
- **Splitter (C2):** Split stems (vocals/band) are loaded here
- **Karaoke Renderer (C4):** Provides mixed audio for video export

## For LLMs

- **ID:** 6 · **Size:** 21 · **Cohesion:** 0.00 · **Character:** single-class module
- **File:** `src/utils/AudioStemManager.js`
- **Top nodes:** AudioStemManager, .loadStems(), .pause(), ._stopTimeUpdates()
