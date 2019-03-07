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

const crypto = require('crypto');
const fs = require('fs');
const google = require('googleapis');
const http = require('http');
const {promisify} = require('util');
const {URL} = require('url');

const oauth2Api = google.oauth2('v2');
const readFile = promisify(fs.readFile);

// Configuration constants.
const configFileName = 'loginServer.cfg';

// Global variables.
let CFG = null;
let oauth2Client;
let loginUrl;


/**
 * Load a file from disk, add substitutions, and serve to the web.
 * @param {!Object} response HTTP server response object.
 * @param {string} filename Name of template file on disk.
 * @param {!Object} subs Hash of replacement strings.
 */
async function serveFile(response, filename, subs) {
  let data;
  try {
    data = await readFile(filename, 'utf8');
    // Inject substitutions.
    for (const name in subs) {
      data = data.replace(name, subs[name]);
    }
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/html');
  } catch (err) {
    console.log(err);
    response.statusCode = 500;
    data = `Unable to load file: ${filename}\n${err}`;
  } finally {
    // Serve page to user.
    response.end(data);
  }
}

/**
 * Handles HTTP requests from web server.
 * @param {!Object} request HTTP server request object
 * @param {!Object} response HTTP server response object.
 */
async function handleRequest(request, response) {
  if (request.connection.remoteAddress != '127.0.0.1') {
    // This check is redundant, the server is only accessible to
    // localhost connections.
    console.log(
        `Rejecting connection from ${request.connection.remoteAddress}`);
    response.end('Connection rejected.');
    return;
  }
  // Only serve the page specified by loginPath.
  if (!request.url.startsWith(CFG.loginPath)) {
    response.statusCode = 404;
    response.end(`Unknown Login URL: ${request.url}`);
    return;
  }
  // No query parameters?  Serve login.html.
  if (request.url === CFG.loginPath) {
    await serveFile(response, 'login.html', {'<<<LOGIN_URL>>>': loginUrl});
    return;
  }
  // Process authentication code from OAuth server.
  const code = new URL(request.url, CFG.origin).searchParams.get('code');
  let tokens;
  try {
    // N.B.: due to a bug in Oauth2 API, the Promise returned by
    // getToken never rejects, even if an error occurs.  See
    // https://github.com/googleapis/google-api-nodejs-client/issues/1617
    // for details.  Once that bug is fixed, this contents of this try
    // block can be replaced by this single line:
    //
    // tokens = await oauth2Client.getToken(code);
    //
    // Unsightly kludge:
    tokens = await new Promise((resolve, reject) => {
      oauth2Client.getToken(code, (err, tokens) => {
        if (err) {
          reject(err);
        } else {
          resolve(tokens);
        }
      });
    });
    // End kludge.
  } catch (err) {
    console.log(err);
    response.statusCode = 500;
    response.end(`Google Authentication fail: ${err}`);
    return;
  }
  // Now tokens contains an access_token and an optional
  // refresh_token. Save them.
  oauth2Client.setCredentials(tokens);
  let data;
  try {
    data = await oauth2Api.userinfo.v2.me.get({auth: oauth2Client});
  } catch (err) {
    console.log(err);
    response.statusCode = 500;
    response.end(`Google Userinfo fail: ${err}`);
    return;
  }
  // Convert the Google ID into one unique for Code City.
  const id =
      crypto.createHash('sha512').update(CFG.password + data.id).digest('hex');
  // Create anti-tampering hash as checksum.
  const checksum =
      crypto.createHash('sha').update(CFG.password + id).digest('hex');
  // For future reference, the user's email address is: data.email.
  response.writeHead(302, {
    // Temporary redirect
    'Set-Cookie': `ID=${id}_${checksum}; HttpOnly;`,
    'Location': CFG.connectPath
  });
  response.end('Login OK.  Redirecting.');
  console.log(`Accepted xxxx${id.substring(id.length - 4)}`);
}

/**
 * Read the JSON configuration file and return it.  If none is
 * present, write a stub and throw an error.
 */
function readConfigFile(filename) {
  let data;
  try {
    data = fs.readFileSync(filename, 'utf8');
  } catch (err) {
    const template = {
      // Internal port for this HTTP server.  Nginx hides this from users.
      httpPort: 7781,
      // Origin for login and connect pages.
      origin: 'https://example.codecity.world',
      // Path to the login page.
      loginPath: '/login',
      // Path to the connect page.
      connectPath: '/connect',
      // Google's API client ID.
      clientId: '00000000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' +
          '.apps.googleusercontent.com',
      // Google's API client secret.
      clientSecret: 'yyyyyyyyyyyyyyyyyyyyyyyy',
      // Domain of connect page.
      cookieDomain: 'example.codecity.world',
      // Random password for cookie encryption and salt for login IDs.
      password: 'zzzzzzzzzzzzzzzz'
    };
    fs.writeFileSync(filename, JSON.stringify(template, null, 2), 'utf8');
    throw new Error(
        `Configuration file ${filename} not found.  ` +
        'Creating new file.  Please edit this file.');
  }
  CFG = JSON.parse(data);
  if (CFG.password == 'zzzzzzzzzzzzzzzz') {
    throw new Error(
        `Configuration file ${filename} not configured.  ` +
        'Please edit this file.');
  }
}

/**
 * Initialize Google's authentication and start up the HTTP server.
 */
function startup() {
  try {
    readConfigFile(configFileName);
  } catch (err) {
    console.log(String(err));
    return;
  }

  // Create an authentication client for our interactions with Google.
  oauth2Client = new google.auth.OAuth2(
      CFG.clientId, CFG.clientSecret, CFG.origin + CFG.loginPath);

  // Precompute Google's login URL.
  loginUrl = oauth2Client.generateAuthUrl({scope: 'email'});

  // Start an HTTP server.
  var server = http.createServer(handleRequest);
  server.listen(CFG.httpPort, 'localhost', () => {
    console.log('Login server listening on port ' + CFG.httpPort);
  });
}

startup();
