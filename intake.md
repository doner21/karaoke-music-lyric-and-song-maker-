# Intake: Full Splitter Verification Sweep (CPU + GPU)

**Date**: 2026-05-14
**Branch**: `fix/splitter-cli-entry-point`
**Workflow**: NenFlow PEV — Researcher → Planner → Executor (no Verifier)

---

## Current State

The vocal splitters have been fixed:

| Component | Status |
|-----------|--------|
| `uvr-mdx-net-adapter.js` | Uses `SEPARATOR_RUNNER` wrapper script |
| `audio-separator-adapter.js` | Uses `SEPARATOR_RUNNER` wrapper script |
| `server/splitter/run_audio_separator.py` | Wrapper calling `audio_separator.utils.cli.main()` |
| Demucs adapter | Unchanged, known-working |
| `venv/Lib/.../cli.py` | Reverted to original (no venv modifications) |

All changes are committed and tracked in git. The wrapper script is permanent — survives venv rebuilds and branch switches.

## What Needs Verification

1. **UVR-MDX-NET (Inst Main) on CPU** — split an audio file, verify vocals + instrumental stems are produced
2. **UVR-MDX-NET (Inst Main) on GPU** — same test with CUDA (if available)
3. **Demucs (htdemucs) on CPU** — regression test, verify still works
4. **Demucs (htdemucs) on GPU** — regression test with CUDA (if available)
5. **Full server integration** — start server, submit split job, poll status, verify output

## Success Criteria

- Real audio file passes through the full pipeline: download → pre-convert → split → output stems
- Vocals stem file exists, non-zero, playable
- Instrumental/band stem file exists, non-zero, playable
- No errors in server logs
- Progress callbacks fire throughout
- GPU path tested if CUDA available (skip otherwise with note)

## Workflow

1. **Researcher** — verify current codebase state, confirm no regressions, check GPU availability
2. **Planner** — produce structured test plan with exact commands and verification points
3. **Executor** — run all tests, iterate until passing, build real-world validation

**No Verifier** — Executor self-verifies with real tests against the actual splitter.
