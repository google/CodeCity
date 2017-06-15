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
	"bufio"
	"encoding/json"
	"fmt"
	"net"

	"codecity.world/cc/server/interpreter/ast"
)

// parse takes a javascript program, and returns an *ast.Program
//
// FIXME: error handling
func parse(code string) (*ast.Program, error) {
	astJSON, err := codeToJSON(code)
	if err != nil {
		return nil, err
	}
	// Check for parse errors:
	var tmp struct {
		Type string `json:"type"`
	}
	e := json.Unmarshal([]byte(astJSON), &tmp)
	if e != nil {
		return nil, e
	} else if tmp.Type != "Program" {
		return nil, fmt.Errorf("%s", astJSON) // FIXME: return proper error
	}

	p, err := ast.NewFromJSON(astJSON)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func codeToJSON(code string) (string, error) {
	conn, err := net.Dial("tcp", "localhost:7780")
	if err != nil {
		return "", err
	}
	fmt.Fprint(conn, code+"\n")
	// Half-close the connection, and wait for a reply.
	conn.(*net.TCPConn).CloseWrite()
	// Listen for single-line reply.
	json, err := bufio.NewReader(conn).ReadString('\n')
	if err != nil {
		return "", err
	}
	return json, nil
}
