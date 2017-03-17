/**
 * @license
 * Code City Node.js Login Server
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
 * @fileoverview Node.js server that provides Google auth services to Code City.
 * @author fraser@google.com (Neil Fraser)
 */

// Start with: node loginServer.js
'use strict';

var fs = require('fs');
var http = require('http');
var google = require('googleapis');
var oauth2Api = google.oauth2('v2');
var OAuth2 = google.auth.OAuth2;

// Define a port we want to listen to.
const loginPort = 7781;

var oauth2Client = new OAuth2(
  '63024745471-9aothjt7m84o1cpsmg6ta93td2qnbsaf.apps.googleusercontent.com',
  'Nbxup8Ge92D8krs9nGsszjj6',
  'http://localhost:7781/login'
);

var url = oauth2Client.generateAuthUrl({
  scope: 'email'
});

function serveFile(response, filename, subs) {
  fs.readFile(filename, 'utf8', function(err, data) {
    if (err) {
      response.statusCode = 500;
      console.log(err);
      response.end('Unable to load file: ' + filename + '\n' + err);
    }
    // Inject substitutions.
    for (var name in subs) {
      data = data.replace(name, subs[name]);
    }
    // Serve page to user.
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/html');
    response.end(data);
  });
}

//We need a function which handles requests and send response
function handleRequest(request, response) {
  if (request.connection.remoteAddress != '127.0.0.1') {
    // This check is redundant, the server is only accessible to
    // localhost connections.
    console.log('Rejecting connection from ' + request.connection.remoteAddress);
    response.end('Connection rejected.');
    return;
  }

  if (request.url == '/login') {
    var subs = {'<<<LOGIN_URL>>>': url};
    serveFile(response, 'login.html', subs);
  } else if (request.url.indexOf('/login?code=') == 0) {
    var code = request.url.substring(request.url.indexOf('=') + 1);
    oauth2Client.getToken(code, function(err, tokens) {
      // Now tokens contains an access_token and an optional refresh_token. Save them.
      if (err) {
        console.log(err);
        response.statusCode = 500;
        response.end('Google Authentication fail: ' + err);
        return;
      }
      oauth2Client.setCredentials(tokens);

      oauth2Api.userinfo.v2.me.get({auth: oauth2Client},
        function(err, data) {
          if (err) {
            console.log(err);
            response.statusCode = 500;
            response.end('Google Userinfo fail: ' + err);
            return;
          }
          response.end('Hello: ' + data.email + ' ' + data.id);
          console.log(data);
        });
    });
  } else {
    response.statusCode = 404;
    response.end('Unknown URL: ' + request.url);
  }
}

//Create a server
var server = http.createServer(handleRequest);

// Start server
server.listen(loginPort, 'localhost', function(){
  console.log('Login server listening on port ' + loginPort);
});
