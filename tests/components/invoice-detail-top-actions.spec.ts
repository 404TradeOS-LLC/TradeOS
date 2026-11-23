import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

// DES-7 (a): Send invoice + Open PDF move to a top action row on mobile
// (390px) and stay in the aside at desktop widths. The detail page itself
// is a server component, so this spec bundles the extracted
// InvoiceTopActions row — the exact component the page renders — with the
// send server action stubbed, following the invoice-draft-recovery spec's
// harness.

const webRequire = createRequire(resolve('web/package.json'));
let bundle: string;
let css: string;
let directory: string;

test.beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'tradeos-invoice-top-actions-'));
  writeFileSync(join(directory, 'transport.ts'), `
    export const sendInvoiceAction=(data)=>{
      window.topActionAttempts.push(Object.fromEntries(data.entries()));
      return Promise.resolve();
    };
  `);
  writeFileSync(join(directory, 'entry.tsx'), `
    import React from 'react';import {createRoot} from 'react-dom/client';
    import {InvoiceTopActions} from '@/app/(app)/projects/[id]/invoices/[invoiceId]/top-actions';
    window.topActionAttempts=[];
    createRoot(document.getElementById('root')).render(<InvoiceTopActions isDraft projectId='synthetic-project' invoiceId='invoice-1'/>);
  `);
  writeFileSync(join(directory,'loader.cjs'),`const ts=require(${JSON.stringify(webRequire.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};`);
  const webpack=webRequire('next/dist/compiled/webpack/webpack').webpack;
  await new Promise<void>((done,fail)=>webpack({mode:'development',devtool:false,entry:join(directory,'entry.tsx'),output:{path:directory,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:{'@/app/actions/invoices':join(directory,'transport.ts'),'@':resolve('web/src')},modules:[resolve('web/node_modules'),'node_modules']},module:{rules:[{test:/\.tsx?$/,use:join(directory,'loader.cjs')}] }},(error:Error|null,stats:{hasErrors():boolean;toString():string})=>error?fail(error):stats.hasErrors()?fail(new Error(stats.toString())):done()));
  bundle=readFileSync(join(directory,'bundle.js'),'utf8');
  css=(await webRequire('postcss')([webRequire('@tailwindcss/postcss')({base:resolve('web')})]).process(readFileSync('web/src/app/globals.css','utf8'),{from:resolve('web/src/app/globals.css')})).css;
}, { timeout: 120_000 });
test.afterAll(()=>{if(directory)rmSync(directory,{recursive:true,force:true});});

for (const width of [390, 1440]) {
  test(`invoice top actions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent('<main id="root" style="padding:16px"></main>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    const send = page.getByRole('button', { name: 'Send invoice', exact: true });
    const pdf = page.getByRole('link', { name: 'Open PDF', exact: true });
    if (width === 390) {
      await expect(send).toBeVisible();
      await expect(pdf).toBeVisible();
      expect((await send.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect((await pdf.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      // Near the top of the page, not buried below the invoice body.
      expect((await send.boundingBox())!.y).toBeLessThan(200);
      expect((await pdf.boundingBox())!.y).toBeLessThan(200);
      await send.click();
      await expect.poll(() => page.evaluate(() => window.topActionAttempts.length)).toBe(1);
      expect(await page.evaluate(() => window.topActionAttempts[0])).toEqual({ invoiceId: 'invoice-1', projectId: 'synthetic-project' });
    } else {
      // At desktop widths the aside carries Send / Open PDF instead.
      await expect(send).toBeHidden();
      await expect(pdf).toBeHidden();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
