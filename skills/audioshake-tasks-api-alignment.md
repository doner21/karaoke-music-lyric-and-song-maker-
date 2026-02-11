# Skill: AudioShake Tasks API — Lyrics Alignment Integration

## Purpose
Integrate AudioShake's **Tasks API v2** for lyrics-to-audio alignment (word-level timestamp synchronization). This skill covers alignment-only mode — providing pre-existing lyrics text to skip automatic transcription.

## When to Use
- Building karaoke, subtitle, or lyric sync features that need word-level timestamps
- Migrating from AudioShake's Legacy API (`/upload/`, `/job`) to the Tasks API (`/assets`, `/tasks`)
- Aligning known lyrics text against an audio file (not transcribing)

---

## API Reference

**Base URL:** `https://api.audioshake.ai`
**Auth:** `x-api-key: <your-key>` header on ALL requests
**Key format:** `ashke_...` (generated from AudioShake Dashboard → Settings → API Keys)
**Docs:** https://developer.audioshake.ai

> **CRITICAL:** Legacy JWT tokens (`eyJhbG...`) do NOT work with the Tasks API. You must generate a new key from the dashboard. Legacy keys used `Authorization: Bearer` — the Tasks API uses `x-api-key`.

---

## Complete Flow

### Step 1: Upload Audio Asset
```
POST /assets
Content-Type: multipart/form-data
x-api-key: <key>

Field: "file" = <audio file (mp3, wav, flac, m4a, ogg, webm)>
```
**Response:**
```json
{ "id": "cmlh8sfr3052301oi2zh23zmy", ... }
```
Assets expire after 72 hours.

### Step 2: Upload Transcript Asset
Upload the lyrics as a **plain text `.txt` file** (not JSON-wrapped).

```
POST /assets
Content-Type: multipart/form-data
x-api-key: <key>

Field: "file" = <lyrics.txt>
```
**Response:**
```json
{ "id": "cmlh8sq5405b401pxg6h19yqp", ... }
```

> **IMPORTANT:** Write lyrics as plain text, not `{"text": "..."}` JSON. The Tasks API expects a raw transcript file.

### Step 3: Create Alignment Task
```
POST /tasks
Content-Type: application/json
x-api-key: <key>
```
**Request body:**
```json
{
  "assetId": "<audio-asset-id>",
  "targets": [
    {
      "model": "alignment",
      "formats": ["json"],
      "transcriptAssetId": "<transcript-asset-id>",
      "language": "en"
    }
  ]
}
```

**Key fields in target:**
| Field | Required | Description |
|-------|----------|-------------|
| `model` | Yes | Must be `"alignment"` |
| `formats` | Yes | Array: `["json"]`, `["srt"]`, `["txt"]`, or combination |
| `transcriptAssetId` | Yes* | ID of uploaded transcript. Providing this **skips transcription** |
| `transcriptUrl` | Alt* | Public URL to transcript (alternative to transcriptAssetId) |
| `language` | No | Improves accuracy when specified (e.g., `"en"`) |

*Provide either `transcriptAssetId` or `transcriptUrl`, not both. If neither is provided, AudioShake will auto-transcribe first (costs more credits and is not alignment-only).

**Response:**
```json
{ "id": "cmlh8sqrb002y7f6creefs7lw", "createdAt": "...", "targets": [...] }
```

### Step 4: Poll Task Status

```
GET /tasks/<task-id>
x-api-key: <key>
```

**CRITICAL RESPONSE STRUCTURE — Status is nested inside `targets[0]`, NOT at the top level:**

```json
{
  "id": "cmlh8sqrb002y7f6creefs7lw",
  "createdAt": "2026-02-10T23:39:02.134Z",
  "clientId": "clten6pzh0idgoe90vh408kp3",
  "assetId": "cmlh8sfr3052301oi2zh23zmy",
  "targets": [
    {
      "id": "cmlh8sqrb002z7f6c5a15hnkd",
      "model": "alignment",
      "status": "processing",
      "formats": ["json"],
      "output": [],
      "cost": 4,
      "duration": 196.88,
      "language": "en",
      "transcriptAssetId": "cmlh8sq5405b401pxg6h19yqp"
    }
  ]
}
```

**Status location:** `response.targets[0].status`
**Output location:** `response.targets[0].output`

> **GOTCHA:** `response.status` is `undefined`. This is the #1 migration pitfall. The Tasks API nests per-target status because a single task can have multiple targets.

**Status values:**
| Tasks API Status | Meaning |
|-----------------|---------|
| `"queued"` | Waiting to start |
| `"pending"` | Waiting to start |
| `"processing"` | In progress |
| `"completed"` | Done — outputs available |
| `"succeeded"` | Done — outputs available |
| `"failed"` | Error occurred |

### Step 5: Fetch Results

When `targets[0].status === "completed"`, the `targets[0].output` array contains download links:

```json
{
  "output": [
    {
      "name": "alignment.json",
      "format": "json",
      "link": "https://...",
      "type": "json"
    }
  ]
}
```

Fetch the JSON from the `link` URL. The result contains word-level alignment data with timestamps.

---

## Legacy API → Tasks API Migration Cheat Sheet

| Aspect | Legacy API | Tasks API v2 |
|--------|-----------|-------------|
| **Auth header** | `Authorization: Bearer <jwt>` | `x-api-key: <ashke_...>` |
| **Upload endpoint** | `POST /upload/` | `POST /assets` |
| **Job creation** | `POST /job` | `POST /tasks` |
| **Transcript passing** | `otherSourceAssets: [{id, type: "transcription"}]` | `targets[0].transcriptAssetId` |
| **Job metadata** | `metadata: {format, name: "alignment"}` | `targets: [{model: "alignment", formats: [...]}]` |
| **Callback URL** | Required (could be dummy) | Not needed |
| **Status polling** | `GET /job/<id>/` → `response.status` | `GET /tasks/<id>` → `response.targets[0].status` |
| **Output location** | `response.outputAssets` | `response.targets[0].output` |
| **Transcript format** | JSON: `{"text": "..."}` as `.json` file | Plain text as `.txt` file |
| **Key format** | JWT (`eyJhbG...`) | Dashboard key (`ashke_...`) |

---

## Constraints & Invariants

1. **Alignment only** — Always provide `transcriptAssetId` or `transcriptUrl`. Never omit both (that triggers auto-transcription, which is a different model and costs more).
2. **Lyrics are required** — Reject empty/missing lyrics before making API calls.
3. **No transcription fallback** — If alignment-only is the goal, fail fast when no lyrics are provided rather than falling back to transcription.
4. **Asset expiration** — Uploaded assets expire after 72 hours. Don't cache asset IDs across sessions.
5. **Credit cost** — Alignment: 1 credit/minute. Transcription+Alignment combined: 1.5 credits/minute.
6. **Max duration** — 1 hour per task (alignment model).
7. **Rate limiting** — Poll no faster than every 2 seconds.

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Invalid Token. Path requires valid client token: /assets` | Using legacy JWT key with new endpoint | Generate new `ashke_...` key from dashboard |
| `400 Insufficient credits` | Account balance depleted | Purchase credits on dashboard |
| Poll hangs forever (status never changes) | Reading `data.status` instead of `data.targets[0].status` | Read status from `targets[0].status` |
| Task completes on dashboard but not in code | Same as above — polling reads wrong field | Fix status extraction path |

---

## Node.js Reference Implementation

See `server/alignment/audioshake-adapter.js` for a complete working implementation including:
- Multipart file upload via Node.js `https` module
- Plain text transcript upload
- Task creation with alignment target
- Polling with correct `targets[0]` status extraction
- Result JSON fetching from output links

**Adapter interface:**
```javascript
class AudioShakeAdapter {
  constructor(apiKey)                                    // x-api-key value
  async checkHealth() → {available, error?}              // GET /assets
  async submitAlignment({audioPath, lyricsText}) → taskId // Upload + POST /tasks
  async poll(taskId) → {state, progress, result?, error?} // GET /tasks/{id}
  async cancel(taskId) → boolean                          // Soft cancel
  async uploadAsset(filePath) → assetId                   // POST /assets (multipart)
  async uploadLyricsAsset(text) → assetId                 // Write .txt → uploadAsset
  async fetchResult(outputs) → json                       // GET output[].link
}
```
