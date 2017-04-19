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

type PropIter struct {
	value Value
	names []string
	seen  map[string]bool
}

// NewPropIter takes any JavaScript value and returns an iterator
// which will iterate over the properties of that object and its
// prototypes.
//
// FIXME: skip non-enumerable properties
// FIXME: perhaps we should guarantee iteration order, as most
// browsers (and ES6) do?
func NewPropIter(v Value) *PropIter {
	return &PropIter{v, v.OwnPropertyKeys(), make(map[string]bool)}
}

// The Next method returns the next non-deleted, non-shadowed property
// name and ok == true, or ok == false if there are no more property
// names to iterate over.
func (iter *PropIter) Next() (string, bool) {
	var name string
	for {
		for len(iter.names) > 0 {
			name = iter.names[0]
			iter.names = iter.names[1:]
			if iter.value.HasOwnProperty(name) && !iter.seen[name] {
				iter.seen[name] = true
				return name, true
			}
		}
		iter.value = iter.value.Proto()
		if iter.value == nil {
			return "", false
		}
		iter.names = iter.value.OwnPropertyKeys()
	}
}
