/**
 * @license
 * Code City Node.js Connection Server
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
 * @fileoverview Node.js server that provides connection services to Code City.
 * @author fraser@google.com (Neil Fraser)
 */

// Start with: node loginServer.js
'use strict';

var fs = require('fs');
var http = require('http');

// Global variables.
var CFG = null;

/**
 * Generate a unique ID.  This should be globally unique.
 * 62 characters ^ 22 length > 128 bits (better than a UUID).
 * @return {string} A globally unique ID string.
 */
function genUid(n) {
  var soupLength = genUid.soup_.length;
  var id = [];
  for (var i = 0; i < n; i++) {
    id[i] = genUid.soup_.charAt(Math.random() * soupLength);
  }
  return id.join('');
};

/**
 * Legal characters for the unique ID.
 * @private
 */
genUid.soup_ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Load a file from disk, add substitutions, and serve to the web.
 * @param {!Object} response HTTP server response object.
 * @param {string} filename Name of template file on disk.
 * @param {!Object} subs Hash of replacement strings.
 */
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

/**
 * Handles HTTP requests from web server.
 * @param {!Object} request HTTP server request object
 * @param {!Object} response HTTP server response object.
 */
function handleRequest(request, response) {
  if (request.connection.remoteAddress != '127.0.0.1') {
    // This check is redundant, the server is only accessible to
    // localhost connections.
    console.log('Rejecting connection from ' + request.connection.remoteAddress);
    response.end('Connection rejected.');
    return;
  }

  if (request.url == CFG.connectPath) {
    var cookieList = {};
    var rhc = request.headers.cookie;
    rhc && rhc.split(';').forEach(function(cookie) {
        var parts = cookie.split('=');
        cookieList[parts.shift().trim()] = decodeURI(parts.join('='));
    });
    if (!cookieList.id || !cookieList.id.match(/^\w+$/)) {
      if (cookieList.id) {
        console.log('Missing login ID.  Redirecting.');
      } else {
        console.log('Invalid login ID: ' + cookieList.id);
      }
      response.writeHead(302, {  // Temporary redirect
         'Location': CFG.loginPath
       });
      response.end('Login required.  Redirecting.');
      return;
    }
    var sessionId = genUid(22);
    var subs = {
      '<<<LOGIN_ID>>>': cookieList.id,
      '<<<SESSION_ID>>>': sessionId
    };
    serveFile(response, 'connect.html', subs);

  } else if (request.url.indexOf(CFG.connectPath + '?ping=') == 0) {
  } else {
    response.statusCode = 404;
    response.end('Unknown Connect URL: ' + request.url);
  }
}

/**
 * Read the JSON configuration file.  If none is present, write a stub.
 * When done, call startup.
 */
function configureAndStartup() {
  const filename = 'connectServer.cfg';
  fs.readFile(filename, 'utf8', function(err, data) {
    if (err) {
      console.log('Configuration file connectServer.cfg not found.  ' +
                  'Creating new file.');
      data = {
        // Internal port for this HTTP server.  Nginx hides this from users.
        httpPort: 7782,
        // Path to the login page.
        loginPath: '/login',
        // Path to the connect page.
        connectPath: '/connect'
      };
      data = JSON.stringify(data, null, 2);
      fs.writeFile(filename, data, 'utf8');
    }
    data = JSON.parse(data);
    CFG = data;
    startup();
  });
}

/**
 * Initialize Google's authentication and start up the HTTP server.
 */
function startup() {
  // Start an HTTP server.
  var server = http.createServer(handleRequest);
  server.listen(CFG.httpPort, 'localhost', function(){
    console.log('Connection server listening on port ' + CFG.httpPort);
  });
}

configureAndStartup();
