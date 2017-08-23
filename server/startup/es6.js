/**
 * @license
 * Code City: Startup code.
 *
 * Copyright 2017 Google Inc.
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
 * @fileoverview Polyfills to bring the server's partial JavaScript
 * implementation beyond JavaScript 5.1.
 * @author fraser@google.com (Neil Fraser)
 */

Object.defineProperty(Object, 'is',
    {configurable: true,
     enumerable: false,
     writable: true,
     value: new 'Object.is'});

Object.defineProperty(String.prototype, 'endsWith',
    {configurable: true,
     enumerable: false,
     writable: true,
     value: new 'String.prototype.endsWith'});

Object.defineProperty(String.prototype, 'includes',
    {configurable: true,
     enumerable: false,
     writable: true,
     value: new 'String.prototype.includes'});

Object.defineProperty(String.prototype, 'repeat',
    {configurable: true,
     enumerable: false,
     writable: true,
     value: new 'String.prototype.repeat'});

Object.defineProperty(String.prototype, 'startsWith',
    {configurable: true,
     enumerable: false,
     writable: true,
     value: new 'String.prototype.startsWith'});

Object.defineProperty(Number, 'EPSILON',
    {configurable: false,
     enumerable: false,
     writable: false,
     value: Math.pow(2, -52)});

Object.defineProperty(Number, 'isFinite',
    {configurable: false,
     enumerable: false,
     writable: false,
     value: new 'Number.isFinite'});

Object.defineProperty(Number, 'isNaN',
    {configurable: false,
     enumerable: false,
     writable: false,
     value: new 'Number.isNaN'});

Object.defineProperty(Number, 'isSafeInteger',
    {configurable: false,
     enumerable: false,
     writable: false,
     value: new 'Number.isSafeInteger'});

Object.defineProperty(Math, 'sign',
    {configurable: false,
     enumerable: false,
     writable: false,
     value: new 'Math.sign'});

Object.defineProperty(Math, 'trunc',
    {configurable: false,
     enumerable: false,
     writable: false,
     value: new 'Math.trunc'});

