
import 'dotenv/config';
import { AudioShakeAdapter } from './server/alignment/audioshake-adapter.js';
import path from 'path';

// Using the confirmed existing file
const VOCAL_PATH = String.raw`C:\Users\donald clark\.gemini\antigravity\scratch\karaoke-box\downloads\6c171c0f-8b9d-4631-b04a-66ed133bba1f\separated\htdemucs\audio\vocals.mp3`;

const LYRICS = `Scented and tall, hesitating once more
And as I take on myself and the bitterness I felt
Realize that love flows wild

White horses, they will take me away
And the tenderness I feel
Will send the dark on beneath
Will I follow?

Through the glory of life, I will scatter on the floor
Disappointed and sore
And in my thoughts, I have bled for the riddles I've been fed
Another life moves over

Wild white horses, they will take me away
And the tenderness I feel
Will send the dark on beneath
Will I follow?

Wild white horses, they will take me away
And the tenderness I feel
Will send the dark on beneath
Will I follow?`;

async function run() {
    console.log("Starting Manual AudioShake Dump Test (Alignment Mode)");
    const apiKey = process.env.AUDIOSHAKE_API_KEY;

    if (!apiKey) {
        console.error("Missing API Key in process.env");
        return;
    }

    const adapter = new AudioShakeAdapter(apiKey);
    const health = await adapter.checkHealth();
    console.log("Health check:", health);

    if (!health.available) return;

    try {
        console.log("Submitting file:", VOCAL_PATH);
        // Using LYRICS this time to trigger 'alignment' mode
        const taskId = await adapter.submitAlignment({ audioPath: VOCAL_PATH, lyricsText: LYRICS });
        console.log("Task ID:", taskId);

        let complete = false;
        while (!complete) {
            await new Promise(r => setTimeout(r, 2000));
            const status = await adapter.poll(taskId);
            process.stdout.write(`Status: ${status.state} ${(status.progress * 100).toFixed(1)}% \r`);

            if (status.state === 'completed') {
                console.log("\nCOMPLETED!");
                // Result has already been fetched inside poll->fetchResult, 
                // logging outputAssets will happen in the class method.
                // We'll just log the final result object here too.
                console.log("RESULT JSON BEGIN >>>");
                console.log(JSON.stringify(status.result, null, 2));
                console.log("<<< RESULT JSON END");
                complete = true;
            } else if (status.state === 'failed' || status.state === 'error') {
                console.log("\nFAILED:", status.error);
                complete = true;
            }
        }

    } catch (e) {
        console.error("\nError:", e);
    }
}

run();
