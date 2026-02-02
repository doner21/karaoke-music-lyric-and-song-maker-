# Lyrics Orchestration System - Overview

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER REQUEST                                  │
│         "Get lyrics for 'Blinding Lights' by The Weeknd"        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PLANNER AGENT                               │
│  • Analyzes request                                              │
│  • Determines source strategy (sequential/parallel)              │
│  • Creates execution plan with fallbacks                         │
│  • Defines validation criteria                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ YAML Plan
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXECUTOR AGENT                               │
│  • Executes plan steps in order                                  │
│  • Calls lyrics sources (Genius → AZLyrics)                     │
│  • Creates new tools if existing tools fail                      │
│  • Aggregates results from all sources                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Lyrics Results
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     VERIFIER AGENT                               │
│  • Validates lyrics quality                                      │
│  • Compares multiple sources                                     │
│  • Detects anomalies (wrong song, truncation, etc.)             │
│  • Makes final recommendation                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Verified Result
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    KARAOKE SYSTEM                                │
│  • Stores lyrics in database                                     │
│  • Sends to alignment engine (AudioShake)                       │
│  • Renders in KaraokeLyricsDisplay                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Communication Protocol

### Message Format
All inter-agent communication uses this structure:

```yaml
message:
  from: "{planner|executor|verifier}"
  to: "{planner|executor|verifier|system}"
  type: "{plan|execution_report|verification_report|feedback}"
  timestamp: "ISO-8601"
  payload:
    # Type-specific content
```

### Flow Sequence

```
1. USER → SYSTEM: "Get lyrics for X"

2. SYSTEM → PLANNER: Initialize with request

3. PLANNER → EXECUTOR:
   {
     type: "plan",
     payload: { plan_id, execution_steps, validation_criteria }
   }

4. EXECUTOR → VERIFIER:
   {
     type: "execution_report",
     payload: { plan_id, results[], tools_created[] }
   }

5. VERIFIER → SYSTEM:
   {
     type: "verification_report",
     payload: { recommendation, quality_scores, warnings }
   }

6. VERIFIER → PLANNER (feedback loop):
   {
     type: "feedback",
     payload: { plan_effectiveness, suggestions }
   }

7. VERIFIER → EXECUTOR (feedback loop):
   {
     type: "feedback",
     payload: { tool_performance, cleaning_requirements }
   }

8. SYSTEM → USER: Final result with options
```

---

## Invoking the System

### Standard Request (Sequential Strategy)
```javascript
const result = await lyricsOrchestrator.fetch({
  artist: "The Weeknd",
  title: "Blinding Lights",
  strategy: "sequential",  // Genius first, then backups
  saveToDatabase: true
});
```

### Request with All Sources (Comparison)
```javascript
const result = await lyricsOrchestrator.fetch({
  artist: "Led Zeppelin",
  title: "Stairway to Heaven",
  strategy: "parallel",  // Fetch from all, compare
  returnAllSources: true,
  saveToDatabase: false  // Let user choose first
});
```

### Request After Genius Failure
```javascript
const result = await lyricsOrchestrator.fetch({
  artist: "Ben Folds Five",
  title: "Underground",
  strategy: "backup_only",  // Skip Genius
  skipSources: ["genius"],
  saveToDatabase: true
});
```

### Request with User Choice
```javascript
// After Genius returns, user wants to see alternatives
const alternatives = await lyricsOrchestrator.fetchAlternatives({
  existingSource: "genius",
  existingLyrics: currentLyrics,
  artist: "The Weeknd",
  title: "Blinding Lights"
});

// Returns comparison with AZLyrics
```

---

## Gemini IDE Integration

### System Instructions for Antigravity

When setting up in Google's Gemini IDE (antigravity), use these system instructions:

```
You are a lyrics orchestration system with three specialized modes:

MODE: PLANNER
When user says "plan lyrics fetch for [song]":
- Activate Planner Agent persona
- Analyze the request
- Output a YAML execution plan
- Use prompt: @planner-agent.md

MODE: EXECUTOR
When user says "execute plan [plan_id]" or receives a plan:
- Activate Executor Agent persona
- Follow the plan steps
- Create tools if needed
- Output execution report
- Use prompt: @executor-agent.md

MODE: VERIFIER
When user says "verify results" or receives execution report:
- Activate Verifier Agent persona
- Validate all lyrics
- Compare sources
- Output recommendation
- Use prompt: @verifier-agent.md

Default behavior: Run all three modes in sequence automatically.
```

### Example Conversation Flow

```
USER: Get lyrics for "Bohemian Rhapsody" by Queen

PLANNER:
Creating plan PLN-1706382000...

Plan Summary:
- Strategy: direct
- Source: AZLyrics only
- Fallback: None (single source mode)

[Outputs full YAML plan]

EXECUTOR:
Executing plan PLN-1706382000...

Step 1: Fetch from AZLyrics
  ✓ AZLyrics: 2,901 chars (4.8s)

[Outputs full execution report]

VERIFIER:
Verifying AZLyrics result...

Quality Score: 97/100 ✓
- Complete lyrics detected
- No truncation
- Clean text (minimal metadata)

Recommendation: AZLyrics result verified and ready.

[Outputs full verification report]

Result saved to database with source: 'AZLyrics'
```

---

## Error Recovery Scenarios

### Scenario: All Sources Fail
```yaml
EXECUTOR → VERIFIER:
  status: ALL_FAILED
  attempted: ["genius", "azlyrics"]
  errors:
    genius: "404 - Song not found"
    azlyrics: "403 - Blocked"

VERIFIER → SYSTEM:
  recommendation: MANUAL_ENTRY_REQUIRED
  suggestions:
    - "Try alternative song title"
    - "Check if song is instrumental"
    - "Song may not exist in databases"

SYSTEM → USER:
  "Unable to find lyrics automatically. Options:
   1. Try different search terms
   2. Enter lyrics manually
   3. Mark as instrumental"
```

### Scenario: Wrong Song Detected
```yaml
VERIFIER:
  status: WRONG_SONG_DETECTED
  requested: "Wonderwall - Oasis"
  detected: "Wonderwall - Ryan Adams (cover)"
  confidence: 85%

  action: REJECTED
  suggestion: "Re-search with exact artist match"

VERIFIER → PLANNER:
  feedback:
    issue: "Artist disambiguation needed"
    suggestion: "Add 'original' or 'Oasis' to query"
```

### Scenario: Tool Creation Required
```yaml
EXECUTOR:
  step: 3
  tool: azlyrics_scrape
  status: FAILED (403 Forbidden)

  action: CREATING_NEW_TOOL
  new_tool: azlyrics_scrape_v2
  changes:
    - Added user-agent rotation
    - Added request delays
    - Added referrer header

  retry_status: SUCCESS

EXECUTOR → VERIFIER:
  tools_created:
    - name: azlyrics_scrape_v2
      reason: "Original blocked by Cloudflare"
      status: VERIFIED_WORKING
```

---

## File Structure

```
/server/agents/
├── prompts/
│   ├── planner-agent.md      # Planner system prompt
│   ├── executor-agent.md     # Executor system prompt
│   ├── verifier-agent.md     # Verifier system prompt
│   └── orchestration-system.md  # This file
│
├── services/
│   ├── lyrics/
│   │   ├── genius.js         # Existing Genius integration
│   │   ├── azlyrics.js       # AZLyrics integration (backup)
│   │   └── index.js          # Unified lyrics service
│   │
│   └── orchestrator.js       # Agent orchestration logic
│
└── tools/
    └── generated/            # Executor-created tools stored here
        └── azlyrics_scrape_v2.js
```

---

## Quick Reference

| Agent | Input | Output | Key Capability |
|-------|-------|--------|----------------|
| Planner | User request | YAML execution plan | Strategy design |
| Executor | YAML plan | Lyrics results + report | Tool creation |
| Verifier | Lyrics results | Recommendation | Quality assurance |

| Source | Type | Auth | Rate Limit | Quality |
|--------|------|------|------------|---------|
| Genius | API + Scrape | Bearer token | 5/sec | Excellent (primary) |
| AZLyrics | Scrape | None | Be gentle | Good (backup) |

| Strategy | When to Use |
|----------|-------------|
| sequential | Default - try Genius first, then AZLyrics |
| azlyrics_only | User wants AZLyrics specifically or Genius failed |
| compare | User wants to see both sources side by side |
