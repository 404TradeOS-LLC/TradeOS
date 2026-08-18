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

test('getGitContext returns branch and head fields', () => {
  const ctx = getGitContext(process.cwd());
  assert.ok('branch' in ctx);
  assert.ok('head' in ctx);
});
