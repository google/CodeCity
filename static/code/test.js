/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Tests for Integrated Development Environment for Code City.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

function testCommonSelectorToParts() {
  // Join a list of parts into a path selector.
  assertEquals('[{"type":"id","value":"$"},{"type":"^"},{"type":"id","value":"foo"}]', JSON.stringify(Code.Common.selectorToParts('$^.foo')));
}

function testCommonPartsToSelector() {
  // Join a list of parts into a path selector.
  assertEquals('$^.foo', Code.Common.partsToSelector([{type: 'id', value: '$'}, {type: '^'}, {type: 'id', value: 'foo'}]));
}

function testCommonSelectorToReference() {
  // No substitution.
  assertEquals('$.foo', Code.Common.selectorToReference('$.foo'));
  // Parent substitution.
  assertEquals("$('$^.foo')", Code.Common.selectorToReference('$^.foo'));
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
