
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db;

export function initDB() {
    if (db) return db;

    const dbPath = path.resolve(process.cwd(), 'karaoke.db');
    console.log('[DB] Connecting to database at:', dbPath);

    db = new Database(dbPath);

    // Enable WAL mode for better concurrency
    // db.pragma('journal_mode = WAL');

    console.log('[DB] Starting schema init...');
    // Initialize Schema
    const tables = [
        `CREATE TABLE IF NOT EXISTS songs (
            id TEXT PRIMARY KEY,
            video_id TEXT UNIQUE,
            source_title_raw TEXT,
            artist_name TEXT,
            track_title TEXT,
            canonical_display_name TEXT,
            duration_sec INTEGER,
            thumbnail_url TEXT,
            source_type TEXT, -- 'youtube' | 'local'
            created_at INTEGER,
            updated_at INTEGER,
            last_opened_at INTEGER,
            is_deleted INTEGER DEFAULT 0
        )`,
        `CREATE TABLE IF NOT EXISTS lyrics (
            id TEXT PRIMARY KEY,
            song_id TEXT NOT NULL,
            text TEXT,
            hash TEXT,
            source TEXT, -- 'manual' | 'scrape' | 'import'
            is_active INTEGER DEFAULT 0,
            created_at INTEGER,
            updated_at INTEGER,
            FOREIGN KEY(song_id) REFERENCES songs(id)
        )`,
        `CREATE TABLE IF NOT EXISTS artifacts (
            id TEXT PRIMARY KEY,
            song_id TEXT NOT NULL,
            kind TEXT, -- 'downloaded_media' | 'vocal_stem' | 'band_stem' | 'timings_json'
            storage_ref TEXT, -- absolute path or relative path
            filename TEXT,
            mime_type TEXT,
            hash TEXT, -- input hash
            params_hash TEXT,
            version_tag TEXT,
            artist_name TEXT, -- Denormalized for safety
            track_title TEXT, -- Denormalized for safety
            canonical_display_name TEXT, -- Denormalized for safety
            created_at INTEGER,
            FOREIGN KEY(song_id) REFERENCES songs(id)
        )`,
        `CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            song_id TEXT NOT NULL,
            kind TEXT, -- 'download' | 'split' | 'align'
            state TEXT, -- 'queued' | 'processing' | 'done' | 'error' | 'canceled'
            progress REAL,
            error_json TEXT,
            params_json TEXT, -- Input parameters
            result_json TEXT, -- Output result
            idempotency_key TEXT UNIQUE,
            inputs_hash TEXT,
            logs_json TEXT,   -- Execution logs
            created_at INTEGER,
            updated_at INTEGER,
            completed_at INTEGER,
            FOREIGN KEY(song_id) REFERENCES songs(id)
        )`,
        `CREATE INDEX IF NOT EXISTS idx_songs_video_id ON songs(video_id)`,
        `CREATE INDEX IF NOT EXISTS idx_songs_canonical ON songs(canonical_display_name)`,
        `CREATE INDEX IF NOT EXISTS idx_jobs_song_id ON jobs(song_id)`,
        `CREATE INDEX IF NOT EXISTS idx_artifacts_song_id ON artifacts(song_id)`,
        `CREATE INDEX IF NOT EXISTS idx_jobs_idempotency ON jobs(idempotency_key)`
    ];

    for (const sql of tables) {
        try {
            db.exec(sql);
        } catch (e) {
            console.error('[DB] Failed to execute SQL:', sql);
            console.error('[DB] Error:', e.message);
            throw e;
        }
    }
    console.log('[DB] Schema initialized');

    return db;
}

export function getDB() {
    if (!db) {
        // Auto-initialize to resolve circular dependencies with static instances
        return initDB();
    }
    return db;
}
