# UVR Model Integration Guide

**Project:** karaoke-box  
**Last Updated:** January 24, 2026  
**Status:** Working - UVR-MDX-NET-Inst_Main implemented

---

## Overview

This document captures the complete integration process for UVR (Ultimate Vocal Remover) models using the `audio-separator` Python library. Use this as a reference when adding new UVR models.

---

## Architecture

```
Frontend                    Backend                     Python
┌─────────────────┐        ┌────────────────────┐      ┌─────────────────────┐
│ Dropdown Select │───────▶│ uvr-mdx-net-       │─────▶│ audio-separator.exe │
│ uvr-mdx-inst-   │        │ adapter.js         │      │ with ONNX model     │
│ main            │        │                    │      │                     │
└─────────────────┘        └────────────────────┘      └─────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `server/splitter/uvr-mdx-net-adapter.js` | Main adapter class |
| `server/splitter/index.js` | Routing logic (model → adapter) |
| `src/components/karaoke-designs/IntegratedEcologicalOS.jsx` | Frontend dropdown |

---

## Dependencies

### Required Python Packages
```bash
# Install audio-separator with CPU support
.\venv\Scripts\pip.exe install audio-separator[cpu]

# For GPU acceleration (REQUIRED for good performance)
.\venv\Scripts\pip.exe uninstall onnxruntime -y
.\venv\Scripts\pip.exe install onnxruntime-gpu
```

### PyTorch Compatibility
> ⚠️ **CRITICAL**: `audio-separator[cpu]` will replace your CUDA PyTorch with CPU-only version!

If Demucs breaks after installing audio-separator, restore PyTorch:
```bash
.\venv\Scripts\pip.exe install torch==2.5.1+cu121 torchaudio==2.5.1+cu121 torchvision==0.20.1+cu121 --index-url https://download.pytorch.org/whl/cu121
```

---

## Bug Fixes Applied

### Bug 1: Wrong CLI Invocation
**Symptom:** `No module named audio_separator.separator.__main__`

**Cause:** Cannot run `python -m audio_separator.separator`

**Fix:** Use the direct executable instead:
```javascript
// WRONG
const args = ['-m', 'audio_separator.separator', ...];
spawn(VENV_PYTHON, args, { env });

// CORRECT
const AUDIO_SEPARATOR_EXE = path.join(process.cwd(), 'venv', 'Scripts', 'audio-separator.exe');
spawn(AUDIO_SEPARATOR_EXE, args, { env });
```

---

### Bug 2: File Detection Excluding Output Files
**Symptom:** Job hangs at end, shows "No vocal or instrumental files produced"

**Cause:** UVR outputs files like:
```
input_canonical_(Vocals)_UVR-MDX-NET-Inst_Main.mp3
input_canonical_(Instrumental)_UVR-MDX-NET-Inst_Main.mp3
```

Detection was filtering out files containing "input_canonical":
```javascript
// WRONG - excludes the output files!
!lower.includes('input_canonical')

// CORRECT - only exclude the source WAV
lower !== 'input_canonical.wav'
```

---

### Bug 3: CPU Instead of GPU
**Symptom:** High CPU load, no GPU usage, slow processing

**Cause:** Only `onnxruntime` (CPU) installed, not `onnxruntime-gpu`

**Fix:**
```bash
.\venv\Scripts\pip.exe uninstall onnxruntime -y
.\venv\Scripts\pip.exe install onnxruntime-gpu
```

**Verify GPU support:**
```bash
.\venv\Scripts\python.exe -c "import onnxruntime as ort; print(ort.get_available_providers())"
# Should show: ['TensorrtExecutionProvider', 'CUDAExecutionProvider', 'CPUExecutionProvider']
```

---

## Adding New UVR Models

### Step 1: Add to Frontend Dropdown
```jsx
// IntegratedEcologicalOS.jsx, line ~1315
<option value="uvr-mdx-inst-main">UVR MDX Inst Main</option>
<option value="uvr-mdx-inst-hq-3">UVR MDX Inst HQ 3</option>  // NEW
```

### Step 2: Update Model Mapping (if needed)
```javascript
// uvr-mdx-net-adapter.js
let modelFilename = 'UVR-MDX-NET-Inst_Main.onnx';
const modelId = options.modelId?.toLowerCase() || '';
if (modelId.includes('hq_1') || modelId.includes('hq-1')) {
    modelFilename = 'UVR-MDX-NET-Inst_HQ_1.onnx';
} else if (modelId.includes('hq_3') || modelId.includes('hq-3')) {
    modelFilename = 'UVR-MDX-NET-Inst_HQ_3.onnx';
}
// ADD NEW MODELS HERE
```

### Step 3: Update Routing (if needed)
The routing in `index.js` uses pattern matching:
```javascript
const isUVRModel = (modelId) => {
    const id = modelId.toLowerCase();
    return id.includes('uvr-mdx') || id.includes('uvr_mdx') || id === 'uvr-mdx-inst-main';
};
```
Most new UVR models will match automatically.

---

## Available Models

List models with:
```bash
.\venv\Scripts\audio-separator.exe --list_models
```

Common MDX-Net models:
- `UVR-MDX-NET-Inst_Main.onnx` - Main instrumental model
- `UVR-MDX-NET-Inst_HQ_1.onnx` - High quality variant 1
- `UVR-MDX-NET-Inst_HQ_3.onnx` - High quality variant 3
- `UVR-MDX-NET-Inst_HQ_4.onnx` - High quality variant 4
- `UVR-MDX-NET-Inst_HQ_5.onnx` - High quality variant 5

---

## Testing

### Health Check
```bash
.\venv\Scripts\python.exe -c "from audio_separator.separator import Separator; print('OK')"
```

### Manual Separation Test
```bash
.\venv\Scripts\audio-separator.exe "test.wav" --model_filename "UVR-MDX-NET-Inst_Main.onnx" --output_dir "test_output"
```

### Verify Output Files
UVR creates files with pattern:
```
<input_basename>_(Vocals)_<model_name>.mp3
<input_basename>_(Instrumental)_<model_name>.mp3
```

---

## Constraints

| Constraint | Description |
|------------|-------------|
| 2-stem only | UVR-MDX-NET models output only vocals + instrumental |
| 4-stem disabled | When UVR selected, 4-stem button is disabled in UI |
| Auto-download | ONNX models download automatically on first use (~100MB each) |

---

## Alignment Critical

**Pre-convert all audio to 44.1kHz WAV before separation:**
```javascript
await execAsync(`"${FFMPEG_PATH}" -y -i "${inputPath}" -ar 44100 -ac 2 "${wavPath}"`);
```
This ensures consistent timing between vocal and instrumental stems.
