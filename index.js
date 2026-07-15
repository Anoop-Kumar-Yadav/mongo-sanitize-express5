'use strict';

const mongoSanitize = require('./lib/middleware');
const { sanitize, sanitizeInPlace } = require('./lib/sanitize');

module.exports = mongoSanitize;
module.exports.default = mongoSanitize;
module.exports.sanitize = sanitize;
module.exports.sanitizeInPlace = sanitizeInPlace;
