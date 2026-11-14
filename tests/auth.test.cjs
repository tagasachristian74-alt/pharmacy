const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const port = 31000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
let child;
before(async () => {
  child = spawn(process.execPath, ['--require', path.join(__dirname, 'mock-db.cjs'), 'server.js'], { env: {...process.env, PORT:String(port), COOKIE_SECURE:'false'}, stdio:['ignore','pipe','pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server startup timeout')), 10000);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`server exited ${code}`)); });
    child.stdout.on('data', data => { if (String(data).includes('server running')) { clearTimeout(timer); resolve(); } });
  });
});
after(() => child?.kill());
const req = (url, opts={}) => fetch(base + url, opts);
async function login(username, password) {
  const r = await req('/api/auth/login', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({username,password})});
  assert.equal(r.status,200);
  const cookie = r.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
  return cookie.split(';')[0];
}
test('API access requires a real server session and private files stay private', async () => {
  assert.equal((await req('/api/medicines')).status,401);
  for (const p of ['/server.js','/schema.sql','/data/settings.json','/.env']) assert.equal((await req(p)).status,404);
  assert.equal((await req('/dashboard.html')).status,200);
});
test('cashier permissions, identity and logout are enforced server-side', async () => {
  const cookie = await login('cashier','test-cashier-password');
  const headers = {cookie};
  assert.equal((await req('/api/users',{headers})).status,403);
  assert.equal((await req('/api/settings',{method:'PUT',headers:{...headers,'content-type':'application/json'},body:'{}'})).status,403);
  assert.equal((await req('/api/medicines',{headers})).status,200);
  const sales = await req('/api/sales?cashier_username=admin',{headers});
  assert.equal((await sales.json())[0].cashier_username,'cashier');
  assert.equal((await req('/api/auth/logout',{method:'POST',headers})).status,200);
  assert.equal((await req('/api/auth/session',{headers})).status,401);
});
test('admin can access admin routes and cross-origin writes are rejected', async () => {
  const cookie = await login('admin','test-admin-password');
  assert.equal((await req('/api/users',{headers:{cookie}})).status,200);
  assert.equal((await req('/api/users',{method:'POST',headers:{cookie,origin:'https://attacker.example','content-type':'application/json'},body:'{}'})).status,403);
});
