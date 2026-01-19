
import { normalizeLyrics } from './src/utils/lyricsTimingNormalizer.js';
import { getActiveGap } from './src/utils/gapDetector.js';

// Mock Data: Words with a 10s gap (End 4.0s -> Start 14.0s)
const mockJson = {
    lyrics: [
        {
            words: [
                { text: "Word1", start: 1.0, end: 2.0 },
                { text: "Word2", start: 3.0, end: 4.0 }
            ]
        },
        {
            words: [
                { text: "Word3", start: 14.0, end: 15.0 },
                { text: "Word4", start: 16.0, end: 17.0 }
            ]
        }
    ]
};

const trackDuration = 30.0;
const normalized = normalizeLyrics(mockJson, trackDuration);

console.log("=== GAPS DETECTED ===");
console.log(JSON.stringify(normalized.gaps, null, 2));

console.log("\n=== SIMULATING PLAYBACK ===");
// Gap is 4.0s -> 14.0s (Duration: 10s)
// Prep buffer is 3s. So countdown should be active from 4.0s to 11.0s.
// At 11.0s, countdown ends (prep buffer starts).

const testTimes = [3.0, 5.0, 10.0, 11.0, 11.1, 13.0];
const PREP_BUFFER = 3.0;

testTimes.forEach(t => {
    const gap = getActiveGap(normalized.gaps, t);
    let status = "LYRICS";

    if (gap) {
        const countdownDuration = Math.max(0, gap.duration - PREP_BUFFER);
        const countdownEndTime = gap.startTime + countdownDuration;

        if (t < countdownEndTime && countdownDuration > 0) {
            status = `INTERVAL DISPLAY (Remaining: ${(countdownEndTime - t).toFixed(2)}s)`;
        } else {
            status = "PREP BUFFER (Show Lyrics)";
        }
    }

    console.log(`Time: ${t.toFixed(1)}s -> Gap: ${gap ? 'YES' : 'NO'} -> ${status}`);
});
