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
  assert.deepEqual(Array.from(context.getNotifications(), x=>x.id), ['expired-1','expired-2']);
});
