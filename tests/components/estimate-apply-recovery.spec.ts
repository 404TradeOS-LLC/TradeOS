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
  // Production review component/helper; only transport and Next Link are synthetic.
  directory = mkdtempSync(join(tmpdir(), 'tradeos-apply-recovery-'));
  writeFileSync(join(directory, 'next-link.tsx'), `
    import React from 'react';
    export default function Link({href,children,...props}){return <a href={typeof href==='string'?href:href.pathname} {...props}>{children}</a>;}
  `);
  writeFileSync(join(directory, 'transport.ts'), `
    export class ClientApiError extends Error {constructor(message,status){super(message);this.status=status;}}
    export const clientFetch=(url,options)=>{
      if(url.endsWith('/ai-estimator/apply')){
        window.applyRequests.push({url,body:options.body});
        return new Promise((resolve,reject)=>{
          window.acknowledgeApply=()=>resolve({applied:[{draftLineItemId:'reviewed-line',lineItemId:'synthetic-saved-line',quantity:2}],skipped:[]});
          window.failApply=()=>reject(new Error('Synthetic response lost'));
          window.rejectApply=()=>reject(new ClientApiError('Synthetic validation failed',400));
        });
      }
      if(url.endsWith('/ai-estimator/draft')){
        window.generationRequests.push({url,body:options.body});
        return new Promise(resolve=>{window.finishGeneration=()=>resolve(window.syntheticDraft);});
      }
      if(!options?.method)return Promise.resolve([]);
      throw new Error('Unexpected synthetic write: '+url);
    };
  `);
  writeFileSync(join(directory, 'entry.tsx'), `
    import React,{useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
    import {AIEstimateAssist} from '@/components/estimate-assist/ai-estimate-assist';
    window.applyRequests=[];window.generationRequests=[];
    window.syntheticDraft={scopeOfWork:'Synthetic reviewed deck scope',detectedTrade:'Carpentry',confidenceScore:80,
      validation:{status:'ready_for_review',missingInformation:[],warnings:[]},lineItems:[{
        draftLineItemId:'reviewed-line',targetKind:'assembly',targetId:'catalog-assembly',targetName:'Synthetic deck assembly',targetCode:'SYN-DECK',
        description:'Reviewed deck framing',rationale:'Synthetic reviewed quantity',quantity:1,unitOfMeasure:'assembly',confidence:80,
        provenanceStatus:'unverified-legacy',reviewToken:'synthetic-review-token',
        targetResolution:{target:{id:'catalog-assembly',kind:'assembly',name:'Synthetic deck assembly',code:'SYN-DECK',unitOfMeasure:'assembly'},reason:'Synthetic match'}
      }]};
    const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
    function Fixture(){
      const [id,setId]=useState('estimate-a');
      window.changeApplyRecord=()=>setId('estimate-b');
      return <QueryClientProvider client={client}><AIEstimateAssist key={'project-a:'+id}
        projectId='project-a' estimateId={id} initialScopeOfWork='Synthetic reviewed deck scope'
        initialSuggestions={[]} initialStructuredDraft={window.syntheticDraft} initialKnowledgeStats={null}
        initialKnowledgeTrades={[]} initialKnowledgeMatch={null}/></QueryClientProvider>;
    }
    createRoot(document.getElementById('root')).render(<Fixture/>);
  `);
  writeFileSync(join(directory, 'loader.cjs'), `const ts=require(${JSON.stringify(webRequire.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};`);
  const webpack=webRequire('next/dist/compiled/webpack/webpack').webpack;
  await new Promise<void>((done,fail)=>webpack({
    mode:'development',devtool:false,entry:join(directory,'entry.tsx'),output:{path:directory,filename:'bundle.js'},
    resolve:{extensions:['.tsx','.ts','.js'],alias:{
      '@/lib/clientApi$':join(directory,'transport.ts'),
      'next/link$':join(directory,'next-link.tsx'),
      '@':resolve('web/src'),
    },modules:[resolve('web/node_modules'),'node_modules']},
    module:{rules:[{test:/\.tsx?$/,use:join(directory,'loader.cjs')}]},
  },(error:Error|null,stats:{hasErrors():boolean;toString():string})=>error?fail(error):stats.hasErrors()?fail(new Error(stats.toString())):done()));
  bundle=readFileSync(join(directory,'bundle.js'),'utf8');
  css=(await webRequire('postcss')([webRequire('@tailwindcss/postcss')({base:resolve('web')})])
    .process(readFileSync('web/src/app/globals.css','utf8'),{from:resolve('web/src/app/globals.css')})).css;
});
test.afterAll(()=>{if(directory)rmSync(directory,{recursive:true,force:true});});

for(const width of [390,768,1024,1440]){
  test(`Apply preserves one review through failure, retry and record navigation at ${width}px`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:900});
    await page.setContent('<main id="root" style="padding:16px"></main>');
    await page.addStyleTag({content:css});
    await page.addScriptTag({content:bundle});
    const scope=page.getByRole('textbox',{name:'Scope of work',exact:true});
    const quantity=page.getByRole('spinbutton',{name:'Suggestion quantity',exact:true});
    await expect(scope).toHaveValue('Synthetic reviewed deck scope');
    await quantity.fill('2');
    await page.getByRole('button',{name:'Accept',exact:true}).click();
    const apply=page.getByRole('button',{name:'Add 1 accepted suggestion to estimate',exact:true});
    await apply.focus();
    await apply.press('Enter');
    await expect.poll(()=>page.evaluate(()=>window.applyRequests.length)).toBe(1);
    const first=await page.evaluate(()=>window.applyRequests[0]);
    expect(JSON.parse(first.body).lineItems[0]).toMatchObject({draftLineItemId:'reviewed-line',quantity:2,reviewToken:'synthetic-review-token'});
    await expect(scope).toBeDisabled();
    await expect(quantity).toBeDisabled();
    await expect(page.getByRole('button',{name:'Run Athena review',exact:true})).toBeDisabled();
    await expect(page.getByRole('button',{name:'Applying accepted suggestions…',exact:true})).toBeDisabled();
    await page.evaluate(()=>window.failApply());
    await expect(page.getByRole('alert')).toContainText('Apply was not confirmed');
    await expect(quantity).toHaveValue('2');
    await expect(quantity).toBeDisabled();
    await expect(page.getByRole('link',{name:'Check saved Items',exact:true})).toHaveAttribute('href','/projects/project-a/estimates/estimate-a');
    expect(await page.evaluate(()=>window.applyRequests.length)).toBe(1);
    await page.screenshot({path:testInfo.outputPath(`apply-unconfirmed-${width}.png`),fullPage:true,animations:'disabled'});

    const retry=page.getByRole('button',{name:'Retry unchanged review',exact:true});
    await expect(retry).toBeFocused();
    await retry.press('Space');
    await expect.poll(()=>page.evaluate(()=>window.applyRequests.length)).toBe(2);
    expect(await page.evaluate(()=>window.applyRequests[1])).toEqual(first);
    await page.evaluate(()=>window.acknowledgeApply());
    await expect(page.getByText('Latest apply result',{exact:true})).toBeVisible();
    await expect(quantity).toBeEnabled();
    await quantity.fill('3');
    await expect(page.getByText('Latest apply result',{exact:true})).toHaveCount(0);

    await page.getByRole('button',{name:'Add 1 accepted suggestion to estimate',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.applyRequests.length)).toBe(3);
    await page.evaluate(()=>window.rejectApply());
    await expect(page.getByRole('alert')).toContainText('Apply was rejected');
    await expect(page.getByRole('alert')).not.toContainText('Apply was not confirmed');
    await expect(quantity).toBeEnabled();
    await expect(scope).toBeEnabled();
    await page.screenshot({path:testInfo.outputPath(`apply-rejected-${width}.png`),fullPage:true,animations:'disabled'});
    await page.getByRole('textbox',{name:'Estimate description',exact:true}).fill('Corrected reviewed deck framing');
    await quantity.fill('4');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button',{name:'Add 1 accepted suggestion to estimate',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.applyRequests.length)).toBe(4);
    expect(JSON.parse(await page.evaluate(()=>window.applyRequests[3].body)).lineItems[0]).toMatchObject({quantity:4,description:'Corrected reviewed deck framing'});
    await page.evaluate(()=>window.acknowledgeApply());
    await expect(quantity).toBeEnabled();
    await quantity.fill('5');
    await page.getByRole('button',{name:'Add 1 accepted suggestion to estimate',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.applyRequests.length)).toBe(5);
    await page.evaluate(()=>window.changeApplyRecord());
    await expect(quantity).toHaveValue('1');
    await page.evaluate(()=>window.acknowledgeApply());
    await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
    await expect(page.getByText('Latest apply result',{exact:true})).toHaveCount(0);
    await expect(quantity).toHaveValue('1');

    // Generation and Apply cannot race to replace the review under a pending write.
    await page.getByRole('button',{name:'Accept',exact:true}).click();
    await page.getByRole('button',{name:'Run Athena review',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.generationRequests.length)).toBe(1);
    await expect(page.getByRole('button',{name:'Add 1 accepted suggestion to estimate',exact:true})).toBeDisabled();
    await expect(scope).toBeDisabled();
    expect(await page.evaluate(()=>window.applyRequests.length)).toBe(5);
    await page.evaluate(()=>window.finishGeneration());
    await expect(scope).toBeEnabled();
  });
}
