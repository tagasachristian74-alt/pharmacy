const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('expiration list uses inventory, shelf search and date filter', () => {
  const source = fs.readFileSync('dashboard.js','utf8');
  const start = source.indexOf('function getExpirationStatus(');
  const end = source.indexOf('async function initializeSettingsPage()', start);
  const nodes = {expirationBody:{innerHTML:''},expirationSearch:{value:''},expirationFilter:{value:'All'},expirationBefore:{value:''},expTotalBatches:{},expSoonCount:{},expExpiredCount:{}};
  const context = {document:{getElementById:id=>nodes[id]}, inventoryMedicines:[{id:1,name:'Aspirin',batch:'B1',shelf:'A-2',quantity:3,expiry:'2027-09-01'},{name:'No date'}], highlightNotificationTarget:()=>{}, formatPharmacyDate:s=>s, escapeSupplierText:s=>String(s).replaceAll('<','&lt;'),Date,Math};
  vm.createContext(context); vm.runInContext(source.slice(start,end),context);
  context.renderExpirationMedicines(); assert.match(nodes.expirationBody.innerHTML,/A-2/); assert.equal(nodes.expTotalBatches.textContent,1);
  nodes.expirationSearch.value='a-2'; context.renderExpirationMedicines(); assert.match(nodes.expirationBody.innerHTML,/Aspirin/);
  nodes.expirationBefore.value='2027-01-01'; context.renderExpirationMedicines(); assert.match(nodes.expirationBody.innerHTML,/No medicines/);
});
