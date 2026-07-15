'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitize, sanitizeInPlace } = require('../lib/sanitize');

test('drops top-level operator injection ($ne auth bypass)', () => {
  const { sanitized } = sanitize({ username: 'admin', password: { $ne: null } });
  assert.deepEqual(sanitized, { username: 'admin', password: {} });
});

test('drops $where javascript injection', () => {
  const { sanitized, hits } = sanitize({ $where: 'this.password.length > 0' });
  assert.deepEqual(sanitized, {});
  assert.equal(hits.length, 1);
});

test('drops nested operators inside arrays ($or / $and)', () => {
  const { sanitized } = sanitize({
    $or: [{ role: 'admin' }, { $where: '1==1' }],
  });
  assert.deepEqual(sanitized, {});
});

test('strips operator inside array-of-objects value, keeps sibling data', () => {
  const { sanitized } = sanitize({
    items: [{ id: 1 }, { id: { $gt: 0 } }],
  });
  assert.deepEqual(sanitized, { items: [{ id: 1 }, { id: {} }] });
});

test('blocks dot-notation field targeting by default', () => {
  const { sanitized } = sanitize({ 'address.zip': '00000' });
  assert.deepEqual(sanitized, {});
});

test('allowDots:true preserves dotted keys but still blocks $ operators', () => {
  const { sanitized } = sanitize(
    { 'address.zip': '00000', $gt: 1 },
    { allowDots: true }
  );
  assert.deepEqual(sanitized, { 'address.zip': '00000' });
});

test('replaceWith sanitizes chars instead of deleting the field', () => {
  const { sanitized } = sanitize({ $gt: 5, 'a.b': 1 }, { replaceWith: '_' });
  assert.deepEqual(sanitized, { _gt: 5, a_b: 1 });
});

test('blocks prototype pollution keys unconditionally, even with replaceWith', () => {
  const payload = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"x":1}}');
  const { sanitized } = sanitize(payload, { replaceWith: '_' });
  assert.deepEqual(sanitized, {});
  assert.equal({}.polluted, undefined);
});

test('deeply nested payload is truncated at maxDepth (DoS guard)', () => {
  let payload = { $gt: 1 };
  for (let i = 0; i < 100; i++) payload = { nested: payload };
  const { sanitized } = sanitize(payload, { maxDepth: 5 });
  // Should not throw (no stack overflow) and should be truncated.
  assert.ok(sanitized);
});

test('dryRun reports hits without mutating', () => {
  const original = { $gt: 1, user: 'a' };
  const { sanitized, hits } = sanitizeInPlace(original, { dryRun: true });
  assert.deepEqual(sanitized, { $gt: 1, user: 'a' });
  assert.equal(hits.length, 1);
});

test('leaves clean payloads untouched', () => {
  const { sanitized, hits } = sanitize({ name: 'Alice', age: 30, tags: ['a', 'b'] });
  assert.deepEqual(sanitized, { name: 'Alice', age: 30, tags: ['a', 'b'] });
  assert.equal(hits.length, 0);
});
