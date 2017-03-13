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

package nodejs

import "strings"
import "testing"

func TestCodeToAST(t *testing.T) {
	code := "1 + 2"
	json := strings.Trim(codeToAST(code), " \r\n")
	expected := `{"type":"Program","start":0,"end":5,"body":[{"type":"ExpressionStatement","start":0,"end":5,"expression":{"type":"BinaryExpression","start":0,"end":5,"left":{"type":"Literal","start":0,"end":1,"value":1,"raw":"1"},"operator":"+","right":{"type":"Literal","start":4,"end":5,"value":2,"raw":"2"}}}]}`
	if json != expected {
		t.Errorf("%s != %s", json, expected)
	}

	code = "Holy !@#$%"
	json = strings.Trim(codeToAST(code), " \r\n")
	expected = `{"type":"SyntaxError","message":"Unexpected token (1:5)","error":{"pos":5,"loc":{"line":1,"column":5},"raisedAt":6}}`
	if json != expected {
		t.Errorf("%s != %s", json, expected)
	}
}
