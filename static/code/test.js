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

function testCommonSelectorToParts() {
  // Join a list of parts into a path selector.
  assertEquals('[{"type":"id","value":"$"},{"type":"keyword","value":"{proto}"},{"type":"id","value":"foo"}]', JSON.stringify(Code.Common.selectorToParts('${proto}.foo')));
}

function testCommonPartsToSelector() {
  // Join a list of parts into a path selector.
  assertEquals('${proto}.foo', Code.Common.partsToSelector([{type: 'id', value: '$'}, {type: 'keyword', value: '{proto}'}, {type: 'id', value: 'foo'}]));
}

function testCommonSelectorToReference() {
  // No substitution.
  assertEquals('$.foo', Code.Common.selectorToReference('$.foo'));
  // Parent substitution.
  assertEquals("$('${proto}.foo')", Code.Common.selectorToReference('${proto}.foo'));
}

function testGetPrefix() {
  // No string.
  assertEquals('', Code.Explorer.getPrefix([]));
  // One string.
  assertEquals('foo', Code.Explorer.getPrefix(['foo']));
  // No prefix.
  assertEquals('', Code.Explorer.getPrefix(['foo', 'bar', 'baz']));
  // Some prefix.
  assertEquals('ba', Code.Explorer.getPrefix(['bar', 'baz']));
  // Whole prefix.
  assertEquals('foo', Code.Explorer.getPrefix(['foo', 'foot', 'food']));
  // Case-sensitive.
  assertEquals('foo', Code.Explorer.getPrefix(['foot', 'fooT']));
}

function testAutocompletePrefix() {
  // No options.
  assertEquals('{"prefix":"foo","terminal":false}', JSON.stringify(Code.Explorer.autocompletePrefix([], 'foo')));
  // One option.
  assertEquals('{"prefix":"FOOT","terminal":true}', JSON.stringify(Code.Explorer.autocompletePrefix(['FOOT'], 'foo')));
  // No prefix, one option.
  assertEquals('{"prefix":"foot","terminal":true}', JSON.stringify(Code.Explorer.autocompletePrefix(['foot'], '')));
  // No prefix, two options.
  assertEquals('{"prefix":"foo","terminal":false}', JSON.stringify(Code.Explorer.autocompletePrefix(['food', 'foot'], '')));
  // Case-sensitive prefix.
  assertEquals('{"prefix":"foo","terminal":false}', JSON.stringify(Code.Explorer.autocompletePrefix(['foot', 'fool', 'FORK'], 'f')));
  // Case-sensitive prefix.
  assertEquals('{"prefix":"FORK","terminal":true}', JSON.stringify(Code.Explorer.autocompletePrefix(['foot', 'fool', 'FORK'], 'F')));
  // Case-insensitive prefix.
  assertEquals('{"prefix":"foo","terminal":false}', JSON.stringify(Code.Explorer.autocompletePrefix(['foot', 'fool'], 'F')));
  // Case-insensitive no match.
  assertEquals('{"prefix":"Fo","terminal":false}', JSON.stringify(Code.Explorer.autocompletePrefix(['FOOT', 'fool'], 'Fo')));
}
