/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview The Registry class, for e.g. registering built-ins.
 * @author cpcallen@google.com (Christopher Allen)
 */
'use strict';

/**
 * Class for a registry provinding a bidirectional mapping between
 * string-valued keys and arbitrary values.
 * @constructor
 * @template T
 */
class Registry {
  constructor() {
    /** @private @const @type {!Object<string, T>} */
    this.values_ = Object.create(null);
    /** @private @const @type {!Map<T, string>} */
    this.keys_ = new Map();
  }

  /**
   * Return an array of [key, value] pairs of the registry.
   * @return {!Array<!Array<string|T>>}
   */
  entries() {
    return Object.entries(this.values_);
  }

  /**
   * Look up a registered value.  Throws an error if the given key has
   * not been registered.
   * @param {string} key The key to get the registered value for.
   * @return {T} The registered value.
   */
  get(key) {
    if (!this.has(key)) {
      throw new Error('Key "' + key + '" not registered');
    }
    return this.values_[key];
  }

  /**
   * Look up the key for a registered value.  Returns undefined if the
   * given value has not been registered.  If the value has been
   * registered with more than one key then one of those keys will be
   * returned but there is no guarantee which.
   * @param {T} value The value to get the key for.
   * @return {string|undefined} The key for value, or undefined if
   *     value never registered.
   */
  getKey(value) {
    return this.keys_.get(value);
  }

  /**
   * Check if a key exists in the registry.
   * @param {string} key The key to check.
   * @return {boolean} True iff key has previously been registered.
   */
  has(key) {
    return key in this.values_;
  }

  /**
   * Return an array of keys of the registry.
   * @return {!Array<string>}
   */
  keys() {
    return Object.keys(this.values_);
  }

  /**
   * Register a value.  Throws an error if the given key has already
   * been used for a previous registration.
   * @param {string} key The key to register value with.
   * @param {T} value The value to be registered.
   */
  set(key, value) {
    if (key in this.values_) {
      throw new Error('Key "' + key + '" already registered');
    }
    this.values_[key] = value;
    this.keys_.set(value, key);
  }

  /**
   * Return an array of values of the registry.
   * @return {!Array<T>}
   */
  values() {
    return Object.values(this.values_);
  }

}

module.exports = Registry;
