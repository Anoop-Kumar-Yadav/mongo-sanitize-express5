'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoSanitize = require('../lib/middleware');

// Mimics Express 5's req.query: a getter with NO setter (assigning throws).
function makeExpress5StyleReq({ query, body, params }) {
  const req = { body, params };
  const store = query;
  Object.defineProperty(req, 'query', {
    get() { return store; },
    enumerable: true,
    // no set() -> assigning req.query = x throws TypeError, just like Express 5
  });
  return req;
}

test('sanitizes req.query in place without reassigning it (Express 5 safe)', () => {
  const req = makeExpress5StyleReq({ query: { username: { $ne: null } }, body: {}, params: {} });
  const mw = mongoSanitize();
  let called = false;
  mw(req, {}, () => { called = true; });

  assert.equal(called, true);
  assert.deepEqual(req.query, { username: {} });
  assert.deepEqual(req.mongoSanitized, ['$root.username.$ne']);
});

test('reassigning req.query on an Express-5-style object throws (sanity check)', () => {
  const req = makeExpress5StyleReq({ query: {}, body: {}, params: {} });
  assert.throws(() => { req.query = {}; }, TypeError);
});

test('sanitizes body and params too, respects targets option', () => {
  const req = {
    body: { $where: 'sleep(1000)' },
    params: { id: { $gt: 0 } },
    query: { safe: 'ok' },
  };
  mongoSanitize({ targets: ['body', 'params'] })(req, {}, () => {});
  assert.deepEqual(req.body, {});
  assert.deepEqual(req.params, { id: {} });
  assert.deepEqual(req.query, { safe: 'ok' }); // untouched: not in targets
});

test('onSanitize callback fires with attacker payload details', () => {
  const req = { body: { $gt: 1 }, params: {}, query: {} };
  const seen = [];
  mongoSanitize({ onSanitize: (key, path) => seen.push({ key, path }) })(req, {}, () => {});
  assert.equal(seen.length, 1);
  assert.equal(seen[0].key, '$gt');
});
