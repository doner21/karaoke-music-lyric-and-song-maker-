
import { getDB } from '../db/index.js';
import crypto from 'crypto';
import fs from 'fs';

export const JOB_STATES = {
    QUEUED: 'queued',
    PROCESSING: 'processing',
    DONE: 'done',
    ERROR: 'error',
    CANCELED: 'canceled'
};

export class JobManager {
    constructor() {
        this.db = getDB();
        this.processors = new Map(); // kind -> async fn(job)
        this.pollingInterval = null;

        // Prepare statements for performance
        this.stmts = {
            create: this.db.prepare(
                `INSERT INTO jobs (id, song_id, kind, state, progress, params_json, idempotency_key, inputs_hash, created_at, updated_at) 
                 VALUES (@id, @song_id, @kind, @state, @progress, @params_json, @idempotency_key, @inputs_hash, @created_at, @updated_at)`
            ),
            completeJob: this.db.prepare(`
                UPDATE jobs SET state = 'done', completed_at = @completed_at, updated_at = @completed_at, result_json = @result_json WHERE id = @id
            `),
            getById: this.db.prepare('SELECT * FROM jobs WHERE id = ?'),
            getByKey: this.db.prepare('SELECT * FROM jobs WHERE idempotency_key = ?'),
            updateState: this.db.prepare(`
                UPDATE jobs SET state = @state, completed_at = @completed_at, updated_at = @updated_at, error_json = @error_json, result_json = @result_json, params_json = COALESCE(@params_json, params_json) WHERE id = @id
            `),

            updateProgress: this.db.prepare('UPDATE jobs SET progress = ?, updated_at = ? WHERE id = ?'),
            getNextJob: this.db.prepare(`
                SELECT * FROM jobs WHERE state = 'queued' AND kind = ? ORDER BY created_at ASC LIMIT 1
            `),
            getBySongAndKind: this.db.prepare('SELECT * FROM jobs WHERE song_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 1'),
            updateJobWithNewParams: this.db.prepare(`
                UPDATE jobs SET state = @state, idempotency_key = @idempotency_key, inputs_hash = @inputs_hash, 
                params_json = @params_json, completed_at = NULL, error_json = NULL, result_json = NULL, updated_at = @updated_at 
                WHERE id = @id
            `)
        };
    }



    registerProcessor(kind, processorFn) {
        this.processors.set(kind, processorFn);
        console.log(`[JobManager] Registered processor for '${kind}'`);
    }

    async startPolling(intervalMs = 2000) {
        if (this.pollingInterval) return;

        // Startup Recovery: Reset stuck jobs
        console.log('[JobManager] Running Startup Recovery...');
        try {
            this.recoverStuckJobs();
        } catch (e) {
            console.warn('[JobManager] Startup Recovery failed (non-critical):', e.message);
        }

        console.log('[JobManager] Starting poller...');
        this.pollingInterval = setInterval(() => this.poll(), intervalMs);
    }

    recoverStuckJobs() {
        console.log('[JobManager] recoverStuckJobs called');
        try {
            const stmt = this.db.prepare("UPDATE jobs SET state = ? WHERE state = ?");
            console.log('[JobManager] recoverStuckJobs prepared');
            const res = stmt.run('queued', 'processing');
            console.log('[JobManager] recoverStuckJobs executed. Changes:', res.changes);
        } catch (e) {
            console.error('[JobManager] recoverStuckJobs ERROR:', e);
            throw e;
        }
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    async poll() {
        // Iterate over registered kinds and check for work
        for (const kind of this.processors.keys()) {
            await this.processNext(kind);
        }
    }

    async processNext(kind) {
        // Simple distinct lock mechanism:
        // We'll rely on single-threaded poller for now or DB atomic update if we had multiple workers.
        // For SQLite in this app, single Orchestrator instance is assumed.

        const job = this.stmts.getNextJob.get(kind);
        if (!job) return;

        console.log('[JobManager] processNext fetched job:', job.id, 'params_json:', job.params_json);

        // Parse params
        if (job.params_json) {
            try {
                job.params = JSON.parse(job.params_json);
            } catch (e) {
                console.error('[JobManager] Failed to parse job params:', e);
                job.params = {};
            }
        }

        // Lock
        this.stmts.updateState.run({
            id: job.id,
            state: JOB_STATES.PROCESSING,
            completed_at: null,
            error_json: null,
            result_json: null,
            params_json: null,
            updated_at: Date.now() // Added updated_at
        });

        console.log(`[JobManager] Starting job ${job.id} (${kind})`);

        const processor = this.processors.get(kind);
        try {
            const result = await processor(job);
            console.log(`[JobManager] Job ${job.id} processor finished. Result:`, JSON.stringify(result));
            this.complete(job.id, result);
        } catch (err) {
            console.error(`[JobManager] Job ${job.id} failed catch block:`, err);
            this.fail(job.id, err);
        }
    }

    /**
     * Submit a new job. Implements Idempotency.
     */
    async submit({ songId, kind, params, force = false }) {
        // 1. Generate Idempotency Key
        const pjson = JSON.stringify(params || {});
        const inputsHash = this.hashInputs(params);
        const idempotencyKey = `${kind}:${songId}:${inputsHash}`;

        console.log(`[JobManager] Submit called: kind=${kind}, songId=${songId}, force=${force}`);

        // 2. Check existing by exact key match
        const existingByKey = this.stmts.getByKey.get(idempotencyKey);

        if (existingByKey) {
            // Force = true: Reset existing job and requeue it
            if (force) {
                console.log(`[JobManager] Force re-queue (same params): resetting existing job ${existingByKey.id}`);
                this.stmts.updateState.run({
                    id: existingByKey.id,
                    state: JOB_STATES.QUEUED,
                    completed_at: null,
                    error_json: null,
                    result_json: null,
                    params_json: pjson,
                    updated_at: Date.now()
                });
                return { jobId: existingByKey.id, state: JOB_STATES.QUEUED, existing: true, reused: false, forced: true };
            }

            console.log(`[JobManager] Job deduplicated: ${existingByKey.id} (${existingByKey.state})`);

            // If error, allow retry automatically without requiring force
            if (existingByKey.state === JOB_STATES.ERROR) {
                this.stmts.updateState.run({
                    id: existingByKey.id,
                    state: JOB_STATES.QUEUED,
                    completed_at: null,
                    error_json: null,
                    result_json: null,
                    params_json: pjson,
                    updated_at: Date.now()
                });
                return { jobId: existingByKey.id, state: JOB_STATES.QUEUED, existing: true, reused: false };
            }

            return { jobId: existingByKey.id, state: existingByKey.state, existing: true, reused: true };
        }

        // 3. Force with DIFFERENT params: Look for any existing job for this song+kind
        if (force) {
            const existingBySong = this.stmts.getBySongAndKind.get(songId, kind);
            if (existingBySong) {
                console.log(`[JobManager] Force re-queue (NEW params): updating existing job ${existingBySong.id} with new lyrics/params`);
                this.stmts.updateJobWithNewParams.run({
                    id: existingBySong.id,
                    state: JOB_STATES.QUEUED,
                    idempotency_key: idempotencyKey,
                    inputs_hash: inputsHash,
                    params_json: pjson,
                    updated_at: Date.now()
                });
                return { jobId: existingBySong.id, state: JOB_STATES.QUEUED, existing: true, reused: false, forced: true, paramsChanged: true };
            }
        }

        // 3. Create new
        const jobId = crypto.randomUUID();
        const now = Date.now();
        const job = {
            id: jobId,
            song_id: songId,
            kind,
            state: JOB_STATES.QUEUED,
            progress: 0,
            params_json: pjson,
            idempotency_key: idempotencyKey,
            inputs_hash: inputsHash,
            created_at: now,
            updated_at: now // Added
        };

        console.log('[JobManager] Inserting Job. Keys:', Object.keys(job));
        try {
            this.stmts.create.run(job);
            console.log(`[JobManager] Job created: ${jobId} (${kind})`);
        } catch (e) {
            console.error('[JobManager] Create Job Failed:', e);
            throw e;
        }
        console.log(`[JobManager] Job created: ${jobId} (${kind})`);

        // TODO: Notify / Trigger Processor

        return { jobId, state: JOB_STATES.QUEUED, existing: false };
    }

    updateProgress(jobId, progress, message) {
        if (message) {
            // Fetch existing logs first (Expensive but necessary for simple SQLite append)
            // Or ideally use a separate logs table. For now, we do a read-modify-write.
            const job = this.stmts.getById.get(jobId);
            let logs = [];
            if (job && job.logs_json) {
                try { logs = JSON.parse(job.logs_json); } catch (e) { }
            }
            logs.push({ timestamp: Date.now(), level: 'INFO', message });

            // Limit logs to last 100 to prevent bloat
            if (logs.length > 100) logs = logs.slice(-100);

            this.db.prepare('UPDATE jobs SET progress = ?, updated_at = ?, logs_json = ? WHERE id = ?')
                .run(progress, Date.now(), JSON.stringify(logs), jobId);
        } else {
            this.stmts.updateProgress.run(progress, Date.now(), jobId);
        }
    }

    getJob(jobId) {
        const job = this.stmts.getById.get(jobId);
        if (job) {
            try { if (job.error_json) job.error = JSON.parse(job.error_json); } catch (e) { console.error(`[JobMgr] Failed to parse error_json for ${jobId}`, e); job.error = { kind: 'parse_error', message: 'DB Corruption' }; }
            try { if (job.params_json) job.params = JSON.parse(job.params_json); } catch (e) { console.error(`[JobMgr] Failed to parse params_json for ${jobId}`, e); job.params = {}; }
            try { if (job.result_json) job.result = JSON.parse(job.result_json); } catch (e) { console.error(`[JobMgr] Failed to parse result_json for ${jobId}`, e); job.result = null; }
        }
        return job;
    }

    complete(jobId, result) {
        this.stmts.completeJob.run({
            id: jobId,
            completed_at: Date.now(),
            result_json: result ? JSON.stringify(result) : null,
            updated_at: Date.now()
        });
    }

    fail(jobId, error) {
        try { fs.writeFileSync('fatal_error.txt', JSON.stringify({ message: error?.message, stack: error?.stack }, null, 2)); } catch (e) { }
        console.log('[JobManager] fail called with error:', error);
        this.stmts.updateState.run({
            id: jobId,
            state: JOB_STATES.ERROR,
            completed_at: Date.now(),
            error_json: JSON.stringify({ message: error?.message || "Unknown", stack: error?.stack }),
            result_json: null,
            params_json: null,
            updated_at: Date.now()
        });
    }

    hashInputs(params) {
        // Simple JSON hash
        return crypto.createHash('sha256').update(JSON.stringify(params || {})).digest('hex');
    }
}

export const JobMgr = new JobManager();
