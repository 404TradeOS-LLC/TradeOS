import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const webRequire = createRequire(resolve('web/package.json'));
const sourcePath = 'web/src/app/(app)/projects/[id]/estimates/[estimateId]/builder.tsx';
let bundle: string;
let css: string;
let directory: string;

test.beforeAll(async () => {
  // Production picker, React Query, Base UI Input/Button, Label and Tailwind.
  // Only transport is controlled: no auth session or server writes occur.
  const ts = webRequire('typescript');
  directory = mkdtempSync(join(tmpdir(), 'tradeos-catalog-controls-'));
  const ast = ts.createSourceFile('builder.tsx', readFileSync(process.env.TRADEOS_CATALOG_TEST_SOURCE ?? sourcePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions = ['LineItemPicker', 'ResultGroup', 'formatCurrency'].map(name => {
    const node = ast.statements.find((n: { name?: { text: string } }) => n.name?.text === name);
    if (!node) throw new Error(`Missing production function ${name}`);
    return node.getText(ast);
  }).join('\n');
  writeFileSync(join(directory, 'entry.tsx'), `
    import React, {useEffect,useId,useMemo,useRef,useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {QueryClient,QueryClientProvider,useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
    import {Input} from '@/components/ui/input';
    import {Button} from '@/components/ui/button';
    import {Label} from '@/components/ui/label';
    import {Badge} from '@/components/ui/badge';
    import {cn} from '@/lib/utils';
    import {canAddReviewedEstimateCatalogItem} from '@/lib/estimate-catalog-review';
    const costTypes=['labor','material','equipment','disposal','subcontractor','other'];
    const clientFetch=(url,options)=>{
      if(url.startsWith('/cost-database/cost-items/search'))return Promise.resolve([
        {id:'fixture-1',name:'Debris handling',code:'CC-FIXTURE-001',unitOfMeasure:'EA'},
        {id:'fixture-2',name:'Second synthetic cost item',code:'CC-FIXTURE-002',unitOfMeasure:'EA'}
      ]);
      if(url.endsWith('/unit-cost'))return new Promise((resolve,reject)=>{
        window.resolveCost=(value)=>resolve({totalUnitCost:value});
        window.rejectCost=()=>reject(new Error('Synthetic cost preview failure'));
      });
      if(options?.method==='POST')return new Promise((resolve,reject)=>{
        window.request={url,payload:JSON.parse(options.body)};
        window.finish=()=>resolve({id:'synthetic-line'});
        window.fail=()=>reject(new Error('Synthetic add failure'));
      });
      throw new Error('Unexpected synthetic transport path: '+url);
    };
    ${functions}
    function Fixture(){const [added,setAdded]=useState(0);return <QueryClientProvider client={client}><LineItemPicker estimateId="synthetic-estimate" active onAdded={()=>setAdded(n=>n+1)}/><output>{added}</output></QueryClientProvider>}
    const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
    createRoot(document.getElementById('root')).render(<Fixture/>);
  `);
  writeFileSync(join(directory, 'loader.cjs'), `const ts=require(${JSON.stringify(webRequire.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};`);
  const webpack = webRequire('next/dist/compiled/webpack/webpack').webpack;
  await new Promise<void>((done, fail) => webpack({
    mode: 'development', devtool: false, entry: join(directory, 'entry.tsx'),
    output: { path: directory, filename: 'bundle.js' },
    resolve: { extensions: ['.tsx','.ts','.js'], alias: {'@': resolve('web/src')}, modules: [resolve('web/node_modules'), 'node_modules'] },
    module: { rules: [{ test: /\.tsx?$/, use: join(directory, 'loader.cjs') }] },
  }, (error: Error | null, stats: { hasErrors(): boolean; toString(): string }) => error ? fail(error) : stats.hasErrors() ? fail(new Error(stats.toString())) : done()));
  bundle = readFileSync(join(directory, 'bundle.js'), 'utf8');
  const result = await webRequire('postcss')([webRequire('@tailwindcss/postcss')({base:resolve('web')})]).process(readFileSync('web/src/app/globals.css','utf8'), {from:resolve('web/src/app/globals.css')});
  css = result.css;
});
test.afterAll(() => { if (directory) rmSync(directory, {recursive:true,force:true}); });

for (const width of [390,768,1024,1440]) {
  test(`catalog targets, selection and cost/add recovery at ${width}px`, async ({page}, testInfo) => {
    await page.setViewportSize({width,height:1000});
    await page.route('https://tradeos-fixture.test/', route=>route.fulfill({contentType:'text/html',body:'<main id="root" style="padding:16px;max-width:1100px;margin:auto"></main>'}));
    await page.goto('https://tradeos-fixture.test/');
    await page.addStyleTag({content:css});
    await page.addScriptTag({content:bundle});
    await page.getByRole('button',{name:'Costbook',exact:true}).click();
    const search=page.getByRole('combobox',{name:'Search Costbook items'});
    const section=page.getByLabel('Section',{exact:true}).filter({visible:true});
    const qty=page.getByRole('spinbutton',{name:/^Quantity/});
    const type=page.getByLabel('Costbook cost type');
    const taxable=page.getByLabel('Costbook item is taxable');
    const add=page.getByRole('button',{name:'Add to estimate',exact:true});
    await expect(search).toBeFocused();
    await expect(add).toBeDisabled();
    for(const input of [search,section,qty])expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(width<1024?44:32);
    for(const control of [add,type])expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await taxable.evaluate(n=>n.parentElement!.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Tab');await expect(section).toBeFocused();
    await page.keyboard.press('Tab');await expect(qty).toBeFocused();
    await section.fill('Synthetic demolition');await qty.fill('2');
    await type.selectOption('disposal');await taxable.check();
    await search.fill('debris');
    await expect(page.getByRole('listbox',{name:'Costbook search results'}).getByRole('option')).toHaveCount(2);
    await search.press('ArrowDown');
    const second=await page.getByRole('listbox',{name:'Costbook search results'}).getByRole('option').nth(1).getAttribute('id');
    await expect(search).toHaveAttribute('aria-activedescendant',second!);
    await search.press('ArrowUp');await search.press('Enter');
    await expect(qty).toBeFocused();
    await expect(page.getByText('Resolving stored unit cost…')).toBeVisible();
    await expect(add).toBeDisabled();
    await page.evaluate(()=> (window as unknown as {rejectCost():void}).rejectCost());
    await expect(page.getByRole('alert')).toContainText('Synthetic cost preview failure');
    await expect(add).toBeDisabled();
    const clear=page.getByRole('button',{name:'Clear',exact:true});
    expect((await clear.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await clear.click();await expect(search).toBeFocused();await expect(search).toHaveValue('');
    await expect(section).toHaveValue('Synthetic demolition');await expect(qty).toHaveValue('2');
    await expect(type).toHaveValue('disposal');await expect(taxable).toBeChecked();
    await search.fill('debris');await expect(page.getByRole('listbox',{name:'Costbook search results'}).getByRole('option')).toHaveCount(2);
    await search.press('Enter');await expect(qty).toBeFocused();
    await expect(page.getByText('Resolving stored unit cost…')).toBeVisible();
    await page.evaluate(()=> (window as unknown as {resolveCost(v:number):void}).resolveCost(125));
    await expect(page.getByText('$250.00 estimated direct job cost for 2 EA.')).toBeVisible();
    await qty.fill('0');await expect(add).toBeDisabled();await expect(qty).toHaveAttribute('aria-invalid','true');
    await qty.fill('2');await expect(add).toBeEnabled();await add.click();
    await expect(page.getByRole('button',{name:'Adding…'})).toBeDisabled();
    const request=await page.evaluate(()=> (window as unknown as {request: {url:string,payload:Record<string,unknown>}}).request);
    expect(request.url).toBe('/estimates/synthetic-estimate/line-items');
    expect(request.payload).toMatchObject({costItemId:'fixture-1',quantity:2,section:'Synthetic demolition',costType:'disposal',taxable:true});
    expect(request.payload).not.toHaveProperty('unitCost');
    await page.evaluate(()=> (window as unknown as {fail():void}).fail());
    await expect(page.getByRole('alert')).toHaveText('Synthetic add failure');
    await expect(search).toHaveValue('Debris handling');await expect(qty).toHaveValue('2');
    await expect(section).toHaveValue('Synthetic demolition');await expect(type).toHaveValue('disposal');await expect(taxable).toBeChecked();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`catalog-failure-${width}.png`),fullPage:true});
    await add.click();await page.evaluate(()=> (window as unknown as {finish():void}).finish());
    await expect(page.locator('output')).toHaveText('1');await expect(search).toBeFocused();
    await expect(search).toHaveValue('');await expect(section).toHaveValue('Demolition');await expect(qty).toHaveValue('1');
    await expect(type).toHaveValue('');await expect(taxable).not.toBeChecked();await expect(add).toBeDisabled();
  });
}
