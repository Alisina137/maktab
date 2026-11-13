#!/usr/bin/env node
// Phase 11: independently reviewed evidence ledger + opt-in staging-only probes.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHASE10_LIVE_JOURNEYS } from './final-audit-phase10.mjs';
import { GATES } from './phase7-release-report.mjs';

export const TASKS = Object.freeze({
  '11.1': ['platform_setup', 'neon_migrations'],
  '11.2': ['admin_dashboard', 'academic_setup', 'family_accounts', 'staff_portal', 'two_school_isolation', 'account_session_recovery'],
  '11.3': ['teacher_attendance', 'teacher_homework', 'exam_results', 'parent_multiple_children', 'student_role', 'three_languages', 'offline_device'],
  '11.4': ['announcements_push', 'fees_reconciliation'],
  '11.5': ['backup_restore', 'production_operations'],
  '11.6': ['operator_signoff']
});
const SHA = /^[a-f0-9]{40}$/;
const OBSERVED = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const STATUSES = ['UNVERIFIED', 'PASS', 'FAIL', 'BLOCKED'];
const REQUIRED_FIELDS = ['actor', 'reviewer', 'device', 'reference', 'observedAt'];
const JOURNEYS = new Map(PHASE10_LIVE_JOURNEYS.map(({ id, actor, procedure }) => [id, { actor, procedure }]));
const GATE_IDS = Object.keys(GATES);

function value(input, label, min = 3, max = 240) {
  if (typeof input !== 'string' || input.trim().length < min || input.length > max || /[\r\n\0]/.test(input)) {
    throw new Error(`${label} must be a single-line value (${min}-${max} characters).`);
  }
  return input.trim();
}
export function safeReference(input) {
  const reference = value(input, 'Evidence reference', 8, 350);
  if (/[\s]/.test(reference) || /(password|secret|token|api[_-]?key|session|authorization|cookie)[=:]/i.test(reference)) {
    throw new Error('Evidence reference must not contain secrets, whitespace or credentials.');
  }
  if (/^https:\/\//i.test(reference)) {
    const u = new URL(reference);
    if (!u.hostname || u.username || u.password || u.search || u.hash || u.port) {
      throw new Error('Evidence URL must not contain login data, query, fragment or a custom port.');
    }
  } else if (!/^(vault|ticket|evidence):[a-zA-Z0-9._/-]+$/.test(reference)) {
    throw new Error('Use a safe https:// link without query/fragment, or a vault:/ticket:/evidence: identifier.');
  }
  return reference;
}
function isRecent(iso, now) {
  if (typeof iso !== 'string' || !OBSERVED.test(iso)) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t <= now.getTime() + 300000 && t >= now.getTime() - 31 * 86400000;
}
export function createLedger({ sha, deploymentIdentifier, environment = 'staging', now = new Date() }) {
  if (!SHA.test(sha ?? '')) throw new Error('Exact lowercase 40-character release SHA is required.');
  if (environment !== 'staging') throw new Error('Phase 11 accepts staging observations only.');
  const build = value(deploymentIdentifier, 'Deployment identifier', 5, 120);
  return {
    schemaVersion: 1, releaseSha: sha, deploymentIdentifier: build,
    environment, createdAt: now.toISOString(),
    journeys: Object.fromEntries([...JOURNEYS].map(([id]) => [id, { status: 'UNVERIFIED' }])),
    gates: Object.fromEntries(GATE_IDS.map(id => [id, { status: 'UNVERIFIED' }])),
    defects: []
  };
}
function validateObservation(row, label, releaseSha, now) {
  const errors = [];
  if (!row || !STATUSES.includes(row.status)) return [`${label} has invalid status.`];
  if (row.status === 'UNVERIFIED') return errors;
  if (row.sha !== releaseSha) errors.push(`${label} evidence SHA differs from release SHA.`);
  if (!isRecent(row.observedAt, now)) errors.push(`${label} requires a recent valid UTC observation time.`);
  for (const field of REQUIRED_FIELDS) {
    try { field === 'reference' ? safeReference(row[field]) : value(row[field], field); }
    catch { errors.push(`${label} has invalid or missing ${field}.`); }
  }
  if (row.actor && row.reviewer && row.actor.toLowerCase().trim() === row.reviewer.toLowerCase().trim()) {
    errors.push(`${label} requires a reviewer different from its test operator.`);
  }
  if (row.status === 'FAIL' || row.status === 'BLOCKED') {
    try { safeReference(row.defectRef); } catch { errors.push(`${label} requires a safe defect reference.`); }
  }
  return errors;
}
export function recordObservation(ledger, { kind, id, status, actor, reviewer, device, reference, observedAt, defectRef }, now = new Date()) {
  if (!['journey', 'gate'].includes(kind)) throw new Error('Kind must be journey or gate.');
  const collection = kind === 'journey' ? JOURNEYS : new Map(GATE_IDS.map(key => [key, {}]));
  if (!collection.has(id)) throw new Error('Unknown Phase 11 observation ID.');
  if (!['PASS', 'FAIL', 'BLOCKED'].includes(status)) throw new Error('Record status must be PASS, FAIL or BLOCKED.');
  const row = { status, sha: ledger.releaseSha, actor, reviewer, device,
    reference: safeReference(reference), observedAt };
  if (status !== 'PASS') row.defectRef = safeReference(defectRef);
  const errors = validateObservation(row, `${kind}:${id}`, ledger.releaseSha, now);
  if (errors.length) throw new Error(errors.join(' '));
  const target = kind === 'journey' ? 'journeys' : 'gates';
  return { ...ledger, [target]: { ...ledger[target], [id]: row } };
}
export function recordDefect(ledger, { reference, severity, status, actor, reviewer, observedAt, fixSha }, now = new Date()) {
  const ref = safeReference(reference);
  if (!['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(severity)) throw new Error('Defect severity is invalid.');
  if (!['OPEN', 'RESOLVED'].includes(status)) throw new Error('Defect status must be OPEN or RESOLVED.');
  const entry = { reference: ref, severity, status,
    actor: value(actor, 'Defect operator'), reviewer: value(reviewer, 'Defect reviewer'),
    observedAt };
  if (entry.actor.toLowerCase() === entry.reviewer.toLowerCase()) throw new Error('Independent defect reviewer required.');
  if (!isRecent(observedAt, now)) throw new Error('Defect update requires recent UTC observation.');
  if (status === 'RESOLVED') {
    if (!SHA.test(fixSha ?? '') || fixSha !== ledger.releaseSha) {
      throw new Error('Resolution must be retested on the exact current release SHA.');
    }
    entry.fixSha = fixSha;
  }
  if (!Array.isArray(ledger.defects)) throw new Error('Invalid defects ledger.');
  const defects = ledger.defects.filter(item => item.reference !== ref);
  return { ...ledger, defects: [...defects, entry] };
}
export function assessLedger(ledger, { sha, now = new Date(), worktreeClean = true } = {}) {
  const blockers = [];
  if (!ledger || ledger.schemaVersion !== 1 || ledger.environment !== 'staging' || !SHA.test(ledger.releaseSha ?? '')) {
    return { decision: 'NO_GO', readiness: 'INCOMPLETE', blockers: ['Invalid Phase 11 staging ledger.'] };
  }
  if (sha !== ledger.releaseSha) blockers.push('Release SHA differs from the exact checked-out commit.');
  if (!worktreeClean) blockers.push('Git worktree is not clean.');
  try { value(ledger.deploymentIdentifier, 'Deployment identifier', 5, 120); }
  catch { blockers.push('Missing staged deployment identifier.'); }
  if (Object.keys(ledger.journeys ?? {}).some(id => !JOURNEYS.has(id))) blockers.push('Unknown live journey in ledger.');
  if (Object.keys(ledger.gates ?? {}).some(id => !GATE_IDS.includes(id))) blockers.push('Unknown release gate in ledger.');
  for (const [kind, ids] of [['journeys', [...JOURNEYS.keys()]], ['gates', GATE_IDS]]) {
    for (const id of ids) {
      const row = ledger[kind]?.[id];
      if (!row || row.status !== 'PASS') blockers.push(`${kind}:${id} is not PASS.`);
      if (row && row.status !== 'UNVERIFIED') blockers.push(...validateObservation(row, `${kind}:${id}`, ledger.releaseSha, now));
    }
  }
  if (!Array.isArray(ledger.defects)) blockers.push('Defects list is invalid.');
  for (const defect of Array.isArray(ledger.defects) ? ledger.defects : []) {
    if (!defect || !['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(defect.severity) ||
        !['OPEN', 'RESOLVED'].includes(defect.status)) {
      blockers.push('Malformed defect entry.'); continue;
    }
    try { safeReference(defect.reference); value(defect.actor, 'Defect operator'); value(defect.reviewer, 'Defect reviewer'); }
    catch { blockers.push('Defect entry requires safe reference and independent reviewer.'); }
    if (defect.actor === defect.reviewer || !isRecent(defect.observedAt, now)) {
      blockers.push('Defect review is invalid, stale or not independent.');
    }
    if (defect.status === 'RESOLVED' && defect.fixSha !== ledger.releaseSha) {
      blockers.push('Resolved defect lacks a retest on the exact release SHA.');
    }
    if (['CRITICAL', 'HIGH'].includes(defect.severity) && defect.status !== 'RESOLVED') {
      blockers.push('Unresolved critical/high defect referenced in release ledger.');
    }
  }
  return {
    reportVersion: 1, releaseSha: ledger.releaseSha, deploymentIdentifier: ledger.deploymentIdentifier,
    targetEnvironment: 'staging', decision: 'NO_GO',
    readiness: blockers.length ? 'INCOMPLETE' : 'READY_FOR_INDEPENDENT_PILOT_REVIEW',
    completedJourneys: [...JOURNEYS.keys()].filter(id => ledger.journeys?.[id]?.status === 'PASS').length,
    completedGates: GATE_IDS.filter(id => ledger.gates?.[id]?.status === 'PASS').length,
    totalJourneys: JOURNEYS.size, totalGates: GATE_IDS.length,
    taskStatus: Object.fromEntries(Object.entries(TASKS).map(([task, ids]) => [task,
      ids.every(id => ledger.journeys?.[id]?.status === 'PASS') ? 'RECORDED_PASS_REQUIRES_INDEPENDENT_REVIEW' : 'PENDING'])),
    blockers: [...new Set(blockers)],
    note: 'A submitted evidence ledger is not independently authenticated. This tool never authorizes a pilot or production GO.'
  };
}

const pgHost = url => url.hostname.toLowerCase().replace('-pooler.', '.');
function pgUrl(raw) {
  let u; try { u = new URL(raw); } catch { throw new Error('Database URL is invalid.'); }
  if (!['postgres:', 'postgresql:'].includes(u.protocol) || !u.hostname || !u.pathname || u.pathname === '/') {
    throw new Error('A complete PostgreSQL connection is required.');
  }
  return u;
}
export function validateStagingDatabase(env) {
  if (env.PHASE11_CONFIRM_STAGING !== 'YES') throw new Error('Set PHASE11_CONFIRM_STAGING=YES after staging identity review.');
  if (!env.STAGING_DATABASE_URL || !env.STAGING_DATABASE_URL_UNPOOLED) throw new Error('Supply separate staging pooled and direct URLs.');
  if (!env.PRODUCTION_DATABASE_URL && !env.DATABASE_URL) throw new Error('Supply production source URL for isolation comparison (PRODUCTION_DATABASE_URL or DATABASE_URL).');
  const stage = pgUrl(env.STAGING_DATABASE_URL);
  const direct = pgUrl(env.STAGING_DATABASE_URL_UNPOOLED);
  const original = pgUrl(env.PRODUCTION_DATABASE_URL || env.DATABASE_URL);
  const stageName = decodeURIComponent(stage.pathname.slice(1));
  if (stageName !== env.CONFIRM_STAGING_DATABASE) throw new Error('CONFIRM_STAGING_DATABASE must exactly match the staging database name.');
  if (pgHost(stage) !== pgHost(direct) || stage.pathname !== direct.pathname) {
    throw new Error('Staging pooled and direct URLs must identify the same PostgreSQL database.');
  }
  if (pgHost(stage) === pgHost(original)) {
    throw new Error('Staging must use an independently isolated database cluster, not the production project.');
  }
  return { DATABASE_URL: env.STAGING_DATABASE_URL, DATABASE_URL_UNPOOLED: env.STAGING_DATABASE_URL_UNPOOLED };
}
export function runStagingPreflight(env, runner = execFileSync) {
  const stageEnv = validateStagingDatabase(env);
  // Node's execFile cannot launch .cmd scripts without cmd.exe on Windows.
  const onWindows = process.platform === 'win32';
  const command = onWindows ? (env.ComSpec || 'cmd.exe') : 'pnpm';
  for (const task of ['db:check', 'db:preflight:phase3', 'db:preflight:phase6']) {
    // These are fixed safe task IDs, not shell-supplied input.
    const argv = onWindows ? ['/d', '/s', '/c', 'pnpm', task] : [task];
    // No connection URLs, passwords, SQL rows or unredacted subprocess output in logs.
    runner(command, argv, { env: { ...env, ...stageEnv }, stdio: 'ignore' });
  }
  return { checks: ['db:check', 'db:preflight:phase3', 'db:preflight:phase6'], status: 'EXECUTED_REVIEW_OUTPUT_INDEPENDENTLY' };
}

export function validateStagingApi(env) {
  if (env.PHASE11_CONFIRM_STAGING !== 'YES') throw new Error('PHASE11_CONFIRM_STAGING=YES is required.');
  let url; try { url = new URL(env.STAGING_API_URL); } catch { throw new Error('STAGING_API_URL must be valid HTTPS URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      url.hostname !== env.CONFIRM_STAGING_HOST || url.hostname === 'localhost' || url.port) {
    throw new Error('Staging API must be HTTPS root with exact CONFIRM_STAGING_HOST, without credentials, port or query.');
  }
  if (env.PRODUCTION_API_URL) {
    let prod; try { prod = new URL(env.PRODUCTION_API_URL); } catch { throw new Error('Invalid PRODUCTION_API_URL for comparison.'); }
    if (prod.hostname === url.hostname) throw new Error('Refusing staging probe against production API hostname.');
  }
  return url;
}
const PROTECTED = [
  '/v1/admin/academics', '/v1/admin/families', '/v1/admin/learning',
  '/v1/admin/fees/invoices', '/v1/admin/attendance/monitor',
  '/v1/teacher/today', '/v1/teacher/learning', '/v1/parent/home',
  '/v1/student/home', '/v1/staff/me', '/v1/notifications'
];
export async function probeStagingApi(env, fetcher = fetch) {
  const base = validateStagingApi(env);
  const probes = [['/health', 200], ['/ready', 200], ['/metrics', [401, 404]],
    ...PROTECTED.map(path => [path, 401])];
  if (env.PHASE11_METRICS_TOKEN) probes.push(['/metrics', 200, 'metrics']);
  if (env.PHASE11_ADMIN_TOKEN) {
    probes.push(...['/v1/teacher/today', '/v1/parent/home', '/v1/student/home', '/v1/staff/me']
      .map(path => [path, 403, 'admin']));
  }
  const results = [];
  for (const [path, expected, auth] of probes) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetcher(new URL(path, base), {
        method: 'GET', redirect: 'manual', signal: controller.signal,
        headers: auth === 'admin' ? { authorization: `Bearer ${env.PHASE11_ADMIN_TOKEN}` }
          : auth === 'metrics' ? { authorization: `Bearer ${env.PHASE11_METRICS_TOKEN}` } : {}
      });
      const acceptable = Array.isArray(expected) ? expected : [expected];
      const cacheControl = response.headers?.get('cache-control') ?? '';
      const cacheSafe = path !== '/health' && /no-store/i.test(cacheControl);
      results.push({ path, check: auth ?? 'anonymous', status: response.status,
        pass: acceptable.includes(response.status) && (path === '/health' || cacheSafe) });
    } catch { results.push({ path, check: auth ?? 'anonymous', status: 'NETWORK_ERROR', pass: false }); }
    finally { clearTimeout(timer); }
  }
  return { environment: 'staging', productionDecision: 'NO_GO',
    result: results.every(r => r.pass) ? 'PROBE_PASS_NOT_LIVE_E2E' : 'PROBE_FAIL',
    results, note: 'Probe does not establish two-school authorization, Android UX, financial correctness or production readiness.' };
}

function args(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--attest') { opts.attest = true; continue; }
    if (!/^--[a-z-]+$/.test(key) || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('Invalid Phase 11 option.');
    opts[key.slice(2)] = argv[++i];
  }
  return opts;
}
function outsideRepo(filename) {
  if (!filename || !isAbsolute(filename)) throw new Error('Evidence file must be an absolute path outside the repository.');
  const location = resolve(filename);
  const repo = resolve(fileURLToPath(new URL('../', import.meta.url)));
  const rel = relative(repo, location);
  if (!rel || (!rel.startsWith('..') && !isAbsolute(rel))) throw new Error('Do not write private evidence inside the repository.');
  return location;
}
function gitSha() { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); }
function gitClean() { return execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() === ''; }
function save(file, data) { writeFileSync(outsideRepo(file), JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); }
function main(argv) {
  const [cmd, ...rest] = argv;
  const opt = args(rest);
  if (cmd === 'init') {
    save(opt.output, createLedger({ sha: gitSha(), deploymentIdentifier: opt.deployment }));
    console.log('Phase 11 staged evidence workbook created; all journeys and gates UNVERIFIED.');
  } else if (cmd === 'record') {
    if (!opt.attest) throw new Error('Recording requires --attest confirming independently observed staging evidence.');
    const file = outsideRepo(opt.input);
    const ledger = JSON.parse(readFileSync(file, 'utf8'));
    if (ledger.releaseSha !== gitSha()) throw new Error('Evidence SHA does not match current code checkout.');
    const recorded = recordObservation(ledger, {
      kind: opt.kind, id: opt.id, status: opt.status, actor: opt.actor, reviewer: opt.reviewer,
      device: opt.device, reference: opt.reference, observedAt: opt['observed-at'], defectRef: opt.defect
    });
    save(opt.output, recorded);
    console.log('New evidence revision written (original preserved); no automatic release authorization.');
  } else if (cmd === 'defect') {
    if (!opt.attest) throw new Error('Defect changes require independent --attest.');
    const ledger = JSON.parse(readFileSync(outsideRepo(opt.input), 'utf8'));
    if (ledger.releaseSha !== gitSha()) throw new Error('Defect evidence SHA does not match current checkout.');
    save(opt.output, recordDefect(ledger, {
      reference: opt.reference, severity: opt.severity, status: opt.status,
      actor: opt.actor, reviewer: opt.reviewer, observedAt: opt['observed-at'], fixSha: opt['fix-sha']
    }));
    console.log('New immutable defect evidence revision recorded outside the repository.');
  } else if (cmd === 'report') {
    const ledger = JSON.parse(readFileSync(outsideRepo(opt.input), 'utf8'));
    const report = assessLedger(ledger, { sha: gitSha(), worktreeClean: gitClean() });
    if (opt.output) save(opt.output, report); else console.log(JSON.stringify(report, null, 2));
    if (report.readiness === 'INCOMPLETE') process.exitCode = 2;
  } else if (cmd === 'probe') {
    return probeStagingApi(process.env).then(result => {
      if (opt.output) save(opt.output, result); else console.log(JSON.stringify(result, null, 2));
      if (result.result === 'PROBE_FAIL') process.exitCode = 2;
    });
  } else if (cmd === 'preflight') {
    const result = runStagingPreflight(process.env);
    if (opt.output) save(opt.output, result); else console.log(JSON.stringify(result, null, 2));
  } else throw new Error('Use init, record, defect, report, probe, or preflight. See docs/PILOT-ACCEPTANCE-PHASE11.md.');
}
if (process.argv[1] && basename(process.argv[1]) === 'phase11-pilot.mjs') {
  Promise.resolve().then(() => main(process.argv.slice(2))).catch(error => {
    // No raw environment, network errors or database credentials in output.
    console.error('Phase 11 command failed: ' + String(error.message || 'Unknown error').slice(0, 400));
    process.exitCode = 2;
  });
}
