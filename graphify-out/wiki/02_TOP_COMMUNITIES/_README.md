---
type: community/index
---

# Top Communities

> Top 20 communities by size.  407 nodes · 64 communities total.

```mermaid
mindmap
  root((KaraokeBox))
    Pipeline
      Download_Engine[Download Engine<br/>39 nodes]
      Splitter_Service[Splitter Service<br/>33 nodes]
      Alignment[Alignment Service<br/>22 nodes]
      Renderer[Renderer & Export<br/>23 nodes]
    Core
      Orchestrator[Orchestrator<br/>31 nodes]
      Audio_Stems[Audio Stem Manager<br/>21 nodes]
      Token_Editor[Token Editor<br/>37 nodes]
    Utilities
      Lyrics_Lookup[Lyrics Services<br/>16 nodes]
      Audio_Utils[Audio Utilities<br/>16 nodes]
      yt-dlp_Updater[yt-dlp Updater<br/>15 nodes]
    Frontend
      GPU_Export[GPU & Export UI<br/>13 nodes]
      Lyrics_Display[Lyrics Display<br/>13 nodes]
      Error_Boundaries[Error Boundaries<br/>12 nodes]
    Queues
      Alignment_Queue[Alignment Queue<br/>10 nodes]
      Splitter_Queue[Splitter Queue<br/>8 nodes]
    Tools
      Debug_Scripts[Debug Scripts<br/>6 nodes]
      Search[Search<br/>5 nodes]
      ASS_Export[ASS Export<br/>5 nodes]
      Highlight_Calc[Highlight Calc<br/>7 nodes]
```

| # | Community | Nodes | Cohesion | Character |
|---|-----------|-------|----------|-----------|
| 0 | [[COMMUNITY_0|Download Engine]] | 39 | 0.06 loose | Adapter Chain |
| 1 | [[COMMUNITY_1|Lyrics Token Editor]] | 37 | 0.13 loose | Immutable Transforms |
| 2 | [[COMMUNITY_2|Vocal Splitter Service]] | 33 | 0.06 loose | Adapter Family |
| 3 | [[COMMUNITY_3|Orchestrator & Job Manager]] | 31 | 0.08 loose | Central Coordinator |
| 4 | [[COMMUNITY_4|Karaoke Renderer & Export]] | 23 | 0.17 moderate | WebGL Pipeline |
| 5 | [[COMMUNITY_5|Audio Alignment Service]] | 22 | 0.12 loose | API Gateway |
| 6 | [[COMMUNITY_6|Audio Stem Manager]] | 21 | 0.00 single-class | Multi-track Mixer |
| 7 | [[COMMUNITY_7|Lyrics Services]] | 16 | 0.25 moderate | Web Scrapers |
| 8 | [[COMMUNITY_8|Audio Utilities]] | 16 | 0.17 moderate | Pure Functions |
| 9 | [[COMMUNITY_9|yt-dlp Updater]] | 15 | 0.24 moderate | CLI Wrapper |
| 10 | [[COMMUNITY_10|GPU & Export UI]] | 13 | 0.19 moderate | React Hook |
| 11 | [[COMMUNITY_11|Lyrics Display]] | 13 | 0.23 moderate | Pagination |
| 12 | [[COMMUNITY_12|Alignment Job Queue]] | 10 | 0.00 single-class | FIFO Queue |
| 13 | [[COMMUNITY_13|Splitter Job Queue]] | 8 | 0.00 single-class | FIFO Queue |
| 14 | [[COMMUNITY_14|Word Highlight Calculator]] | 7 | 0.00 single-class | Timing Math |
| 15 | [[COMMUNITY_15|Debug Separator Script]] | 6 | 0.60 tight | Dev Tool |
| 16 | [[COMMUNITY_16|Audio Error Boundary]] | 6 | 0.00 single-class | React Safety Net |
| 17 | [[COMMUNITY_17|Simple Error Boundary]] | 6 | 0.00 single-class | React Safety Net |
| 18 | [[COMMUNITY_18|Unified Search]] | 5 | 0.00 single-class | Search Aggregator |
| 19 | [[COMMUNITY_19|ASS Subtitle Export]] | 5 | 0.70 tight | Format Converter |

**Cohesion guide:** 0.0–0.15 loose / 0.15–0.30 moderate / 0.30–0.50 coherent / 0.50+ tight

## How Communities Connect

```mermaid
graph TD
    DL[Download Engine<br/>C0 · 39n] -->|audio.mp3| SS[Splitter Service<br/>C2 · 33n]
    SS -->|vocals + band| AS[Alignment Service<br/>C5 · 22n]
    AS -->|timed lyrics| KR[Karaoke Renderer<br/>C4 · 23n]
    SS -->|stems| AM[Audio Stem Mgr<br/>C6 · 21n]
    OM[Orchestrator<br/>C3 · 31n] -->|manages| DL
    OM -->|manages| SS
    OM -->|manages| AS
    TE[Token Editor<br/>C1 · 37n] -->|edits| AS
    LS[Lyrics Services<br/>C7 · 16n] -->|lyrics text| AS
    AU[Audio Utils<br/>C8 · 16n] -->|WAV encoding| KR
    GPU[GPU & Export<br/>C10 · 13n] -->|configures| KR
    LD[Lyrics Display<br/>C11 · 13n] -->|renders| KR
    WH[Highlight Calc<br/>C14 · 7n] -->|animates| LD
    SQ[Splitter Queue<br/>C13 · 8n] -->|dispatches| SS
    AQ[Alignment Queue<br/>C12 · 10n] -->|dispatches| AS
    YU[yt-dlp Updater<br/>C9 · 15n] -->|maintains| DL
```
