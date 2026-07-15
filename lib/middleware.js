'use strict';

const { sanitizeInPlace } = require('./sanitize');

/**
 * mongoSanitize(options) -> Express middleware.
 *
 * Express 5 note: req.query is a getter-only accessor (no setter), so
 * `req.query = x` throws. This middleware NEVER reassigns req.query/body/params;
 * it mutates the existing object's keys in place, which works on both Express 4 and 5.
 */
function mongoSanitize(userOptions = {}) {
  const { targets = ['body', 'params', 'query'], onSanitize, ...rest } = userOptions;

  return function mongoSanitizeMiddleware(req, res, next) {
    const allHits = [];
    const options = {
      ...rest,
      onSanitize: (key, path) => {
        allHits.push(path);
        if (onSanitize) onSanitize(key, path, req);
      },
    };

    for (const target of targets) {
      const obj = req[target];
      if (obj && typeof obj === 'object') {
        sanitizeInPlace(obj, options);
      }
    }

    if (allHits.length) req.mongoSanitized = allHits;
    next();
  };
}

module.exports = mongoSanitize;
