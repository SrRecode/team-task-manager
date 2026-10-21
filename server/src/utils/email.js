'use strict';

/**
 * Normalizes an email address for storage and lookup.
 *
 * The address is trimmed and lowercased so that "Ayesha@Example.com" and
 * "ayesha@example.com" are the same account. No provider-specific rewriting
 * is applied: dots and "+tags" are significant for some providers and are
 * left untouched (docs/DATABASE.md section 4).
 */
function normalizeEmail(value) {
  return String(value).trim().toLowerCase();
}

module.exports = { normalizeEmail };
