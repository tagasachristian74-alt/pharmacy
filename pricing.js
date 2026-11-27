// Shared POS calculation. Unit prices are rounded to centavos before multiplying quantity.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.EPharmaPricing = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const money = value => Math.round((value + Number.EPSILON) * 100) / 100;
    function calculate(price, quantity, promotionPercent, customerType) {
        const original = Number(price), qty = Number(quantity), promo = Number(promotionPercent);
        if (!Number.isFinite(original) || original < 0 || !Number.isSafeInteger(qty) || qty < 1 || !Number.isFinite(promo) || promo < 0 || promo > 100 || !['regular', 'senior', 'pwd'].includes(customerType)) throw new Error('Invalid pricing inputs.');
        const promoUnit = money(original * (1 - promo / 100));
        const exemptUnit = money(original / 1.12);
        const statutoryUnit = money(original / 1.12 * 0.8);
        const statutory = customerType !== 'regular' && statutoryUnit <= promoUnit;
        const unitPrice = statutory ? statutoryUnit : promoUnit;
        return {
            unitPrice, total: money(unitPrice * qty),
            discountPercent: statutory ? 20 : promo,
            applied: statutory ? 'statutory' : (promo > 0 ? 'promotion' : 'none'),
            vatExemptSales: statutory ? money(exemptUnit * qty) : 0,
            discountAmount: statutory ? money((exemptUnit - unitPrice) * qty) : money((original - unitPrice) * qty)
        };
    }
    return { calculate };
});
