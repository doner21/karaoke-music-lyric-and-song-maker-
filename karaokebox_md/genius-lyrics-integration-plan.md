# Genius Lyrics API Integration Plan

## Overview
Integrate Genius API to fetch lyrics automatically when a song is selected, using the existing lyrics infrastructure.

---

## Architecture Fit

Your app already has:
- **`lyrics` table** with `source` field supporting `'manual'|'scrape'|'import'`
- **Song title parsing** that extracts artist/title from YouTube titles
- **Server-proxy pattern** for all API calls (frontend → Express → external APIs)
- **SongRepo** with prepared statements for database operations

The Genius integration slots cleanly into this existing architecture.

---

## Implementation Steps

### Step 1: Genius API Setup
- Register at [genius.com/api-clients](https://genius.com/api-clients) for API credentials
- Add `GENIUS_ACCESS_TOKEN` to `.env` file

### Step 2: Create Genius Service
**New file:** `server/services/genius.js`

```javascript
// Functions:
// - searchSong(artist, title) → Returns song matches from Genius
// - getLyrics(geniusUrl) → Scrapes lyrics from Genius song page
// - parseLyrics(rawText) → Cleans lyrics text:
//     - Strips section headers: [Chorus], [Verse 1], [Bridge], [Intro], [Outro], etc.
//     - Removes contributor annotations and embed metadata
//     - Normalizes line breaks and whitespace
//     - Returns clean, singable text only
```

**Dependencies to add:** `cheerio` (HTML parsing)

### Step 2b: Lyrics Parser Utility
**New file:** `server/utils/lyricsParser.js`

Handles extraction of section markers:
```
Input:  "[Verse 1]\nHello world\n[Chorus]\nLa la la"
Output: "Hello world\nLa la la"
```

Pattern to strip: `/^\[.*?\]$/gm` (lines that are just section markers)

### Step 3: Add API Endpoints
**File:** `server-proxy.js`

New endpoints:
```
GET /api/lyrics/search?artist=X&title=Y
  → Search Genius API
  → Returns { matches: [{ title, artist, geniusUrl, thumbnail }] }

GET /api/lyrics/fetch?url={geniusUrl}
  → Scrape lyrics from Genius song page
  → Parse/clean: strip [Chorus], [Verse], etc. headers
  → Returns { lyrics (cleaned), rawLyrics (original), title, artist }

POST /api/lyrics/save
  → Body: { songId, text, source, geniusUrl }
  → Saves to lyrics table with source='scrape'
```

### Step 4: Extend Database Repository
**File:** `server/db/repo.js`

Add methods:
- `getLyricsBySongId(songId)` - fetch existing lyrics
- `saveLyrics(songId, text, source, geniusUrl)` - insert/update lyrics

### Step 5: Frontend Integration
**File:** `src/components/karaoke-designs/IntegratedEcologicalOS.jsx`

Add:
- **Auto-fetch on song selection** - trigger Genius search when `selectedSong` changes
- Loading spinner while fetching lyrics
- **Match selection modal** - when multiple Genius matches found, show list for user to pick
- **Lyrics arrive in edit mode by default** - textarea pre-populated and editable immediately
- Cleaned lyrics displayed (no [Chorus]/[Verse] markers)
- Manual "Retry" button if auto-fetch fails

---

## File Changes Summary

| File | Change |
|------|--------|
| `.env` | Add `GENIUS_ACCESS_TOKEN` |
| `package.json` | Add `cheerio` dependency |
| `server/services/genius.js` | **New** - Genius API + scraper |
| `server/utils/lyricsParser.js` | **New** - Strip section headers, clean text |
| `server/db/repo.js` | Add lyrics CRUD methods |
| `server-proxy.js` | Add `/api/lyrics/*` routes |
| `IntegratedEcologicalOS.jsx` | Auto-fetch + match modal + editable textarea |

---

## Data Flow

```
User selects song
       ↓
Auto-trigger: extract artist/title from YouTube title
       ↓
GET /api/lyrics/search?artist=X&title=Y
       ↓
server/services/genius.js:
  1. Search Genius API for matches
  2. Return match list (title, artist, geniusUrl, thumbnail)
       ↓
Frontend shows match selection modal
       ↓
User picks correct match
       ↓
GET /api/lyrics/fetch?url={geniusUrl}
       ↓
Scrape lyrics from Genius page
       ↓
Parse lyrics:
  - Strip [Chorus], [Verse 1], [Bridge], etc.
  - Remove annotations/metadata
  - Clean whitespace
       ↓
Return cleaned lyrics → populate editable textarea
       ↓
User edits if needed → POST /api/lyrics/save
```

---

## Genius API Details

**Search endpoint:** `https://api.genius.com/search?q={query}`
- Returns song metadata including `url` field
- Auth: `Authorization: Bearer {token}` header

**Lyrics retrieval:**
- Genius API does NOT return lyrics directly
- Must scrape from the song page URL
- Target element: `div[data-lyrics-container="true"]`

**Rate limits:**
- No official rate limit published
- Recommended: Add 100ms delay between requests

---

## Verification Plan

1. **Unit test Genius service:**
   - Search returns results for known songs
   - Lyrics scraper extracts text correctly from Genius HTML

2. **Integration test:**
   - Select a YouTube video in the app
   - Verify auto-fetch triggers and match modal appears
   - Select a match from the list
   - Verify lyrics appear in editor
   - Verify lyrics saved to database with `source='scrape'`

3. **Edge cases:**
   - Song not found on Genius → Show "No matches found" with manual entry option
   - Network error → Show error toast with "Retry" button
   - Single match → Still show modal (user confirms correct match)
   - Genius page structure changed → Graceful fallback with error message

---

## Optional Enhancements (Future)

- Cache Genius search results (5-min TTL like YouTube search)
- Fallback to other lyrics sources if Genius fails (Musixmatch, AZLyrics)
- "Skip" option in match modal to enter lyrics manually
- Confidence scoring to auto-select when match is very strong (>95%)
