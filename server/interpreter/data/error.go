/* Copyright 2017 Google Inc.
 * https://github.com/NeilFraser/CodeCity
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

package data

// NativeError is a (type, description) tuple used to indicate that an
// error condition which is specified to throw a JS native error has
// occurred.  It's not actually a JS Error object itself (because
// creating one would require access to the appropriate prototype
// object), but the interpreter should turn it into one and then
// trhrow the result.
type NativeError struct {
	Type    NativeErrorType
	Message string
}

// NativeErrorType is an enum of the native error types listed in
// ES5.1 §15.11.6: EvalError, RangeError, etc.
type NativeErrorType int

// Type constants for NativeErrorType.
const (
	EvalError NativeErrorType = iota
	RangeError
	ReferenceError
	SyntaxError
	TypeError
	URIError
)
