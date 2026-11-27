const {test} = require('node:test');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const path = require('node:path');
const password = 'test-only-gate-password';
const auth = 'Basic ' + Buffer.from('demo:' + password).toString('base64');
async function server(env={}) {
  const port = 31000 + Math.floor(Math.random()*20000);
  const child = spawn(process.execPath,['--require',path.join(__dirname,'mock-db.cjs'),'server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),COOKIE_SECURE:'false',EPHARMA_REQUIRE_ACCESS_GATE:'true',EPHARMA_ACCESS_PASSWORD:password,...env},stdio:['ignore','pipe','pipe']});
  let out=''; child.stderr.on('data',b=>out+=b); child.stdout.on('data',b=>out+=b);
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout: '+out)),10000); child.on('exit',code=>{clearTimeout(t);reject(Error('exit '+code+': '+out));});child.stdout.on('data',b=>{if(String(b).includes('server running')){clearTimeout(t);resolve();}});});
  return {child,url:`http://127.0.0.1:${port}`};
}
test('gate protects pages, assets and APIs independently of app login',async()=>{
 const {child,url}=await server();try {
 for(const route of ['/','/dashboard.html','/dashboard.js','/api/auth/session','/api/settings']) {const r=await fetch(url+route);assert.equal(r.status,401);assert.match(r.headers.get('www-authenticate'),/^Basic/);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-frame-options'),'DENY');}
 let r=await fetch(url+'/',{headers:{authorization:'Basic '+Buffer.from('demo:incorrect').toString('base64')}}); assert.equal(r.status,401);
 r=await fetch(url+'/',{headers:{authorization:auth}});assert.equal(r.status,200);assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 r=await fetch(url+'/api/auth/session',{headers:{authorization:auth}});assert.equal(r.status,401); // gate does not bypass app login
 r=await fetch(url+'/api/auth/login',{method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'test-admin-password'})});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly/);
 }finally {child.kill();}
});
test('repeated bad gate credentials are throttled',async()=>{
 const {child,url}=await server();try {for(let i=0;i<10;i++)assert.equal((await fetch(url+'/',{headers:{authorization:'Basic '+Buffer.from('demo:wrong').toString('base64')}})).status,401);const r=await fetch(url+'/',{headers:{authorization:auth}});assert.equal(r.status,429);assert.ok(Number(r.headers.get('retry-after'))>0);}finally{child.kill();}
});
test('required gate fails closed if its password is missing or short',async()=>{
 for(const p of ['', 'short']) {
 const result=await new Promise(resolve=>{const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,EPHARMA_REQUIRE_ACCESS_GATE:'true',EPHARMA_ACCESS_PASSWORD:p},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',b=>stderr+=b);child.on('exit',code=>resolve({code,stderr}));});
 assert.notEqual(result.code,0);assert.match(result.stderr,/16–128/);
 }
});
