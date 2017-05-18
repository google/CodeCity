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

package flatpack

import (
	"encoding/json"
	"reflect"
)

// Support for (de)serializing Flatpack using encoding/json

func (t *tagged) UnmarshalJSON(b []byte) error {
	var tmp struct {
		T tID
		V json.RawMessage
	}
	if e := json.Unmarshal(b, &tmp); e != nil {
		return e
	}
	t.T = tmp.T
	if tmp.T == "" { // Special case: `{"T": "", "V": null}` -> tagged{"", nil}
		if string(tmp.V) != "null" {
			panic("Non-null value with no type??")
		}
		*t = tagged{"", nil} // Redundant - unless caller is re-using *t
		return nil
	}
	// FIXME: better error handling
	_, ftyp := typesForTID(tmp.T)
	item := reflect.New(ftyp)
	if e := json.Unmarshal(tmp.V, item.Interface()); e != nil {
		return e
	}
	t.V = item.Elem().Interface()
	return nil
}
