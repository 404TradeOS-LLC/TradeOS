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
  // Real Builder, editor, contextual panel and navigation helper. Only router
  // and transport are synthetic; no session, backend or durable write exists.
  directory = mkdtempSync(join(tmpdir(), 'tradeos-review-continuity-'));
  writeFileSync(join(directory, 'router.ts'), `
    export const useRouter=()=>({push:(href)=>window.reviewNavigations.push(href)});
  `);
  writeFileSync(join(directory, 'next-link.tsx'), `
    import React from 'react';
    export default function Link({href,children,...props}){return <a href={typeof href==='string'?href:href.pathname} {...props}>{children}</a>;}
  `);
  writeFileSync(join(directory, 'transport.ts'), `
    export const clientFetch=(url,options)=>{
      if(url.startsWith('/projects/')&&options?.method==='PATCH'){
        window.scopeRequests.push(JSON.parse(options.body));
        return new Promise((resolve,reject)=>{
          window.finishScopeSave=()=>resolve({simpleScope:JSON.parse(options.body).simpleScope});
          window.failScopeSave=()=>reject(new Error('Synthetic scope-save failure'));
        });
      }
      if(url.startsWith('/estimates/')&&!options?.method)return Promise.resolve({
        id:url.split('/')[2],projectId:'fixture-project',version:1,status:'draft',
        subtotalCost:0,costAfterOverhead:0,preTaxTotalPrice:0,totalPrice:0,
        overheadPct:0,markupPct:0,taxPct:0,taxAmount:0,targetMarginPct:null,lineItems:[]
      });
      if(!options?.method)return Promise.resolve([]);
      throw new Error('Unexpected synthetic write: '+url);
    };
  `);
  writeFileSync(join(directory, 'entry.tsx'), `
    import React,{useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
    import {EstimateBuilder} from '@/app/(app)/projects/[id]/estimates/[estimateId]/builder';
    window.reviewNavigations=[];window.scopeRequests=[];
    const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
    function Fixture(){
      const [id,setId]=useState('fixture-estimate');
      window.changeReviewRecord=()=>setId('fixture-estimate-b');
      return <QueryClientProvider client={client}><EstimateBuilder key={'fixture-project:'+id}
        projectId="fixture-project" projectName="Synthetic review continuity"
        estimateId={id} simpleScope="Original saved scope"/></QueryClientProvider>;
    }
    createRoot(document.getElementById('root')).render(<Fixture/>);
  `);
  writeFileSync(join(directory, 'loader.cjs'), `const ts=require(${JSON.stringify(webRequire.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};`);
  const webpack = webRequire('next/dist/compiled/webpack/webpack').webpack;
  await new Promise<void>((done, fail) => webpack({
    mode:'development',devtool:false,entry:join(directory,'entry.tsx'),
    output:{path:directory,filename:'bundle.js'},
    resolve:{extensions:['.tsx','.ts','.js'],alias:{
      '@/lib/clientApi$':join(directory,'transport.ts'),
      'next/link$':join(directory,'next-link.tsx'),
      'next/navigation$':join(directory,'router.ts'),
      '@':resolve('web/src'),
    },modules:[resolve('web/node_modules'),'node_modules']},
    module:{rules:[{test:/\.tsx?$/,use:join(directory,'loader.cjs')}]},
  },(error:Error|null,stats:{hasErrors():boolean;toString():string})=>error?fail(error):stats.hasErrors()?fail(new Error(stats.toString())):done()));
  bundle=readFileSync(join(directory,'bundle.js'),'utf8');
  const result=await webRequire('postcss')([webRequire('@tailwindcss/postcss')({base:resolve('web')})])
    .process(readFileSync('web/src/app/globals.css','utf8'),{from:resolve('web/src/app/globals.css')});
  css=result.css;
});
test.afterAll(()=>{if(directory)rmSync(directory,{recursive:true,force:true});});

for(const width of [390,768,1024,1440]){
  test(`review navigation acknowledges scope, recovers, and cancels stale entry at ${width}px`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:900});
    await page.setContent('<main id="root" style="padding:16px"></main>');
    await page.addStyleTag({content:css});
    await page.addScriptTag({content:bundle});
    const scope=page.getByRole('textbox',{name:'Estimate scope',exact:true});
    const header=page.getByRole('button',{name:'Athena review',exact:true});
    const context=page.getByRole('button',{name:'Open full review workspace →',exact:true});
    await expect(scope).toHaveValue('Original saved scope');

    await scope.fill('Current reviewed scope B');
    await header.focus();
    await header.press('Enter');
    await expect.poll(()=>page.evaluate(()=>window.scopeRequests.length)).toBe(1);
    expect(await page.evaluate(()=>window.scopeRequests[0])).toEqual({simpleScope:'Current reviewed scope B'});
    expect(await page.evaluate(()=>window.reviewNavigations)).toEqual([]);
    await expect(scope).toBeDisabled();
    await expect(page.getByRole('button',{name:'Saving scope…',exact:true}).first()).toBeDisabled();
    await page.evaluate(()=>window.finishScopeSave());
    await expect.poll(()=>page.evaluate(()=>window.reviewNavigations.length)).toBe(1);
    expect(await page.evaluate(()=>window.reviewNavigations[0])).toBe('/projects/fixture-project/estimates/fixture-estimate/assist');

    // The second entry uses the same clean-scope path without another write.
    await context.press('Enter');
    await expect.poll(()=>page.evaluate(()=>window.reviewNavigations.length)).toBe(2);
    expect(await page.evaluate(()=>window.scopeRequests.length)).toBe(1);
    await page.evaluate(()=>{window.reviewNavigations=[];});

    await scope.fill('Retain scope C after failure');
    await context.press('Space');
    await expect.poll(()=>page.evaluate(()=>window.scopeRequests.length)).toBe(2);
    await page.evaluate(()=>window.failScopeSave());
    await expect(page.getByRole('alert').filter({hasText:'Your scope is still in the editor'})).toBeVisible();
    await expect(scope).toHaveValue('Retain scope C after failure');
    expect(await page.evaluate(()=>window.reviewNavigations)).toEqual([]);
    await page.screenshot({path:testInfo.outputPath(`scope-review-failure-${width}.png`),fullPage:true,animations:'disabled'});

    await header.click();
    await expect.poll(()=>page.evaluate(()=>window.scopeRequests.length)).toBe(3);
    expect(await page.evaluate(()=>window.scopeRequests[2])).toEqual({simpleScope:'Retain scope C after failure'});
    await page.evaluate(()=>window.finishScopeSave());
    await expect.poll(()=>page.evaluate(()=>window.reviewNavigations.length)).toBe(1);
    await page.evaluate(()=>{window.reviewNavigations=[];});

    await scope.fill('Obsolete scope D');
    await header.click();
    await expect.poll(()=>page.evaluate(()=>window.scopeRequests.length)).toBe(4);
    await page.evaluate(()=>window.changeReviewRecord());
    await expect(scope).toHaveValue('Original saved scope');
    await page.evaluate(()=>window.finishScopeSave());
    await page.evaluate(()=>new Promise<void>((done)=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
    await expect(page.getByRole('textbox',{name:'Estimate scope',exact:true})).toHaveValue('Original saved scope');
    expect(await page.evaluate(()=>window.reviewNavigations)).toEqual([]);
  });
}

