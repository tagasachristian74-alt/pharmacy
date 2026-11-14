// In-memory MySQL double for API authorization tests, not a database integration test.
const Module = require('module');
const original = Module._load;
const users = [
  { user_id: 1, username: 'admin', password_hash: 'test-admin-password', full_name: 'Admin', email: '', role: 'admin', status: 'Active' },
  { user_id: 2, username: 'cashier', password_hash: 'test-cashier-password', full_name: 'Cashier', email: '', role: 'cashier', status: 'Active' }
];
const query = async (sql, values = []) => {
  if (sql.includes('INFORMATION_SCHEMA')) return [[{COLUMN_NAME:'exists'}]];
  if (sql.includes('SELECT COUNT(*) AS cnt FROM users')) return [[{cnt:users.length}]];
  if (sql.includes('FROM users') && sql.includes('WHERE username')) return [users.filter(u => u.username === values[0])];
  if (sql.includes('FROM users') && sql.includes('WHERE user_id')) return [users.filter(u => u.user_id === values[0])];
  if (sql.includes('FROM sales s')) return [[{cashier_username:values[0] || 'all'}]];
  if (sql.includes('SELECT * FROM medicines')) return [[]];
  return [{ affectedRows: 1, insertId: 1 }];
};
Module._load = function (request, ...args) {
  if (request === 'mysql2/promise') return { createPool: () => ({query, end: async () => {}}) };
  return original.call(this, request, ...args);
};
