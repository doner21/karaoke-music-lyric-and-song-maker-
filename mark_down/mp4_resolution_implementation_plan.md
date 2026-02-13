# MP4 Lyric Resolution Upgrade — Implementation Plan

## Problem Statement

Exported karaoke MP4 lyrics **granulate (pixelate) on larger screens** because the entire rendering pipeline is locked to 1280x720 with lossy JPEG intermediate frames. Text is the most vulnerable visual element to compression artifacts — thin strokes, anti-aliased edges, and sub-pixel rendering all degrade catastrophically under JPEG quantization and low-resolution scaling.

---

## Root Cause Analysis

The current pipeline has **four compounding resolution bottlenecks**:

| # | Bottleneck | Location | Current Value | Impact |
|---|-----------|----------|---------------|--------|
| 1 | Canvas render resolution | `electronExport.js:19-20`, `useKaraokeExport.js:129-130` | 1280x720 | Text is rasterized at 720p — upscaling on a 1080p/4K screen introduces blur |
| 2 | JPEG intermediate frames | `electronExport.js:170` | `toDataURL('image/jpeg', 0.9)` | JPEG quantization destroys text edges; 0.9 quality still introduces DCT artifacts on sharp boundaries |
| 3 | FFmpeg re-encode from JPEG | `electron/main.js:208-223` | `frame_%06d.jpg` input, CRF 23, preset `fast` | Decoding already-degraded JPEG input; CRF 23 adds another layer of quantization |
| 4 | Fixed font sizes in drawer | `karaokeDrawer.js:139` | `fontSize = 32` (px absolute) | Font size does not scale with resolution — at 1080p the same 32px text is proportionally smaller and thinner |

---

## Invariants (Execution Preconditions)

These conditions **must hold true** for the plan to execute correctly. Violating any invariant blocks execution.

### Hard Invariants

1. **FFmpeg binary must exist** at `FFMPEG_PATH` and support `libx264`, `png` decoding, and `aac` encoding
2. **Electron IPC channel contracts are stable** — `export-start`, `export-frames`, `export-finalize` message shapes cannot change without updating both renderer and main process in lockstep
3. **`drawKaraokeFrame()` is the single source of truth** for frame rendering — both preview and export must call the same function to maintain visual parity
4. **Canvas `getContext('2d')` is available** in the renderer process (Electron Chromium guarantees this)
5. **`mp4-muxer` and `VideoEncoder` WebCodecs API** are available in the Electron version being used (for the `fastExport.js` path)
6. **Stem audio files exist on disk** at the paths returned by the artifacts API before export begins

### Soft Invariants (Degradation Allowed)

7. **Available system RAM must accommodate frame buffers** — a 1920x1080 PNG frame is ~6MB vs ~150KB JPEG; batch sizes must adapt
8. **Disk space for temp frames** — 1080p PNG at 30fps for a 4-minute song ≈ 43GB uncompressed (mitigated by streaming/pipe approach below)
9. **Export time scales linearly** with pixel count — 1080p is 2.25x the pixels of 720p; user should see progress feedback

---

## Constraints (Shaping the Implementation)

These constraints **bound the solution space** and prevent the agent from making decisions that break the system.

### Architectural Constraints

| ID | Constraint | Rationale |
|----|-----------|-----------|
| C1 | **Do not break the preview path** — `KaraokeLyricsDisplay.jsx` and its React component tree must remain untouched for live playback | Preview uses DOM/React rendering; export uses canvas. They are decoupled by design. |
| C2 | **`drawKaraokeFrame()` must remain resolution-agnostic** — all pixel values (font size, margins, spacing) must derive from `width`/`height` parameters, never hardcoded | This is the central fix. Currently font size is hardcoded at 32px. |
| C3 | **Backward compatibility** — users who have existing export code or settings expecting 720p should get 720p unless they choose otherwise | Default resolution should remain 1280x720; higher resolutions are opt-in. |
| C4 | **Frame transport must not exhaust memory** — IPC frame batching must respect backpressure; PNG frames are 40x larger than JPEG | Batch size must scale inversely with resolution. |
| C5 | **FFmpeg input must be lossless or near-lossless** — no JPEG in the intermediate pipeline for text content | PNG or raw bitmap pipe. |
| C6 | **Final H.264 CRF must be ≤ 18 for text clarity** at higher resolutions | CRF 23 is acceptable for natural video but destructive for synthetic text overlays. |
| C7 | **No new npm dependencies** — use existing `mp4-muxer`, Canvas API, and FFmpeg; avoid pulling in puppeteer, headless-gl, etc. | Keep the dependency surface small. |
| C8 | **Export must remain a single-click operation** — resolution selection should be a dropdown in the UI, not a config file edit | UX constraint. |

### Performance Constraints

| ID | Constraint | Rationale |
|----|-----------|-----------|
| P1 | **Export time for a 4-minute song at 1080p must not exceed 10 minutes** on a mid-range machine | User tolerance threshold. |
| P2 | **Peak memory usage must stay under 2GB** during export | Electron renderer process memory limit. |
| P3 | **IPC payload per batch must stay under 50MB** | Electron IPC has practical limits on serialized message size. |

---

## Execution Agent — Job Role Definition

> Assign this section to the agent that will implement the plan. It defines identity, authority, boundaries, and the decision protocol the agent must follow at every step.

### Role: Karaoke Export Resolution Engineer

**Mission:** Eliminate lyric granulation in exported MP4 files by upgrading the rendering-and-encoding pipeline to produce resolution-scaled, lossless-intermediate, text-optimized video output — without breaking live preview or existing 720p defaults.

### Identity

| Field | Value |
|-------|-------|
| **Title** | Karaoke Export Resolution Engineer |
| **Scope** | MP4 export pipeline only — canvas rendering (`karaokeDrawer.js`), frame transport (`electronExport.js`), encoding (`electron/main.js` export handlers), export hook (`useKaraokeExport.js`), bitrate config (`fastExport.js`) |
| **Does NOT own** | Live preview components (`KaraokeLyricsDisplay.jsx`, `PaginatedLyricsDisplay.jsx`, `NoLyricsIntervalDisplay.jsx`), audio stem splitting, lyrics alignment, database, server API routes |

### Authority (What the Agent MAY Do)

1. **Modify** any file listed in the Scope above
2. **Add** new parameters to existing functions (with defaults that preserve current behavior)
3. **Add** a `RESOLUTION_MAP` constant and resolution-selection UI element
4. **Change** FFmpeg CLI arguments in the export-finalize IPC handler
5. **Adjust** IPC batch sizes and backpressure logic
6. **Create** helper functions inside existing files (e.g., `computeScaleFactor()`)
7. **Run** the application to validate each phase before moving to the next
8. **Read** any file in the project for context

### Prohibitions (What the Agent MUST NOT Do)

1. **MUST NOT** modify any React component used in live preview rendering (`KaraokeLyricsDisplay.jsx`, `PaginatedLyricsDisplay.jsx`, `LetterFillWord.jsx`, `NoLyricsIntervalDisplay.jsx`)
2. **MUST NOT** add new npm dependencies (Constraint C7)
3. **MUST NOT** change the default export resolution from 1280x720 — higher resolutions are opt-in only (Constraint C3)
4. **MUST NOT** change IPC channel names or message shapes without updating both renderer and main process in the same commit (Invariant #2)
5. **MUST NOT** remove or rename existing exported functions — only extend signatures with optional parameters
6. **MUST NOT** skip phases or reorder the dependency chain without explicitly stating why and which invariant/constraint permits it
7. **MUST NOT** commit code that causes 720p export to produce visually different output than the current version (regression gate)
8. **MUST NOT** introduce hardcoded pixel values into `drawKaraokeFrame()` — every numeric dimension must derive from the scale factor (Constraint C2)

### Decision Protocol

At each decision point during execution, the agent must apply these rules in order:

```
1. CHECK INVARIANTS
   → For each Hard Invariant (1-6): Is it still satisfied?
   → If any invariant is violated: STOP. Report which invariant failed and why.

2. CHECK CONSTRAINTS
   → Does the proposed change violate any Architectural Constraint (C1-C8)?
   → Does the proposed change violate any Performance Constraint (P1-P3)?
   → If yes: Reject the approach. Find an alternative that satisfies the constraint.

3. CHECK REGRESSION
   → Will this change alter 720p export output?
   → If yes: Ensure a scaleFactor of 1.0 produces identical math to the current hardcoded values.

4. CHECK SCOPE
   → Is the file I'm about to modify listed in my Scope?
   → If no: Do not modify it. If the change seems necessary, report it as a blocker
     and request scope expansion from the user.

5. EXECUTE
   → Make the smallest change that satisfies the current phase.
   → Validate before moving to the next phase.
```

### Phase Completion Gates

The agent **must not** advance to the next phase until the current phase's gate is passed:

| Phase | Gate Condition |
|-------|---------------|
| Phase 1 | `drawKaraokeFrame()` accepts any `width`/`height` and all dimensions scale proportionally. At 1280x720, output is identical to pre-change. |
| Phase 2 | Intermediate frames are written as `.png`. FFmpeg input pattern updated. Export completes without error at 720p. |
| Phase 3 | FFmpeg encode uses CRF ≤ 18, `-tune animation`, `-preset slow`. Exported MP4 plays in VLC. |
| Phase 4 | Batch size adjusts dynamically. Export at 1080p does not crash or exceed 2GB RAM. |
| Phase 5 | (Optional) Pipe mode works end-to-end. Temp disk usage is near zero. |
| Phase 6 | Resolution dropdown appears in UI. Selecting 1080p produces a 1920x1080 MP4. Default is still 720p. |
| Phase 7 | WebCodecs path bitrate scales with resolution. 1080p export bitrate is ~11Mbps. |

### Reporting Requirements

After completing each phase, the agent must produce a brief status report:

```
PHASE [N] COMPLETE
- Files modified: [list]
- Lines changed: [approx count]
- Invariants verified: [list which were checked]
- Constraints honored: [list which were relevant]
- Regression check: [pass/fail + method used]
- Gate condition: [met/not met + evidence]
- Next phase: [N+1] or [DONE]
```

### Escalation Triggers

The agent must **stop and ask the user** if any of these occur:

1. A Hard Invariant cannot be satisfied (e.g., FFmpeg binary missing, WebCodecs API unavailable)
2. A constraint must be relaxed to proceed (e.g., needing a new dependency)
3. A phase gate fails after two attempts
4. Estimated memory or disk usage exceeds the Performance Constraints
5. A file outside Scope needs modification
6. The existing code structure makes a phase's approach infeasible — agent must propose an alternative and await approval

---

## Implementation Steps

### Phase 1: Make `karaokeDrawer.js` Resolution-Aware

**File:** `src/utils/karaokeDrawer.js`

**What changes:**
- Derive all pixel dimensions from `width` and `height` using a scale factor
- Replace every hardcoded pixel value with a proportional calculation

**Scale factor formula:**
```
scaleFactor = height / 720
```

**Affected values:**

| Current Hardcoded Value | Proportional Replacement |
|------------------------|-------------------------|
| `fontSize = 32` | `fontSize = Math.round(32 * scaleFactor)` |
| `MARGIN = 60` | `MARGIN = Math.round(60 * scaleFactor)` |
| `LINE_SPACING = 1.8` | Remains 1.8 (already relative) |
| `font: '600 18px Arial'` (interval label) | `font: '600 ${Math.round(18 * scaleFactor)}px Arial'` |
| `font: '300 48px monospace'` (timer) | `font: '300 ${Math.round(48 * scaleFactor)}px monospace'` |
| `shadowBlur = 20` / `10` | `shadowBlur = Math.round(20 * scaleFactor)` / `Math.round(10 * scaleFactor)` |
| `barWidth = 300`, `barHeight = 6` | `barWidth = Math.round(300 * scaleFactor)`, `barHeight = Math.round(6 * scaleFactor)` |
| Minimum font `18` in scale-down logic | `Math.max(Math.round(18 * scaleFactor), 12)` |
| Word spacing `8` px | `Math.round(8 * scaleFactor)` |

**Validation:** Export at 720p must produce pixel-identical output to current version (scaleFactor = 1.0).

---

### Phase 2: Switch Intermediate Frames from JPEG to PNG

**File:** `src/utils/electronExport.js`

**What changes:**
- Line 170: Change `canvas.toDataURL('image/jpeg', 0.9)` to `canvas.toDataURL('image/png')`
- Frame file extension in `electron/main.js` line 186: change `.jpg` to `.png`
- FFmpeg input pattern in `electron/main.js` line 208: change `frame_%06d.jpg` to `frame_%06d.png`

**Why this matters for text:**
- JPEG uses 8x8 DCT blocks that create visible ringing around high-contrast text edges
- PNG is lossless — text anti-aliasing is perfectly preserved
- The FFmpeg H.264 encoder then has pristine input to work with

**Trade-off:** PNG frames are larger (~6MB vs ~150KB at 1080p). This is mitigated in Phase 4.

---

### Phase 3: Tune FFmpeg Encoding for Text Clarity

**File:** `electron/main.js` (export-finalize handler)

**What changes in the FFmpeg video encode command:**

```
Current:  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p
Proposed: -c:v libx264 -preset slow -crf 17 -tune animation -pix_fmt yuv420p
```

| Parameter | Old | New | Why |
|-----------|-----|-----|-----|
| `-preset` | `fast` | `slow` | Better compression efficiency; smaller files at same quality. Export is offline so speed is less critical. |
| `-crf` | `23` | `17` | Lower CRF = higher quality. CRF 17 is visually lossless for synthetic/text content. |
| `-tune` | (none) | `animation` | Optimized for flat areas with sharp edges — exactly what karaoke text is. Adjusts deblocking and reference frames. |

**Estimated file size impact:** ~2-3x larger files (a 4-minute 720p song goes from ~30MB to ~60-80MB; 1080p ~100-150MB). Acceptable for download/share.

---

### Phase 4: Adapt Frame Batching for Larger Frames

**File:** `src/utils/electronExport.js`

**What changes:**
- Make `BATCH_SIZE` dynamic based on resolution
- Add backpressure awareness for IPC

**Logic:**
```
Resolution    | Frame Size (PNG) | Batch Size | Batch Payload
1280x720      | ~2MB             | 15         | ~30MB
1920x1080     | ~6MB             | 5          | ~30MB
2560x1440     | ~11MB            | 3          | ~33MB
3840x2160     | ~24MB            | 2          | ~48MB
```

**Formula:**
```javascript
const estimatedFrameSize = (width * height * 4) / 3; // rough PNG estimate
const BATCH_SIZE = Math.max(1, Math.floor(40_000_000 / estimatedFrameSize)); // target ~40MB per batch
```

---

### Phase 5: Alternative — FFmpeg Pipe Mode (Eliminates Disk Bottleneck)

**Files:** `electron/main.js`, `src/utils/electronExport.js`

**Concept:** Instead of writing PNG files to disk and then reading them back, pipe raw RGBA bitmap data directly from Canvas to FFmpeg's stdin via `rawvideo` input format.

**FFmpeg command change:**
```
ffmpeg -y -f rawvideo -pix_fmt rgba -s {width}x{height} -r {fps} -i pipe:0
       -c:v libx264 -preset slow -crf 17 -tune animation -pix_fmt yuv420p output.mp4
```

**Renderer side:** Instead of `toDataURL('image/png')`, use:
```javascript
const imageData = ctx.getImageData(0, 0, width, height);
// Send imageData.data (Uint8ClampedArray) over IPC as ArrayBuffer
```

**Benefits:**
- Zero disk I/O for intermediate frames
- No PNG encode/decode overhead
- FFmpeg receives raw pixels — maximum quality input
- Eliminates the disk space invariant (Soft Invariant #8)

**Trade-off:** Requires spawning FFmpeg before frame rendering and keeping the pipe open for the duration. More complex IPC flow.

**Recommendation:** Implement Phase 2 (PNG files) first for simplicity, then migrate to pipe mode if disk I/O becomes a bottleneck.

---

### Phase 6: Add Resolution Selection UI

**File:** `src/hooks/useKaraokeExport.js` and parent component

**What changes:**
- Accept a `resolution` parameter: `'720p' | '1080p' | '1440p' | '4k'`
- Map to pixel dimensions:

```javascript
const RESOLUTION_MAP = {
    '720p':  { width: 1280,  height: 720 },
    '1080p': { width: 1920,  height: 1080 },
    '1440p': { width: 2560,  height: 1440 },
    '4k':    { width: 3840,  height: 2160 }
};
```

- Default remains `'720p'` (Constraint C3)
- The resolution dropdown should appear in the export dialog/button area

---

### Phase 7: Increase Video Bitrate Proportionally

**File:** `src/utils/fastExport.js` (WebCodecs path)

**What changes for the `fastExport.js` in-browser path (non-Electron):**

```javascript
// Current
bitrate: 5_000_000 // 5Mbps — fine for 720p

// Proposed — scale with pixel count
const baseBitrate = 5_000_000;
const pixelRatio = (width * height) / (1280 * 720);
const bitrate = Math.round(baseBitrate * pixelRatio);
// 720p  → 5 Mbps
// 1080p → 11.25 Mbps
// 1440p → 20 Mbps
// 4K    → 45 Mbps
```

Note: The FFmpeg/Electron path uses CRF (constant quality) so bitrate scaling is automatic there. This only applies to the WebCodecs `VideoEncoder` path.

---

## Execution Order & Dependencies

```
Phase 1 ──┐
           ├──→ Phase 6 (UI needs resolution param that Phase 1 consumes)
Phase 2 ──┤
           ├──→ Phase 4 (batching adapts to PNG size from Phase 2)
Phase 3 ──┘
           │
           └──→ Phase 5 (optional optimization, replaces Phase 2+4)
           │
Phase 7 ────── (independent, can run in parallel with any phase)
```

**Minimum viable improvement:** Phases 1 + 2 + 3 alone will dramatically reduce granulation. Phase 1 is the highest-impact single change.

---

## Validation Criteria

| Test | Pass Condition |
|------|---------------|
| 720p regression | Export at 720p produces visually identical output to current version |
| 1080p text clarity | Individual letter strokes are sharp when viewed at native 1080p (no ringing, no block artifacts) |
| 4K scaling | Text remains crisp on a 4K display in fullscreen |
| Highlight accuracy | Word-level highlight fill-clip renders correctly at all resolutions |
| Glow effects | Shadow/glow radius scales proportionally — not too thin at 4K, not too thick at 720p |
| Progress bar | Interval display progress bar and timer scale correctly |
| Memory | Peak RAM stays under 2GB during 1080p export |
| File plays everywhere | Output MP4 plays in VLC, Windows Media Player, QuickTime, and browser `<video>` tag |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PNG frame disk usage exhausts temp space | Medium | High | Implement Phase 5 (pipe mode) or add disk space check before export |
| Electron IPC chokes on large PNG payloads | Medium | Medium | Dynamic batch sizing (Phase 4); fallback to smaller batches |
| `OffscreenCanvas` not available in older Electron | Low | High | Feature-detect and fall back to `document.createElement('canvas')` |
| CRF 17 produces files too large for sharing | Low | Medium | Offer "Quality" vs "Compact" export presets (CRF 17 vs CRF 22) |
| Font "Outfit" not available in export canvas | Medium | Medium | Bundle the font or fall back to Arial with appropriate scaling |

---

## Summary

The granulation problem is caused by a 720p canvas → JPEG → re-encoded H.264 pipeline where text quality degrades at every stage. The fix is:

1. **Render at the target resolution** (scale all drawing proportionally)
2. **Use lossless intermediate frames** (PNG or raw pipe instead of JPEG)
3. **Encode with text-optimized settings** (CRF 17, `-tune animation`)
4. **Let the user choose their output resolution** (720p/1080p/1440p/4K)

Phases 1-3 are the critical path. Phases 4-7 are optimization and UX polish.
