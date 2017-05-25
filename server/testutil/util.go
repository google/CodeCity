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

// Package testutil provides some utility functions to make writing
// tests easier.
package testutil

import (
	"github.com/davecgh/go-spew/spew"
	"github.com/pmezard/go-difflib/difflib"
)

var diffSpew = spew.ConfigState{
	Indent:                  " ",
	DisablePointerAddresses: true,
	DisableCapacities:       true,
	SortKeys:                true,
}

// Diff prints a unified diff of two complex (possibly circular)
// datastructures.
func Diff(want, got interface{}) string {
	diff := difflib.UnifiedDiff{
		A:        difflib.SplitLines(diffSpew.Sdump(want)),
		B:        difflib.SplitLines(diffSpew.Sdump(got)),
		FromFile: "Want",
		ToFile:   "Got",
		Context:  3,
	}
	result, _ := difflib.GetUnifiedDiffString(diff)
	return result
}
