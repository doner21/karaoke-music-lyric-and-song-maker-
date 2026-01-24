# LLM Implementation Prompt: UVR-MDX-NET-Inst_Main Integration

**Project:** karaoke-box
**Task:** Integrate UVR-MDX-NET-Inst_Main model as a splitter option
**Date:** January 23, 2026

---

## Context

You are implementing the UVR-MDX-NET-Inst_Main audio separation model into an Electron + React karaoke application. The detailed implementation plan is located at:

```
c:\Users\donald clark\.gemini\antigravity\scratch\karaoke-box\IMPLEMENTATION_PLAN_UVR_MDX_NET.md
```

**READ THIS FILE FIRST** before proceeding with any implementation.

---

## Project Structure Reference

```
karaoke-box/
├── src/
│   └── components/
│       └── karaoke-designs/
│           └── IntegratedEcologicalOS.jsx    # Frontend UI - dropdown lives here
├── server/
│   └── splitter/
│       ├── index.js                          # Splitter service init & routing
│       ├── demucs-adapter.js                 # Reference implementation (STUDY THIS)
│       ├── audio-separator-adapter.js        # Existing audio-separator adapter
│       ├── ffmpeg-splitter-adapter.js        # FFmpeg fallback adapter
│       ├── mock-adapter.js                   # Mock for testing
│       └── queue.js                          # Job queue management
├── venv/                                     # Python virtual environment
└── IMPLEMENTATION_PLAN_UVR_MDX_NET.md        # Detailed implementation plan
```

---

## Critical Invariants (MUST NOT BREAK)

These are non-negotiable requirements that must remain true throughout implementation:

### I1: Audio Alignment Integrity
- **All input audio MUST be pre-converted to 44.1kHz stereo WAV before separation**
- This prevents timing drift between vocal and instrumental stems
- Reference: `server/splitter/demucs-adapter.js` lines 61-82
- Failure to do this WILL cause alignment issues

### I2: Adapter Interface Contract
All adapters must implement this exact interface:
```javascript
class Adapter {
    constructor() { this.name = 'adapter-name'; }
    async checkHealth() → { available: boolean, error?: string }
    async separate(jobId, inputPath, options, onProgress) → {
        modelUsed: string,
        files: {
            vocals?: string,
            band?: string,
            drums?: string,
            bass?: string,
            other?: string
        }
    }
}
```

### I3: Result Structure Compatibility
- The `result.files` object keys must match: `vocals`, `band`, `drums`, `bass`, `other`
- File paths must be absolute paths
- The `band` key is used for instrumental (not `instrumental`)

### I4: Progress Callback Signature
```javascript
onProgress(percent: number, message?: string)
// percent: 0.0 to 1.0
// message: optional status string
```

### I5: Storage Path Convention
- Output directory: `Storage.getFilePath(jobId, 'separated')`
- Do not create custom output paths

### I6: Environment Variables
- FFmpeg path: `C:\Users\donald clark\AppData\Roaming\Youka Desktop\youka\data\binaries\ffmpeg`
- Python venv: `./venv/Scripts/python.exe`
- These paths are already defined in existing adapters - reuse them

### I7: Existing Functionality
- Do not modify the behavior of existing adapters (demucs, audio-separator, ffmpeg, mock)
- Do not change database schema
- Do not remove any existing dropdown options

---

## Constraints

### C1: Model Limitation
- UVR-MDX-NET-Inst_Main is **2-stem ONLY** (vocals + instrumental)
- It cannot produce 4-stem output (drums/bass/other)
- UI must enforce this constraint

### C2: MDX Parameters for Alignment
These parameters MUST be used to prevent alignment issues:
```
--mdx_hop_length 1024
--mdx_overlap 0.25
--mdx_segment_size 256
--sample_rate 44100
```

### C3: Model Filename
- Exact model name: `UVR-MDX-NET-Inst_Main.onnx`
- Case-sensitive - do not change capitalization

### C4: Output File Naming
UVR outputs files as:
```
<input_filename>_(Vocals)_UVR-MDX-NET-Inst_Main.mp3
<input_filename>_(Instrumental)_UVR-MDX-NET-Inst_Main.mp3
```
Your adapter must parse these patterns to locate output files.

### C5: Frontend Model ID Convention
- Frontend uses lowercase with hyphens: `uvr-mdx-inst-main`
- Backend model filename: `UVR-MDX-NET-Inst_Main.onnx`
- Mapping required between these formats

### C6: Error Handling
- Must throw Error on failure (caught by JobManager)
- Must not silently fail
- Must log to console with `[UVR-MDX-NET]` prefix

---

## Implementation Checklist

Complete each task in order. Check off each item only after verification.

### Phase 1: Environment Verification
```
[ ] 1.1 Verify audio-separator is installed in venv
      Command: venv\Scripts\python.exe -c "import audio_separator; print(audio_separator.__version__)"
      Expected: Version number (0.17+)

[ ] 1.2 Verify UVR-MDX-NET-Inst_Main model is available
      Command: venv\Scripts\python.exe -m audio_separator.separator --list_models
      Expected: List includes UVR-MDX-NET-Inst_Main.onnx

[ ] 1.3 Test model execution manually
      Command: venv\Scripts\python.exe -m audio_separator.separator "test.wav" --model_filename "UVR-MDX-NET-Inst_Main.onnx" --output_dir "test_out"
      Expected: Produces vocal and instrumental files
```

### Phase 2: Create Adapter
```
[ ] 2.1 Create file: server/splitter/uvr-mdx-net-adapter.js

[ ] 2.2 Implement constructor with:
      - this.name = 'uvr-mdx-net'
      - Correct path constants (copy from demucs-adapter.js)

[ ] 2.3 Implement checkHealth() method
      - Verify audio_separator module is importable
      - Return { available: true/false }

[ ] 2.4 Implement separate() method with:
      [ ] 2.4.1 Input validation (file exists, has content)
      [ ] 2.4.2 Pre-convert to 44.1kHz WAV (CRITICAL for alignment)
      [ ] 2.4.3 Construct command with all MDX parameters
      [ ] 2.4.4 Spawn process with correct environment (FFmpeg in PATH)
      [ ] 2.4.5 Parse progress from stdout/stderr
      [ ] 2.4.6 Handle process completion
      [ ] 2.4.7 Parse output files (find vocals and instrumental)
      [ ] 2.4.8 Return result object with correct structure

[ ] 2.5 Export class: export class UVRMDXNetAdapter
```

### Phase 3: Register Adapter
```
[ ] 3.1 Edit server/splitter/index.js
      [ ] 3.1.1 Add import statement at top
      [ ] 3.1.2 Instantiate adapter in adapters object
      [ ] 3.1.3 Add to health check sequence in initSplitterService()

[ ] 3.2 Implement model-to-adapter routing
      - If modelId contains 'uvr-mdx' or equals 'uvr-mdx-inst-main', use UVR adapter
```

### Phase 4: Frontend Integration
```
[ ] 4.1 Edit src/components/karaoke-designs/IntegratedEcologicalOS.jsx
      [ ] 4.1.1 Add dropdown option (around line 1305):
            <option value="uvr-mdx-inst-main">UVR MDX Inst Main</option>

      [ ] 4.1.2 Add stem count constraint - when UVR selected:
            - Force stems to 2
            - Disable 4-stem option
            - Show tooltip/message explaining 2-stem only
```

### Phase 5: Backend Routing
```
[ ] 5.1 Verify job parameters pass modelId correctly to adapter

[ ] 5.2 Verify adapter selection logic routes to UVR adapter when:
      - modelId === 'uvr-mdx-inst-main'
      - modelId contains 'UVR-MDX-NET'
```

### Phase 6: Testing
```
[ ] 6.1 Health check test
      - Start server
      - Check console for "[UVR-MDX-NET] Health Check" message
      - Verify adapter reports available: true

[ ] 6.2 UI test
      - Load frontend
      - Verify "UVR MDX Inst Main" appears in dropdown
      - Verify selecting it disables 4-stem option

[ ] 6.3 Separation test
      - Select a song
      - Choose UVR MDX Inst Main model
      - Click Split
      - Verify job queues and processes
      - Verify progress updates display

[ ] 6.4 Output test
      - Verify vocal file is created
      - Verify instrumental file is created
      - Verify files are playable

[ ] 6.5 CRITICAL: Alignment test
      - Play vocal stem
      - Play instrumental stem simultaneously
      - Verify they are perfectly in sync (no timing drift)
      - Acceptable drift: < 10ms

[ ] 6.6 Integration test
      - Verify stems work with YouTube sync playback
      - Verify artifacts saved to database
      - Verify version_tag = "UVR-MDX-NET-Inst_Main"
```

---

## Code Templates

### Adapter Template (server/splitter/uvr-mdx-net-adapter.js)
```javascript
import { exec, spawn } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs-extra';
import { Storage } from '../downloader/storage.js';

const execAsync = util.promisify(exec);

const VENV_PYTHON = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');
const FFMPEG_DIR = 'C:\\Users\\donald clark\\AppData\\Roaming\\Youka Desktop\\youka\\data\\binaries\\ffmpeg';
const FFMPEG_PATH = path.join(FFMPEG_DIR, 'ffmpeg.exe');

export class UVRMDXNetAdapter {
    constructor() {
        this.name = 'uvr-mdx-net';
    }

    async checkHealth() {
        // TODO: Implement - verify audio_separator with ONNX support
    }

    async separate(jobId, inputPath, options, onProgress) {
        // TODO: Implement following the pattern in demucs-adapter.js
        // CRITICAL: Pre-convert to 44.1kHz WAV first!
    }
}
```

### Frontend Dropdown Addition
```jsx
<option value="uvr-mdx-inst-main">UVR MDX Inst Main</option>
```

### Model Routing Logic
```javascript
function getAdapterForModel(modelId) {
    const id = modelId.toLowerCase();
    if (id.includes('uvr-mdx') || id === 'uvr-mdx-inst-main') {
        return adapters.uvrMdxNet;
    }
    // ... existing routing
}
```

---

## Verification Commands

Run these after implementation to verify correctness:

```bash
# 1. Check adapter health
curl http://localhost:3001/split/health

# 2. Start a split job
curl -X POST http://localhost:3001/split/start \
  -H "Content-Type: application/json" \
  -d '{"source":{"inputPath":"path/to/audio.mp3"},"songId":"test","modelId":"uvr-mdx-inst-main","stems":2}'

# 3. Check job status
curl http://localhost:3001/split/status/{jobId}
```

---

## Rollback Instructions

If implementation fails or causes issues:

1. Delete `server/splitter/uvr-mdx-net-adapter.js`
2. Revert changes to `server/splitter/index.js`
3. Revert changes to `src/components/karaoke-designs/IntegratedEcologicalOS.jsx`
4. Restart server

No database changes to revert.

---

## Success Criteria

Implementation is complete when ALL of the following are true:

- [ ] UVR-MDX-NET-Inst_Main appears in splitter dropdown
- [ ] Selecting it correctly routes to UVR adapter
- [ ] 4-stem option is disabled when UVR is selected
- [ ] Separation produces vocal and instrumental stems
- [ ] Stems have NO alignment/timing issues (< 10ms drift)
- [ ] Stems sync with YouTube playback
- [ ] Job progress displays in UI
- [ ] Artifacts saved with correct version_tag
- [ ] No regressions in existing splitter functionality

---

**BEGIN IMPLEMENTATION BY READING THE FULL PLAN AT:**
`IMPLEMENTATION_PLAN_UVR_MDX_NET.md`
