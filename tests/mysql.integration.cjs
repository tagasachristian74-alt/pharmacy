// Opt-in real-MySQL integration test. Creates and drops its own randomly named database.
// Never point TEST_DB_* at a production server or an account with customer data.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');

const enabled = process.env.EPHARMA_TEST_MYSQL === '1';
test('real MySQL: legacy migration, IDs, avatar and sale snapshot', { skip: !enabled, timeout: 90000 }, async () => {
  const name = `epharma_test_${crypto.randomBytes(6).toString('hex')}`;
  const options = { host: process.env.TEST_DB_HOST || '127.0.0.1', port: Number(process.env.TEST_DB_PORT || 3306), user: process.env.TEST_DB_USER || 'root', password: process.env.TEST_DB_PASSWORD || '', multipleStatements: true };
  const conn = await mysql.createConnection(options);
  let child;
  try {
    // Use the old schema to exercise automatic migrations without touching the real DB.
    let schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
    schema = schema.replaceAll('epharma_db', name)
      .replace('    avatar_data LONGTEXT NULL,\n', '')
      .replace('    employee_id VARCHAR(40) NULL,\n    UNIQUE KEY uq_users_employee_id (employee_id),\n', '')
      .replace('    cashier_employee_id VARCHAR(40) DEFAULT NULL,\n', '')
      .replace(/-- Durable allocation counter\.[\s\S]*?\n\);\n/, '');
    await conn.query(schema);
    // Seed a pre-upgrade user so backfill is exercised, not just new-user creation.
    const password = 'integration-admin-password';
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
    await conn.query(`INSERT INTO \`${name}\`.users (username,password_hash,full_name,role,status) VALUES (?, ?, ?, ?, ?)`,
      ['admin', hash, 'Legacy Admin', 'admin', 'Active']);
    const server = require('node:net').createServer();
    await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
    const appPort = server.address().port;
    await new Promise(resolve => server.close(resolve));
    child = spawn(process.execPath, ['server.js'], {cwd:path.join(__dirname, '..'), env:{...process.env, DB_HOST:options.host, DB_PORT:String(options.port), DB_USER:options.user, DB_PASSWORD:options.password, DB_NAME:name, DB_SSL:'false', DB_ADMIN_PASSWORD:password, PORT:String(appPort), COOKIE_SECURE:'false'}, stdio:['ignore','pipe','pipe']});
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timed out: ' + output)), 15000);
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${output}`)); });
      child.stdout.on('data', chunk => { if (String(chunk).includes('server running')) { clearTimeout(timer); resolve(); } });
    });
    const base = `http://127.0.0.1:${appPort}`;
    async function login(username, pass) {
      const response = await fetch(base + '/api/auth/login', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({username,password:pass})});
      assert.equal(response.status, 200, await response.clone().text());
      return {user:(await response.json()).user, cookie:response.headers.get('set-cookie').split(';')[0]};
    }
    const admin = await login('admin',password);
    assert.match(admin.user.employee_id, /^EP-ADM-\d{4}-\d{4,}$/);
    const headers = {cookie:admin.cookie, 'content-type':'application/json'};
    const generated = await (await fetch(base + '/api/users/generate-id',{headers})).json();
    assert.match(generated.employee_id, /^EP-CSH-\d{4}-\d{4,}$/);
    const creation = await fetch(base + '/api/users',{method:'POST',headers,body:JSON.stringify({username:'testcashier',full_name:'Test Cashier',password:'test-cashier-password',employee_id:generated.employee_id})});
    assert.equal(creation.status,201,await creation.clone().text());
    const cashier = await login('testcashier','test-cashier-password');
    assert.equal(cashier.user.employee_id,generated.employee_id);
    const cHeaders = {cookie:cashier.cookie,'content-type':'application/json'};
    const avatar = 'data:image/png;base64,YQ==';
    const profile = await fetch(base + '/api/account/profile',{method:'PUT',headers:cHeaders,body:JSON.stringify({fullName:'Test Cashier',avatar_data:avatar})});
    assert.equal(profile.status,200,await profile.clone().text());
    assert.equal((await (await fetch(base+'/api/auth/session',{headers:cHeaders})).json()).user.avatar,avatar);
    const [inserted] = await conn.query(`INSERT INTO \`${name}\`.medicines (medicine_name, price, quantity) VALUES ('Test medicine', 10, 4)`);
    const sale = await fetch(base+'/api/sales',{method:'POST',headers:cHeaders,body:JSON.stringify({medicine_id:inserted.insertId,quantity:1})});
    assert.equal(sale.status,201,await sale.clone().text());
    const history = await (await fetch(base+'/api/sales',{headers:cHeaders})).json();
    assert.equal(history[0].cashier_employee_id,generated.employee_id);
  } finally {
    if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => { child.once('exit', resolve); setTimeout(resolve, 3000).unref(); }); }
    try { await conn.query(`DROP DATABASE IF EXISTS \`${name}\``); } finally { await conn.end(); }
  }
});
