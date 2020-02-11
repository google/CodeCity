/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Polyfills to bring the server's partial JavaScript
 * implementation to include some features of JavaScript 7.
 * @author fraser@google.com (Neil Fraser)
 */


///////////////////////////////////////////////////////////////////////////////
// Array.prototype polyfills
///////////////////////////////////////////////////////////////////////////////

Object.defineProperty(Array.prototype, 'includes',
    {configurable: true,
     enumerable: false,
     writable: true,
     value: new 'Array.prototype.includes'});
