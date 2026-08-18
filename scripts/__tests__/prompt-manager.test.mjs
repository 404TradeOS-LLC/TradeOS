import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROMPT_REGISTRY,
  renderPrompt,
  getGitContext
} from '../prompt-manager-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAYBOOK_PATH = resolve(__dirname, '..', '..', 'docs', 'agent-prompts', 'PROMPTS_MASTER_PLAYBOOK.md');

// Parses the "Category" column out of the real catalog table in
// PROMPTS_MASTER_PLAYBOOK.md, keyed by Prompt ID, so the drift test below
// checks the actual cross-file contract instead of two independently
// hand-typed copies that could silently agree with each other while both
// being wrong.
function parseCatalogCategories() {
  const doc = readFileSync(PLAYBOOK_PATH, 'utf8');
  const categories = {};
  for (const line of doc.split('\n')) {
    const match = line.match(/^\|\s*`([a-z0-9-]+)`\s*\|\s*([^|]+?)\s*\|/);
    if (match) categories[match[1]] = match[2];
  }
  return categories;
}

test('PROMPT_REGISTRY has all expected core prompt definitions', () => {
  const expectedKeys = [
    'startup',
    'backend',
    'database-rls',
    'frontend',
    'auth-supabase',
    'vercel-cloudflare',
    'athena-tool',
    'bugfix',
    'pr-gate',
    'docs-handoff'
  ];

  for (const key of expectedKeys) {
    const item = PROMPT_REGISTRY[key];
    assert.ok(item, `Prompt registry is missing "${key}"`);
    assert.equal(item.id, key);
    assert.ok(item.title && item.title.length > 0, `Prompt "${key}" missing title`);
    assert.ok(item.category && item.category.length > 0, `Prompt "${key}" missing category`);
    assert.ok(Array.isArray(item.targetAgents) && item.targetAgents.length > 0, `Prompt "${key}" missing target agents`);
    assert.ok(item.template && item.template.length > 0, `Prompt "${key}" missing template`);
    assert.ok(typeof item.variables === 'object', `Prompt "${key}" missing variables object`);
  }
});

test('renderPrompt correctly replaces default variables', () => {
  const result = renderPrompt('startup');
  assert.equal(result.meta.id, 'startup');
  assert.ok(result.rendered.includes('docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md'));
  assert.ok(!result.rendered.includes('{{ALLOWED_PATHS}}'), 'Template placeholder should be replaced');
  assert.ok(!result.rendered.includes('{{FORBIDDEN_PATHS}}'), 'Template placeholder should be replaced');
});

test('renderPrompt overrides variables with user inputs', () => {
  const customVars = {
    FEATURE_NAME: 'Special Payments Flow',
    PERMISSION_KEY: 'billing.manage'
  };

  const result = renderPrompt('backend', customVars);
  assert.ok(result.rendered.includes('Special Payments Flow'));
  assert.ok(result.rendered.includes("requirePermissions('billing.manage')"));
});

test('renderPrompt throws on invalid prompt ID', () => {
  assert.throws(() => {
    renderPrompt('non-existent-id');
  }, /Prompt ID not found/);
});

test('renderPrompt throws the documented not-found error for inherited Object.prototype names, not a TypeError', () => {
  // PROMPT_REGISTRY has a null prototype (Object.create(null)) specifically
  // so lookups like PROMPT_REGISTRY['constructor'] don't resolve through
  // Object.prototype and masquerade as a real (but malformed) entry.
  for (const id of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
    assert.throws(() => renderPrompt(id), /Prompt ID not found/, `renderPrompt('${id}') should report not-found, not crash`);
  }
});

test('every registry category matches the actual catalog table in PROMPTS_MASTER_PLAYBOOK.md', () => {
  // Regression for a category drift caught in review: parses the doc's real
  // catalog table (not a second hand-typed copy) so a catalog-only edit
  // that drifts from the registry actually fails this test.
  const docCategories = parseCatalogCategories();
  const registryIds = Object.keys(PROMPT_REGISTRY);

  assert.deepEqual(Object.keys(docCategories).sort(), registryIds.sort(), 'catalog table and registry must list the same prompt IDs');
  for (const id of registryIds) {
    assert.equal(docCategories[id], PROMPT_REGISTRY[id].category, `category mismatch for "${id}"`);
  }
});

test('renderPrompt preserves a literal $-pattern in a variable value instead of interpreting it as a replacement pattern', () => {
  // String.prototype.replace treats $&/$$/$1.. specially when the
  // replacement argument is a string; a user-typed value containing a
  // literal '$' (e.g. a dollar amount in a bug description) must survive
  // rendering unchanged.
  const result = renderPrompt('bugfix', {
    MODULE_NAME: 'BillingService',
    BUG_DESCRIPTION: 'Invoice total shows $& instead of $19.99, and $1 is duplicated'
  });
  assert.ok(result.rendered.includes('Invoice total shows $& instead of $19.99, and $1 is duplicated'));
});

test('renderPrompt does not let an earlier variable value leak into a later placeholder substitution', () => {
  // Regression: the old implementation looped per-variable, reassigning
  // `rendered` each time, so a value containing a later placeholder's
  // literal text got re-scanned and replaced on that later iteration.
  const result = renderPrompt('backend', {
    FEATURE_NAME: '{{PERMISSION_KEY}}',
    PERMISSION_KEY: 'billing.manage'
  });
  assert.ok(result.rendered.includes('Implement the backend changes for {{PERMISSION_KEY}} in'), 'FEATURE_NAME value must survive as literal text, not get re-substituted');
});

test('getGitContext returns branch and head fields', () => {
  const ctx = getGitContext(process.cwd());
  assert.ok('branch' in ctx);
  assert.ok('head' in ctx);
});
