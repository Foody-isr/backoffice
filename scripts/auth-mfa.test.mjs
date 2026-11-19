import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture() {
  const storage = new Map();
  const requests = [];
  const compile = file => ts.transpileModule(fs.readFileSync(new URL('../src/lib/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const context = vm.createContext({exports:{}, process:{env:{}}, window:{location:{hostname:'localhost'}}, AbortSignal, Response, Headers, URL,
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    fetch:async(url,options)=>{
      requests.push({url,options});
      if (url.endsWith('/portal-session')) return Response.json({session:'fp1p.e30.fixture.00'});
      if (url.endsWith('/auth/security')) return Response.json({enabled:true,mfa_verified:true});
      return new Response(JSON.stringify(url.endsWith('/verify') ? {token:'synthetic-token',user:{id:1,role:'superadmin'},recovery_codes:['synthetic-once']} : {mfa_required:true,enrollment_required:true,challenge:'synthetic-proof',secret:'synthetic-seed'}),{status:url.endsWith('/verify')?200:202});
    },
    require:name=>{if(name==='./portal-session')return portal;if(name==='./mfa')return mfa;if(name==='@sentry/nextjs')return {withScope:()=>assert.fail('unexpected telemetry')};throw Error(name)},
  });
  vm.runInContext(compile('portal-session.ts'),context); const portal=context.exports;context.exports={};
  vm.runInContext(compile('mfa.ts'),context); const mfa=context.exports;
  context.exports={};vm.runInContext(compile('api.ts'),context);
  return {api:context.exports,storage,requests};
}
test('Backoffice withholds storage until the MFA prompt acknowledges recovery',async()=>{
  const {api,storage,requests}=fixture();
  await api.login('synthetic@example.test','synthetic-password',async(challenge,verify)=>{
    assert.equal(storage.size,0);assert.equal(challenge.challenge,'synthetic-proof');
    const result=await verify('123456');
    assert.equal(result.recovery_codes[0],'synthetic-once');assert.equal(storage.size,0);
    return result;
  });
  assert.equal(storage.get('foody_backoffice_portal_session'),'fp1p.e30.fixture.00');
  assert.equal(storage.has('foody_admin_token'),false);
  assert.equal(requests[2].options.credentials,'include');
  assert.equal(requests[3].options.credentials,'include');
  assert.equal(requests.length,4);
  assert.equal(requests[1].url,'http://localhost:8080/api/v1/auth/mfa/verify');
  assert.equal([...storage.values()].some(x=>x.includes('synthetic-seed')),false);
});
test('Clone MFA stays bound to the chosen environment and never stores its session',async()=>{
  const {api,storage,requests}=fixture();
  const result=await api.loginCloneEnvironment('development','synthetic@example.test','synthetic-password',async(_,verify)=>verify('123456'));
  assert.equal(result.token,'synthetic-token');assert.equal(storage.size,0);
  assert.equal(requests[0].url,'https://dev-api.foody-pos.co.il/api/v1/auth/login');
  assert.equal(requests[1].url,'https://dev-api.foody-pos.co.il/api/v1/auth/mfa/verify');
  assert.equal(requests[1].options.credentials,'omit');
  assert.equal(requests[1].options.redirect,'error');
});
test('A legacy caller cannot silently treat the MFA challenge as a session',async()=>{
  const {api,storage,requests}=fixture();
  await assert.rejects(api.login('synthetic@example.test','synthetic-password'),/Second-factor/);
  assert.equal(storage.size,0);assert.equal(requests.length,1);
});
