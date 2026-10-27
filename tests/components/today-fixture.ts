import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import type { TodayData } from '../../web/src/lib/today-model';

/** Synthetic records only. Never imports a session, seed script or production API. */
export const syntheticTodayData: TodayData = {
  companyName: 'Synthetic Component Test Contractor',
  viewer: { name: 'Synthetic Owner', role: 'owner', presentation: 'owner', timeZone: 'America/Indiana/Indianapolis' },
  generatedAt: '2026-10-27T14:00:00.000Z',
  stats: [
    { id: 'active', label: 'Active jobs', value: 2, href: '/dispatch', helper: 'Synthetic test records' },
    { id: 'people', label: 'Assigned people', value: 2, href: '/dispatch', helper: 'Synthetic test records' },
    { id: 'tasks', label: 'Tasks due', value: 1, href: '/dashboard/work', helper: 'Synthetic test records' },
    { id: 'attention', label: 'Needs attention', value: 3, href: '/dashboard/needs-you', helper: 'Synthetic test records' },
    { id: 'approvals', label: 'Pending approvals', value: null, href: '/athena/approvals', helper: 'Unavailable' },
    { id: 'conflicts', label: 'Schedule conflicts', value: 0, href: '/dispatch', helper: 'Synthetic test records' },
  ],
  attention: [
    { id: 'test-blocker', title: 'Synthetic kitchen task blocked', context: 'Synthetic Kitchen · Delivery delayed', source: 'Tasks', priority: 'urgent', assignee: 'Synthetic Field Lead', dueAt: '2026-10-26T00:00:00.000Z', href: '/projects/11111111-1111-4111-8111-111111111111?tab=tasks', action: 'Resolve blocker', status: 'blocked', task: { projectId: '11111111-1111-4111-8111-111111111111', taskId: '44444444-4444-4444-8444-444444444444', status: 'blocked', updatedAt: '2026-10-26T12:00:00.000Z' } },
    { id: 'test-proposal', title: 'Synthetic deck proposal needs follow-up', context: 'Synthetic Deck · Customer decision overdue', source: 'Proposals', priority: 'high', assignee: 'Synthetic Office', dueAt: '2026-10-25T14:00:00.000Z', href: '/projects/22222222-2222-4222-8222-222222222222/proposals/test-proposal', action: 'Review proposal' },
    { id: 'test-invoice', title: 'Synthetic invoice overdue', context: 'Synthetic Porch · Saved invoice requires review', source: 'Invoices', priority: 'medium', assignee: null, dueAt: '2026-10-24T00:00:00.000Z', href: '/projects/33333333-3333-4333-8333-333333333333/invoices/test-invoice', action: 'Review invoice' },
  ],
  work: [
    { id: 'test-job', title: 'Synthetic kitchen framing', context: 'Synthetic Kitchen · Job #TEST-001', kind: 'job', start: '2026-10-27T13:00:00.000Z', end: '2026-10-27T16:00:00.000Z', assignee: 'Synthetic Field Lead', status: 'on_site', href: '/projects/11111111-1111-4111-8111-111111111111' },
    { id: 'test-task', title: 'Synthetic permit check', context: 'Synthetic Deck · Assigned task', kind: 'task', start: null, end: null, assignee: 'Synthetic Office', status: 'todo', task: { projectId: '22222222-2222-4222-8222-222222222222', taskId: '55555555-5555-4555-8555-555555555555', status: 'todo', updatedAt: '2026-10-26T12:00:00.000Z' }, href: '/projects/22222222-2222-4222-8222-222222222222?tab=tasks' },
    { id: 'test-visit', title: 'Synthetic customer site visit', context: 'Synthetic Porch · Intake visit', kind: 'visit', start: '2026-10-27T18:00:00.000Z', end: '2026-10-27T19:00:00.000Z', assignee: 'Synthetic Office', status: 'scheduled', href: '/projects/33333333-3333-4333-8333-333333333333?tab=site-visits' },
  ],
  progress: [],
  upcoming: [],
  sources: [{ id: 'tasks', label: 'Project tasks', state: 'ready' }, { id: 'proposals', label: 'Proposals', state: 'ready' }],
  athenaEnabled: false,
};

export async function buildTodayFixture() {
  const webRequire = createRequire(resolve('web/package.json'));
  const directory = mkdtempSync(join(tmpdir(), 'tradeos-today-components-'));
  try {
    const tsPath = webRequire.resolve('typescript');
    writeFileSync(join(directory, 'loader.cjs'), `const ts=require(${JSON.stringify(tsPath)});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};`);
    writeFileSync(join(directory, 'ignore-css.cjs'), 'module.exports=function(){return "";};');
    writeFileSync(join(directory, 'next-link.tsx'), `
      import React from 'react';
      export default React.forwardRef(function TestNextLink({href,children,prefetch,replace,scroll,onClick,...props},ref){
        return <a {...props} ref={ref} href={href} onClick={event=>{onClick?.(event);event.preventDefault();window.__testNavigation=href;}}>{children}</a>;
      });
    `);
    writeFileSync(join(directory, 'next-navigation.ts'), `
      const router={refresh(){window.__testRefreshes=(window.__testRefreshes||0)+1;},push(href){window.__testNavigation=href;},replace(href){window.__testNavigation=href;}};
      export const useRouter=()=>router;
      export const usePathname=()=>window.location.pathname;
    `);
    writeFileSync(join(directory, 'auth.ts'), 'export async function logoutAction(){throw new Error("Authentication mutations are disabled in synthetic component tests");}');
    writeFileSync(join(directory, 'entry.tsx'), `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {TodayExperience} from '@/components/dashboard/today-experience';
      import {AppNav} from '@/components/shared/app-nav';
      import {GlobalCommandPaletteProvider} from '@/components/shared/global-command-palette';
      import {THEME_INIT_SCRIPT} from '@/lib/theme';
      const params=new URLSearchParams(location.search);
      const data=${JSON.stringify(syntheticTodayData)};
      if(params.get('role')==='office'){data.viewer={...data.viewer,name:'Synthetic Office',role:'dispatcher',presentation:'office'};}
      if(params.get('role')==='field'){
        data.viewer={...data.viewer,name:'Synthetic Field Lead',role:'technician',presentation:'field'};
        data.attention=[];data.work=data.work.filter(item=>item.kind==='job');
        data.work=data.work.map(item=>({...item,href:'/field?job=test-job'}));
        data.stats=data.stats.map(stat=>({...stat,value:stat.id==='attention'?0:stat.value}));
        data.sources=[{id:'commercial',label:'Commercial work',state:'restricted',message:'Field test role receives assigned work only.'}];
      }
      if(params.get('failure')==='attention'){
        data.stats=data.stats.map(stat=>stat.id==='attention'?{...stat,value:null}:stat);
        data.sources.push({id:'invoices',label:'Invoices',state:'unavailable',message:'Synthetic source outage'});
      }
      if(!localStorage.getItem('tradeos-theme'))localStorage.setItem('tradeos-theme',params.get('theme')||'light');
      new Function(THEME_INIT_SCRIPT)();
      createRoot(document.getElementById('root')).render(<GlobalCommandPaletteProvider><AppNav email="synthetic@example.invalid" currentRole={data.viewer.role} athenaEnabled={false}/><main id="main-content" className="mx-auto w-full max-w-[96rem] flex-1 px-4 py-5 pb-28 sm:px-6 lg:px-8"><TodayExperience data={data} initialView={params.get('view')||'today'}/></main></GlobalCommandPaletteProvider>);
    `);
    const webpack = webRequire('next/dist/compiled/webpack/webpack').webpack;
    await new Promise<void>((done, fail) => webpack({
      mode: 'development', devtool: false, entry: join(directory, 'entry.tsx'),
      output: { path: directory, filename: 'bundle.js' },
      resolve: { extensions: ['.tsx', '.ts', '.js'], alias: {
        'next/link$': join(directory, 'next-link.tsx'),
        'next/navigation$': join(directory, 'next-navigation.ts'),
        '@/app/actions/auth$': join(directory, 'auth.ts'),
        '@': resolve('web/src'),
      }, modules: [resolve('web/node_modules'), 'node_modules'] },
      module: { rules: [{ test: /\.tsx?$/, use: join(directory, 'loader.cjs') }, { test: /\.css$/, use: join(directory, 'ignore-css.cjs') }] },
    }, (error: Error | null, stats: { hasErrors(): boolean; toString(): string }) => error ? fail(error) : stats.hasErrors() ? fail(new Error(stats.toString())) : done()));
    const result = await webRequire('postcss')([webRequire('@tailwindcss/postcss')({ base: resolve('web') })]).process(readFileSync('web/src/app/globals.css', 'utf8'), { from: resolve('web/src/app/globals.css') });
    const bundle = readFileSync(join(directory, 'bundle.js'), 'utf8');
    const css = result.css + '\n' + readFileSync('web/src/components/dashboard/today-experience.css', 'utf8');
    const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>' + css + '</style></head><body class="min-h-full flex flex-col"><div id="root"></div><script>' + bundle.replaceAll('</script', '<\\/script') + '</script></body></html>';
    return { html, bundle, css, directory, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}
