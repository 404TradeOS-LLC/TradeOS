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
