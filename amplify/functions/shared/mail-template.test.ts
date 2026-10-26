import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPurchaseConfirmationBodyHtml } from './mail-template';

test('greets the buyer using only the escaped first name', () => {
  const body = buildPurchaseConfirmationBodyHtml({
    memberFirstName: 'Jean & Marie',
    amount: '30,00',
    currency: 'EUR',
  });

  assert.match(body, /Bonjour Jean &amp; Marie,/);
  assert.doesNotMatch(body, /DUPONT/);
});

test('uses an inclusive greeting when the first name is unavailable', () => {
  const body = buildPurchaseConfirmationBodyHtml({
    amount: '30,00',
    currency: 'EUR',
  });

  assert.match(body, />\s*Bonjour,\s*</);
});
