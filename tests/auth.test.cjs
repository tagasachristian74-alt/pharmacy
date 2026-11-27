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
  assert.equal((await req('/inventory.css')).status,200);
  assert.equal((await req('/pricing.js')).status,200);
});
test('cashier permissions, identity and logout are enforced server-side', async () => {
  const cookie = await login('cashier','test-cashier-password');
  const headers = {cookie};
  assert.equal((await req('/api/users',{headers})).status,403);
  assert.equal((await req('/api/settings',{method:'PUT',headers:{...headers,'content-type':'application/json'},body:'{}'})).status,403);
  assert.equal((await req('/api/medicines',{headers})).status,200);
  const sales = await req('/api/sales?cashier_username=admin',{headers});
  assert.deepEqual(await sales.json(), []); // legacy username-only and other users' sales must not leak
  assert.equal((await req('/api/auth/logout',{method:'POST',headers})).status,200);
  assert.equal((await req('/api/auth/session',{headers})).status,401);
});
test('admin can access admin routes and cross-origin writes are rejected', async () => {
  const cookie = await login('admin','test-admin-password');
  assert.equal((await req('/api/users',{headers:{cookie}})).status,200);
  assert.equal((await req('/api/users',{method:'POST',headers:{cookie,origin:'https://attacker.example','content-type':'application/json'},body:'{}'})).status,403);
});
test('Rx verification, senior price and admin void restore stock once', async () => {
  const cashier = await login('cashier','test-cashier-password');
  const headers = {cookie:cashier,'content-type':'application/json'};
  const payload = {medicine_id:1, quantity:2, discount_percent:0, discount_type:'senior',customer_name:'Test Person',discount_id_number:'TEST-ID'};
  let response = await req('/api/sales',{method:'POST',headers,body:JSON.stringify(payload)});
  assert.equal(response.status,400); // Rx must be verified on the server.
  response = await req('/api/sales',{method:'POST',headers,body:JSON.stringify({...payload,customer_name:'',prescription_verified:true})});
  assert.equal(response.status,400); // identity is required for eligible customer type.
  response = await req('/api/sales',{method:'POST',headers,body:JSON.stringify({...payload,prescription_verified:true})});
  assert.equal(response.status,201); const sale=await response.json();
  assert.equal(sale.total_amount,160); assert.equal(sale.vat_exempt_sales,200); assert.equal(sale.discount_amount,40);
  const history = await (await req('/api/sales',{headers})).json();
  const saved = history.find(row => row.sale_id === sale.sale_id);
  assert.equal(saved.discount_type, 'senior'); assert.equal(saved.customer_name, 'Test Person');
  assert.equal(saved.discount_id_number, 'TEST-ID'); assert.equal(saved.discount_amount, 40);
  assert.equal(saved.cashier_employee_id, 'EP-CSH-2026-0002');
  let stock = await (await req('/api/medicines',{headers})).json(); assert.equal(stock[0].quantity,8);
  assert.equal((await req(`/api/sales/${sale.sale_id}/void`,{method:'POST',headers,body:JSON.stringify({reason:'mistake'})})).status,403);
  const admin = await login('admin','test-admin-password');
  const adminHeaders = {cookie:admin,'content-type':'application/json'};
  assert.equal((await req(`/api/sales/${sale.sale_id}/void`,{method:'POST',headers:adminHeaders,body:JSON.stringify({reason:'mistake'})})).status,200);
  assert.equal((await req(`/api/sales/${sale.sale_id}/void`,{method:'POST',headers:adminHeaders,body:JSON.stringify({reason:'again'})})).status,409);
  stock = await (await req('/api/medicines',{headers})).json(); assert.equal(stock[0].quantity,10);
});

test('profile supports both field styles and cannot target another account', async () => {
  const cookie = await login('cashier','test-cashier-password');
  const headers = {cookie, 'content-type':'application/json'};
  let result = await req('/api/account/profile', {method:'PUT',headers,body:JSON.stringify({username:'admin',full_name:'Test Cashier',email:'test@example.com'})});
  assert.equal(result.status,200);
  let data = await result.json(); assert.equal(data.user.username,'cashier'); assert.equal(data.user.fullName,'Test Cashier');
  result = await req('/api/account/profile', {method:'PUT',headers,body:JSON.stringify({fullName:'Updated Cashier'})});
  assert.equal(result.status,200); assert.equal((await result.json()).user.fullName,'Updated Cashier');
});
test('purchase requires an existing active supplier and expired medicines cannot be sold', async () => {
  const cookie = await login('admin','test-admin-password');
  const headers = {cookie,'content-type':'application/json'};
  const purchase = {medicine_id:1, quantity:2, unit_cost:5};
  let response = await req('/api/purchases',{method:'POST',headers,body:JSON.stringify({...purchase,supplier_id:1})}); assert.equal(response.status,201);
  response = await req('/api/purchases',{method:'POST',headers,body:JSON.stringify({...purchase,supplier_id:2})}); assert.equal(response.status,400);
  response = await req('/api/purchases',{method:'POST',headers,body:JSON.stringify({...purchase,supplier_name:'Unknown supplier'})}); assert.equal(response.status,400);
  response = await req('/api/sales',{method:'POST',headers,body:JSON.stringify({medicine_id:2,quantity:1,prescription_verified:true})});
  assert.equal(response.status,400); assert.match((await response.json()).message,/expired/i);
});

test('profile photo validation, persistence and reset for current user', async () => {
  const cookie = await login('cashier','test-cashier-password');
  const headers = {cookie, 'content-type':'application/json'};
  const url = '/api/account/profile';
  const avatar = 'data:image/png;base64,YQ==';
  const update = data => req(url,{method:'PUT',headers,body:JSON.stringify({fullName:'Cashier',...data})});
  let response = await update({avatar_data:avatar});
  assert.equal(response.status,200); assert.equal((await response.json()).user.avatar,avatar);
  assert.equal((await (await req('/api/auth/session',{headers})).json()).user.avatar,avatar);
  const admin = await login('admin','test-admin-password');
  const listed = await (await req('/api/users',{headers:{cookie:admin}})).json();
  assert.equal(listed.find(u=>u.username==='cashier').avatar,avatar);
  assert.equal((await req('/api/users/2',{method:'PUT',headers:{cookie:admin,'content-type':'application/json'},body:JSON.stringify({full_name:'Cashier',avatar_data:'javascript:bad'})})).status,400);
  assert.equal((await update({avatar_data:'data:image/svg+xml;base64,PHN2Zz4='})).status,400);
  assert.equal((await update({avatar_data:'data:image/png;base64,' + 'A'.repeat(140001)})).status,400);
  response = await update({avatar_data:''}); assert.equal(response.status,200); assert.equal((await response.json()).user.avatar,'');
});

test('staff IDs are admin-only, validated, unique and returned in session', async () => {
  const cashier = await login('cashier','test-cashier-password');
  assert.equal((await req('/api/users/generate-id',{headers:{cookie:cashier}})).status,403);
  const admin = await login('admin','test-admin-password');
  const headers={cookie:admin,'content-type':'application/json'};
  const first=await (await req('/api/users/generate-id',{headers})).json();
  const second=await (await req('/api/users/generate-id',{headers})).json();
  assert.match(first.employee_id,/^EP-CSH-\d{4}-\d{4,}$/); assert.notEqual(first.employee_id,second.employee_id);
  const payload={username:'newcashier',full_name:'New Cashier',password:'safe-test-password',employee_id:first.employee_id};
  let response=await req('/api/users',{method:'POST',headers,body:JSON.stringify(payload)}); assert.equal(response.status,201);
  assert.equal((await response.json()).employee_id,first.employee_id);
  response=await req('/api/users',{method:'POST',headers,body:JSON.stringify({...payload,username:'othercashier'})}); assert.equal(response.status,409);
  response=await req('/api/users',{method:'POST',headers,body:JSON.stringify({...payload,username:'invalidcashier',employee_id:'INVALID'})}); assert.equal(response.status,400);
  const newCookie=await login('newcashier','safe-test-password');
  assert.equal((await (await req('/api/auth/session',{headers:{cookie:newCookie}})).json()).user.employee_id,first.employee_id);
});

// Deletion revokes every session, not only the session used for the request.
test('deleting an account invalidates all its active sessions', async () => {
  const first = await login('cashier','test-cashier-password');
  const second = await login('cashier','test-cashier-password');
  const admin = await login('admin','test-admin-password');
  assert.equal((await req('/api/users/2',{method:'DELETE',headers:{cookie:admin}})).status,200);
  assert.equal((await req('/api/auth/session',{headers:{cookie:first}})).status,401);
  assert.equal((await req('/api/auth/session',{headers:{cookie:second}})).status,401);
});
