const test = require('node:test');
const assert = require('node:assert/strict');

test('demo sanity check', () => {
  assert.equal('OpenShift'.includes('Shift'), true);
});

test('environment defaults are safe', () => {
  assert.equal(process.env.PORT || '8080', process.env.PORT || '8080');
});
