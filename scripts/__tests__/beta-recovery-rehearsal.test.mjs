import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArgs, verifyRestoredEvidence } from '../beta-recovery-rehearsal.mjs';
const valid = { expectedHash: 'sha', restoredHash: 'sha', expectedRows: 'snapshot', restoredRows: 'snapshot', missingSource: true, privateStatus: 403, rlsEnabled: true, rlsForced: true, foreignKeyCount: 1 };
test('recovery evidence rejects lost bytes, changed rows, missing destruction proof and lost security', () => {
  verifyRestoredEvidence(valid);
  for (const patch of [{ restoredHash: 'corrupt' }, { restoredRows: 'missing' }, { missingSource: false }, { privateStatus: 200 }, { rlsEnabled: false }, { rlsForced: false }, { foreignKeyCount: 0 }]) assert.throws(() => verifyRestoredEvidence({ ...valid, ...patch }));
});
test('runner has no remote/production connection option', () => {
  for (const arg of ['--database-url=postgresql://production/postgres', '--endpoint=https://production.example', '--container=existing']) assert.throws(() => parseArgs([arg]));
  assert.equal(parseArgs(['--help']).help, true);
  assert.equal(parseArgs(['--rustfs-binary=/tmp/rustfs']).binary, '/tmp/rustfs');
});
