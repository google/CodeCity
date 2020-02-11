/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview HTML utilities for Code City.
 * @author fraser@google.com (Neil Fraser)
 */

$.utils.html = {}

$.utils.html.escape = function(text) {
  // Escape text so that it is safe to print as HTML.
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

$.utils.html.preserveWhitespace = function(text) {
  // Escape text so that it is safe and preserves whitespace formatting as HTML.
  // Runs of three spaces ('   ') need to be escaped twice ('_  ', '__ ').
  return $.utils.html.escape(text)
      .replace(/\t/g, '\u00A0 \u00A0 ')
      .replace(/  /g, '\u00A0 ').replace(/  /g, '\u00A0 ')  // Escape twice.
      .replace(/^ /gm, '\u00A0')
      .replace(/\n/g, '<br>');
};
