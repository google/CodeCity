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

package interpreter

import (
	"fmt"

	"CodeCity/server/interpreter/data"
)

// cvalType is an enum of completion value types.
type cvalType int

// Completion value types, as defined in §8.9 of the ES5.1 spec.
const (
	NORMAL cvalType = iota
	BREAK
	CONTINUE
	RETURN
	THROW
)

// The cval type implements Completion Values, as defined in §8.9
// of the ES5.1 spec.
//
// .typ is the type: NORMAL, BREAK, CONTINUE, RETURN, or THROW
//
// .val is the JavaScript value being returned or a reference (or nil,
//  which the spec calls 'empty').
//
// .targ is the target label for a BREAK or CONTINUE
type cval struct {
	typ  cvalType
	val  value
	targ string
}

// *scope must satisfy value, so we can put one in a reference.
var _ value = (*scope)(nil)

// The pval method tests to make sure the cval is a (normal) plain
// JavaScript value (has .typ == NORMAL, .val fulfils data.Value,
// .targ == ""), and returns that value.
func (cv cval) pval() data.Value {
	if cv.typ != NORMAL || cv.targ != "" {
		panic("expected NORMAL completion value")
	}
	return cv.value()
}

// The value method tests to make sure the cval is a JavaScript value.
func (cv cval) value() data.Value {
	if cv.val == nil {
		return nil
	}
	return cv.val.(data.Value)
}

// The rval method tests to make sure the cval is a (normal) reference
// (has .typ == NORMAL, .val is a reference, .targ == ""), and returns
// that reference.
func (cv cval) rval() reference {
	if cv.typ != NORMAL || cv.targ != "" {
		panic("expected NORMAL completion value")
	}
	return cv.val.(reference)
}

// The abrupt method returns true if the cval is an abrupt completion,
// i.e. has .typ other than NORMAL.
func (cv cval) abrupt() bool {
	if cv.typ == NORMAL {
		return false
	} else if cv.typ == BREAK || cv.typ == CONTINUE ||
		cv.typ == RETURN || cv.typ == THROW {
		return true
	} else {
		panic("invalid cval type")
	}
}

// pval takes an ordinary JavaScript value and returns a pointer to a
// cval with type NORMAL containing that value.
func pval(v data.Value) *cval {
	return &cval{NORMAL, v, ""}
}

// rval takes a reference returns a pointer to a cval with type NORMAL
// containing reference.
func rval(r reference) *cval {
	return &cval{NORMAL, r, ""}
}

// GoString prints a cval in a readable format for debugging purposes.
func (cv cval) GoString() string {
	var t string
	switch cv.typ {
	case NORMAL:
		t = "NORMAL"
	case BREAK:
		t = "BREAK"
	case CONTINUE:
		t = "CONTINUE"
	case RETURN:
		t = "RETURN"
	case THROW:
		t = "THROW"
	}
	return fmt.Sprintf("{%s, %#v, %#v}", t, cv.val, cv.targ)
}
