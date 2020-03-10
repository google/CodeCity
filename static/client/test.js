/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Tests for Integrated Development Environment for Code City.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

// common.js

function testCommonEscapeSpaces() {
  // Escape strings with whitespace into non-collapsable HTML strings.
  assertEquals('a\u00A0 \u00A0 b', CCC.Common.escapeSpaces('a    b'));
  assertEquals('\u00A0a\u00A0 \u00A0 \u00A0 \u00A0 b', CCC.Common.escapeSpaces(' a\tb'));
}

// log.js

function testLogGetTemplate() {
  // Fetch a template string from HTML
  // <span id="testTemplate">%1 kicks %2.</span>
  var span = document.createElement('span');
  span.id = 'testTemplate';
  span.innerHTML = '%1 kicks %2.';
  document.body.appendChild(span);
  try {
    var df = CCC.Log.getTemplate(span.id, 'Max', 'Fido');
  } finally {
    document.body.removeChild(span);
  }
  // Render the DocumentFragment.
  var div = document.createElement('div');
  div.appendChild(df);
  assertEquals('Max kicks Fido.', div.innerHTML);
}

// world.js

function testWorldGetTemplate() {
  // Fetch a template string from HTML
  // <span id="testTemplate">Today is a good day to die.</span>
  var span = document.createElement('span');
  span.id = 'testTemplate';
  span.innerHTML = 'Today is a good day to die.';
  document.body.appendChild(span);
  try {
    var text = CCC.World.getTemplate(span.id);
  } finally {
    document.body.removeChild(span);
  }
  assertEquals('Today is a good day to die.', text);
}
