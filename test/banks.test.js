import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankAccounts } from '../src/services/banks.js';
import { toOrder } from '../src/routes/checkout.js';

test('checkout provides both receiving accounts and the order reference', () => {
  const order = toOrder({ id: 'cord_example', createdAt: new Date(), status: 'pending_payment' }, { PHONE_ONLY_ORDERING: 'false' });
  assert.equal(order.id, 'cord_example');
  assert.deepEqual(order.banks.map((bank) => bank.accountNumber), ['MN790005005031346583', 'MN570004004004201904']);
  assert.equal(order.banks[1].accountName, 'МЭЖИК КОД ЭЙ АЙ ХХК');
  assert.equal(bankAccounts({ TDB_ACCOUNT_NAME: 'Updated holder' })[1].accountName, 'Updated holder');
});

test('phone ordering hides accounts and disables new QPay invoices', () => {
 const order = toOrder({ id: 'existing-order', createdAt: new Date(), status: 'pending_payment' }, {});
 assert.deepEqual(order.banks, []);
 assert.equal(order.qpayAvailable, false);
 assert.equal(order.id, 'existing-order');
});
