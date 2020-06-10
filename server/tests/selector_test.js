/**
 * @license
 * Copyright 2018 Google LLC
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
 * @fileoverview Test for CSS-style selectors for JS objects.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

const Selector = require('../selector');
const {T} = require('./testing');
const util = require('util');

/**
 * Unit tests for Selector
 * @param {!T} t The test runner object.
 */
exports.testSelector = function(t) {
  const cases = [
    // Test cases  of form [SS, [P1, P2, ...], tS, tE, tSE] where
    // SS: selector string, to use as argument to Selector constructor,
    // [Pn...]: expected parts array,
    // tS: expected toString output,
    // tE: expected toExpr output (can be omitted if same),
    // tSE: expected toSetExpr output (if different not same + ' = NEW').

    ['foo', ['foo'], 'foo'],

    ['foo.bar', ['foo', 'bar'], 'foo.bar'],
    ['foo["bar"]', ['foo', 'bar'], 'foo.bar'],
    ["foo['bar']", ['foo', 'bar'], 'foo.bar'],

    ['foo[42]', ['foo', '42'], 'foo[42]'],
    ["foo['42']", ['foo', '42'], 'foo[42]'],
    ['foo["42"]', ['foo', '42'], 'foo[42]'],

    ['foo["bar baz"]', ['foo', 'bar baz'], "foo['bar baz']"],
    ["foo['bar baz']", ['foo', 'bar baz'], "foo['bar baz']"],

    ["foo['\"\\'\"']", ['foo', '"\'"'], "foo['\"\\'\"']"],
    ['foo["\'\\"\'"]', ['foo', "'\"'"], 'foo["\'\\"\'"]'],
    ['foo.bar.baz', ['foo', 'bar', 'baz'], 'foo.bar.baz'],
    ['$._.__.$$', ['$', '_', '__', '$$'], '$._.__.$$'],
    ['foo^', ['foo', Selector.PROTOTYPE], 'foo{proto}',
        'Object.getPrototypeOf(foo)', 'Object.setPrototypeOf(foo, NEW)'],
    ['foo{proto}.bar', ['foo', Selector.PROTOTYPE, 'bar'], 'foo{proto}.bar',
        'Object.getPrototypeOf(foo).bar',
        'Object.getPrototypeOf(foo).bar = NEW'],
    ['foo{owner}', ['foo', Selector.OWNER], 'foo{owner}',
        'Object.getOwnerOf(foo)', 'Object.setOwnerOf(foo, NEW)'],
    ['foo{owner}.bar', ['foo', Selector.OWNER, 'bar'], 'foo{owner}.bar',
        'Object.getOwnerOf(foo).bar',
        'Object.getOwnerOf(foo).bar = NEW'],
  ];
  for (const [input, parts, str, expr, setExpr] of cases) {
    // Do test with selector string.
    let name = util.format('new Selector(%o)', input);
    let s = new Selector(input);
    t.expect(name + '.length', s.length, parts.length);
    for (let i = 0; i < s.length; i++) {
      t.expect(util.format('%s[%d]', name, i), s[i], parts[i]);
    }
    t.expect(name + '.toString()', s.toString(), str);
    let expectedExpr = expr || str;
    t.expect(name + '.toExpr()', s.toExpr(), expectedExpr);
    let expectedSetExpr = setExpr || expectedExpr + ' = NEW';
    t.expect(name + '.toSetExpr()', s.toSetExpr('NEW'), expectedSetExpr);

    // Repeat test using parts array.
    name = util.format('new Selector(%o)', parts);
    s = new Selector(parts);
    t.expect(name + '.toString()', s.toString(), str);
    t.expect(name + '.toExpr()', s.toExpr(), expectedExpr);
    t.expect(name + '.toSetExpr()', s.toSetExpr('NEW'), expectedSetExpr);
  }

  const invalidCases = [
    '1foo',
    'foo.',
    'foo["bar]',
    "foo[bar']",
    'foo.[42]',
    'foo[42',
    'foo42]',
    'foo[42}',
    "foo['\"'\"']",
    'foo["\'"\'"]',
    'foo^bar',
    '^.bar',
    ['1foo'],
    '^',
    '{proto}',
    [Selector.PROTOTYPE],
    "foo['bar'}",
    'foo{proto]',
    'foo{proto',
    'foo.proto}',
    'foo{blah}',
    'foo{}',
    '{owner}',
    [Selector.OWNER],
  ];
  for (const input of invalidCases) {
    // Do test with selector string.
    const name = util.format('new Selector(%o)', input);
    try {
      new Selector(input);
      t.fail(name, "didn't throw");
    } catch (e) {
      t.pass(name);
    }
  }
};

/**
 * Unit tests for Selector.prototype.isVar / isProp / isProto
 * @param {!T} t The test runner object.
 */
exports.testSelectorPrototypeIsWhatever = function(t) {
  const cases = [
    // Test cases  of form [selector, isVar].
    ['foo', true, false, false, false],
    ['foo.bar', false, true, false, false],
    ['foo^', false, false, true, false],
    ['foo{proto}', false, false, true, false],
    ['foo{owner}', false, false, false, true],
  ];
  for (const [input, isVar, isProp, isProto, isOwner] of cases) {
    const name = util.format('new Selector(%o)', input);
    const s = new Selector(input);
    t.expect(name + '.isVar()', s.isVar(), isVar);
    t.expect(name + '.isProp()', s.isProp(), isProp);
    t.expect(name + '.isProto()', s.isProto(), isProto);
    t.expect(name + '.isOwner()', s.isOwner(), isOwner);
  }
};

/**
 * Unit tests for Selector.partBadness
 * @param {!T} t The test runner object.
 */
exports.testSelectorPartBadness = function(t) {
  // Test verifies these are in monotonically increasing order of badness.
  const cases = [
    'bar',
    'quux',
    '10',
    '100',
    '&',
    '&*',
    'ridiculouslyLongIdentifier',
    '2872498713723',
    '#^@*%*!@#',
    Selector.PROTOTYPE,
  ];
  let previous = '(no previous)';
  let previousBadness = -Infinity;
  for (const part of cases) {
    const badness = Selector.partBadness(part);
    const name = util.format(
        'Selector.partBadness(%o) (===%d) < Selector.partBadness(%o) (===%d)',
        previous, previousBadness, part, badness);
    t.assert(name, previousBadness < badness);
    previous = part;
    previousBadness = badness;
  }
};

/**
 * Unit tests for Selector.prototype.badness
 * @param {!T} t The test runner object.
 */
exports.testSelectorPrototypeBadness = function(t) {
  // Test verifies these are in monotonically increasing order of badness.
  const cases = [
    'foo',
    'foobar',
    'foo.bar',
    'foo[10]',
    'foo["&"]',
    'foo.bar.baz.quux.quuux.quuux',
    'foo{proto}',
    'foo.bar.baz.quux.quuux.quuux.quuuux.quuuuux.quuuuuux.quuuuuuux',
  ];
  let previous = '(no previous)';
  let previousBadness = -Infinity;
  for (const ss of cases) {
    const s = new Selector(ss);
    const badness = s.badness();
    const name = util.format('Selector(%o).badness() < Selector(%o).badness()',
                             previous, ss);
    t.assert(name, previousBadness < badness);
    previous = ss;
    previousBadness = badness;
  }
};

