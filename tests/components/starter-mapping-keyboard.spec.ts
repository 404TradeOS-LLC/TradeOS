import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const webRequire = createRequire(resolve('web/package.json'));
const builderPath = 'web/src/app/(app)/projects/[id]/estimates/[estimateId]/builder.tsx';

// Hermetic component evidence: real React, DOM events, mapping assessment and
// production picker. Only query transport and the Input primitive are fixtures.
// No app session, network request, Install or Estimate write is possible.
function fixtureBundle() {
  const ts = webRequire('typescript');
  const source = readFileSync(process.env.TRADEOS_MAPPING_TEST_SOURCE ?? builderPath, 'utf8');
  const ast = ts.createSourceFile('builder.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const picker = ast.statements.find((node: { name?: { text: string } }) => node.name?.text === 'StarterComponentMappingPicker');
  if (!picker) throw new Error('Production mapping picker not found');
  const compile = (text: string) => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  const modules: Record<string, string> = {};
  for (const [name, file] of [
    ['react', 'react.production.js'],
    ['react-dom', 'react-dom.production.js'],
    ['scheduler', 'scheduler.production.js'],
    ['react-dom/client', 'react-dom-client.production.js'],
    ['react/jsx-runtime', 'react-jsx-runtime.production.js'],
  ]) {
    const packageName = name === 'react/jsx-runtime' ? 'react' : name === 'react-dom/client' ? 'react-dom' : name;
    modules[name] = readFileSync(resolve(dirname(webRequire.resolve(`${packageName}/package.json`)), 'cjs', file), 'utf8');
  }
  modules.model = compile(readFileSync('web/src/components/costbook/assembly-catalog-model.ts', 'utf8'));
  modules.picker = compile(`
    import { useState, useEffect, useId } from 'react';
    import { assessCostItemMapping } from 'model';
    const Input = (props) => <input {...props} />;
    const cn = (...values) => values.filter(Boolean).join(' ');
    const useQuery = ({queryKey}) => { window.mappingQuery = queryKey[2]; return {data: window.mappingRows, isLoading: false,
      isFetching: queryKey[2] === 'pending', isError: queryKey[2] === 'error'}; };
    ${picker.getText(ast)}
    export { StarterComponentMappingPicker };
  `);
  const factories = Object.entries(modules).map(([name, body]) => `${JSON.stringify(name)}: function(module,exports,require){${body}\n}`).join(',');
  return `const modules={${factories}}, cache={};
    function require(name){if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;modules[name](module,module.exports,require);return module.exports;}
    const React=require('react');const {createRoot}=require('react-dom/client');
    const {StarterComponentMappingPicker}=require('picker');
    const row=(id,unit='EA')=>({id,code:id,name:id,unitOfMeasure:unit,isActive:true,materialId:'material',laborRateId:null,equipmentId:null,subcontractorId:null,productionRate:null});
    window.mappingRows=[row('wrong-unit','LF'),row('first'),row('already-used'),row('last')];
    function Fixture(){const [value,setValue]=React.useState();return React.createElement('div',null,
      React.createElement(StarterComponentMappingPicker,{component:{key:'stud',label:'Framing stud',quantityPerUnit:1,help:'Fixture',compatibleUnits:['EA'],allowedCostItemKinds:['material']},value,unavailableIds:new Set(['already-used']),disabled:false,onSelect:setValue}),
      React.createElement('button',{id:'after'},'After picker'),React.createElement('output',null,value?.id??'none'));}
    createRoot(document.getElementById('root')).render(React.createElement(Fixture));`;
}

test.use({ hasTouch: true });
for (const width of [390, 768, 1024, 1440]) {
  test(`mapping supports keyboard selection and recovery at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: fixtureBundle() });
    const input = page.getByRole('combobox', { name: 'Map Framing stud' });
    await input.focus();
    await expect(page.getByRole('option', { name: /wrong-unit/ })).toBeDisabled();
    await expect(page.getByRole('option', { name: /already-used/ })).toBeDisabled();
    const active = async () => page.evaluate(() => {
      const input = document.querySelector('[role="combobox"]')!;
      return document.getElementById(input.getAttribute('aria-activedescendant') ?? '')?.textContent;
    });
    await input.press('ArrowDown');
    await expect.poll(active).toContain('first');
    await input.press('ArrowDown');
    await expect.poll(active).toContain('last');
    await input.press('ArrowDown');
    await expect.poll(active).toContain('last');
    await input.press('ArrowUp');
    await expect.poll(active).toContain('first');
    await expect(input).toBeFocused();
    await input.press('Enter');
    await expect(page.locator('output')).toHaveText('first');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(input).not.toHaveAttribute('aria-activedescendant');
    await expect(input).toBeFocused();
    await input.press('ArrowUp');
    await expect.poll(active).toContain('last');
    await input.press('Escape');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('output')).toHaveText('first');
    await input.press('ArrowDown');
    await input.press('Tab');
    await expect(page.locator('#after')).toBeFocused();
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await input.focus();
    await input.fill('pending');
    await expect(page.getByRole('status').filter({ hasText: 'Searching Costbook…' })).toHaveText('Searching Costbook…');
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(page.locator('output')).toHaveText('none');
    await expect(input).not.toHaveAttribute('aria-activedescendant');
    await expect.poll(() => page.evaluate(() => (window as unknown as { mappingQuery: string }).mappingQuery)).toBe('pending');
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(page.locator('output')).toHaveText('none');
    await input.fill('error');
    await expect(page.getByRole('alert')).toHaveText('Cost Items could not be loaded.');
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(page.locator('output')).toHaveText('none');
    await input.fill('recovered');
    await expect(page.getByRole('option', { name: /last/ })).toBeVisible();
    await page.getByRole('option', { name: /last/ }).click();
    await expect(page.locator('output')).toHaveText('last');
    await expect(input).toBeFocused();
    await input.fill('touch');
    await page.getByRole('option', { name: /first/ }).tap();
    await expect(page.locator('output')).toHaveText('first');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

// Resolve-screen evidence: the real production checklist plus the real
// production resolve screen (StarterAssemblySetup) with stubbed transport.
// No app session, network request, Install or Estimate write is possible;
// the install mutation is a spy, so "Keep draft unchanged" proves zero
// mutation calls rather than a backend state.
function checklistBundle() {
  const ts = webRequire('typescript');
  const source = readFileSync('web/src/components/costbook/mapping-resolve-checklist.tsx', 'utf8');
  const compile = (text: string) => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  const modules: Record<string, string> = {};
  for (const [name, file] of [
    ['react', 'react.production.js'],
    ['react-dom', 'react-dom.production.js'],
    ['scheduler', 'scheduler.production.js'],
    ['react-dom/client', 'react-dom-client.production.js'],
    ['react/jsx-runtime', 'react-jsx-runtime.production.js'],
  ]) {
    const packageName = name === 'react/jsx-runtime' ? 'react' : name === 'react-dom/client' ? 'react-dom' : name;
    modules[name] = readFileSync(resolve(dirname(webRequire.resolve(`${packageName}/package.json`)), 'cjs', file), 'utf8');
  }
  modules.checklist = compile(source);
  const factories = Object.entries(modules).map(([name, body]) => `${JSON.stringify(name)}: function(module,exports,require){${body}\n}`).join(',');
  return `const modules={${factories}}, cache={};
    function require(name){if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;modules[name](module,module.exports,require);return module.exports;}
    const React=require('react');const {createRoot}=require('react-dom/client');
    const {MappingResolveChecklist}=require('checklist');
    const root=createRoot(document.getElementById('root'));
    window.renderChecklist=(props)=>{root.render(React.createElement(MappingResolveChecklist,props));};
    window.renderChecklist({mappedCount:0,totalCount:2,incompatibleLabel:null,incompatibleReasons:[],allMappedItemsActive:false,duplicateMapping:false});`;
}

function setupBundle() {
  const ts = webRequire('typescript');
  const source = readFileSync(process.env.TRADEOS_MAPPING_TEST_SOURCE ?? builderPath, 'utf8');
  const ast = ts.createSourceFile('builder.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const picker = ast.statements.find((node: { name?: { text: string } }) => node.name?.text === 'StarterComponentMappingPicker');
  const setup = ast.statements.find((node: { name?: { text: string } }) => node.name?.text === 'StarterAssemblySetup');
  if (!picker || !setup) throw new Error('Production mapping picker or resolve screen not found');
  const compile = (text: string) => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  const modules: Record<string, string> = {};
  for (const [name, file] of [
    ['react', 'react.production.js'],
    ['react-dom', 'react-dom.production.js'],
    ['scheduler', 'scheduler.production.js'],
    ['react-dom/client', 'react-dom-client.production.js'],
    ['react/jsx-runtime', 'react-jsx-runtime.production.js'],
  ]) {
    const packageName = name === 'react/jsx-runtime' ? 'react' : name === 'react-dom/client' ? 'react-dom' : name;
    modules[name] = readFileSync(resolve(dirname(webRequire.resolve(`${packageName}/package.json`)), 'cjs', file), 'utf8');
  }
  modules.model = compile(readFileSync('web/src/components/costbook/assembly-catalog-model.ts', 'utf8'));
  modules.checklist = compile(readFileSync('web/src/components/costbook/mapping-resolve-checklist.tsx', 'utf8'));
  const useQueryStub = `const useQuery = ({queryKey}) => {
    if (queryKey[0] === 'starter-assembly-cost-preview') {
      const ids = queryKey.slice(2);
      const complete = ids.length > 0 && ids.every(Boolean);
      return {data: complete ? {unitCost: 12.5} : undefined, isLoading: !complete, isFetching: false, isError: false};
    }
    window.mappingQuery = queryKey[2];
    return {data: window.mappingRows, isLoading: false, isFetching: queryKey[2] === 'pending', isError: queryKey[2] === 'error'};
  };`;
  const useMutationStub = `const useMutation = ({onSuccess, onError}) => {
    const [pending, setPending] = useState(false);
    return {mutate: () => {
      window.installCalls = (window.installCalls || 0) + 1;
      if (window.installMode === 'fail') { onError(new Error('Install failed in fixture')); return; }
      if (window.installMode === 'pending') { setPending(true); return; }
      onSuccess({id: 'asm-1', name: 'Fixture wall', code: 'FIX', unitOfMeasure: 'SF'});
    }, isPending: pending};
  };`;
  const sharedStubs = `
    const Input = (props) => <input {...props} />;
    const Button = (props) => <button {...props} />;
    const cn = (...values) => values.filter(Boolean).join(' ');
    const formatCurrency = (n) => '$' + Number(n).toFixed(2);
    const clientFetch = () => { throw new Error('network fixture: clientFetch must not run'); };
    ${useQueryStub}
    ${useMutationStub}`;
  modules.picker = compile(`
    import { useState, useEffect, useId } from 'react';
    import { assessCostItemMapping } from 'model';
    ${sharedStubs}
    ${picker.getText(ast)}
    export { StarterComponentMappingPicker };
  `);
  modules.setup = compile(`
    import { useState, useEffect, useRef } from 'react';
    import { assessCostItemMapping } from 'model';
    import { StarterComponentMappingPicker } from 'picker';
    import { MappingResolveChecklist } from 'checklist';
    ${sharedStubs}
    ${setup.getText(ast)}
    export { StarterAssemblySetup };
  `);
  const factories = Object.entries(modules).map(([name, body]) => `${JSON.stringify(name)}: function(module,exports,require){${body}\n}`).join(',');
  return `const modules={${factories}}, cache={};
    function require(name){if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;modules[name](module,module.exports,require);return module.exports;}
    const React=require('react');const {createRoot}=require('react-dom/client');
    const {StarterAssemblySetup}=require('setup');
    window.installCalls = 0; window.keepDraftCalls = 0; window.installedAssembly = null;
    function Fixture(){return React.createElement(StarterAssemblySetup,{template: window.setupTemplate, quantity: '1',
      onInstalled: (assembly) => { window.installedAssembly = assembly; },
      onKeepDraft: () => { window.keepDraftCalls++; }});}
    createRoot(document.getElementById('root')).render(React.createElement(Fixture));`;
}

const resolveTemplate = {
  id: 'tpl-1', code: 'TPL', name: 'Fixture wall', description: 'Fixture', unitOfMeasure: 'SF',
  csiDivision: '06', csiTitle: 'Wood', nahbGroup: 'Framing', trade: 'Carpentry',
  measurementBasis: 'Per SF', wasteGuidance: 'Allow waste.', version: 1,
  review: { status: 'research', source: 'Fixture', reviewedOn: '', regionalBasis: 'Fixture' },
  components: [
    { key: 'stud', label: 'Framing stud', quantityPerUnit: 1, help: 'Fixture', compatibleUnits: ['EA'], allowedCostItemKinds: ['material'] },
    { key: 'plate', label: 'Top plate', quantityPerUnit: 1, help: 'Fixture', compatibleUnits: ['LF'], allowedCostItemKinds: ['material'] },
  ],
};
const resolveRows = [
  { id: 'stud-item', code: 'STUD', name: 'Stud item', unitOfMeasure: 'EA', isActive: true, materialId: 'material', laborRateId: null, equipmentId: null, subcontractorId: null, productionRate: null },
  { id: 'plate-item', code: 'PLATE', name: 'Plate item', unitOfMeasure: 'LF', isActive: true, materialId: 'material', laborRateId: null, equipmentId: null, subcontractorId: null, productionRate: null },
];

for (const width of [390, 1440]) {
  test(`resolve checklist states at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: checklistBundle() });
    const checklist = page.locator('section[aria-label="Before you continue"]');
    await expect(checklist).toBeVisible();
    const render = (props: Record<string, unknown>) => page.evaluate((next) => {
      (window as unknown as { renderChecklist: (props: unknown) => void }).renderChecklist(next);
    }, props);
    const base = { mappedCount: 2, totalCount: 2, incompatibleLabel: null, incompatibleReasons: [], allMappedItemsActive: true, duplicateMapping: false };
    await render(base);
    await expect(checklist).toContainText('All 2 slots mapped.');
    await expect(checklist).toContainText('Each mapped item uses a compatible unit and cost type.');
    await expect(checklist).toContainText("Mapped items come from your organization's active Costbook.");
    await expect(checklist).toContainText('Adding keeps a price snapshot.');
    await render({ ...base, mappedCount: 1 });
    await expect(checklist).toContainText('Map 1 more component.');
    await render({ ...base, mappedCount: 0, allMappedItemsActive: false });
    await expect(checklist).toContainText('Map 2 more components.');
    await expect(checklist).toContainText('Waiting for mapped items.');
    await render({ ...base, incompatibleLabel: 'Framing stud', incompatibleReasons: ['Expected EA; found LF'] });
    await expect(checklist).toContainText('Framing stud needs a compatible unit and cost type: Expected EA; found LF.');
    await render({ ...base, duplicateMapping: true });
    await expect(checklist).toContainText('Each recipe slot must use a different Costbook item.');
    await render({ ...base, allMappedItemsActive: false });
    await expect(checklist).toContainText('Mapped items must be active items from your organization.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

  test(`resolve screen gates install, resolves, and keeps draft unchanged at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.setContent('<main id="root"></main>');
    await page.evaluate(({ template, rows }) => {
      const w = window as unknown as Record<string, unknown>;
      w.installMode = 'ok'; w.setupTemplate = template; w.mappingRows = rows;
    }, { template: resolveTemplate, rows: resolveRows });
    await page.addScriptTag({ content: setupBundle() });
    const screen = page.locator('section[aria-label="Resolve required assembly mapping"]');
    await expect(screen).toBeVisible();
    await expect(page.locator('h3[tabindex="-1"]')).toBeFocused();
    await expect(page.locator('h3[tabindex="-1"]')).toHaveText('Resolve required assembly mapping');
    const checklist = page.locator('section[aria-label="Before you continue"]');
    await expect(checklist).toContainText('Map 2 more components.');
    const resolve = page.getByRole('button', { name: 'Resolve Cost item mappings', exact: true });
    const keepDraft = page.getByRole('button', { name: 'Keep draft unchanged', exact: true });
    await expect(resolve).toBeDisabled();
    const studInput = page.getByRole('combobox', { name: 'Map Framing stud' });
    await studInput.click();
    await page.getByRole('option', { name: /STUD · Stud item/ }).click();
    await expect(studInput).toHaveValue('STUD · Stud item');
    await expect(checklist).toContainText('Map 1 more component.');
    await expect(resolve).toBeDisabled();
    const plateInput = page.getByRole('combobox', { name: 'Map Top plate' });
    await plateInput.click();
    await page.getByRole('option', { name: /PLATE · Plate item/ }).click();
    await expect(plateInput).toHaveValue('PLATE · Plate item');
    await expect(checklist).toContainText('All 2 slots mapped.');
    await expect(page.getByText('$12.50').first()).toBeVisible();
    await expect(resolve).toBeEnabled();
    await keepDraft.click();
    expect(await page.evaluate(() => (window as unknown as { keepDraftCalls: number }).keepDraftCalls)).toBe(1);
    expect(await page.evaluate(() => (window as unknown as { installCalls: number }).installCalls)).toBe(0);
    await resolve.click();
    expect(await page.evaluate(() => (window as unknown as { installCalls: number }).installCalls)).toBe(1);
    expect(await page.evaluate(() => (window as unknown as { installedAssembly: { name: string } | null }).installedAssembly?.name)).toBe('Fixture wall');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

  test(`install failure preserves mappings at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.setContent('<main id="root"></main>');
    await page.evaluate(({ template, rows }) => {
      const w = window as unknown as Record<string, unknown>;
      w.installMode = 'fail'; w.setupTemplate = template; w.mappingRows = rows;
    }, { template: resolveTemplate, rows: resolveRows });
    await page.addScriptTag({ content: setupBundle() });
    const studInput = page.getByRole('combobox', { name: 'Map Framing stud' });
    await studInput.click();
    await page.getByRole('option', { name: /STUD · Stud item/ }).click();
    const plateInput = page.getByRole('combobox', { name: 'Map Top plate' });
    await plateInput.click();
    await page.getByRole('option', { name: /PLATE · Plate item/ }).click();
    const resolve = page.getByRole('button', { name: 'Resolve Cost item mappings', exact: true });
    await expect(resolve).toBeEnabled();
    await resolve.click();
    await expect(page.getByRole('alert')).toHaveText('Install failed in fixture');
    await expect(studInput).toHaveValue('STUD · Stud item');
    await expect(plateInput).toHaveValue('PLATE · Plate item');
    await expect(resolve).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

  test(`install pending shows resolving state at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.setContent('<main id="root"></main>');
    await page.evaluate(({ template, rows }) => {
      const w = window as unknown as Record<string, unknown>;
      w.installMode = 'pending'; w.setupTemplate = template; w.mappingRows = rows;
    }, { template: resolveTemplate, rows: resolveRows });
    await page.addScriptTag({ content: setupBundle() });
    const studInput = page.getByRole('combobox', { name: 'Map Framing stud' });
    await studInput.click();
    await page.getByRole('option', { name: /STUD · Stud item/ }).click();
    const plateInput = page.getByRole('combobox', { name: 'Map Top plate' });
    await plateInput.click();
    await page.getByRole('option', { name: /PLATE · Plate item/ }).click();
    const resolve = page.getByRole('button', { name: 'Resolve Cost item mappings', exact: true });
    await expect(resolve).toBeEnabled();
    await resolve.click();
    await expect(page.getByRole('button', { name: 'Resolving…', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Keep draft unchanged', exact: true })).toBeDisabled();
    await expect(studInput).toBeDisabled();
    await expect(plateInput).toBeDisabled();
    expect(await page.evaluate(() => (window as unknown as { installCalls: number }).installCalls)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
