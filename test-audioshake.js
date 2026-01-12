
import 'dotenv/config';
import { startTransition } from 'react';
import { AudioShakeAdapter } from './server/alignment/audioshake-adapter.js';

async function test() {
    console.log("Testing AudioShake Payload Structure...");
    const apiKey = process.env.AUDIOSHAKE_API_KEY;
    if (!apiKey) {
        console.error("No API Key found");
        return;
    }

    const AUDIOSHAKE_API_BASE = 'https://api.audioshake.ai';

    // Test Case: metadata object at root
    const payload = {
        assetId: "mock-asset-id",
        callbackUrl: 'https://audioshake.ai/dummy-callback',
        metadata: {
            format: 'json',
            name: 'transcription'
        }
    };

    console.log("Testing Payload:", JSON.stringify(payload, null, 2));

    try {
        const res = await fetch(`${AUDIOSHAKE_API_BASE}/job`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        console.log(`Response: ${res.status} ${res.statusText}`);
        console.log("Body:", text);
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

test();
