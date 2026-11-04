export function GET() {
  return Response.json({
    service:'tradeos-forge-worker',status:'online',version:'0.1.0',mode:'read-only',
    githubAuthConfigured:Boolean(process.env.GITHUB_READ_TOKEN),
    cronConfigured:Boolean(process.env.CRON_SECRET),
    codeExecutionEnabled:false,mergeEnabled:false,productionAccess:false
  },{headers:{'Cache-Control':'no-store'}});
}
