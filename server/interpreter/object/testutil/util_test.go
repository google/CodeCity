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

package testutil

import (
	"math"
	"testing"

	. "CodeCity/server/interpreter/object"
)

func TestIdentical(t *testing.T) {
	var o1 = New(nil, nil)
	var o2 = New(nil, nil)
	var tests = []struct {
		x        Value
		y        Value
		expected bool
	}{
		{Boolean(true), Boolean(true), true},
		{Boolean(true), Boolean(false), false},
		{Boolean(false), Boolean(false), true},
		{Boolean(false), Boolean(true), false},
		{Number(0), Number(0), true},
		{Number(1), Number(1), true},
		{String("1"), Number(1), false},
		{Number(0), Number(math.Copysign(0, -1)), false},
		{Number(math.Copysign(0, -1)), Number(math.Copysign(0, -1)), true},
		{Number(math.Copysign(0, -1)), Number(0), false},
		{Number(math.Copysign(0, -1)), Number(math.Copysign(0, -1)), true},
		{Number(math.Inf(+1)), Number(math.Inf(+1)), true},
		{Number(math.Inf(+1)), Number(math.Inf(-1)), false},
		{Number(math.Inf(-1)), Number(math.Inf(-1)), true},
		{Number(math.Inf(-1)), Number(math.Inf(+1)), false},
		{String("foo"), String("foo"), true},
		{String(""), String(""), true},
		{String("foo"), String(""), false},
		{String("foo"), String("bar"), false},
		{o1, o1, true},
		{o1, o2, false},
		{o2, o1, false},
		{o1, nil, false},
		{nil, o2, false},
		{nil, nil, true},
	}
	for _, c := range tests {
		v := Identical(c.x, c.y)
		if v != c.expected {
			t.Errorf("Identical(%#v, %#v) == %#v", c.x, c.y, v)
		}
	}
}
