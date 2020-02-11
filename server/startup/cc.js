/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Initialisation code to expose CC-specific extensions
 *     not exposed by server/startup/esx.js for testing.
 * @author cpcallen@google.com (Christopher Allen)
 */

///////////////////////////////////////////////////////////////////////////////
// Namespace for CodeCity-specific extensions.
//
var CC = {};

///////////////////////////////////////////////////////////////////////////////
// Permissions API.
//
CC.root = new 'CC.root';
var perms = new 'perms';
var setPerms = new 'setPerms';

///////////////////////////////////////////////////////////////////////////////
// Networking API.
//
CC.connectionListen = new 'CC.connectionListen';
CC.connectionUnlisten = new 'CC.connectionUnlisten';
CC.connectionWrite = new 'CC.connectionWrite';
CC.connectionClose = new 'CC.connectionClose';
CC.xhr = new 'CC.xhr';
