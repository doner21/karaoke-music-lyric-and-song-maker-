# Antigravity IDE Handoff Contract

This document serves as the source of truth for the Planner → Executor → Verifier orchestration system.

## Directory Structure

All cycle artifacts are stored in `ag_ide_cycles/`.
The current system status is maintained in `AG_IDE_STATUS.md` in the root directory.

```
/
├── AG_IDE_Contract.md       # This file
├── AG_IDE_STATUS.md         # Current system status and cycle pointer
└── ag_ide_cycles/
    ├── cycle_001/
    │   ├── plan.md          # Output from Planner
    │   ├── execution.md     # Output from Executor
    │   └── verification.md  # Output from Verifier
    └── ...
```

## Cycle Protocol

### 1. Planner
*   **Input**: `AG_IDE_STATUS.md`, previous `verification.md`, usage of `task.md` (Agentic).
*   **Action**: Analyze requirements, create a step-by-step plan.
*   **Output**: 
    *   Create directory `ag_ide_cycles/cycle_NNN/`.
    *   Write `ag_ide_cycles/cycle_NNN/plan.md`.
    *   Content must include: Goals, Constraints, Steps, Acceptance Criteria, DoD.
    *   Update `AG_IDE_STATUS.md` to `Step: Execution`, `Cycle: NNN`.

### 2. Executor
*   **Input**: `ag_ide_cycles/cycle_NNN/plan.md`.
*   **Action**: Execute the plan using tools.
*   **Output**:
    *   Perform code changes.
    *   Write `ag_ide_cycles/cycle_NNN/execution.md`.
    *   Content must include: Changes made, files touched, commands run.
    *   Update `AG_IDE_STATUS.md` to `Step: Verification`, `Cycle: NNN`.

### 3. Verifier
*   **Input**: `plan.md`, `execution.md`, current codebase.
*   **Action**: Verify changes against Acceptance Criteria.
*   **Output**:
    *   Write `ag_ide_cycles/cycle_NNN/verification.md`.
    *   Content must include: Pass/Fail status for each criterion, Evidence.
    *   **If FAIL**: Update `AG_IDE_STATUS.md` to `Step: Planning`, `Cycle: NNN+1` (Next cycle to fix).
    *   **If PASS**: Update `AG_IDE_STATUS.md` to `Step: Complete`, `Cycle: DONE`. Write `verified-complete` signal file in `ag_ide_cycles/cycle_NNN/`.

## Termination
The loop terminates when `AG_IDE_STATUS.md` reports `Step: Complete`.

## Signals
*   **Completion**: Presence of `ag_ide_cycles/cycle_NNN/verified-complete` AND `AG_IDE_STATUS.md` status.
