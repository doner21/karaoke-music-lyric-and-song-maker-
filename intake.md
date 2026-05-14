# Intake: Vocal Splitters — Correct Python Entry Point Discovery

**Date**: 2026-05-14
**Status**: INTAKE — requires Research → Plan → Execute workflow
**Severity**: HIGH — splitters non-functional, core pipeline blocked

---

## Problem

The UVR-MDX-NET splitter (and potentially Demucs/Hybrid Real) fails at the Python invocation level.
After fixing the `spawn UNKNOWN` error (`.exe` wrapper → `python.exe -m`), the new error is:

```
No module named audio_separator.separator.__main__
'audio_separator.separator' is a package and cannot be directly executed
```

## Root Hypothesis

The `-m audio_separator.separator` invocation is wrong — `audio_separator.separator` is a **package** (directory with `__init__.py`), not a runnable module with `__main__`. The correct entry point module or script needs to be discovered.

The fix was previously solved in an earlier branch before a "cleanup refactor". Git history of main/previous branches may contain the correct invocation pattern.

## What Success Looks Like

- Both UVR-MDX-NET (Inst Main) and Demucs (Hybrid Real) splitters successfully separate vocals from band stems
- Works on CPU and GPU
- Nothing else in the app is affected
- Verified with real-world test (actual split job)

## Workflow

This uses the NenFlow v3 PEV workflow:
1. **Researcher** — investigate codebase, git history, Python package structure to find correct entry point
2. **Planner** — produce structured plan with invariants and success criteria
3. **Executor** — implement fix with real-world tests to verify CPU + GPU splitting works

**Verifier is NOT required** — the Executor will verify via real-world tests.

## Key Artifacts to Investigate

- `server/splitter/uvr-mdx-net-adapter.js` — the failing adapter
- `server/splitter/demucs-adapter.js` — may have similar issues
- `venv/Lib/site-packages/audio_separator/` — Python package structure
- `venv/Scripts/audio-separator.exe` — what does the wrapper actually run?
- Git history: `git log --all -- server/splitter/` for previous fixes
- The `audio-separator-adapter.js` fallback adapter — it also references `audio_separator.separator`

## Constraints

- Must not break Demucs path
- Must work on Windows (PATH, spawn, environment quirks)
- Must preserve all existing functionality: progress reporting, output file discovery, timeout, error handling
