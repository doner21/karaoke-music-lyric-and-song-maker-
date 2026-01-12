
import { Canonicalizer } from './server/alignment/canonicalizer.js';

const mockResult = {
    "metadata": { "language": "en" },
    "lines": [
        {
            "start": 26.9201,  // Seconds
            "end": 33.0801,
            "text": "Scented and tall\n",
            "words": [
                { "start": 26.9201, "end": 31.7801, "text": "Scented " },
                { "start": 31.8601, "end": 32.0801, "text": "and " },
                { "start": 32.1401, "end": 33.0801, "text": "tall\n" }
            ]
        }
    ]
};

const userLyrics = "Scented and tall";

console.log("Testing Canonicalizer...");
const canonicalizer = new Canonicalizer();
try {
    const output = canonicalizer.transform(mockResult, userLyrics, {});
    console.log("Output Lyrics Length:", output.lyrics.length);
    console.log("First Line:", JSON.stringify(output.lyrics[0], null, 2));
} catch (e) {
    console.error("Canonicalizer Verification Failed:", e);
}
