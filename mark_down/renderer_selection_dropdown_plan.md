# Implementation Plan: Explicit Renderer Selection Dropdown for MP4 Export

## Executer Agent Role Definition

**Role:** Executer Agent — Front-End Integration Specialist

**Responsibilities:**
- Implement all changes described in the step-by-step execution plan below.
- Modify only the files listed in the scope. Do not touch files outside the scope.
- Follow the existing code patterns (React hooks, Tailwind CSS classes, existing component structure) already present in the codebase.
- Verify each step against the verification checklist before considering it complete.
- Preserve all existing fallback and safety behavior.

**Decision Rights:**
- May choose CSS class names and minor layout adjustments within the export section (Section 4) to make the new dropdown visually consistent with the existing resolution dropdown.
- May add `console.log` statements matching the existing `[Export]` prefix pattern for observability.

**Must Escalate (do not proceed without approval):**
- Any change to files not listed in the scope.
- Any modification to the CPU renderer (`karaokeDrawer.js`) or GPU renderer (`karaokeDrawerGL.js`).
- Any change to the Electron main process (`electron/main.js`).
- Any change to the FFmpeg encoding pipeline or IPC protocol.
- Adding new dependencies or new files.

---

## A) Scope Definition

### What Changes

| # | File | Change |
|---|------|--------|
| 1 | `src/components/karaoke-designs/IntegratedEcologicalOS.jsx` | Add `gpuAcceleration` state (`useState`), add renderer dropdown `<select>`, pass state to `useKaraokeExport` |
| 2 | `src/hooks/useKaraokeExport.js` | No code changes needed — already accepts `gpuAcceleration` parameter (line 40), already passes it to `resolveGpuConfig` (line 149) |
| 3 | `src/utils/gpuCapabilities.js` | No code changes needed — `resolveGpuConfig` already handles `'force-gpu'` and `'force-cpu'` (lines 209-226) |
| 4 | `src/utils/electronExport.js` | No code changes needed — already accepts `renderMode` and `encoder`, already has GPU-to-CPU fallback (lines 87-108) |

**Total files modified: 1** (`IntegratedEcologicalOS.jsx`)

### What Remains Unchanged

- CPU renderer (`src/utils/karaokeDrawer.js`) — untouched
- GPU renderer (`src/utils/karaokeDrawerGL.js`) — untouched
- Export pipeline (`src/utils/electronExport.js`) — untouched, already has fallback
- GPU detection (`src/utils/gpuCapabilities.js`) — untouched, already has `resolveGpuConfig`
- Export hook (`src/hooks/useKaraokeExport.js`) — untouched, already accepts `gpuAcceleration`
- Electron main process (`electron/main.js`) — untouched
- All other components — untouched

---

## B) Design Approach

### Renderer Choice Representation

The codebase already defines a renderer selection type in `useKaraokeExport.js` line 40:

```
gpuAcceleration = 'auto'   // 'auto' | 'force-gpu' | 'force-cpu'
```

The dropdown will expose two user-facing options that map to these existing values:

| Dropdown Label | Internal Value | Behavior |
|---------------|----------------|----------|
| **GPU** (first, default) | `'auto'` | Use GPU if available; fall back to CPU if GPU fails. This is the current default behavior. |
| **CPU** | `'force-cpu'` | Use CPU renderer directly. GPU is never attempted. |

**Why `'auto'` instead of `'force-gpu'` for the GPU option:** The `'auto'` value already implements the safe behavior — attempt GPU, fall back to CPU on failure. The `'force-gpu'` value in `resolveGpuConfig` still falls back to `canvas2d` render mode when WebGL2 is unavailable (line 217), but it would still attempt to use the GPU encoder (`preferredEncoder`) even when that may fail. Using `'auto'` preserves the full existing fallback hierarchy for both rendering and encoding, which is the safer choice.

### How the Rendering Pipeline Uses This Choice

The data flow already exists but is not wired to the UI:

```
IntegratedEcologicalOS.jsx
  └── gpuAcceleration state ('auto' | 'force-cpu')  ← NEW: dropdown sets this
        │
        ▼
useKaraokeExport({ gpuAcceleration })  ← EXISTING: already accepts this param
        │
        ▼
resolveGpuConfig(gpuAcceleration, gpuCaps)  ← EXISTING: returns { encoder, renderMode }
        │
        ▼
exportToMp4Electron({ renderMode, encoder })  ← EXISTING: uses values
        │
        ▼
if renderMode === 'webgl2':                    ← EXISTING: GPU path with fallback
    try initGL() → GPU streaming pipeline
    catch → fallback to Canvas 2D + libx264
else:                                          ← EXISTING: CPU path
    Canvas 2D → PNG frames → libx264
```

**When GPU is selected (`'auto'`):**
1. `resolveGpuConfig('auto', gpuCaps)` returns the detected best encoder and render mode.
2. If WebGL2 is available, `renderMode = 'webgl2'` and `encoder = 'h264_nvenc'` (or `'h264_qsv'` or `'libx264'` depending on what is detected).
3. If WebGL2 init fails at export time, `electronExport.js` lines 87-104 catch the error and fall back to Canvas 2D.
4. If the GPU encoder fails at FFmpeg level, `electron/main.js` lines 318-352 retry with libx264.

**When CPU is selected (`'force-cpu'`):**
1. `resolveGpuConfig('force-cpu', gpuCaps)` returns `{ encoder: 'libx264', renderMode: 'canvas2d' }` unconditionally (line 210-211).
2. The export uses Canvas 2D rendering and libx264 encoding. GPU is never attempted.

### Integration with Current Fallback Behavior

The current fallback behavior is **fully preserved**. The GPU dropdown option maps to `'auto'`, which is the existing default. The CPU option maps to `'force-cpu'`, which bypasses GPU entirely. No fallback paths are removed or altered.

---

## C) Step-by-Step Execution Plan

### Step 1: Locate Current Code Points

Verify these locations before making changes:

| What | File | Line(s) |
|------|------|---------|
| `gpuAcceleration` parameter (already defined, defaults to `'auto'`) | `src/hooks/useKaraokeExport.js` | 40 |
| `resolveGpuConfig` function (already handles `'force-cpu'`) | `src/utils/gpuCapabilities.js` | 209-226 |
| GPU fallback in export (try/catch on `initGL`) | `src/utils/electronExport.js` | 87-104 |
| Export hook call (does NOT pass `gpuAcceleration` yet) | `IntegratedEcologicalOS.jsx` | 108-118 |
| `exportResolution` state declaration (pattern to follow) | `IntegratedEcologicalOS.jsx` | 85 |
| Resolution dropdown (pattern to follow for new dropdown) | `IntegratedEcologicalOS.jsx` | 1625-1635 |

### Step 2: Add `gpuAcceleration` State

In `IntegratedEcologicalOS.jsx`, near line 85 (next to the `exportResolution` state), add:

```javascript
const [gpuAcceleration, setGpuAcceleration] = useState('auto');
```

This places the renderer selection state alongside the existing export resolution state.

### Step 3: Pass `gpuAcceleration` to the Export Hook

In `IntegratedEcologicalOS.jsx`, in the `useKaraokeExport` call (lines 108-118), add `gpuAcceleration` to the parameters object:

```javascript
const { isExporting, exportProgress, exportError, startExport } = useKaraokeExport({
    songId: selectedSong?.id,
    bandVolume,
    vocalVolume,
    timingJson: alignResult,
    linesPerPage,
    highlightColor,
    trackDuration: duration,
    songTitle: selectedSong?.title || 'karaoke-export',
    exportResolution,
    gpuAcceleration    // ← ADD THIS LINE
});
```

This is the only wiring needed. The hook already accepts this parameter (line 40) and already passes it to `resolveGpuConfig` (line 149).

### Step 4: Add Renderer Dropdown to the UI

In `IntegratedEcologicalOS.jsx`, in the export section (Section 4), add a `<select>` element for the renderer. Place it after the existing resolution dropdown (after line 1635), inside the same `grid grid-cols-4 gap-2` container or directly after the grid, depending on layout fit.

The dropdown must:
- List **GPU** first, **CPU** second.
- Map GPU to `'auto'` and CPU to `'force-cpu'`.
- Be disabled during export (`isExporting`).
- Follow the same styling as the resolution dropdown.

```jsx
<select
    value={gpuAcceleration}
    onChange={(e) => setGpuAcceleration(e.target.value)}
    disabled={isExporting}
    className="p-2 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-slate-300 hover:border-slate-500 disabled:opacity-30 cursor-pointer"
    title="Renderer: GPU (faster, auto-falls back to CPU) or CPU (always works)"
>
    <option value="auto">GPU</option>
    <option value="force-cpu">CPU</option>
</select>
```

### Step 5: Verify Fallback Behavior is Intact

No code changes needed for this step. The fallback chain is:

1. **Render fallback** (`electronExport.js:87-104`): If `initGL()` throws, creates a new canvas with 2D context and continues.
2. **Encoder fallback** (`electronExport.js:108`): If GPU render failed, encoder is downgraded to `libx264`.
3. **FFmpeg fallback** (`electron/main.js:318-352`): If GPU encoder fails at FFmpeg level, retries with `libx264`.

All three fallbacks remain active when `gpuAcceleration = 'auto'`. When `gpuAcceleration = 'force-cpu'`, fallbacks 1-2 are bypassed entirely (CPU path is used directly), and fallback 3 does not apply (libx264 is already selected).

### Step 6: Verify CPU Selection Independence from GPU

When `'force-cpu'` is selected, `resolveGpuConfig` returns `{ encoder: 'libx264', renderMode: 'canvas2d' }` unconditionally, even if `gpuCaps` reports WebGL2/NVENC available. This means:
- GPU detection still runs (cached, no performance cost) but its results are ignored.
- The export enters the CPU path (`electronExport.js` line 101-104) directly.
- No GPU resources are allocated or initialized.

### Step 7: User Feedback on GPU Failure

No new UI is needed. The existing behavior already handles this:
- `electronExport.js` line 91 logs: `[ElectronExport] WebGL2 init failed, falling back to Canvas 2D: ${err.message}`
- The export continues successfully using CPU.
- Progress messages already distinguish GPU vs CPU: `"Rendering frame N/M (GPU)"` vs `"Rendering frame N/M"`.
- If export fails entirely, the existing error display (`IntegratedEcologicalOS.jsx:1644-1648`) shows the error message.

---

## D) Verification Plan

### UI Checks

| # | Check | Pass Criteria | How to Verify |
|---|-------|---------------|---------------|
| U1 | Renderer dropdown exists | A `<select>` element is visible in Section 4 (Export Artifacts) | Visual inspection of the UI |
| U2 | Dropdown has exactly two options | First option: "GPU", second option: "CPU" | Open the dropdown and count options |
| U3 | GPU is the first/default option | On page load, dropdown shows "GPU" | Load the page fresh, inspect dropdown value |
| U4 | Selecting an option updates state | Changing dropdown updates `gpuAcceleration` state | Add temporary `console.log(gpuAcceleration)` in render or use React DevTools |
| U5 | Dropdown is disabled during export | While exporting, dropdown cannot be changed | Start an export, try to change the dropdown |
| U6 | Dropdown follows existing visual style | Matches the resolution dropdown styling | Visual comparison with the resolution dropdown |

### Functional Checks

| # | Check | Pass Criteria | How to Verify |
|---|-------|---------------|---------------|
| F1 | GPU selected + GPU available → GPU rendering | Console shows `renderMode: 'webgl2'` and export uses GPU streaming pipeline | Select GPU, start export, check console for `[Export] GPU config: { ... renderMode: 'webgl2' ... }` and `[ElectronExport] Using GPU streaming pipeline` |
| F2 | GPU selected + GPU fails → CPU fallback | Console shows WebGL2 fallback message, export completes | Simulate GPU failure (e.g., test on a system without GPU) or verify the try/catch path exists in `electronExport.js:87-104` |
| F3 | CPU selected → CPU rendering regardless of GPU | Console shows `renderMode: 'canvas2d'` and `encoder: 'libx264'` | Select CPU, start export, check console for `[Export] GPU config: { gpuAcceleration: 'force-cpu', encoder: 'libx264', renderMode: 'canvas2d' ... }` and `[ElectronExport] Using CPU pipeline (PNG frames)` |
| F4 | MP4 renders successfully with GPU selected | A valid .mp4 file is produced | Select GPU, export, open the resulting .mp4 file |
| F5 | MP4 renders successfully with CPU selected | A valid .mp4 file is produced | Select CPU, export, open the resulting .mp4 file |
| F6 | Selection persists across multiple exports | Second export uses the same renderer as selected | Select CPU, export, export again without changing dropdown, verify both use CPU |

### Regression Checks

| # | Check | Pass Criteria | How to Verify |
|---|-------|---------------|---------------|
| R1 | Default behavior unchanged | With no user interaction on the new dropdown, export behaves identically to before (GPU auto-detection) | Export without touching the renderer dropdown; compare console output to a pre-change export |
| R2 | Resolution dropdown still works | Changing resolution still affects export dimensions | Change resolution, export, verify dimensions in console log `[Export] Resolution: 1080p → 1920x1080` |
| R3 | GPU failure never leaves app unable to render | If GPU is selected and GPU fails, CPU takes over and export completes | The existing try/catch in `electronExport.js:87-104` and encoder fallback in `electron/main.js:318-352` are unchanged |
| R4 | No new imports or dependencies added | The diff shows no new `import` statements for external packages | Review the diff |

### Definition of "Done"

All checks U1-U6, F1-F6, and R1-R4 pass.

---

## E) Smallest Tests / Perturbations

### Minimal Proof Step (before any UI work)

**Test:** In `IntegratedEcologicalOS.jsx`, temporarily hardcode `gpuAcceleration: 'force-cpu'` in the `useKaraokeExport` call:

```javascript
const { isExporting, exportProgress, exportError, startExport } = useKaraokeExport({
    ...existing params...,
    gpuAcceleration: 'force-cpu'  // TEMPORARY: force CPU
});
```

**Expected Evidence:**
- Console output during export shows: `[Export] GPU config: { gpuAcceleration: 'force-cpu', encoder: 'libx264', renderMode: 'canvas2d' ... }`
- Console output shows: `[ElectronExport] Using CPU pipeline (PNG frames)`
- Export produces a valid .mp4 file.

**What This Proves:** The entire chain from `gpuAcceleration` parameter → `resolveGpuConfig` → `exportToMp4Electron` → CPU rendering path works without any pipeline changes. The only remaining work is the UI dropdown.

### Second Minimal Test (after adding state + dropdown, before polish)

**Test:** Add the `useState` and `<select>` (Steps 2-4). No styling needed. Just a bare dropdown.

**Expected Evidence:**
- Selecting "CPU" and exporting shows `renderMode: 'canvas2d'` in console.
- Selecting "GPU" and exporting shows `renderMode: 'webgl2'` in console (assuming GPU is available).
- Both exports produce valid .mp4 files.

---

## F) Risk List and Mitigations

| # | Risk | Impact | Detection | Mitigation |
|---|------|--------|-----------|------------|
| 1 | **Selection not wired:** `gpuAcceleration` state is created but not passed to hook | Dropdown changes have no effect; export always uses default `'auto'` | F3 will fail — CPU selected but console shows `gpuAcceleration: 'auto'` | Verify the `useKaraokeExport` call includes `gpuAcceleration` prop |
| 2 | **Stale closure:** `startExport` callback captures old `gpuAcceleration` value | User changes dropdown but export uses the previous selection | F6 will fail — second export with different selection uses old value | `gpuAcceleration` is already in the dependency array of `useCallback` in `useKaraokeExport.js:191` because it is destructured from the params object |
| 3 | **Fallback loop:** GPU fails, falls back to CPU, but some code re-selects GPU | Export fails or enters infinite retry | F2 will fail — export does not complete | The fallback in `electronExport.js` is a one-way try/catch, not a loop. No code re-selects GPU after fallback. |
| 4 | **Renderer choice ignored:** `resolveGpuConfig` does not respect `'force-cpu'` | CPU selection still uses GPU | F3 will fail — console shows `renderMode: 'webgl2'` when CPU is selected | `resolveGpuConfig` line 210 explicitly checks for `'force-cpu'` and returns CPU config. Already implemented and tested. |
| 5 | **Layout break:** Adding a 6th element to a `grid-cols-4` grid causes wrapping | UI looks broken or dropdown is hidden | U1 visual inspection fails | May need to expand grid to `grid-cols-5` or `grid-cols-6`, or place the renderer dropdown in a separate row. Executer may adjust grid layout within Section 4. |
| 6 | **Wrong default:** Default state is `'force-cpu'` instead of `'auto'` | App defaults to CPU when it should default to GPU | U3 will fail — dropdown shows "CPU" on load | Ensure `useState('auto')` not `useState('force-cpu')` |
