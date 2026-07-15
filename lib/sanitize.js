'use strict';

// Keys that can pollute Object.prototype if merged/assigned downstream.
// Blocked unconditionally — never renamed, always dropped.
const PROTO_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const DEFAULT_OPTIONS = {
  replaceWith: null,   // null -> drop offending key. string -> replace '$'/'.' chars with it (e.g. '_')
  allowDots: false,    // false -> dot-notation keys ("a.b") are treated as an attack vector too
  maxDepth: 25,         // guards against deeply-nested payload DoS / stack overflow
  dryRun: false,        // true -> report only, don't mutate
  onSanitize: null,     // (key, path) => void, called for every offending key found
};

function isPlainObject(v) {
  if (v === null || typeof v !== 'object') return false;
  if (Array.isArray(v)) return false;
  if (v instanceof Date || v instanceof RegExp) return false;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) return false;
  return true;
}

// Returns: null (drop key entirely) | key (unchanged) | newKey (renamed)
function resolveKey(key, options) {
  if (PROTO_POLLUTION_KEYS.has(key)) return null;

  let result = key;
  let offending = false;

  if (key.charCodeAt(0) === 36 /* '$' */) {
    offending = true;
    result = options.replaceWith ? options.replaceWith + result.slice(1) : null;
  }

  if (result !== null && !options.allowDots && result.indexOf('.') !== -1) {
    offending = true;
    result = options.replaceWith ? result.split('.').join(options.replaceWith) : null;
  }

  return offending ? result : key;
}

function walk(node, options, depth, path, hits) {
  if (depth > options.maxDepth) {
    // Nested past the allowed depth: truncate rather than recurse further (DoS guard).
    if (isPlainObject(node)) {
      for (const k of Object.keys(node)) delete node[k];
    } else if (Array.isArray(node)) {
      node.length = 0;
    }
    return;
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const v = node[i];
      if (isPlainObject(v) || Array.isArray(v)) walk(v, options, depth + 1, `${path}[${i}]`, hits);
    }
    return;
  }

  if (!isPlainObject(node)) return;

  for (const key of Object.keys(node)) {
    const value = node[key];
    const newKey = resolveKey(key, options);
    const fullPath = `${path}.${key}`;

    if (newKey === null) {
      hits.push(fullPath);
      if (options.onSanitize) options.onSanitize(key, fullPath);
      if (!options.dryRun) delete node[key];
      continue; // dropped -> nothing to recurse into
    }

    if (newKey !== key) {
      hits.push(fullPath);
      if (options.onSanitize) options.onSanitize(key, fullPath);
      if (!options.dryRun) {
        delete node[key];
        node[newKey] = value;
      }
    }

    const child = options.dryRun ? value : node[newKey];
    if (isPlainObject(child) || Array.isArray(child)) {
      walk(child, options, depth + 1, `${path}.${newKey}`, hits);
    }
  }
}

/**
 * Mutates `obj` in place, stripping/renaming Mongo-operator keys, dotted keys,
 * and prototype-pollution keys. Returns { sanitized: obj, hits: string[] }.
 * In-place mutation is required for Express 5 compatibility (req.query has no setter).
 */
function sanitizeInPlace(obj, userOptions) {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  const hits = [];
  if (isPlainObject(obj) || Array.isArray(obj)) walk(obj, options, 0, '$root', hits);
  return { sanitized: obj, hits };
}

/**
 * Non-mutating variant: deep-clones input (JSON-safe values only) then sanitizes the clone.
 */
function sanitize(obj, userOptions) {
  const clone = obj === undefined ? obj : JSON.parse(JSON.stringify(obj));
  return sanitizeInPlace(clone, userOptions);
}

module.exports = { sanitize, sanitizeInPlace, isPlainObject, PROTO_POLLUTION_KEYS };
