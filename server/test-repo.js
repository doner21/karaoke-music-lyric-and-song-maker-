
import { initDB } from './db/index.js';
import { SongRepo } from './db/repo.js';
import fs from 'fs';

console.log('Testing SongRepo...');
try {
    if (fs.existsSync('karaoke.db')) fs.unlinkSync('karaoke.db');
    initDB();
    console.log('DB Init Done. Instantiating Repo...');

    // SongRepo is a singleton instantiated on module load.
    // So by importing it, it already ran constructor.
    // If it crashed, it would have crashed on import.

    // Let's call a method to verify.
    const res = SongRepo.search('test');
    console.log('Repo Search Result:', res);
} catch (e) {
    console.error('Repo Test Failed:', e);
}
