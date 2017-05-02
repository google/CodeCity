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

// Protos is a struct containing prototypes for the various Object
// classes defined in the ES5.1 spec.
//
// N.B.: BooleanProto is the prototype for BoxedBoolean objects, not
// for Boolean values (which, as primitives, do not have a prototype);
// similarly for NubmerProto and StringProto.
//
// FIXME: specify types of Errors and other prototypes once suitable
// types defined.
type Protos struct {
	ObjectProto         Object
	BooleanProto        *BoxedBoolean // See note
	NumberProto         *BoxedNumber  // See note
	StringProto         *BoxedString  // See note
	FunctionProto       Object
	ArrayProto          *Array
	ErrorProto          Object
	EvalErrorProto      Object
	RangeErrorProto     Object
	ReferenceErrorProto Object
	SyntaxErrorProto    Object
	TypeErrorProto      Object
	URIErrorProto       Object
	OwnerProto          *Owner
}

// NewProtos creates, initialises and populates a Proto struct with
// default prototype objects.
func NewProtos() *Protos {
	var prts Protos
	prts.ObjectProto = NewObject(nil, nil)

	prts.BooleanProto = NewBoxedBoolean(nil, prts.ObjectProto, Boolean(false))
	prts.NumberProto = NewBoxedNumber(nil, prts.ObjectProto, Number(0))
	prts.StringProto = NewBoxedString(nil, prts.ObjectProto, String(""))

	prts.FunctionProto = NewObject(nil, prts.ObjectProto)
	prts.ArrayProto = NewArray(nil, prts.ObjectProto)
	prts.ErrorProto = NewObject(nil, prts.ObjectProto)

	prts.EvalErrorProto = NewObject(nil, prts.ErrorProto)
	prts.EvalErrorProto.Set("name", String("EvalError"))
	prts.RangeErrorProto = NewObject(nil, prts.ErrorProto)
	prts.RangeErrorProto.Set("name", String("RangeError"))
	prts.ReferenceErrorProto = NewObject(nil, prts.ErrorProto)
	prts.ReferenceErrorProto.Set("name", String("ReferenceError"))
	prts.SyntaxErrorProto = NewObject(nil, prts.ErrorProto)
	prts.SyntaxErrorProto.Set("name", String("SyntaxError"))
	prts.TypeErrorProto = NewObject(nil, prts.ErrorProto)
	prts.TypeErrorProto.Set("name", String("TypeError"))
	prts.URIErrorProto = NewObject(nil, prts.ErrorProto)
	prts.URIErrorProto.Set("name", String("URIError"))

	prts.OwnerProto = NewOwner(prts.ObjectProto)

	return &prts
}
