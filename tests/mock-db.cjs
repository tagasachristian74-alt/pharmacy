// In-memory MySQL double for route tests; it does not replace real MySQL transaction tests.
const Module = require('module');
const original = Module._load;
const crypto = require('crypto');
const testHash = password => { const salt='0123456789abcdef0123456789abcdef'; return salt + ':' + crypto.scryptSync(password, salt, 64).toString('hex'); };
const users = [
  { user_id: 1, username: 'admin', password_hash: testHash('test-admin-password'), full_name: 'Admin', email: '', role: 'admin', status: 'Active' },
  { user_id: 2, username: 'cashier', password_hash: testHash('test-cashier-password'), full_name: 'Cashier', email: '', role: 'cashier', status: 'Active' }
];
const suppliers = [{supplier_id:1,supplier_name:'Active Supplier',status:'Active'}, {supplier_id:2,supplier_name:'Inactive Supplier',status:'Inactive'}];
const medicine = { medicine_id: 1, medicine_name: 'Rx medicine', price: 112, quantity: 10, discount_percent: 0, reorder_level: 2, requires_prescription: 1 };
const sales = [{sale_id: 100, cashier_id: null, cashier_username:'cashier', status:'COMPLETED'}, {sale_id:101,cashier_id:99,cashier_username:'cashier',status:'COMPLETED'}];
const query = async (sql, values = []) => {
  if (sql.includes('INFORMATION_SCHEMA')) return [[{COLUMN_NAME:'exists', CONSTRAINT_NAME:'fk_sales_cashier'}]];
  if (sql.includes('SELECT COUNT(*) AS cnt FROM users')) return [[{cnt:users.length}]];
  if (sql.includes('FROM users') && sql.includes('WHERE username')) return [users.filter(u => u.username === values[0])];
  if (sql.includes('FROM users') && sql.includes('WHERE user_id')) return [users.filter(u => u.user_id === values[0])];
  if (sql.includes('FROM users') && sql.includes('ORDER BY role')) return [users];
  if (sql.includes('FROM sales s')) {
    const visible = sales.filter(s => !values.length || (sql.includes('WHERE s.cashier_id = ?') ? s.cashier_id === values[0] : s.cashier_username === values[0]));
    return [visible.map(s => ({...s, medicine_name:medicine.medicine_name}))];
  }
  if (sql.includes('SELECT sale_id, status FROM sales')) return [sales.filter(s => s.sale_id === values[0]).map(s => ({sale_id:s.sale_id,status:s.status}))];
  if (sql.includes('SELECT medicine_id, quantity FROM sale_items')) return [sales.filter(s => s.sale_id === values[0]).map(s => ({medicine_id:1,quantity:s.quantity}))];
  if (sql.includes('SELECT * FROM medicines')) { if (values[0] === 2) return [[{...medicine,medicine_id:2,expiry_date:'2000-01-01'}]]; return [[{...medicine}]]; }
  if (sql.includes('SELECT medicine_id FROM medicines')) return [[{medicine_id:1}]];
  if (sql.includes('SELECT supplier_id, supplier_name FROM suppliers')) return [suppliers.filter(s => s.status === 'Active' && (s.supplier_id === values[0] || s.supplier_name === values[0]))];
  if (sql.includes('DELETE FROM users WHERE user_id = ?')) { const i=users.findIndex(u=>u.user_id===values[0]); if(i>=0) users.splice(i,1); return [{affectedRows:i>=0?1:0}]; }
  if (sql.includes('UPDATE users SET full_name = ?')) { const u=users.find(u=>u.user_id===values[2]); if(u){u.full_name=values[0];u.email=values[1];} return [{affectedRows:u?1:0}]; }
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
