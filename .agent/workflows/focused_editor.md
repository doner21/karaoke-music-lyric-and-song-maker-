ROLE

You are implementing a Word-Level Karaoke Lyrics Timing Editor inside an already-existing Karaoke Creator app. The main UI already exists. Add a focused “Edit Mode” that opens the editor panel/modal/view. Prioritize correctness, reversibility, and sync across audio + timeline + JSON.

\========================

1) NON-NEGOTIABLE INVARIANTS

\========================

I1 — Single Source of Truth Timeline

\- There is exactly one authoritative playhead time (t\_ms).

\- Any seek/scrub updates t\_ms, which drives:

(a) vocal audio position

(b) band audio position

(c) active word highlighting + lyric preview

\- No independent timers may drift; all components subscribe to the same timeline state.

I2 — Deterministic JSON Roundtrip

\- Import JSON -> internal model -> export JSON must be stable:

\- Exported JSON is valid, loadable, and reproduces the same word timings (within rounding tolerance).

\- No silent schema corruption.

\- Define explicit adapters:

\- parseJSONToTokens()

\- tokensToExportJSON()

I3 — Word Token Well-Formedness

For every token:

\- start\_ms < end\_ms

\- minDurationMs enforced (configurable)

\- text is non-empty unless explicitly allowed as placeholder (then must be flagged)

\- tokens have stable ids (no accidental id churn on small edits)

I4 — Ordering + Overlap Policy is Explicit

\- The editor MUST define whether overlaps are allowed.

\- Default: no overlaps (enforced or warned).

\- If overlaps allowed: must be intentional (toggle), visible (warning color), and preserved on export.

I5 — Audio Reference Hierarchy (“Vocal Lab”)

\- Vocal stem is primary alignment reference for word boundaries.

\- Band stem is contextual; it must not override vocal alignment decisions.

\- Playback must support vocal-only audition around selection (pre-roll/post-roll) for micro alignment.

I6 — Undo/Redo Completeness

\- Every user edit action that changes model state must be undoable/redone:

\- move, resize start/end, edit text, insert, delete, split, merge, line break, ripple operations, snap changes (if they alter state)

\- Undo/redo must be deterministic and not degrade performance over long sessions.

I7 — Responsiveness Under Load

\- Must handle long songs and many tokens without freezing.

\- UI render must not block playback; editor interactions cannot stall audio thread.

I8 — Export Must Never “Do Nothing”

\- Export JSON / Export MP3 must provide either:

\- a successful file result, OR

\- a visible error with cause + recovery steps.

\- No silent failures.

I9 — Mode Containment

\- Edit Mode is a contained subsystem:

\- entering/exiting does not break the broader karaoke creator state

\- editor changes are applied to the current song/project explicitly (save/apply) with clear state.

\========================

2) WHERE CONSTRAINTS MAY LIE

\========================

C1 — Data Model Constraints (hard)

\- Token validity: start/end ordering, min duration, track bounds

\- Schema adapter correctness

\- Stable ids

These must be enforced at the model layer (not only in UI).

C2 — Timeline/Audio Sync Constraints (hard)

\- One playhead state

\- Audio engines must follow timeline

\- Seeking must be sample-accurate as practical; define acceptable tolerance (e.g. <= 20ms).

C3 — UI Interaction Constraints (soft-to-hard boundary)

\- Drag, resize, snap, nudges, multi-select

UI may be flexible in implementation, but must map cleanly to model transforms.

C4 — Performance Constraints (hard)

\- Rendering must scale (virtualize token rows if needed).

\- Waveform draw must not stutter playback.

\- Any analysis (waveform generation) runs async without blocking interaction.

C5 — Workflow Constraints (soft)

\- Where “Save/Apply” sits, whether auto-save exists, exact layout.

LLM can decide, but must preserve invariants and pass verification.

C6 — Overlap/Ripple/Snap Policies (explicit toggles)

\- Ripple: Off by default unless stated, but must exist if specified.

\- Snap: optional, but if implemented must be predictable and disable-able.

\========================

3) REQUIRED FEATURES (minimum product)

\========================

F1 Edit Mode entry

\- Button/toggle opens editor view

\- Exit returns to main app without state loss

F2 Imports

\- Import JSON timing file

\- Import vocal stem audio

\- Import band stem audio

\- Validate duration mismatch and warn (do not crash)

F3 Waveform + Transport

\- Vocal waveform visible (primary)

\- Band waveform optional (secondary)

\- Play/Pause/Stop

\- Scrub/seek bar (sync audio+words)

\- Playback rate: at least 0.5x and 1.0x

\- Loop region (in/out)

F4 Word Box Editing

\- Select (single, multi, marquee)

\- Move (drag whole box)

\- Resize (drag edges)

\- Nudge (small & large steps)

\- Edit text inline

\- Insert before/after

\- Delete

\- Split token

\- Merge tokens

F5 Vocal Lab Audition Tools

\- Play around selection with pre-roll/post-roll

\- Loop selected token or selection range

\- Play from selection start

F6 Exports

\- Export JSON (updated timings)

\- Copy JSON

\- Export MP3:

\- vocal stem mp3

\- band stem mp3

\- mixed mp3 (if mixing supported)

\- Flexible naming template

F7 Undo/Redo

\- Full coverage across all edits

\========================

4) MODEL TRANSFORMS (must be pure + testable)

\========================

Implement these as pure functions with unit tests:

T1 moveTokens(tokens, selectionIds, deltaMs, policy)

T2 resizeTokenStart(tokens, tokenId, newStartMs, policy)

T3 resizeTokenEnd(tokens, tokenId, newEndMs, policy)

T4 nudgeTokens(tokens, selectionIds, stepMs, policy)

T5 editTokenText(tokens, tokenId, newText)

T6 insertToken(tokens, anchorTokenId, positionBeforeAfter, text, timingStrategy)

T7 deleteTokens(tokens, selectionIds, policy)

T8 splitToken(tokens, tokenId, splitTextLeftRight, splitPointStrategy)

T9 mergeTokens(tokens, tokenIdsInOrder, joinStrategy)

T10 validateTokens(tokens, trackDurationMs, overlapPolicy) -> issues\[\]

T11 applyRipple(tokens, fromTokenId, deltaMs, direction)

Policies must be explicit inputs (overlap allowed? ripple on? snap settings?), not hidden globals.

\========================

5) VERIFICATION CHECKLIST (Definition of Done)

\========================

A) Import/Load

\[ \] Import JSON succeeds on valid files and shows meaningful errors on invalid files

\[ \] Import vocal stem loads and duration is shown

\[ \] Import band stem loads and duration is shown

\[ \] If durations differ beyond tolerance, UI warns and disables “Apply” unless user overrides

B) Timeline + Sync

\[ \] Press Play: audio plays and playhead moves

\[ \] Scrub/seek: vocal + band + highlight move together

\[ \] Playhead -> active word highlight is stable and correct

\[ \] Tolerance test: seek to 10 random timestamps; active word matches token interval at those times

C) Word Edit Operations (each must mutate model and reflect in UI)

\[ \] Drag token: start/end both shift correctly

\[ \] Resize left edge: start changes, end fixed

\[ \] Resize right edge: end changes, start fixed

\[ \] Nudge small step works (e.g., 10ms)

\[ \] Nudge large step works (e.g., 100ms)

\[ \] Edit text inline commits and persists

\[ \] Insert token before/after creates valid timing

\[ \] Delete removes tokens and leaves model valid

\[ \] Split creates two tokens with correct union timing

\[ \] Merge creates one token spanning union timing

D) Constraints / Validity

\[ \] validateTokens catches:

\- start>=end

\- token outside track duration

\- overlaps (if disallowed)

\- empty text (if disallowed)

\[ \] Editor surfaces issues list with navigation to offending token(s)

\[ \] Cannot export invalid model unless user explicitly “force export” (optional)

E) Undo/Redo

\[ \] Every operation above is undoable/redone

\[ \] Undo restores selection + playhead sensibly (define expected behavior)

\[ \] Long session test: 200 edits does not degrade undo performance noticeably

F) Export

\[ \] Export JSON writes correct schema and reloads cleanly

\[ \] Copy JSON returns updated JSON

\[ \] Export MP3 (vocal/band/mix) produces playable file(s)

\[ \] Export never silently fails; errors are visible with actionable message

G) Integration / Mode

\[ \] Enter Edit Mode and exit without losing overall project state

\[ \] “Apply to song” updates existing karaoke playback engine inputs

\[ \] Returning to main playback uses edited timings correctly

H) Performance

\[ \] Token virtualization or equivalent keeps UI responsive with 5k+ tokens

\[ \] Waveform rendering does not stall playback (no major stutters)

\[ \] CPU usage acceptable during playback and editing (define threshold if available)

\========================

6) PLANNING CHECKLIST (what you must plan before coding)

\========================

P1 Identify current app architecture

\[ \] Where project/song assets are stored

\[ \] Where karaoke engine consumes JSON timings

\[ \] Existing audio engine/player layer and how to seek accurately

\[ \] Existing state management pattern (store/events)

P2 Define schema contract

\[ \] Confirm current JSON schema fields

\[ \] Implement adapter functions with tests

\[ \] Decide rounding rules (ms int? float?) and stick to them

P3 Define edit-mode integration contract

\[ \] How editor receives: (json, vocal, band, metadata)

\[ \] How editor returns: (updated json, updated assets?, version tag)

\[ \] When changes are applied (live vs apply button)

P4 Decide constraint policies

\[ \] Overlaps: allowed or not? default and UI toggle

\[ \] Ripple: default off, toggle exists

\[ \] Snap: optional, but if included define predictable behavior

\[ \] MinDurationMs and bounds behavior at edges

P5 Verify toolchain for exports

\[ \] MP3 export pipeline available (ffmpeg or library)

\[ \] Ensure export runs async with progress and error handling

DELIVERABLES

\- Edit Mode entry + editor view

\- Token model + transforms + validation

\- Audio/timeline sync layer

\- Import/export handlers (JSON + MP3)

\- Undo/redo stack

\- Tests for transforms + adapter + basic integration checks

\- Minimal usage docs + shortcut list