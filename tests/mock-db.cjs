// In-memory MySQL double for route tests; it does not replace real MySQL transaction tests.
const Module = require('module');
const original = Module._load;
const users = [
  { user_id: 1, username: 'admin', password_hash: 'test-admin-password', full_name: 'Admin', email: '', role: 'admin', status: 'Active' },
  { user_id: 2, username: 'cashier', password_hash: 'test-cashier-password', full_name: 'Cashier', email: '', role: 'cashier', status: 'Active' }
];
const medicine = { medicine_id: 1, medicine_name: 'Rx medicine', price: 112, quantity: 10, discount_percent: 0, reorder_level: 2, requires_prescription: 1 };
const sales = [];
const query = async (sql, values = []) => {
  if (sql.includes('INFORMATION_SCHEMA')) return [[{COLUMN_NAME:'exists', CONSTRAINT_NAME:'fk_sales_cashier'}]];
  if (sql.includes('SELECT COUNT(*) AS cnt FROM users')) return [[{cnt:users.length}]];
  if (sql.includes('FROM users') && sql.includes('WHERE username')) return [users.filter(u => u.username === values[0])];
  if (sql.includes('FROM users') && sql.includes('WHERE user_id')) return [users.filter(u => u.user_id === values[0])];
  if (sql.includes('FROM users') && sql.includes('ORDER BY role')) return [users];
  if (sql.includes('FROM sales s')) {
    const visible = sales.filter(s => !values.length || (values.length === 2 ? (s.cashier_id === values[0] || (!s.cashier_id && s.cashier_username === values[1])) : s.cashier_username === values[0]));
    return [visible.length ? visible.map(s => ({...s, medicine_name:medicine.medicine_name})) : [{cashier_username:values[1] || values[0] || 'all'}]];
  }
  if (sql.includes('SELECT sale_id, status FROM sales')) return [sales.filter(s => s.sale_id === values[0]).map(s => ({sale_id:s.sale_id,status:s.status}))];
  if (sql.includes('SELECT medicine_id, quantity FROM sale_items')) return [sales.filter(s => s.sale_id === values[0]).map(s => ({medicine_id:1,quantity:s.quantity}))];
  if (sql.includes('SELECT * FROM medicines')) return [[{...medicine}]];
  if (sql.includes('INSERT INTO sales (')) {
    const [total_amount,cashier_username,cashier_name,cashier_id,discount_type,customer_name,discount_id_number,vat_exempt_sales,discount_amount] = values;
    sales.push({sale_id:sales.length + 1,total_amount,cashier_username,cashier_name,cashier_id,discount_type,customer_name,discount_id_number,vat_exempt_sales,discount_amount,status:'COMPLETED'});
    return [{insertId:sales.length,affectedRows:1}];
  }
  if (sql.includes('INSERT INTO sale_items')) {
    const [id,medicine_id,quantity,original_price,unit_price,discount_percent,subtotal] = values;
    Object.assign(sales.find(s=>s.sale_id===id),{medicine_id,quantity,original_price,unit_price,discount_percent,subtotal});
    return [{affectedRows:1}];
  }
  if (sql.includes('UPDATE medicines') && sql.includes('quantity = quantity -')) { medicine.quantity -= values[0]; return [{affectedRows:1}]; }
  if (sql.includes('UPDATE medicines') && sql.includes('quantity = quantity +')) { medicine.quantity += values[0]; return [{affectedRows:1}]; }
  if (sql.includes("UPDATE sales SET status = 'VOIDED'")) { const s = sales.find(s=>s.sale_id===values[1]); s.status='VOIDED'; s.void_reason=values[0]; return [{affectedRows:1}]; }
  return [{ affectedRows: 1, insertId: 1 }];
};
Module._load = function (request, ...args) {
  if (request === 'mysql2/promise') return { createPool: () => ({query, getConnection:async()=>({query,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{}}), end: async () => {}}) };
  return original.call(this, request, ...args);
};
