# mongo-sanitize-express5

Express **4 and 5** compatible NoSQL-injection sanitizer. Zero dependencies.

## Why not `express-mongo-sanitize`?

It does `req.query = sanitizedObject`. In Express 5, `req.query` is a **getter-only**
accessor — assigning to it throws `TypeError: Cannot set property query of #<IncomingMessage>
which has only a getter`. This package never reassigns `req.query`/`req.body`/`req.params`;
it walks the existing object and mutates keys **in place**, which is safe on both versions.

## Install

```bash
npm install mongo-sanitize-express5
```

## Usage

```js
const express = require('express');
const mongoSanitize = require('mongo-sanitize-express5');

const app = express();
app.use(express.json());
app.use(mongoSanitize()); // sanitizes req.body, req.params, req.query by default
```

## Attack vectors covered

| Vector | Example payload | Why it's dangerous |
|---|---|---|
| Operator injection | `{"password": {"$ne": null}}` | Auth-bypass: matches any non-null password |
| `$where` JS injection | `{"$where": "sleep(10000)"}` | Arbitrary JS execution / DoS on the DB server |
| `$regex` ReDoS / blind extraction | `{"user": {"$regex": "^a.*"}}` | Data exfiltration via boolean/timing oracle |
| Nested operators in arrays | `{"$or": [{"$where": "..."}]}` | Bypasses naive top-level-only filters |
| Dot-notation field targeting | `{"address.isAdmin": true}` | Reaches into nested/embedded fields unexpectedly |
| Prototype pollution | `{"__proto__": {"isAdmin": true}}` | Corrupts `Object.prototype` if later merged/spread |
| Deeply nested payload | 1000 levels of `{"a": {"a": {...}}}` | Stack-overflow / CPU DoS on naive recursive sanitizers |

All of the above are blocked by default; the sanitizer recurses through objects **and**
arrays, so operators hidden inside `$or`/`$and` arrays or nested documents are still caught.

## Developer ergonomics

```js
// Middleware with options
app.use(mongoSanitize({
  targets: ['body', 'query'],   // default: ['body', 'params', 'query']
  replaceWith: '_',              // "$gt" -> "_gt" instead of deleting the key
  allowDots: false,              // set true if you intentionally use dot-notation in payloads
  maxDepth: 25,                  // recursion guard
  onSanitize: (key, path, req) => console.warn(`Blocked ${key} at ${path}`),
}));

// Or use the pure functions directly (e.g. on a Kafka message, a WebSocket payload, etc.)
const { sanitize, sanitizeInPlace } = require('mongo-sanitize-express5');

const { sanitized, hits } = sanitize(untrustedObject); // returns a sanitized clone
sanitizeInPlace(someObjectYouOwn);                      // mutates directly, no clone
```

Every request that had something stripped gets `req.mongoSanitized` — an array of the
offending key paths — so you can log or alert on injection attempts.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `targets` | `string[]` | `['body','params','query']` | Which `req` properties to sanitize |
| `replaceWith` | `string \| null` | `null` | `null` drops the key; a string (e.g. `'_'`) replaces `$`/`.` chars instead |
| `allowDots` | `boolean` | `false` | Allow literal `.` in keys (still blocks `$` operators & proto-pollution keys) |
| `maxDepth` | `number` | `25` | Recursion limit; deeper payloads are truncated, not crashed on |
| `dryRun` | `boolean` | `false` | Report via `onSanitize`/`hits` without mutating |
| `onSanitize` | `function` | `undefined` | `(key, path, req) => void` — called per offending key |

## Testing

```bash
npm test
```
