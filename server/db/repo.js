
import { getDB } from './index.js';
import crypto from 'crypto';

export class SongRepository {
    constructor() {
        this.db = getDB();
        this.baseSelect = `SELECT * FROM songs`;

        const prepare = (sql) => {
            try {
                return this.db.prepare(sql);
            } catch (e) {
                console.error('[SongRepo] Prepare Failed for SQL:', sql);
                throw e;
            }
        };

        this.stmts = {
            create: prepare(`
                INSERT INTO songs (
                    id, video_id, source_title_raw, artist_name, track_title, canonical_display_name,
                    duration_sec, thumbnail_url, source_type, created_at, updated_at, last_opened_at
                ) VALUES (
                    @id, @video_id, @source_title_raw, @artist_name, @track_title, @canonical_display_name,
                    @duration_sec, @thumbnail_url, @source_type, @created_at, @updated_at, @last_opened_at
                )
            `),
            getById: prepare('SELECT * FROM songs WHERE id = ?'),
            getByVideoId: prepare('SELECT * FROM songs WHERE video_id = ?'),
            searchLocal: prepare(`
                SELECT * FROM songs 
                WHERE canonical_display_name LIKE ? OR source_title_raw LIKE ?
                ORDER BY last_opened_at DESC
                LIMIT 20
            `),
            updateTimestamp: prepare('UPDATE songs SET last_opened_at = ? WHERE id = ?'),
            createArtifact: prepare(`
                INSERT INTO artifacts (
                    id, song_id, kind, storage_ref, filename, mime_type, hash, params_hash, version_tag,
                    artist_name, track_title, canonical_display_name, created_at
                ) VALUES (
                    @id, @song_id, @kind, @storage_ref, @filename, @mime_type, @hash, @params_hash, @version_tag,
                    @artist_name, @track_title, @canonical_display_name, @created_at
                )
            `),
            getArtifactsBySong: prepare('SELECT * FROM artifacts WHERE song_id = ?'),
            getArtifactById: prepare('SELECT * FROM artifacts WHERE id = ?'),
            getJobsBySong: prepare('SELECT * FROM jobs WHERE song_id = ? ORDER BY created_at DESC')
        };
    }

    create(songData) {
        const id = crypto.randomUUID();
        const now = Date.now();
        const song = {
            id,
            video_id: songData.videoId || null,
            source_title_raw: songData.sourceTitleRaw || '',
            artist_name: songData.artistName || 'Unknown',
            track_title: songData.trackTitle || 'Unknown',
            canonical_display_name: songData.canonicalDisplayName || 'Unknown Track',
            duration_sec: songData.durationSec || 0,
            thumbnail_url: songData.thumbnailUrl || '',
            source_type: songData.sourceType || 'local',
            created_at: now,
            updated_at: now,
            last_opened_at: now
        };

        try {
            this.stmts.create.run(song);
            return song;
        } catch (e) {
            console.error('[SongRepo] Create Failed:', e);
            throw e;
        }
    }

    getByVideoId(videoId) {
        return this.stmts.getByVideoId.get(videoId);
    }

    getById(id) {
        return this.stmts.getById.get(id);
    }

    search(query) {
        const pattern = `%${query}%`;
        return this.stmts.searchLocal.all(pattern, pattern);
    }

    // --- Jobs ---
    getJobs(songId) {
        const jobs = this.stmts.getJobsBySong.all(songId);
        // Parse JSON fields
        return jobs.map(j => ({
            ...j,
            error: j.error_json ? JSON.parse(j.error_json) : null,
            params: j.params_json ? JSON.parse(j.params_json) : null,
            result: j.result_json ? JSON.parse(j.result_json) : null
        }));
    }

    // --- Artifacts ---

    addArtifact(artifactData) {
        const id = crypto.randomUUID();
        const artifact = {
            id,
            ...artifactData,
            created_at: Date.now()
        };
        this.stmts.createArtifact.run(artifact);
        return artifact;
    }

    getArtifacts(songId) {
        return this.stmts.getArtifactsBySong.all(songId);
    }

    getArtifactById(artifactId) {
        return this.stmts.getArtifactById.get(artifactId);
    }
}

export const SongRepo = new SongRepository();
