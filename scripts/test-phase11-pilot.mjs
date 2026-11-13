import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TASKS, createLedger, recordObservation, recordDefect, assessLedger, safeReference,
  validateStagingApi, probeStagingApi, validateStagingDatabase, runStagingPreflight
} from './phase11-pilot.mjs';
import { PHASE10_LIVE_JOURNEYS } from './final-audit-phase10.mjs';
import { GATES } from './phase7-release-report.mjs';

const sha = 'a'.repeat(40);
const now = new Date('2026-11-13T10:00:00.000Z');
const accepted = {
  kind: 'journey', id: 'platform_setup', status: 'PASS',
  actor: 'Staging tester', reviewer: 'Independent reviewer',
  device: 'Chrome 142 on Windows', reference: 'vault:phase11/browser-audited',
  observedAt: '2026-11-13T09:00:00Z'
};

test('Phase 11 starts 20 live journeys and 11 release gates as UNVERIFIED', () => {
  const ledger = createLedger({ sha, deploymentIdentifier: 'staging-build-20261113', now });
  assert.equal(Object.keys(ledger.journeys).length, 20);
  assert.equal(Object.keys(ledger.gates).length, Object.keys(GATES).length);
  assert.equal(Object.values(ledger.journeys).every(x => x.status === 'UNVERIFIED'), true);
  assert.deepEqual([...new Set(Object.values(TASKS).flat())].sort(),
    PHASE10_LIVE_JOURNEYS.map(x => x.id).sort());
  const result = assessLedger(ledger, { sha, now });
  assert.equal(result.decision, 'NO_GO');
  assert.equal(result.readiness, 'INCOMPLETE');
});

test('No fabricated, stale, same-operator or unsafe evidence can be recorded', () => {
  const ledger = createLedger({ sha, deploymentIdentifier: 'staging-build-20261113', now });
  const next = recordObservation(ledger, accepted, now);
  assert.equal(next.journeys.platform_setup.status, 'PASS');
  assert.equal(ledger.journeys.platform_setup.status, 'UNVERIFIED');
  assert.equal(assessLedger(next, { sha, now }).completedJourneys, 1);
  for (const patch of [
    { reviewer: 'Staging tester' },
    { reference: 'https://example.com/proof?token=abc' },
    { observedAt: '2026-04-01T10:00:00Z' },
    { observedAt: '2026-11-15T10:00:00Z' },
    { device: '' }
  ]) assert.throws(() => recordObservation(ledger, { ...accepted, ...patch }, now));
  assert.throws(() => recordObservation(ledger, { ...accepted, status: 'FAIL' }, now));
  assert.throws(() => recordObservation(ledger, { ...accepted, id: 'unknown' }, now));
  assert.throws(() => recordObservation(ledger, { ...accepted, kind: 'gate', id: 'production_override' }, now));
  assert.throws(() => safeReference('https://example.com/proof#fragment'));
  assert.throws(() => safeReference('ticket:session=abc'));
});

test('Even a complete staging ledger is NO_GO until independent human release review', () => {
  let ledger = createLedger({ sha, deploymentIdentifier: 'stage-release-candidate', now });
  for (const id of Object.keys(ledger.journeys)) ledger = recordObservation(ledger, { ...accepted, id }, now);
  for (const id of Object.keys(ledger.gates)) ledger = recordObservation(ledger, { ...accepted, kind: 'gate', id }, now);
  const ready = assessLedger(ledger, { sha, now });
  assert.equal(ready.completedJourneys, 20);
  assert.equal(ready.completedGates, 11);
  assert.equal(ready.readiness, 'READY_FOR_INDEPENDENT_PILOT_REVIEW');
  assert.equal(ready.decision, 'NO_GO');
  assert.equal(assessLedger(ledger, { sha: 'b'.repeat(40), now }).readiness, 'INCOMPLETE');
  assert.equal(assessLedger(ledger, { sha, now, worktreeClean: false }).readiness, 'INCOMPLETE');
  const tampered = structuredClone(ledger);
  tampered.journeys.staff_portal.sha = 'b'.repeat(40);
  assert.equal(assessLedger(tampered, { sha, now }).readiness, 'INCOMPLETE');
  const unresolved = structuredClone(ledger);
  unresolved.defects = [{ severity: 'HIGH', status: 'OPEN' }];
  assert.equal(assessLedger(unresolved, { sha, now }).readiness, 'INCOMPLETE');
});

test('Staging preflight refuses production pooler/direct aliases and wrong staging identity', () => {
  const env = {
    PHASE11_CONFIRM_STAGING: 'YES', CONFIRM_STAGING_DATABASE: 'maktab_staging',
    STAGING_DATABASE_URL: 'postgresql://stage:x@ep-stage-pooler.us-east-1.aws.neon.tech/maktab_staging?sslmode=require',
    STAGING_DATABASE_URL_UNPOOLED: 'postgresql://stage:x@ep-stage.us-east-1.aws.neon.tech/maktab_staging?sslmode=require',
    PRODUCTION_DATABASE_URL: 'postgresql://prod:x@ep-prod-pooler.us-east-1.aws.neon.tech/maktab?sslmode=require'
  };
  assert.equal(validateStagingDatabase(env).DATABASE_URL, env.STAGING_DATABASE_URL);
  const calls = [];
  const check = runStagingPreflight(env, (_bin, args) => { calls.push(args[0]); });
  assert.equal(check.checks.length, 3);
  assert.deepEqual(calls, ['db:check', 'db:preflight:phase3', 'db:preflight:phase6']);
  for (const patch of [
    { PHASE11_CONFIRM_STAGING: 'NO' },
    { CONFIRM_STAGING_DATABASE: 'maktab' },
    { PRODUCTION_DATABASE_URL: env.STAGING_DATABASE_URL_UNPOOLED },
    { STAGING_DATABASE_URL_UNPOOLED: env.PRODUCTION_DATABASE_URL }
  ]) assert.throws(() => validateStagingDatabase({ ...env, ...patch }));
});

test('Staging probe requires HTTPS, refuses production and checks authorization/private metrics', async () => {
  const env = {
    PHASE11_CONFIRM_STAGING: 'YES',
    STAGING_API_URL: 'https://stage.example.org/',
    CONFIRM_STAGING_HOST: 'stage.example.org',
    PRODUCTION_API_URL: 'https://prod.example.org/',
    PHASE11_ADMIN_TOKEN: 'secret_admin_token',
    PHASE11_METRICS_TOKEN: 'secret_metrics_token'
  };
  assert.equal(validateStagingApi(env).hostname, 'stage.example.org');
  for (const patch of [
    { STAGING_API_URL: 'http://stage.example.org/' },
    { CONFIRM_STAGING_HOST: 'prod.example.org' },
    { STAGING_API_URL: 'https://prod.example.org/', CONFIRM_STAGING_HOST: 'prod.example.org' },
    { STAGING_API_URL: 'https://stage.example.org/?token=xyz' }
  ]) assert.throws(() => validateStagingApi({ ...env, ...patch }));
  const seen = [];
  const fetcher = async (url, opts) => {
    assert.equal(opts.redirect, 'manual');
    const path = url.pathname;
    seen.push({ path, auth: opts.headers?.authorization });
    const status = path === '/health' || path === '/ready' ? 200
      : path === '/metrics' ? opts.headers?.authorization ? 200 : 401
        : opts.headers?.authorization ? 403 : 401;
    return { status, headers: { get: () => path === '/health' ? '' : 'no-store' } };
  };
  const report = await probeStagingApi(env, fetcher);
  assert.equal(report.result, 'PROBE_PASS_NOT_LIVE_E2E');
  assert.equal(report.productionDecision, 'NO_GO');
  assert.equal(report.results.length, 19);
  assert.ok(!JSON.stringify(report).includes('secret_admin_token'));
  assert.ok(!JSON.stringify(report).includes('secret_metrics_token'));
  assert.equal(seen.filter(x => x.auth).length, 5);
  const broken = await probeStagingApi(env, async () => ({ status: 200, headers: { get: () => '' } }));
  assert.equal(broken.result, 'PROBE_FAIL');
});

test('Defect lifecycle is independently reviewed and cannot hide HIGH/CRITICAL blockers', () => {
  let ledger = createLedger({ sha, deploymentIdentifier: 'staging-standalone', now });
  const issue = { reference: 'ticket:phase11/error-123', severity: 'HIGH', status: 'OPEN',
    actor: 'QA tester', reviewer: 'Security reviewer', observedAt: '2026-11-13T09:00:00Z' };
  ledger = recordDefect(ledger, issue, now);
  assert.equal(ledger.defects.length, 1);
  assert.ok(assessLedger(ledger, { sha, now }).blockers.some(x => x.includes('Unresolved critical/high')));
  assert.throws(() => recordDefect(ledger, { ...issue, status: 'RESOLVED', fixSha: 'b'.repeat(40) }, now));
  assert.throws(() => recordDefect(ledger, { ...issue, reviewer: 'QA tester' }, now));
  const fixed = recordDefect(ledger, { ...issue, status: 'RESOLVED', fixSha: sha }, now);
  assert.equal(fixed.defects.length, 1);
  assert.ok(!assessLedger(fixed, { sha, now }).blockers.some(x => x.includes('Unresolved critical/high')));
  const fake = structuredClone(fixed);
  fake.defects[0].fixSha = 'b'.repeat(40);
  assert.ok(assessLedger(fake, { sha, now }).blockers.some(x => x.includes('exact release SHA')));
});
