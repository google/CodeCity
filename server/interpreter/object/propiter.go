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

package object

type PropIter struct {
	value Value
	names []string
	seen  map[string]bool
}

// The PropertyIter method on Object returns an iterator which will
// iterate over the properties of the object.
//
// FIXME: should exclude deleted properties
// FIXME: should also iterate over parent properties, etc.
func NewPropIter(v Value) *PropIter {
	return &PropIter{v, v.propNames(), make(map[string]bool)}
}

func (iter *PropIter) next() (string, bool) {
	var n string
	for {
		for len(iter.names) > 0 {
			n = iter.names[0]
			iter.names = iter.names[1:]
			// if _, exists := iter.value.properties[n]; exists && !iter.seen[n] {
			iter.seen[n] = true
			return n, true
			// }
		}
		iter.value = iter.value.Parent()
		if iter.value == nil {
			return "", false
		}
		iter.names = iter.value.propNames()
	}
}

func (iter *PropIter) first() (string, bool) {
	return iter.next()
}
