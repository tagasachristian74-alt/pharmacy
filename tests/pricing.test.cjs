const {test} = require('node:test');
const assert = require('node:assert/strict');
const {calculate} = require('../pricing');
test('senior/PWD VAT exemption and promotions are not stacked', () => {
  assert.deepEqual(calculate(112, 2, 0, 'senior'), {unitPrice:80,total:160,discountPercent:20,applied:'statutory',vatExemptSales:200,discountAmount:40});
  assert.equal(calculate(112, 1, 30, 'pwd').unitPrice, 78.4);
  assert.equal(calculate(112, 1, 30, 'pwd').applied, 'promotion');
  assert.equal(calculate(112, 1, 0, 'regular').unitPrice, 112);
  assert.throws(()=>calculate(112, 0, 0, 'pwd'));
});
