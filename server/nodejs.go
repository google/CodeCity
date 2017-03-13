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

// The nodejs package handles all network communication to the Node.js server.
// Used to convert code to an AST.
package nodejs

import "bufio"
import "fmt"
import "net"

func codeToAST(code string) string {
	conn, _ := net.Dial("tcp", "127.0.0.1:7780")
	fmt.Fprint(conn, code + "\n.\n")
	// Listen for single-line reply.
	json, _ := bufio.NewReader(conn).ReadString('\n')
	return json
}
