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

// Package main implements the Code City server.  The initial
// implementation just evaluates any JavaScript it receives.
package main

import (
	"CodeCity/server/interpreter"
	"bufio"
	"fmt"
	"net"
	"os"
)

func main() {
	ln, err := net.Listen("tcp", ":7777")
	if err != nil {
		panic(err)
	}
	for {
		conn, err := ln.Accept()
		if err != nil {
			fmt.Errorf("Accept failed: %s\n", err)
			break
		}
		go handleConnection(conn)
	}
}

func handleConnection(conn net.Conn) {
	fmt.Fprintln(os.Stderr, "connection opened.")
	in := bufio.NewScanner(conn)
	for in.Scan() {
		input := in.Text()
		fmt.Println(input)
		i := interpreter.New(input)
		i.Run()
		fmt.Fprintln(conn, i.Value().ToString())
	}
	if err := in.Err(); err != nil {
		fmt.Fprintln(conn, "reading standard input:", err)
		fmt.Fprintln(os.Stderr, "reading standard input:", err)
	}
	fmt.Fprintln(os.Stderr, "connection closed.")
}
