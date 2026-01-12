
import { initDB } from './db/index.js';
import fs from 'fs';

console.log('Testing DB Init...');
try {
    if (fs.existsSync('karaoke.db')) fs.unlinkSync('karaoke.db');
    initDB();
    console.log('DB Init Success');
} catch (e) {
    console.error('DB Init Failed:', e);
}
