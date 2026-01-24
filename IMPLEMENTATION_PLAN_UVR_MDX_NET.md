# Implementation Plan: UVR-MDX-NET-Inst_Main Integration

**Date:** January 23, 2026
**Status:** PENDING APPROVAL
**Author:** Claude Code

---

## 1. Overview

This plan details the integration of the **UVR-MDX-NET-Inst_Main** model as a new splitter option in the karaoke-box application. The model will be hosted locally on the desktop and integrated via the existing `audio-separator` Python module.

### Key Objectives
- Add UVR-MDX-NET-Inst_Main as a selectable option in the splitter dropdown
- Ensure proper setup to prevent alignment/timing issues between stems
- Follow the existing adapter pattern for consistency
- Leverage local hosting for offline capability

---

## 2. Critical: Alignment Issue Prevention

Based on research and the existing Demucs adapter implementation, alignment issues between vocal and instrumental stems are typically caused by:

| Issue | Cause | Solution |
|-------|-------|----------|
| Sample rate mismatch | Input at 48kHz, model expects 44.1kHz | Pre-convert all input to 44.1kHz WAV |
| Decoding inconsistencies | Different backends (torchaudio/ffmpeg) | Canonicalize audio format before processing |
| Hop length variance | Incorrect stride values | Use documented defaults (hop_length=1024) |
| Overlap inconsistency | Non-standard overlap values | Use recommended overlap (0.25) |

### Mandatory Pre-Processing Pattern
Follow the pattern established in [demucs-adapter.js:61-82](server/splitter/demucs-adapter.js#L61-L82):

```javascript
// CRITICAL: Canonicalize to 44.1kHz stereo WAV before separation
const wavPath = path.join(outputRoot, 'input_canonical.wav');
await execAsync(`"${FFMPEG_PATH}" -y -i "${inputPath}" -ar 44100 -ac 2 "${wavPath}"`);
```

This ensures:
- Identical input format regardless of source (MP3, OPUS, WebM, etc.)
- Sample rate locked at 44.1kHz (UVR-MDX-NET training rate)
- Stereo channel layout
- Eliminates backend decoding differences

---

## 3. Implementation Steps

### Phase 1: Environment Verification

#### Step 1.1: Verify audio-separator Installation
```bash
# In project venv
venv\Scripts\python.exe -m audio_separator --help
venv\Scripts\python.exe -c "import audio_separator; print(audio_separator.__version__)"
```

**Expected:** Version 0.17+ with ONNX runtime support

#### Step 1.2: Verify UVR-MDX-NET-Inst_Main Model Availability
```bash
venv\Scripts\python.exe -m audio_separator.separator --list_models | findstr "UVR-MDX-NET-Inst"
```

**Expected output should include:**
- `UVR-MDX-NET-Inst_Main.onnx`
- `UVR-MDX-NET-Inst_HQ_1.onnx` (alternative)
- `UVR-MDX-NET-Inst_HQ_3.onnx` (alternative)

#### Step 1.3: Test Model Download
```bash
# Models auto-download on first use to: %TEMP%\audio-separator-models\
venv\Scripts\python.exe -m audio_separator.separator "test_audio.wav" --model_filename "UVR-MDX-NET-Inst_Main.onnx" --output_dir "test_output"
```

---

### Phase 2: Create Dedicated UVR-MDX-NET Adapter

#### Step 2.1: Create New Adapter File

**File:** `server/splitter/uvr-mdx-net-adapter.js`

The adapter must implement:

```javascript
export class UVRMDXNetAdapter {
    constructor() {
        this.name = 'uvr-mdx-net';
        this.supportedModels = [
            'UVR-MDX-NET-Inst_Main',
            'UVR-MDX-NET-Inst_HQ_1',
            'UVR-MDX-NET-Inst_HQ_3'
        ];
    }

    async checkHealth() {
        // 1. Verify audio_separator module is importable
        // 2. Verify ONNX runtime is available
        // 3. Return { available: true/false, error?: string }
    }

    async separate(jobId, inputPath, options, onProgress) {
        // 1. CRITICAL: Pre-convert to 44.1kHz WAV (alignment fix)
        // 2. Run audio-separator with MDX parameters
        // 3. Parse output files
        // 4. Return result object
    }
}
```

#### Step 2.2: Adapter Implementation Requirements

**Required MDX Parameters for Alignment:**
```javascript
const mdxParams = {
    '--mdx_hop_length': 1024,      // Default stride - DO NOT CHANGE
    '--mdx_overlap': 0.25,          // Window overlap for smooth transitions
    '--mdx_segment_size': 256,      // Default segment size
    '--sample_rate': 44100,         // Match pre-conversion rate
    '--output_format': 'MP3'        // Consistent with other adapters
};
```

**Command Construction:**
```javascript
const cmd = `"${VENV_PYTHON}" -m audio_separator.separator "${canonicalWavPath}" ` +
    `--model_filename "UVR-MDX-NET-Inst_Main.onnx" ` +
    `--output_dir "${outputRoot}" ` +
    `--mdx_hop_length 1024 ` +
    `--mdx_overlap 0.25 ` +
    `--mdx_segment_size 256 ` +
    `--sample_rate 44100 ` +
    `--output_format MP3`;
```

#### Step 2.3: Output File Mapping

UVR-MDX-NET outputs files with naming pattern:
```
<original_filename>_(Vocals)_UVR-MDX-NET-Inst_Main.mp3
<original_filename>_(Instrumental)_UVR-MDX-NET-Inst_Main.mp3
```

Map to standard result structure:
```javascript
const result = {
    modelUsed: 'UVR-MDX-NET-Inst_Main',
    files: {
        vocals: path.join(outputRoot, vocalFile),
        band: path.join(outputRoot, instrumentalFile)
    }
};
```

**Note:** UVR-MDX-NET-Inst_Main is a **2-stem model only** (vocals + instrumental). It does not produce drums/bass/other stems.

---

### Phase 3: Register Adapter in Splitter Service

#### Step 3.1: Update Adapter Imports

**File:** [server/splitter/index.js](server/splitter/index.js)

Add import at top of file (around line 4-8):
```javascript
import { UVRMDXNetAdapter } from './uvr-mdx-net-adapter.js';
```

#### Step 3.2: Instantiate Adapter

Add to adapter instances list (around line 12-18):
```javascript
const adapters = {
    demucs: new DemucsAdapter(),
    audioSeparator: new AudioSeparatorAdapter(),
    uvrMdxNet: new UVRMDXNetAdapter(),  // ADD THIS
    ffmpeg: new FFmpegSplitterAdapter(),
    mock: new MockSplitterAdapter()
};
```

#### Step 3.3: Update Adapter Selection Logic

Modify the `initSplitterService()` function to include UVR-MDX-NET in the fallback chain:
```javascript
// Priority order for automatic selection:
// 1. Demucs (highest quality, 4-stem capable)
// 2. UVR-MDX-NET (excellent 2-stem quality)
// 3. AudioSeparator (fallback)
// 4. FFmpeg (no ML, basic separation)
// 5. Mock (testing only)
```

---

### Phase 4: Frontend Integration

#### Step 4.1: Add Dropdown Option

**File:** [src/components/karaoke-designs/IntegratedEcologicalOS.jsx](src/components/karaoke-designs/IntegratedEcologicalOS.jsx)

Update the model selector (around line 1304-1308):
```jsx
<select value={modelId} onChange={e => setModelId(e.target.value)}
    className="w-full bg-[#162032] text-xs text-slate-400 p-2 rounded border border-slate-700 outline-none">
    <option value="v3-sim">Spec-Sim</option>
    <option value="htdemucs">Hybrid (Real)</option>
    <option value="mdx-extra">MDX (Real)</option>
    <option value="uvr-mdx-inst-main">UVR MDX Inst Main</option>  {/* ADD THIS */}
</select>
```

#### Step 4.2: Add Model Mapping (if using Demucs adapter routing)

If routing through a unified adapter, add mapping:
```javascript
const modelMap = {
    // ... existing mappings
    'uvr-mdx-inst-main': 'UVR-MDX-NET-Inst_Main'
};
```

#### Step 4.3: Stem Count Constraint

When UVR-MDX-NET is selected, enforce 2-stem mode in UI:
```jsx
// Disable 4-stem option when UVR model selected
<select
    value={stems}
    onChange={e => setStems(parseInt(e.target.value))}
    disabled={modelId === 'uvr-mdx-inst-main'}  // UVR only supports 2-stem
>
    <option value={2}>2-Stem (Vocals/Band)</option>
    <option value={4} disabled={modelId === 'uvr-mdx-inst-main'}>
        4-Stem (V/D/B/O)
    </option>
</select>
```

---

### Phase 5: Backend Model Routing

#### Step 5.1: Update Job Processing Logic

**File:** [server/splitter/index.js](server/splitter/index.js) or [server/splitter/queue.js](server/splitter/queue.js)

Add model-to-adapter routing:
```javascript
function getAdapterForModel(modelId) {
    if (modelId.toLowerCase().includes('uvr-mdx-net') ||
        modelId === 'uvr-mdx-inst-main') {
        return adapters.uvrMdxNet;
    }
    if (['htdemucs', 'mdx_extra', 'mdx_extra_q', 'htdemucs_ft', 'v3-sim'].includes(modelId)) {
        return adapters.demucs;
    }
    // Default to active adapter
    return activeAdapter;
}
```

---

### Phase 6: Testing & Validation

#### Step 6.1: Unit Tests for Adapter

Create test file: `server/splitter/__tests__/uvr-mdx-net-adapter.test.js`

Test cases:
1. `checkHealth()` returns correct availability status
2. `separate()` produces valid vocal and instrumental files
3. Output files are correctly named and accessible
4. Progress callback is invoked correctly
5. Error handling for invalid input files

#### Step 6.2: Alignment Validation Test

**Critical test for alignment:**
```javascript
// After separation, verify stems align with original
// 1. Load original audio and both stems
// 2. Mix vocals + instrumental
// 3. Compare waveform alignment with original
// 4. Maximum acceptable drift: < 10ms
```

#### Step 6.3: Integration Test Checklist

- [ ] Model appears in frontend dropdown
- [ ] Selecting model triggers correct adapter
- [ ] Job queues and processes successfully
- [ ] Progress updates display in UI
- [ ] Stem files download correctly
- [ ] Stem playback syncs with YouTube timing
- [ ] No timing drift between vocal and instrumental
- [ ] Artifacts saved to database with correct `version_tag`

---

## 4. File Changes Summary

| File | Action | Changes |
|------|--------|---------|
| `server/splitter/uvr-mdx-net-adapter.js` | **CREATE** | New adapter class |
| `server/splitter/index.js` | MODIFY | Import adapter, add to instances, update routing |
| `src/components/.../IntegratedEcologicalOS.jsx` | MODIFY | Add dropdown option, stem count constraint |
| `server/splitter/queue.js` | MODIFY (maybe) | Model-to-adapter routing if not in index.js |

---

## 5. Dependencies & Prerequisites

### Required Python Packages
```
audio-separator>=0.17.0
onnxruntime>=1.16.0  (or onnxruntime-gpu for CUDA)
numpy
librosa
```

### Model Files (Auto-Downloaded)
```
%TEMP%\audio-separator-models\UVR-MDX-NET-Inst_Main.onnx
```

### External Dependencies
- FFmpeg (already available at `C:\Users\donald clark\AppData\Roaming\Youka Desktop\youka\data\binaries\ffmpeg`)
- Python venv (already configured at `./venv`)

---

## 6. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Model download fails | Implement retry logic with exponential backoff |
| ONNX runtime CUDA conflicts | Detect GPU availability, fallback to CPU |
| Large file memory issues | Use `--chunk_duration` for files > 10 minutes |
| Alignment drift | Enforce 44.1kHz pre-conversion, validate in tests |
| Model not found | Verify model name matches exactly: `UVR-MDX-NET-Inst_Main.onnx` |

---

## 7. Rollback Plan

If integration causes issues:
1. Remove dropdown option from frontend
2. Comment out adapter import/instantiation
3. Previous adapters (Demucs, FFmpeg) remain functional
4. No database schema changes required

---

## 8. Documentation References

- [audio-separator PyPI](https://pypi.org/project/audio-separator/)
- [UVR GitHub Releases](https://github.com/anjok07/ultimatevocalremovergui/releases)
- [MDX-Net Segment Size Discussion](https://github.com/Anjok07/ultimatevocalremovergui/discussions/831)
- [UVR Setup Guide 2026](https://www.propelrc.com/how-to-set-up-ultimate-vocal-remover/)
- [python-audio-separator GitHub](https://github.com/nomadkaraoke/python-audio-separator)

---

## 9. Success Criteria

- [ ] UVR-MDX-NET-Inst_Main appears in splitter dropdown
- [ ] Model processes audio without errors
- [ ] Vocal and instrumental stems are correctly separated
- [ ] **No timing offset** between stems (< 10ms drift)
- [ ] Stems sync perfectly with YouTube playback
- [ ] Job status/progress displays correctly in UI
- [ ] Artifacts stored with `version_tag: "UVR-MDX-NET-Inst_Main"`

---

## 10. Estimated Implementation Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Environment Verification | 30 minutes |
| Phase 2: Create Adapter | 2-3 hours |
| Phase 3: Register Adapter | 30 minutes |
| Phase 4: Frontend Integration | 45 minutes |
| Phase 5: Backend Routing | 30 minutes |
| Phase 6: Testing & Validation | 2-3 hours |
| **Total** | **6-8 hours** |

---

**AWAITING APPROVAL TO PROCEED WITH IMPLEMENTATION**
