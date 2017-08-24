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

var crypto = require('crypto');
var fs = require('fs');
var google = require('googleapis');
var http = require('http');

// Global variables.
var CFG = null;
var oauth2Client;
var loginUrl;


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

  if (request.url == CFG.loginPath) {
    var subs = {'<<<LOGIN_URL>>>': loginUrl};
    serveFile(response, 'login.html', subs);

  } else if (request.url.startsWith(CFG.loginPath + '?code=')) {
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

      var oauth2Api = google.oauth2('v2');
      oauth2Api.userinfo.v2.me.get({auth: oauth2Client},
        function(err, data) {
          if (err) {
            console.log(err);
            response.statusCode = 500;
            response.end('Google Userinfo fail: ' + err);
            return;
          }
          // Convert the Google ID into one unique for Code City.
          var id = CFG.password + data.id;
          id = crypto.createHash('sha512').update(id).digest('hex');
          // Create anti-tampering hash as checksum.
          var checksum = CFG.password + id;
          checksum = crypto.createHash('sha').update(checksum).digest('hex');
          // For future reference, the user's email address is: data.email
          response.writeHead(302, {  // Temporary redirect
              'Set-Cookie': 'id=' + id + '_' + checksum + '; HttpOnly' +
              '; Domain=' + CFG.cookieDomain + '; Path=' + CFG.connectPath,
              'Location': CFG.connectPath
           });
          response.end('Login OK.  Redirecting.');
          console.log('Accepted xxxx' + id.substring(id.length - 4));
        });
    });
  } else {
    response.statusCode = 404;
    response.end('Unknown Login URL: ' + request.url);
  }
}

/**
 * Read the JSON configuration file.  If none is present, write a stub.
 * When done, call startup.
 */
function configureAndStartup() {
  var filename = 'loginServer.cfg';
  fs.readFile(filename, 'utf8', function(err, data) {
    if (err) {
      console.log('Configuration file loginServer.cfg not found.  ' +
                  'Creating new file.  Please edit this file.');
      data = {
        // Internal port for this HTTP server.  Nginx hides this from users.
        httpPort: 7781,
        // Path to the login page.
        loginPath: '/login',
        // Path to the connect page.
        connectPath: '/connect',
        // Google's API client ID.
        clientId: '00000000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com',
        // Google's API client secret.
        clientSecret: 'yyyyyyyyyyyyyyyyyyyyyyyy',
        // Full public-facing URL for login page.
        redirectUri: 'https://example.codecity.world/login',
        // Domain of connect page.
        cookieDomain: 'example.codecity.world',
        // Random password for cookie encryption and salt for login IDs.
        password: 'zzzzzzzzzzzzzzzz'
      };
      data = JSON.stringify(data, null, 2);
      fs.writeFile(filename, data, 'utf8');
      return;
    }
    data = JSON.parse(data);
    if (data.password == 'zzzzzzzzzzzzzzzz') {
      console.log('Configuration file loginServer.cfg not configured.  ' +
                  'Please edit this file.');
      return;
    }
    CFG = data;
    startup();
  });
}

/**
 * Initialize Google's authentication and start up the HTTP server.
 */
function startup() {
  // Create an authentication client for our interactions with Google.
  oauth2Client = new google.auth.OAuth2(
    CFG.clientId,
    CFG.clientSecret,
    CFG.redirectUri
  );

  // Precompute Google's login URL.
  loginUrl = oauth2Client.generateAuthUrl({
    scope: 'email'
  });

  // Start an HTTP server.
  var server = http.createServer(handleRequest);
  server.listen(CFG.httpPort, 'localhost', function(){
    console.log('Login server listening on port ' + CFG.httpPort);
  });
}

configureAndStartup();
