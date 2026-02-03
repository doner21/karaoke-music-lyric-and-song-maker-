# Skill: Implement JSON Adapters

## Purpose
Create bidirectional adapters between the canonical karaoke JSON format and the internal Token model.

## Target File
`src/editor/jsonAdapters.js` — NEW

## Canonical JSON Schema (Input/Output)

```json
{
  "title": "WILDFLOWER",
  "artist": "Billie Eilish",
  "method": "audioshake",
  "lyrics": [
    {
      "sentence": {
        "start": 15.200336,
        "end": 20.800460,
        "text": "Things fall apart and time breaks your heart"
      },
      "words": [
        { "start": 15.200336, "end": 15.600345, "text": "Things" },
        { "start": 15.800349, "end": 16.000353, "text": "fall" }
      ]
    }
  ]
}
```

**Key facts about the schema:**
- Times are in **seconds** (float, arbitrary precision)
- `lyrics` is an array of sentence objects
- Each sentence has `sentence` (metadata) and `words` (array)
- Words may have `syllables` array (preserve but don't use)
- Words may have `_si`, `_wi` indices added by `indexLyrics()` (strip on export)

## Functions to Implement

### `parseJSONToTokens(canonicalJson)`

```
Input:  canonical JSON object
Output: Token[] array

Algorithm:
1. Iterate lyrics[i].words[j]
2. For each word:
   - id = crypto.randomUUID()
   - text = word.text
   - startMs = Math.round(word.start * 1000)
   - endMs = Math.round(word.end * 1000)
   - lineIndex = i (sentence index)
3. Sort final array by startMs (stable sort preserving lineIndex order)
4. Return flat Token array
```

### `tokensToExportJSON(tokens, metadata)`

```
Input:  Token[] array, metadata { title?, artist?, method? }
Output: canonical JSON object

Algorithm:
1. Group tokens by lineIndex → Map<lineIndex, Token[]>
2. Sort groups by lineIndex ascending
3. For each group:
   - Sort tokens by startMs
   - sentence.start = tokens[0].startMs / 1000
   - sentence.end = tokens[last].endMs / 1000
   - sentence.text = tokens.map(t => t.text).join(' ')
   - words = tokens.map(t => ({
       start: t.startMs / 1000,
       end: t.endMs / 1000,
       text: t.text
     }))
4. Return { ...metadata, lyrics: sentences }
```

## Roundtrip Guarantee

`parseJSONToTokens(tokensToExportJSON(parseJSONToTokens(json), meta))` should produce tokens with:
- Same text values
- Same timing values within ±1ms (due to float↔int conversion)
- Same lineIndex groupings
- Different IDs (re-parsed = new UUIDs, which is acceptable)

## Test Fixture

Use `src/assets/wildflower_demo.json` as the real-world test fixture. Load it with:
```js
import demoJson from '../../assets/wildflower_demo.json';
```

## Edge Cases to Handle

1. Empty `lyrics` array → return empty Token[]
2. Empty `words` array in a sentence → skip that sentence
3. Missing `sentence` object → derive from words if available
4. Null/undefined input → throw descriptive error
5. Word with `start >= end` → import it anyway (validateTokens will flag it)
