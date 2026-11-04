import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Behavior tests for public/index.html. The worker has no DOM dependency, so
// these run the page's own inline script (extracted at test time, never a
// copy) against a minimal DOM stub under the worker's node --test runner.
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];

class El {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this._text = '';
    this.className = '';
    this._listeners = {};
  }
  // Like the real DOM, textContent assignment coerces to a string.
  set textContent(v) { this._text = v == null ? '' : String(v); }
  get textContent() { return this._text; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(type, fn) { (this._listeners[type] ??= []).push(fn); }
}

function textOf(el) {
  return [el.textContent, ...el.children.map(textOf)].join(' ').replace(/\s+/g, ' ').trim();
}

function harness(fetchImpl) {
  const elements = {};
  const ids = ['total', 'ci', 'ciLabel', 'protected', 'protectedLabel', 'refresh', 'updated', 'notice', 'items'];
  for (const id of ids) elements[id] = new El('div');
  const state = { fetchImpl };
  const document = {
    getElementById: (id) => elements[id],
    createElement: (tag) => new El(tag),
  };
  const sandbox = { document, fetch: (...args) => state.fetchImpl(...args), console };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  return {
    elements,
    setFetch: (fn) => { state.fetchImpl = fn; },
    clickRefresh: async () => {
      for (const fn of elements.refresh._listeners.click ?? []) await fn();
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));
const item = (number, risk, ciState, gate) => ({
  number, title: 'Item ' + number, url: 'https://example.com/pull/' + number,
  headSha: 'b'.repeat(40), risk, ciState, gate, action: 'Do the next thing.',
});
const queuePayload = (items) => ({
  items, generatedAt: '2026-11-03T12:00:00.000Z', limitedTo: 12, truncated: false,
});
const ok = (payload) => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });

test('dashboard renders queue items, counts, and unknown evidence', async () => {
  const page = harness(() => Promise.resolve(ok(queuePayload([
    item(91, 'protected', 'failed', 'PROTECTED_RELEASE'),
    item(92, 'unknown', 'unknown', 'EVIDENCE_UNAVAILABLE'),
    item(93, 'low', 'passed', 'RELEASE_REVIEW'),
  ]))));
  await flush();
  const { elements } = page;
  assert.equal(elements.total.textContent, '3');
  assert.equal(elements.ci.textContent, '1');
  assert.equal(elements.protected.textContent, '1');
  assert.match(elements.ciLabel.textContent, /1 unknown/);
  assert.match(elements.protectedLabel.textContent, /1 unknown/);
  assert.match(textOf(elements.items), /#91 · Item 91/);
  assert.match(textOf(elements.items), /RELEASE REVIEW/);
});

test('failed refresh keeps the error notice and marks prior results stale', async () => {
  const page = harness(() => Promise.resolve(ok(queuePayload([item(91, 'low', 'passed', 'RELEASE_REVIEW')]))));
  await flush();
  assert.equal(page.elements.items.children.length, 1);
  page.setFetch(() => Promise.reject(new Error('GitHub unavailable')));
  await page.clickRefresh();
  await flush();
  assert.match(page.elements.notice.textContent, /GitHub unavailable/);
  assert.match(page.elements.updated.textContent, /Stale/);
  assert.equal(page.elements.items.children.length, 1);
});

test('initial load failure shows the notice with no current results', async () => {
  const page = harness(() => Promise.reject(new Error('GitHub unavailable')));
  await flush();
  assert.match(page.elements.notice.textContent, /GitHub unavailable/);
  assert.equal(page.elements.updated.textContent, 'Could not verify GitHub evidence');
  assert.equal(page.elements.items.children.length, 0);
});
