import {collectQueue} from '../lib/github.js';
export async function GET() {
  try {
    const result=await collectQueue();
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    // Do not print tokens, headers or provider responses.
    return Response.json({error:'GitHub evidence unavailable',detail:error instanceof Error ? error.message : 'Unknown error',readOnly:true},
      {status:503,headers:{'Cache-Control':'no-store'}});
  }
}
