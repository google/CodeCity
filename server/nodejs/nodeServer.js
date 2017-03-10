/**
 * @license
 * Code City Node.js Server
 *
 * Copyright 2017 Google Inc.
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

/**
 * @fileoverview Node.js server that provides JavaScript services to Code City.
 * @author fraser@google.com (Neil Fraser)
 */

// Start with: node nodeServer.js
'use strict';

var net = require('net');
var acorn = require('./acorn.js');

// Create a new TCP server for parsing code into an AST using Acorn.
var parsePort = 7780;
var server = net.createServer(function (socket) {
  if (socket.remoteAddress != '127.0.0.1') {
    console.log('Rejecting connection from ' + socket.remoteAddress);
    socket.end('Connection rejected.');
    return;
  }
  console.log('Parse connection from ' + socket.remoteAddress);
  socket.incomingData_ = '';
  socket.closed_ = false;

  // Handle incoming messages from clients.
  socket.on('data', function (data) {
    if (socket.closed_) {
      // Ignore any further communication on this connection.
      return;
    }
    socket.incomingData_ += String(data).replace('\r', '');
    // Incoming data is terminated by a '.' on its own line.
    var end = socket.incomingData_.lastIndexOf('\n.\n');
    if (end != -1) {
      var code = socket.incomingData_.substring(0, end);
      try {
        var ast = acorn.parse(code);
        socket.write(JSON.stringify(ast));
        console.log('Parsed: ' + code.length + ' bytes.');
        socket.closed_ = true;
      } catch (e) {
        // Syntax error in provided code.
        var error = {'type': e.name, 'message': e.message, 'error': e};
        socket.write(JSON.stringify(error));
        console.log('Parse: ' + e);
      }
      socket.end('\n');
    }
  });
});
server.listen(parsePort, 'localhost');
console.log('Parse server listening on port ' + parsePort);
