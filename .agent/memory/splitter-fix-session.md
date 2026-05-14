# Memory: Vocal Splitter Fix — Entry Point & Wrapper

**Date**: 2026-05-14
**Branch**: `fix/splitter-cli-entry-point`
**Session**: Fixed the vocal splitter pipeline for UVR-MDX-NET and audio-separator.

## Problem
Both the UVR-MDX-NET Inst Main splitter and Hybrid Real (Demucs) splitter were failing. The UVR adapter spawned `audio-separator.exe` which hit `spawn UNKNOWN` (errno -4094 on Windows). A secondary attempt to use `-m audio_separator.separator` failed because `audio_separator.separator` is a package without `__main__.py`.

## Root Cause
- `audio-separator.exe` is a pip-generated thin wrapper — unreliable when spawned from Node.js on Windows with modified PATH
- The correct Python CLI entry point is `audio_separator.utils.cli:main` (confirmed by `entry_points.txt`)
- That module lacks an `if __name__ == "__main__"` guard, so `-m audio_separator.utils.cli` silently exits

## Fix
1. **Created** `server/splitter/run_audio_separator.py` — a wrapper script that calls `from audio_separator.utils.cli import main; main()`
2. **Updated** `server/splitter/uvr-mdx-net-adapter.js` — changed from `spawn(AUDIO_SEPARATOR_EXE, ...)` to `spawn(VENV_PYTHON, ['-m', 'audio_separator.separator'], ...)` then to `spawn(VENV_PYTHON, [SEPARATOR_RUNNER, ...], ...)`
3. **Updated** `server/splitter/audio-separator-adapter.js` — same change
4. **Demucs adapter** — unchanged (uses `-m demucs` which works correctly)
5. **Reverted** venv modification — removed `if __name__ == "__main__"` from `venv/Lib/site-packages/audio_separator/utils/cli.py`

## Verification
- `python server/splitter/run_audio_separator.py --help` — prints usage, exits 0
- `python -c "from audio_separator.separator import Separator; print('OK')"` — imports OK
- All required CLI flags (--mdx_segment_size, --sample_rate, --output_format, --model_filename) supported
- No remaining `-m audio_separator.separator` references in JS files
- Graph updated: re-clustered to 294 communities; wiki regenerated (26 pages)

## Key Insight
The wrapper script approach (`run_audio_separator.py`) is permanent because it lives in the git-tracked project, not the venv. It survives branch switches, fresh clones, and venv rebuilds.
