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
  directory = mkdtempSync(join(tmpdir(), 'tradeos-custom-controls-'));
  const ast = ts.createSourceFile('builder.tsx', readFileSync(process.env.TRADEOS_CUSTOM_TEST_SOURCE ?? sourcePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
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
    const clientFetch=(url,options)=>new Promise((resolve,reject)=>{
      window.request={url,payload:JSON.parse(options.body)};
      window.finish=()=>resolve({id:'synthetic-line'});
      window.fail=()=>reject(new Error('Synthetic request failure'));
    });
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
  test(`custom targets, keyboard order and request recovery at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.setContent('<main id="root" style="padding:16px;max-width:1100px;margin:auto"></main>');
    await page.addStyleTag({content:css});
    await page.addScriptTag({content:bundle});
    await page.getByRole('button',{name:'Custom item',exact:true}).click();
    const custom=page.locator('[id='+JSON.stringify(await page.getByRole('button',{name:'Custom item',exact:true}).getAttribute('aria-controls'))+']');
    const description=custom.getByLabel('Custom line item',{exact:true});
    const qty=custom.getByLabel('Qty',{exact:true});
    const cost=custom.getByLabel('Unit cost',{exact:true});
    const add=page.getByRole('button',{name:'Add custom',exact:true});
    await expect(description).toBeFocused();
    await expect(add).toBeDisabled();
    for(const control of [description,qty,cost,custom.getByLabel('Unit',{exact:true}),custom.getByLabel('Section',{exact:true})]){
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(width<1024?44:32);
    }
    expect((await add.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await custom.getByLabel('Cost type').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await custom.getByText('Taxable',{exact:true}).evaluate(n=>n.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await description.fill('Debris handling');
    await page.keyboard.press('Tab'); await expect(qty).toBeFocused();
    await page.keyboard.press('Tab'); await expect(cost).toBeFocused();
    await cost.fill('0');
    await page.keyboard.press('Tab'); await expect(add).toBeFocused();
    for(const name of ['Unit','Section','Cost type','Taxable']){
      await page.keyboard.press('Tab');await expect(custom.getByLabel(name,{exact:true})).toBeFocused();
    }
    await custom.getByLabel('Cost type',{exact:true}).selectOption('material');
    await custom.getByLabel('Taxable',{exact:true}).check();
    if(width>=1024){
      const y=await description.evaluate(n=>n.getBoundingClientRect().y);
      expect(Math.abs((await cost.boundingBox())!.y-y)).toBeLessThanOrEqual(1);
      expect(Math.abs((await add.boundingBox())!.y-y)).toBeLessThanOrEqual(1);
    }
    await qty.fill('0'); await expect(qty).toHaveAttribute('aria-invalid','true');await expect(add).toBeDisabled();
    await qty.fill('1');await cost.fill('-1');await expect(cost).toHaveAttribute('aria-invalid','true');await expect(add).toBeDisabled();
    await cost.fill('0');await add.click();
    await expect(page.getByRole('button',{name:'Adding…'})).toBeDisabled();await expect(description).toBeEnabled();
    await page.evaluate(()=> (window as unknown as {fail():void}).fail());
    await expect(page.getByRole('alert')).toHaveText('Synthetic request failure');
    await expect(description).toHaveValue('Debris handling');await expect(cost).toHaveValue('0');
    await page.screenshot({path:test.info().outputPath('custom-item-failure-'+width+'.png'),fullPage:true});
    await add.click();
    expect(await page.evaluate(()=> (window as unknown as {request:unknown}).request)).toEqual({url:'/estimates/synthetic-estimate/line-items',payload:{description:'Debris handling',unitOfMeasure:'EA',quantity:1,unitCost:0,section:'Reconstruction / Finish',costType:'material',taxable:true}});
    await page.evaluate(()=> (window as unknown as {finish():void}).finish());
    await expect(page.locator('output')).toHaveText('1');await expect(description).toHaveValue('');await expect(cost).toHaveValue('');await expect(add).toBeDisabled();
    await expect(custom.getByLabel('Cost type',{exact:true})).toHaveValue('labor');
    await expect(custom.getByLabel('Taxable',{exact:true})).not.toBeChecked();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
