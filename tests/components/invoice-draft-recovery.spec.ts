import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const webRequire = createRequire(resolve('web/package.json'));
let bundle: string;
let css: string;
let directory: string;

test.beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'tradeos-invoice-recovery-'));
  writeFileSync(join(directory, 'transport.ts'), `
    export const createInvoiceAction=(data)=>{
      window.invoiceAttempts.push(Object.fromEntries(data.entries()));
      return new Promise(resolve=>{
        window.loseInvoiceResponse=()=>resolve({error:'Could not confirm whether the draft was saved.',unconfirmed:true});
        window.rejectInvoice=()=>resolve({error:'Enter a valid due date.'});
        window.confirmInvoice=()=>resolve({invoiceId:'confirmed-invoice'});
      });
    };
  `);
  writeFileSync(join(directory, 'navigation.ts'), `export const useRouter=()=>({replace:(url)=>{window.invoiceDestination=url;}});`);
  writeFileSync(join(directory, 'entry.tsx'), `
    import React from 'react';import {createRoot} from 'react-dom/client';
    import {NewInvoiceForm} from '@/app/(app)/projects/[id]/invoices/new/form';
    window.invoiceAttempts=[];
    createRoot(document.getElementById('root')).render(<NewInvoiceForm projectId='synthetic-project' projectName='Synthetic kitchen' customerName='Synthetic customer' estimates={[]} proposals={[]} createRequestKey='d86d0874-6ba3-4b06-94b6-bd0ae99fe532'/>);
  `);
  writeFileSync(join(directory,'loader.cjs'),`const ts=require(${JSON.stringify(webRequire.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};`);
  const webpack=webRequire('next/dist/compiled/webpack/webpack').webpack;
  await new Promise<void>((done,fail)=>webpack({mode:'development',devtool:false,entry:join(directory,'entry.tsx'),output:{path:directory,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:{'@/app/actions/invoices':join(directory,'transport.ts'),'next/navigation':join(directory,'navigation.ts'),'@':resolve('web/src')},modules:[resolve('web/node_modules'),'node_modules']},module:{rules:[{test:/\.tsx?$/,use:join(directory,'loader.cjs')}] }},(error:Error|null,stats:{hasErrors():boolean;toString():string})=>error?fail(error):stats.hasErrors()?fail(new Error(stats.toString())):done()));
  bundle=readFileSync(join(directory,'bundle.js'),'utf8');
  css=(await webRequire('postcss')([webRequire('@tailwindcss/postcss')({base:resolve('web')})]).process(readFileSync('web/src/app/globals.css','utf8'),{from:resolve('web/src/app/globals.css')})).css;
});
test.afterAll(()=>{if(directory)rmSync(directory,{recursive:true,force:true});});

for(const width of [390,768,1024,1440]){
  test(`invoice targets, error focus and unchanged retry at ${width}px`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:900});
    await page.setContent('<main id="root" style="padding:16px"></main>');
    await page.addStyleTag({content:css});await page.addScriptTag({content:bundle});
    await expect(page.getByRole('region',{name:'Project and customer'})).toContainText('Synthetic kitchen · Synthetic customer');
    const description=page.getByLabel('Description',{exact:true});
    const quantity=page.getByLabel('Quantity',{exact:true});
    const price=page.getByLabel('Unit price ($)',{exact:true});
    const due=page.getByLabel('Due date',{exact:true});
    for(const control of [description,quantity,price,due,page.getByLabel('Estimate',{exact:true}),page.getByRole('button',{name:'Create invoice',exact:true}),page.getByRole('button',{name:'Add line item',exact:true})]){
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    if(width===390){expect((await price.boundingBox())!.y).toBeGreaterThan((await quantity.boundingBox())!.y);}
    await description.fill('Synthetic cleanup');await price.fill('300');await due.fill('11/30/2026');
    await page.getByRole('button',{name:'Add line item',exact:true}).click();
    await page.getByLabel('Line 2 · Description',{exact:true}).fill('Synthetic trim');
    await page.getByLabel('Line 2 · Quantity',{exact:true}).fill('2');
    await page.getByLabel('Line 2 · Unit price ($)',{exact:true}).fill('45');
    await expect(page.getByRole('button',{name:'Remove line 2',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Create invoice',exact:true}).click();
    await expect(description).toBeDisabled();
    await page.evaluate(()=>window.rejectInvoice());
    await expect(page.getByRole('alert')).toBeFocused();
    await expect(description).toBeEnabled();
    await page.getByRole('button',{name:'Create invoice',exact:true}).click();
    await page.evaluate(()=>window.loseInvoiceResponse());
    await expect(page.getByRole('alert')).toBeFocused();
    await expect(page.getByRole('region',{name:'Last submitted details'})).toContainText('Synthetic cleanup');
    await expect(page.getByRole('region',{name:'Last submitted details'})).toContainText('Synthetic trim');
    await expect(page.getByRole('region',{name:'Last submitted details'})).toContainText('11/30/2026');
    await expect(description).toBeHidden();
    await page.screenshot({path:testInfo.outputPath(`invoice-unconfirmed-${width}.png`),fullPage:true});
    const submitted=await page.evaluate(()=>window.invoiceAttempts[1]);
    const retry=page.getByRole('button',{name:'Retry same draft',exact:true});
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await retry.click();await expect(description).toBeDisabled();await expect(description).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>window.invoiceAttempts.length)).toBe(3);
    expect(await page.evaluate(()=>window.invoiceAttempts[2])).toEqual(submitted);
    await page.evaluate(()=>window.confirmInvoice());
    await expect.poll(()=>page.evaluate(()=>window.invoiceDestination)).toBe('/projects/synthetic-project/invoices/confirmed-invoice');
    await expect(page.getByRole('button',{name:'Draft saved',exact:true})).toBeDisabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
