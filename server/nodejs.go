package main

import "net"
import "fmt"
import "bufio"

func main() {
  code := "alert(1 + 2);"
  fmt.Println("Parse: " + code)
  json := codeToAST(code)
  fmt.Println("Node.js says: " + json)
}

func codeToAST(code string) string {
  conn, _ := net.Dial("tcp", "127.0.0.1:7780")
  fmt.Fprintf(conn, code + "\n.\n")
  // Listen for single-line reply.
  json, _ := bufio.NewReader(conn).ReadString('\n')
  return json
}
