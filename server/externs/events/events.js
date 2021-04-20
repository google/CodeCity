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
 * @fileoverview Fake implementation of node.js's events module to
 *     satisfy Closure Compiler dependencies.
 * @author cpcallen@google.com (Christopher Allen)
 */

/** @const */
var events = {};

/** @type {symbol} */
events.errorMonitor;

/** @constructor @struct */
events.EventEmitter = function() {};

/**
 * @param {string|symbol} event
 * @param {function(...)} listener
 * @return {events.EventEmitter}
 */
events.EventEmitter.prototype.on = function(event, listener) {};

/**
 * @param {string|symbol} event
 * @param {function(...)} listener
 * @return {events.EventEmitter}
 */
events.EventEmitter.prototype.once = function(event, listener) {};

/**
 * @param {string|symbol} event
 * @param {function(...)} listener
 * @return {events.EventEmitter}
 */
events.EventEmitter.prototype.removeListener = function(event, listener) {};

module.exports = events;
