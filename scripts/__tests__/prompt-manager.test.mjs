import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROMPT_REGISTRY,
  renderPrompt,
  getGitContext
} from '../prompt-manager-lib.mjs';

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

test('every template category matches its catalog table doc entry', () => {
  // Regression for a category drift caught in review: the doc catalog and
  // the registry must agree, since npm run prompt list prints the registry's
  // category directly.
  const docCategories = {
    'startup': 'Workflow & Governance',
    'backend': 'Backend Engineering',
    'database-rls': 'Database & Security',
    'frontend': 'Frontend Engineering',
    'auth-supabase': 'Authentication & Security',
    'vercel-cloudflare': 'Infrastructure & Deployment',
    'athena-tool': 'AI & Athena Subsystems',
    'bugfix': 'Maintenance & Debugging',
    'pr-gate': 'Quality Assurance & CI',
    'docs-handoff': 'Documentation & State'
  };
  for (const [id, expectedCategory] of Object.entries(docCategories)) {
    assert.equal(PROMPT_REGISTRY[id].category, expectedCategory, `category mismatch for "${id}"`);
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

test('getGitContext returns branch and head fields', () => {
  const ctx = getGitContext(process.cwd());
  assert.ok('branch' in ctx);
  assert.ok('head' in ctx);
});
