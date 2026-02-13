# GPU Pipeline Implementation Plan — Karaoke MP4 Export

## Problem Statement

The current MP4 export pipeline is **100% CPU-bound** across all three stages: canvas frame rendering (2D software rasterizer), PNG encoding/decoding (CPU), and H.264 encoding (FFmpeg `libx264` software encoder). On a machine with an **NVIDIA GeForce GTX 1070 (4GB VRAM)** and an **Intel UHD Graphics 630**, this leaves significant hardware acceleration untouched. A 4-minute song at 1080p currently takes several minutes to export because every pixel is processed by CPU cores that are bottlenecked on single-threaded canvas drawing and x264 motion estimation.

### What GPU Acceleration Unlocks

| Stage | CPU Path (Current) | GPU Path (Target) | Expected Speedup |
|-------|-------------------|-------------------|-----------------|
| Canvas rendering | `getContext('2d')` software raster | `getContext('webgl2')` GPU-accelerated shaders | 3-10x for text rendering at high resolution |
| Frame readback | `canvas.toDataURL('image/png')` — CPU PNG encode | `gl.readPixels()` → raw RGBA direct to FFmpeg | Eliminates PNG encode/decode entirely |
| H.264 encoding | `libx264 -preset slow` (CPU) | `h264_nvenc` (NVIDIA GPU ASIC) | 5-15x faster encoding, near-zero CPU load |
| WebCodecs path | `VideoEncoder` defaulting to software | `VideoEncoder` with `hardwareAcceleration: 'prefer-hardware'` | GPU-offloaded encoding when available |

---

## System Hardware Profile

| Component | Details | Relevance |
|-----------|---------|-----------|
| **GPU (Primary)** | NVIDIA GeForce GTX 1070, 4GB VRAM, Driver 32.0.15.8180 | NVENC encoder, WebGL 2.0, CUDA capable |
| **GPU (Integrated)** | Intel UHD Graphics 630, 1GB shared, Driver 27.20.100.9664 | Quick Sync Video (QSV) fallback encoder |
| **FFmpeg** | Located at `FFMPEG_PATH`, compiled with `h264_nvenc`, `h264_qsv`, `h264_amf`, `hevc_nvenc` | GPU encoding confirmed available |
| **Electron** | v28.x with WebCodecs enabled via `--enable-features=WebCodecs` | Chromium WebGL2 + WebCodecs API available |
| **GPU flags** | Hardware acceleration is **enabled** (lines 15-19 of `main.js` — disable calls are commented out) | GPU compositing is active in renderer |

---

## Execution Agent — Job Role Definition

### Role: GPU Pipeline Engineer

**Mission:** Migrate the karaoke MP4 export pipeline from CPU-only processing to GPU-accelerated rendering and encoding, delivering a minimum 3x end-to-end speedup at 1080p while maintaining pixel-accurate lyric rendering and full backward compatibility with the CPU path as a fallback.

### Identity

| Field | Value |
|-------|-------|
| **Title** | GPU Pipeline Engineer |
| **Scope** | GPU rendering layer (`karaokeDrawer.js` — new WebGL path), frame readback (`electronExport.js` — raw pixel extraction), GPU encoding (`electron/main.js` — NVENC integration), WebCodecs hardware config (`fastExport.js` — `hardwareAcceleration` flag), GPU capability detection (new helper) |
| **Does NOT own** | Live preview React components (`KaraokeLyricsDisplay.jsx`, `PaginatedLyricsDisplay.jsx`, `NoLyricsIntervalDisplay.jsx`), audio processing (`AudioStemManager.js`, `OfflineAudioContext`), lyrics alignment, database, server API routes, Electron window/app lifecycle |
| **Collaborates with** | The existing resolution-aware `drawKaraokeFrame()` — the GPU path must produce visually identical output to the CPU Canvas 2D path at every resolution |

### Authority (What the Agent MAY Do)

1. **Create** a new WebGL rendering module (e.g., `karaokeDrawerGL.js`) that implements the same visual output as `drawKaraokeFrame()` using GPU shaders
2. **Modify** `electronExport.js` to use WebGL canvas and `gl.readPixels()` instead of `toDataURL()`
3. **Modify** `electron/main.js` export-finalize handler to use `h264_nvenc` with appropriate fallback to `libx264`
4. **Modify** `fastExport.js` to add `hardwareAcceleration: 'prefer-hardware'` to the `VideoEncoder.configure()` call
5. **Create** a GPU capability detection helper that probes for NVENC, QSV, WebGL2 availability at runtime
6. **Add** Electron command-line switches in `main.js` for GPU feature enablement if needed
7. **Add** new parameters to existing functions (with defaults that preserve CPU behavior)
8. **Read** any file in the project for context
9. **Run** FFmpeg probe commands to verify GPU encoder availability before committing to the GPU path

### Prohibitions (What the Agent MUST NOT Do)

1. **MUST NOT** remove or disable the CPU rendering path — it must remain as the automatic fallback when GPU is unavailable
2. **MUST NOT** modify any React component used in live preview rendering
3. **MUST NOT** add npm dependencies for GPU rendering (use built-in WebGL2 API and existing FFmpeg binary)
4. **MUST NOT** change the default behavior — GPU acceleration must be opt-in or auto-detected, never forced
5. **MUST NOT** change IPC channel names or message shapes without updating both renderer and main process in the same commit
6. **MUST NOT** break the existing resolution-scaling system (`scaleFactor = height / 720`) — GPU path must honor the same proportional math
7. **MUST NOT** introduce GPU-specific visual artifacts (aliasing, gamma shift, missing glow effects) that differ from CPU output
8. **MUST NOT** assume NVENC is always available — the GTX 1070 supports it, but the code must handle machines without NVIDIA GPUs
9. **MUST NOT** call `app.disableHardwareAcceleration()` or add `--disable-gpu` flags (these are explicitly commented out in `main.js:15-19` for a reason)

### Decision Protocol

At each decision point during execution, the agent must apply these rules in order:

```
1. CHECK GPU INVARIANTS
   → Is the GPU capability being used actually available on this system?
   → If probing reveals a GPU feature is missing: Fall back to CPU path.
     Do NOT crash. Log the fallback reason.

2. CHECK VISUAL PARITY
   → Does the GPU-rendered frame match the CPU-rendered frame?
   → Compare at 720p: pixel diff must be < 1% (allow anti-aliasing variance).
   → If visual parity fails: Fix the shader/GL code. Do not ship divergent output.

3. CHECK INVARIANTS (from resolution plan)
   → For each Hard Invariant (1-6): Is it still satisfied?
   → If any invariant is violated: STOP. Report which invariant failed and why.

4. CHECK CONSTRAINTS
   → Does the proposed change violate any Architectural Constraint (C1-C8)?
   → Does the proposed change violate any Performance Constraint (P1-P3)?
   → If yes: Reject the approach. Find an alternative.

5. CHECK FALLBACK PATH
   → If the GPU path fails at runtime, does the CPU path still work?
   → If CPU fallback is broken: This is a blocking bug. Fix before proceeding.

6. EXECUTE
   → Make the smallest change that satisfies the current phase.
   → Validate GPU AND CPU paths before moving to the next phase.
```

### Escalation Triggers

The agent must **stop and ask the user** if any of these occur:

1. NVENC is not available in the installed FFmpeg binary (already verified it IS available — but guard against future FFmpeg replacement)
2. WebGL2 context creation fails in Electron renderer
3. GPU-rendered frames show visible visual differences from CPU path that cannot be resolved through shader adjustments
4. VRAM usage exceeds 2GB during export (GTX 1070 has 4GB total, other apps need headroom)
5. A file outside Scope needs modification
6. The GPU approach for a specific phase is infeasible and requires a fundamentally different architecture

---

## Invariants (Execution Preconditions)

These conditions **must hold true** for GPU pipeline execution. Violating any Hard Invariant blocks the GPU path (but CPU fallback must still work).

### Hard Invariants

| # | Invariant | How to Verify |
|---|-----------|---------------|
| G1 | **NVIDIA GPU driver is installed and functional** | `wmic path win32_VideoController get name` returns "NVIDIA GeForce GTX 1070" |
| G2 | **FFmpeg binary supports `h264_nvenc`** | `ffmpeg -encoders \| findstr h264_nvenc` returns a result (VERIFIED: it does) |
| G3 | **Electron hardware acceleration is enabled** | `main.js` does NOT call `app.disableHardwareAcceleration()` (VERIFIED: lines 16-19 are commented out) |
| G4 | **WebGL2 context is obtainable in renderer** | `canvas.getContext('webgl2')` returns non-null in Electron renderer |
| G5 | **`drawKaraokeFrame()` CPU path exists and works** | The current Canvas 2D implementation must remain intact as fallback |
| G6 | **NVENC concurrent session limit is not exceeded** | GTX 1070 supports up to 2 simultaneous NVENC sessions; export uses exactly 1 |
| G7 | **VRAM is sufficient for render targets** | A 4K RGBA framebuffer is 3840x2160x4 = ~33MB; GTX 1070 has 4096MB — headroom is ample |

### Soft Invariants (Degradation Allowed)

| # | Invariant | Degradation Path |
|---|-----------|-----------------|
| G8 | **GPU encoding is faster than CPU** | If NVENC is somehow slower (unlikely), log a warning but don't block |
| G9 | **WebGL text rendering matches Canvas 2D exactly** | Allow ≤1% pixel variance due to GPU anti-aliasing differences |
| G10 | **GPU is not being used by other heavy workloads** | If VRAM is low, fall back to CPU encoding; keep GPU for rendering only |

---

## Constraints (Shaping the Implementation)

### Architectural Constraints

| ID | Constraint | Rationale |
|----|-----------|-----------|
| GC1 | **CPU fallback must always work** — if GPU detection fails at any stage, the entire export must complete using the existing CPU pipeline with zero user intervention | Users on Intel-only laptops, VMs, or with disabled GPUs must still export |
| GC2 | **Visual output must be identical** between GPU and CPU paths (within anti-aliasing tolerance) | Users should not get different-looking exports depending on their hardware |
| GC3 | **GPU path must not destabilize the main Electron window** — YouTube iframe playback, UI responsiveness, and preview rendering must remain unaffected during export | The GTX 1070 has separate encode (NVENC) and render (CUDA cores) engines, so encoding shouldn't affect rendering, but verify |
| GC4 | **No new npm dependencies** — use WebGL2 (built into Chromium), FFmpeg NVENC (already compiled in), and WebCodecs `hardwareAcceleration` flag | Keep the dependency surface unchanged |
| GC5 | **NVENC quality settings must match or exceed CPU quality** — NVENC CQ (constant quality) mode must produce text as sharp as libx264 CRF 17 | NVENC CQ 19 is roughly equivalent to x264 CRF 17 for synthetic content |
| GC6 | **GPU detection must happen once at startup**, not per-export — cache the result to avoid repeated probe overhead | Detection involves spawning FFmpeg and checking WebGL, which is expensive |
| GC7 | **The resolution-scaling system (`scaleFactor = height / 720`) must be preserved** in the GPU path — all proportional math must match | GPU path extends the resolution plan, does not replace it |

### Performance Constraints

| ID | Constraint | Rationale |
|----|-----------|-----------|
| GP1 | **GPU path must be at least 2x faster** than CPU path at 1080p for the encoding stage, or it's not worth the complexity | If NVENC doesn't deliver measurable speedup, keep CPU |
| GP2 | **VRAM usage must stay under 2GB** during export | Leave headroom for display compositor and other GPU tasks |
| GP3 | **GPU frame readback latency must not exceed 5ms per frame** at 1080p | `gl.readPixels()` is synchronous and can stall — must not become the bottleneck |
| GP4 | **Total export time for a 4-minute song at 1080p must not exceed 4 minutes** with GPU pipeline (vs ~10 min CPU target) | This is the primary user-facing speedup promise |

---

## Implementation Steps

### Phase 1: GPU Capability Detection

**New file:** `src/utils/gpuCapabilities.js`

**What this does:**
Create a singleton module that detects available GPU acceleration features at app startup and caches the results.

**Detection matrix:**

| Capability | Detection Method | Result |
|-----------|-----------------|--------|
| WebGL2 available | `document.createElement('canvas').getContext('webgl2')` | boolean |
| NVENC available | IPC call to main process → `ffmpeg -encoders \| findstr h264_nvenc` | boolean |
| QSV available | IPC call to main process → `ffmpeg -encoders \| findstr h264_qsv` | boolean |
| Max texture size | `gl.getParameter(gl.MAX_TEXTURE_SIZE)` | number (usually 16384 for GTX 1070) |
| VRAM estimate | `gl.getExtension('WEBGL_debug_renderer_info')` → parse adapter string | string |
| WebCodecs HW encode | `VideoEncoder.isConfigSupported({ codec: 'avc1.4d002a', hardwareAcceleration: 'prefer-hardware', width: 1920, height: 1080 })` | boolean |

**Output structure:**
```javascript
{
    webgl2: true,
    nvenc: true,
    qsv: true,
    maxTextureSize: 16384,
    gpuRenderer: 'NVIDIA GeForce GTX 1070',
    webCodecsHardware: true,
    preferredEncoder: 'h264_nvenc',  // or 'h264_qsv' or 'libx264'
    preferredRenderMode: 'webgl2'    // or 'canvas2d'
}
```

**Fallback logic:**
```
if (nvenc)       → preferredEncoder = 'h264_nvenc'
else if (qsv)    → preferredEncoder = 'h264_qsv'
else             → preferredEncoder = 'libx264'

if (webgl2 && maxTextureSize >= width)
                 → preferredRenderMode = 'webgl2'
else             → preferredRenderMode = 'canvas2d'
```

---

### Phase 2: FFmpeg NVENC Encoding Path

**File:** `electron/main.js` (export-finalize handler)

**What changes:**
Replace the hardcoded `libx264` encoder with a dynamic selection based on GPU capabilities passed from the renderer.

**New FFmpeg command (NVENC path):**
```
ffmpeg -y -framerate {fps} -i frame_%06d.png
       -c:v h264_nvenc
       -preset p7                    # highest quality NVENC preset
       -rc constqp -cq 19           # constant quality mode, CQ 19 ≈ x264 CRF 17
       -profile:v high
       -pix_fmt yuv420p
       -rc-lookahead 32             # look-ahead for better quality
       output.mp4
```

**Fallback FFmpeg command (CPU path — unchanged):**
```
ffmpeg -y -framerate {fps} -i frame_%06d.png
       -c:v libx264 -preset slow -crf 17 -tune animation -pix_fmt yuv420p
       output.mp4
```

**IPC change:**
The `export-start` message gains an optional `encoder` field:
```javascript
// Renderer sends:
{ exportId, width, height, fps, ..., encoder: 'h264_nvenc' }

// Main process uses this to select FFmpeg args.
// If encoder is missing or invalid, falls back to 'libx264'.
```

**NVENC vs libx264 parameter mapping for text quality:**

| x264 Parameter | NVENC Equivalent | Notes |
|---------------|-----------------|-------|
| `-crf 17` | `-rc constqp -cq 19` | NVENC CQ is slightly different scale; 19 matches visually |
| `-preset slow` | `-preset p7` | p7 = "slow" equivalent in NVENC; best quality |
| `-tune animation` | (no direct equivalent) | NVENC handles flat regions well natively; not needed |
| `-pix_fmt yuv420p` | `-pix_fmt yuv420p` | Same |

---

### Phase 3: WebGL2 Canvas Rendering

**New file:** `src/utils/karaokeDrawerGL.js`

**What this does:**
Implement the same visual output as `drawKaraokeFrame()` but using WebGL2 for GPU-accelerated rendering. This is the most complex phase.

**Architecture:**
```
karaokeDrawerGL.js
├── initGL(canvas)                    → Create WebGL2 context, compile shaders
├── drawKaraokeFrameGL(gl, params)    → GPU-accelerated frame render
│   ├── clearToBlack()                → gl.clear()
│   ├── drawText(text, x, y, opts)    → Texture atlas + SDF text rendering
│   ├── drawGlow(text, x, y, opts)    → Fragment shader blur pass
│   ├── drawHighlightClip(...)        → Stencil buffer word-fill
│   ├── drawProgressBar(...)          → Simple quad
│   └── drawIntervalDisplay(...)      → Composed from above primitives
└── destroyGL()                       → Cleanup GPU resources
```

**Text rendering strategy — Signed Distance Field (SDF):**

The core challenge is rendering anti-aliased text on the GPU. Canvas 2D has built-in `fillText()` with sub-pixel anti-aliasing. WebGL has no text primitive. The solution:

1. **Pre-render a font texture atlas** using Canvas 2D at 2x resolution (one-time cost)
   - Render each glyph (A-Z, a-z, 0-9, punctuation) to an offscreen Canvas 2D
   - Upload as a WebGL texture
   - Store glyph metrics (width, bearing, advance) in a lookup table

2. **Render text as textured quads** in the vertex shader
   - Each character = 1 quad (2 triangles) positioned using glyph metrics
   - Fragment shader samples from the atlas texture

3. **Apply highlight via uniform** in the fragment shader
   ```glsl
   uniform float u_highlightProgress; // 0.0 to 1.0
   uniform vec3 u_highlightColor;
   uniform vec3 u_baseColor;          // white

   void main() {
       float alpha = texture(u_atlas, v_texCoord).a;
       vec3 color = (v_charX / v_wordWidth < u_highlightProgress)
                    ? u_highlightColor : u_baseColor;
       gl_FragColor = vec4(color, alpha * u_opacity);
   }
   ```

4. **Apply glow via multi-pass Gaussian blur**
   - Render text to an FBO (framebuffer object)
   - Apply separable Gaussian blur (horizontal + vertical pass) in a second FBO
   - Composite blurred glow behind sharp text

**Why SDF over bitmap text:**
- SDF (Signed Distance Field) text stays sharp at any scale factor — perfect for the resolution-scaling system
- A single atlas texture works for 720p through 4K without re-rendering
- GPU fragment shaders compute anti-aliasing at fragment level, producing smoother edges than CPU rasterization

**Font atlas generation (one-time at export start):**
```javascript
function generateFontAtlas(fontFamily, fontSize, scaleFactor) {
    // Render at 2x the target fontSize for quality headroom
    const atlasSize = 2048; // fits all ASCII glyphs comfortably
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = atlasSize;
    tempCanvas.height = atlasSize;
    const ctx = tempCanvas.getContext('2d');

    // Render each glyph, record UV coordinates and metrics
    // Upload to WebGL as gl.texImage2D(gl.TEXTURE_2D, ..., tempCanvas)
}
```

---

### Phase 4: Raw Pixel Readback (Eliminate PNG Encode/Decode)

**File:** `src/utils/electronExport.js`

**What changes:**
When using WebGL rendering, extract raw RGBA pixels directly instead of encoding to PNG.

**Current flow (CPU, PNG):**
```
Canvas 2D → toDataURL('image/png') → base64 string → IPC → Buffer.from(base64) → write .png file → FFmpeg reads .png
```

**New flow (GPU, raw pixels):**
```
WebGL canvas → gl.readPixels(RGBA) → Uint8Array → IPC (ArrayBuffer transfer) → write to FFmpeg stdin pipe
```

**Key changes:**

1. **Renderer side:**
```javascript
// Instead of:
const frameData = canvas.toDataURL('image/png').split(',')[1];

// Use:
const pixels = new Uint8Array(width * height * 4);
gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
// Note: WebGL readPixels returns bottom-up; must flip vertically
flipVertical(pixels, width, height);
```

2. **IPC transport:**
   - Use `ArrayBuffer` transfer instead of base64 string — avoids the 33% base64 overhead
   - Send raw RGBA bytes directly

3. **Main process (FFmpeg stdin pipe):**
   - Instead of writing PNG files to disk and reading them back, pipe raw RGBA directly into FFmpeg's stdin
   - FFmpeg command changes to accept raw video input:
```
ffmpeg -y -f rawvideo -pix_fmt rgba -s {width}x{height} -r {fps} -i pipe:0
       -c:v h264_nvenc -preset p7 -rc constqp -cq 19 -pix_fmt yuv420p
       output.mp4
```

**Performance impact:**
- Eliminates PNG encoding (CPU-heavy, ~20ms/frame at 1080p)
- Eliminates PNG decoding in FFmpeg (another ~10ms/frame)
- Eliminates disk I/O for intermediate frames entirely
- Raw RGBA at 1080p = 8.3MB/frame vs PNG ~6MB/frame, but no encode/decode time

**Vertical flip helper:**
```javascript
function flipVertical(pixels, width, height) {
    const rowSize = width * 4;
    const temp = new Uint8Array(rowSize);
    for (let y = 0; y < height / 2; y++) {
        const topOffset = y * rowSize;
        const bottomOffset = (height - y - 1) * rowSize;
        temp.set(pixels.subarray(topOffset, topOffset + rowSize));
        pixels.copyWithin(topOffset, bottomOffset, bottomOffset + rowSize);
        pixels.set(temp, bottomOffset);
    }
}
```

---

### Phase 5: WebCodecs Hardware Acceleration

**File:** `src/utils/fastExport.js`

**What changes:**
Enable GPU-accelerated encoding in the WebCodecs `VideoEncoder` path (used for non-Electron/in-browser export).

**Current config:**
```javascript
videoEncoder.configure({
    codec: 'avc1.4d002a',
    width,
    height,
    bitrate,
    framerate: fps
});
```

**New config:**
```javascript
// Probe hardware support first
const hwSupport = await VideoEncoder.isConfigSupported({
    codec: 'avc1.4d002a',
    width,
    height,
    bitrate,
    framerate: fps,
    hardwareAcceleration: 'prefer-hardware'
});

videoEncoder.configure({
    codec: 'avc1.4d002a',
    width,
    height,
    bitrate,
    framerate: fps,
    hardwareAcceleration: hwSupport.supported ? 'prefer-hardware' : 'no-preference'
});
```

**Why `prefer-hardware` not `require-hardware`:**
- `prefer-hardware` tries GPU first, falls back to software silently
- `require-hardware` throws if GPU encoder unavailable
- We want graceful degradation, not failure

---

### Phase 6: Streaming Pipeline Integration

**Files:** `electron/main.js`, `src/utils/electronExport.js`

**What this does:**
Wire together Phases 2-4 into a single streaming pipeline where frames flow directly from GPU render → readback → IPC → FFmpeg NVENC without touching disk.

**Full GPU pipeline flow:**
```
[Renderer Process]                          [Main Process]

WebGL2 Canvas                               FFmpeg (h264_nvenc)
    │                                            ▲
    ▼                                            │
gl.readPixels(RGBA)                         stdin pipe (rawvideo)
    │                                            ▲
    ▼                                            │
flipVertical()                              Buffer.from(ArrayBuffer)
    │                                            ▲
    ▼                                            │
ipcRenderer.invoke('export-frame-raw') ──────────┘
    │
    ▼
Backpressure check (encodeQueueSize)
    │
    ▼
Next frame...
```

**IPC design for streaming:**

New IPC channel: `export-frame-raw` (singular, not batched)
```javascript
// Renderer sends one frame at a time as ArrayBuffer
ipcRenderer.invoke('export-frame-raw', {
    exportId,
    frameIndex: i,
    pixels: pixels.buffer  // ArrayBuffer, transferred not copied
});

// Main process writes directly to FFmpeg stdin
ipcMain.handle('export-frame-raw', async (event, { exportId, pixels }) => {
    const exp = activeExports.get(exportId);
    const buffer = Buffer.from(pixels);
    exp.ffmpegProcess.stdin.write(buffer);
    return { success: true };
});
```

**Backpressure:**
```javascript
// In renderer loop:
if (ffmpegBackpressure) {
    await new Promise(r => setTimeout(r, 5));
}

// Main process signals backpressure via:
// - FFmpeg stdin.write() returns false (buffer full)
// - Track pending writes count
```

---

### Phase 7: GPU Path Toggle in Export UI

**File:** `src/hooks/useKaraokeExport.js`

**What changes:**
- Accept a `gpuAcceleration` parameter: `'auto' | 'force-gpu' | 'force-cpu'`
- Default is `'auto'` — uses GPU capability detection from Phase 1
- Pass the selected encoder and render mode through to `exportToMp4Electron()`

```javascript
export function useKaraokeExport({
    // ...existing params
    gpuAcceleration = 'auto' // 'auto' | 'force-gpu' | 'force-cpu'
}) {
    // Resolve GPU capabilities
    const gpuCaps = useGpuCapabilities(); // from Phase 1

    const resolvedConfig = useMemo(() => {
        if (gpuAcceleration === 'force-cpu') {
            return { encoder: 'libx264', renderMode: 'canvas2d' };
        }
        if (gpuAcceleration === 'force-gpu') {
            return {
                encoder: gpuCaps.preferredEncoder,
                renderMode: gpuCaps.webgl2 ? 'webgl2' : 'canvas2d'
            };
        }
        // 'auto' — use GPU if available
        return {
            encoder: gpuCaps.preferredEncoder,
            renderMode: gpuCaps.preferredRenderMode
        };
    }, [gpuAcceleration, gpuCaps]);
}
```

---

## Execution Order & Dependencies

```
Phase 1 (GPU Detection) ──────────────────────────────────┐
    │                                                      │
    ▼                                                      │
Phase 2 (NVENC Encoding) ──┐                               │
    │                      │                               │
    │                      ▼                               │
    │              Phase 3 (WebGL Rendering) ──┐           │
    │                      │                   │           │
    │                      ▼                   │           │
    │              Phase 4 (Raw Readback) ─────┤           │
    │                                          │           │
    ▼                                          ▼           │
Phase 5 (WebCodecs HW)            Phase 6 (Streaming) ────┤
    │                                          │           │
    └──────────────────────┬───────────────────┘           │
                           ▼                               │
                   Phase 7 (UI Toggle) ◄───────────────────┘
```

**Minimum viable GPU improvement:** Phase 1 + Phase 2 alone delivers NVENC encoding speedup with zero rendering changes. This is the lowest-risk, highest-impact starting point.

**Full GPU pipeline:** All 7 phases deliver the complete GPU-accelerated export.

---

## Verification Checklist

The agent must pass **every item** in this checklist before the job is considered complete. Mark each item as it passes.

### Functional Verification

- [ ] **F1: CPU fallback works end-to-end** — With GPU forcibly disabled (`gpuAcceleration: 'force-cpu'`), export at 720p produces a valid MP4 identical to the pre-GPU-plan output
- [ ] **F2: NVENC encoding produces valid MP4** — Export using `h264_nvenc` produces an MP4 that plays in VLC, Windows Media Player, and browser `<video>` tag
- [ ] **F3: NVENC quality matches CPU quality** — Side-by-side comparison of a text-heavy frame: NVENC CQ 19 output has no visible blockiness or ringing around letter strokes that libx264 CRF 17 does not
- [ ] **F4: WebGL rendering matches Canvas 2D** — A frame rendered via `drawKaraokeFrameGL()` is pixel-compared against `drawKaraokeFrame()` at 720p; difference is ≤1% of pixels (anti-aliasing tolerance)
- [ ] **F5: Word highlight clip works on GPU** — The progressive left-to-right highlight fill renders correctly in the WebGL path with stencil/shader clipping
- [ ] **F6: Glow/shadow effects render on GPU** — Text neon glow and highlight color glow are visually indistinguishable from CPU path
- [ ] **F7: Instrumental/Outro interval display renders on GPU** — Timer text, progress bar, and label all render correctly in WebGL
- [ ] **F8: Resolution scaling works on GPU** — Export at 720p, 1080p, and 1440p all produce correctly scaled text, margins, progress bars (scaleFactor math is preserved)
- [ ] **F9: Raw pixel pipe mode works** — FFmpeg receives raw RGBA via stdin and produces valid output without intermediate files on disk
- [ ] **F10: WebCodecs hardware acceleration activates** — `VideoEncoder` reports hardware acceleration when available (check via `VideoEncoder.isConfigSupported`)
- [ ] **F11: GPU detection caching works** — `gpuCapabilities` is probed once at startup, cached, and reused across multiple exports without re-probing
- [ ] **F12: Auto mode selects correct path** — On the target machine (GTX 1070), auto mode selects `h264_nvenc` + `webgl2`; on a simulated no-GPU environment, auto mode selects `libx264` + `canvas2d`

### Performance Verification

- [ ] **P1: NVENC encoding is ≥2x faster** than libx264 at 1080p for a 4-minute song (measure wall-clock time of FFmpeg encode step only)
- [ ] **P2: Full GPU pipeline export at 1080p completes in ≤4 minutes** for a 4-minute song
- [ ] **P3: VRAM usage stays under 2GB** during export (monitor via `nvidia-smi` or task manager)
- [ ] **P4: `gl.readPixels()` latency is ≤5ms/frame** at 1080p (measure in console logs)
- [ ] **P5: No frame drops or stuttering** in exported video (play back at 1x and verify audio-video sync)
- [ ] **P6: CPU usage drops measurably** during GPU-accelerated export compared to CPU-only export (encoding stage should show near-zero CPU for NVENC)
- [ ] **P7: Memory (RAM) stays under 2GB** during export — GPU offloading should reduce RAM pressure, not increase it

### Stability Verification

- [ ] **S1: Export does not crash Electron app** — Run 3 consecutive exports at 1080p without app crash or hang
- [ ] **S2: YouTube iframe remains functional** during export — Start an export, verify YouTube playback in another tab still works
- [ ] **S3: Cancelling mid-export cleans up GPU resources** — Cancel export at 50% progress, verify no VRAM leak (check `nvidia-smi`)
- [ ] **S4: Rapid re-export works** — Complete an export, immediately start another; no stale GPU state or FFmpeg process zombies
- [ ] **S5: Error messages are actionable** — When GPU path fails, the error message tells the user what happened and that CPU fallback is being used

### Regression Verification

- [ ] **R1: 720p CPU export is unchanged** — The output of a 720p export with `gpuAcceleration: 'force-cpu'` is byte-for-byte identical to pre-GPU-plan output (same FFmpeg args, same frame data)
- [ ] **R2: Resolution plan phases are intact** — All 7 phases from the resolution plan still work correctly (scaleFactor, PNG intermediates for CPU path, dynamic batch sizing, resolution dropdown)
- [ ] **R3: Audio mixing is unaffected** — Band/vocal volume controls produce identical audio output regardless of GPU/CPU video path
- [ ] **R4: Existing IPC channels work** — `export-start`, `export-frames`, `export-finalize` still function for the CPU path (new `export-frame-raw` is additive only)
- [ ] **R5: No new npm dependencies** — `package.json` has zero new entries in `dependencies` or `devDependencies`

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| NVENC produces softer text than libx264 at equivalent quality settings | Medium | High | Tune CQ value; test at CQ 17, 18, 19; compare frame screenshots |
| WebGL text rendering introduces visible anti-aliasing differences | High | Medium | Use SDF text with carefully tuned alpha threshold; accept ≤1% pixel diff |
| `gl.readPixels()` causes GPU pipeline stall (synchronous readback) | Medium | Medium | Use PBO (Pixel Buffer Object) for async readback if available in WebGL2 |
| FFmpeg stdin pipe deadlocks under backpressure | Medium | High | Implement write-drain pattern; pause renderer when FFmpeg buffer is full |
| Font atlas generation fails for non-ASCII characters (unicode lyrics) | High | High | Fall back to Canvas 2D `fillText()` for characters not in atlas; or render full unicode ranges |
| GTX 1070 NVENC session limit hit by another app | Low | Medium | Catch NVENC init failure, fall back to libx264 with clear log message |
| VRAM fragmentation after many exports | Low | Low | Destroy WebGL context and recreate between exports |

---

## Summary

This plan adds GPU acceleration to three stages of the MP4 export pipeline:

1. **Rendering:** WebGL2 with SDF text replaces Canvas 2D software rasterization — GPU-parallel fragment shading at any resolution
2. **Readback:** `gl.readPixels()` with raw RGBA piped directly to FFmpeg — eliminates PNG encode/decode and disk I/O entirely
3. **Encoding:** NVENC hardware encoder replaces libx264 software encoder — dedicated encoder ASIC produces H.264 at 5-15x the speed with near-zero CPU load

The CPU path is preserved as an automatic fallback at every stage. Phase 1 (detection) + Phase 2 (NVENC) is the minimum viable improvement with the highest impact-to-risk ratio. The full 7-phase plan delivers end-to-end GPU acceleration with a target of exporting a 4-minute 1080p karaoke video in under 4 minutes.
