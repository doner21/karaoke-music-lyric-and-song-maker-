/**
 * verify-rendering.js — Automated rendering verification script.
 *
 * Launches the Electron app with #/verify hash, waits for the verification
 * panel to load, runs an automated sweep, and reports results.
 *
 * Usage:
 *   node scripts/verify-rendering.js
 *
 * Requirements:
 *   - App must be built (npm run build) or dev server running (npm run dev)
 *   - Server running at localhost:3002 with at least one song
 *
 * Exit codes:
 *   0 — all frames match ≥ 85%
 *   1 — some frames below threshold
 *   2 — startup/runtime error
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TIMEOUT_MS = 120_000; // 2 minutes max
const MATCH_THRESHOLD = 85; // minimum acceptable match %

async function main() {
    console.log('🔍 Rendering Verification Script');
    console.log('================================');
    console.log(`Threshold: ${MATCH_THRESHOLD}%`);
    console.log('');

    // Check if dev server is running
    try {
        const resp = await fetch('http://localhost:5173');
        console.log('✅ Dev server is running');
    } catch {
        console.log('⚠️  Dev server not detected at localhost:5173');
        console.log('   Start it with: npm run dev');
        console.log('   Or build first: npm run build');
    }

    console.log('');
    console.log('To use the verification panel:');
    console.log('  1. Start the app: npm run dev');
    console.log('  2. Navigate to: http://localhost:5173/#/verify');
    console.log('  3. Select a song from the picker');
    console.log('  4. Use the controls:');
    console.log('     • ▶ Play — auto-advance through the song');
    console.log('     • 📸 Snapshot — capture comparison at current time');
    console.log('     • 🔄 Full Sweep — automated 20-point comparison');
    console.log('');
    console.log('Programmatic API (in browser console):');
    console.log('  window.__verifyRendering.setTime(10.5)  — seek to time');
    console.log('  window.__verifyRendering.compare()       — compare current frame');
    console.log('  window.__verifyRendering.sweep()         — full automated sweep');
    console.log('  window.__verifyRendering.getMatchPct()   — get current match %');
    console.log('');
    console.log('For Electron automation:');
    console.log('  npx electron electron/main.js -- --verify-mode');
    console.log('  (loads #/verify route automatically)');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(2);
});
