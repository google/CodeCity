/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Fake implementation of node.js's events module to
 *     satisfy Closure Compiler dependencies.
 * @author cpcallen@google.com (Christopher Allen)
 */

/** @const */
var events = {};

/** @constructor */
events.EventEmitter = function() {};

/**
 * @param {string} event
 * @param {function(...)} listener
 * @return {events.EventEmitter}
 */
events.EventEmitter.prototype.on = function(event, listener) {};

/**
 * @param {string} event
 * @param {function(...)} listener
 * @return {events.EventEmitter}
 */
events.EventEmitter.prototype.once = function(event, listener) {};

module.exports = events;
