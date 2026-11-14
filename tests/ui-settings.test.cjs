const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('dashboard.js','utf8');
test('saved date format and low-stock threshold affect display calculations', () => {
  const settings = {dateFormat:'DD/MM/YYYY', lowStockLevel:15};
  const context = {window:{EPharmaBranding:{getCachedSettings:()=>settings}}, Date, Number, String, Math};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function formatPharmacyDate('),source.indexOf('function updateDate()')), context);
  assert.equal(context.formatPharmacyDate('2026-11-19'), '19/11/2026');
  settings.dateFormat='YYYY-MM-DD'; assert.equal(context.formatPharmacyDate('2026-11-19'), '2026-11-19');
  assert.equal(context.lowStockThreshold({reorderLevel:5}),15);
  assert.equal(context.lowStockThreshold({reorderLevel:20}),20);
});
test('expiry notifications use medicine ids even when batches match', () => {
  const context = {inventoryMedicines:[{id:1,name:'A',quantity:5,reorderLevel:0,expiry:'2000-01-01',batch:''},{id:2,name:'B',quantity:5,reorderLevel:0,expiry:'2000-01-01',batch:''}],lowStockThreshold:()=>0,getExpirationStatus:()=>({status:'Expired'}),Number,Array};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function getNotifications()'),source.indexOf('function renderNotifications()')),context);
  const items = context.getNotifications();
  assert.deepEqual(Array.from(items, x=>x.id), ['expired-1','expired-2']);
  assert.equal(items[0].medicineId, 1); assert.equal(items[0].medicineName, 'A');
  assert.equal(items[0].status, 'Expired'); assert.equal(items[0].targetPage, 'expiration');
});

test('dispensable stock excludes expired or empty medicines', () => {
  const context = {getExpirationStatus: date => ({status: date === 'past' ? 'Expired' : 'Safe'}), Number, Boolean};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function isExpiredMedicine('), source.indexOf('function lowStockThreshold(')), context);
  assert.equal(context.isDispensableMedicine({quantity:1, expiry:'past'}), false);
  assert.equal(context.isDispensableMedicine({quantity:0, expiry:'future'}), false);
  assert.equal(context.isDispensableMedicine({quantity:1, expiry:'future'}), true);
  assert.equal(context.isDispensableMedicine({quantity:1, expiry:''}), true);
});
