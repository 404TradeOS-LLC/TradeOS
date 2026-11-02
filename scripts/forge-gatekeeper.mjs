#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { queueBlockers } from './merge-queue.mjs';
import { recommendNextGate } from './forge-gatekeeper-lib.mjs';

const REPOSITORY = '404TradeOS-LLC/TradeOS';

export function assessSnapshot(snapshot) {
  if (!snapshot || snapshot.repository !== REPOSITORY) {
    throw new Error('Forge snapshot must name the canonical TradeOS repository.');
  }
  // The existing merge-queue implementation owns generic readiness policy.
  // No queue label/consent is needed to *inspect* a PR.
  return recommendNextGate({
    pr: snapshot.pr,
    blockers: queueBlockers(snapshot.pr, REPOSITORY, {requireConsent: false}),
    evidence: snapshot.evidence,
  });
}

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invoked === import.meta.url) {
  try {
    if (process.argv.length !== 3 || process.argv[2] === '--help') {
      console.log('Usage: node scripts/forge-gatekeeper.mjs <read-only-snapshot.json>');
      if (process.argv[2] !== '--help') process.exitCode = 2;
    } else {
      const snapshot = JSON.parse(readFileSync(process.argv[2], 'utf8'));
      console.log(JSON.stringify(assessSnapshot(snapshot), null, 2));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
