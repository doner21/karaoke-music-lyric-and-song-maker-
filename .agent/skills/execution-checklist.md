# Executor Agent: Cycle 002 Execution Checklist

## Pre-Execution

- [ ] Read `ag_ide_cycles/cycle_002/plan.md` completely
- [ ] Read all skill files in `.agent/skills/` for reference
- [ ] Understand the existing codebase structure (especially `IntegratedEcologicalOS.jsx`)

## Execution Order

Execute phases in order. Do NOT skip ahead.

### Phase A: Test Infrastructure
- [ ] Step 1: `npm install --save-dev vitest`
- [ ] Step 2: Create `vitest.config.js`
- [ ] Step 3: Add test scripts to `package.json`
- [ ] Verify: `npx vitest run` exits cleanly

### Phase B: Token Data Model + Transforms
- [ ] Step 4: Create `src/editor/tokenModel.js`
- [ ] Step 5-6: Define Policy and ValidationIssue shapes in tokenModel.js
- [ ] Step 7-9: Create `src/editor/jsonAdapters.js`
- [ ] Step 10-20: Create `src/editor/tokenTransforms.js` (all 11 functions)
- [ ] Step 21: Create `src/editor/__tests__/tokenTransforms.test.js`
- [ ] Step 22: Create `src/editor/__tests__/jsonAdapters.test.js`
- [ ] Verify: `npx vitest run` — all transform + adapter tests pass

### Phase C: Undo/Redo
- [ ] Step 23: Create `src/editor/undoStack.js`
- [ ] Step 24: Create `src/editor/__tests__/undoStack.test.js`
- [ ] Verify: `npx vitest run` — all tests pass including undo stack

### Phase D: React Hook
- [ ] Step 25-28: Create `src/editor/useTokenEditor.js`
- [ ] Note: No tests for the hook in this cycle (it requires React rendering context)

### Phase E: Editor UI Components
- [ ] Step 29-33: Modify `IntegratedEcologicalOS.jsx` (edit mode integration)
- [ ] Step 34-35: Create `src/components/editor/TokenEditorPanel.jsx`
- [ ] Step 36-41: Create `src/components/editor/TokenTimeline.jsx`
- [ ] Step 42-43: Create `src/components/editor/TokenBlock.jsx`
- [ ] Step 44: Create `src/components/editor/InlineTextEditor.jsx`
- [ ] Step 45: Create `src/components/editor/ValidationPanel.jsx`
- [ ] Step 46: Create `src/components/editor/TokenContextMenu.jsx`

### Phase F: Import/Export UI
- [ ] Step 47-49: Add Import/Export/Copy JSON buttons to TokenEditorPanel

## Post-Execution

- [ ] Run `npx vitest run` — ALL tests pass
- [ ] Run `npm run build` — no build errors
- [ ] Create `ag_ide_cycles/cycle_002/execution.md` with full report
- [ ] Document any deviations from the plan in "Issues Encountered"

## Key Reminders

1. **Do NOT modify files outside the plan** — preserve existing code
2. **Follow existing conventions** — Tailwind CSS, lucide-react icons, hook-based state
3. **All transforms must be pure functions** — no side effects, no mutations
4. **Use crypto.randomUUID() for token IDs** — stable across edits
5. **Internal times in milliseconds (integer)** — convert at JSON boundaries only
6. **JSON schema times in seconds (float)** — match existing canonical format
7. **The editor operates on a deep clone** — never mutate parent state directly
8. **Audio/waveform is OUT OF SCOPE** — stub interfaces but don't implement
