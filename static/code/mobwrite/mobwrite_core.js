/**
 * @license
 * Copyright 2006 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview This client-side code drives the synchronisation.
 * @author fraser@google.com (Neil Fraser)
 */


/**
 * Namespace containing all MobWrite code.
 */
var mobwrite = {};


/**
 * URL of Ajax gateway.
 * @type {string}
 */
mobwrite.syncGateway = '/scripts/q.py';


/**
 * Print diagnostic messages to the browser's console.
 * @type {boolean}
 */
mobwrite.debug = true;


/**
 * PID of task which will trigger next Ajax request.
 * @type {number?}
 * @private
 */
mobwrite.syncRunPid_ = null;


/**
 * PID of task which will kill stalled Ajax request.
 * @type {number?}
 * @private
 */
mobwrite.syncKillPid_ = null;


/**
 * Time to wait for a connection before giving up and retrying.
 * @type {number}
 */
mobwrite.timeoutInterval = 30000;


/**
 * Shortest interval (in milliseconds) between connections.
 * @type {number}
 */
mobwrite.minSyncInterval = 1000;


/**
 * Longest interval (in milliseconds) between connections.
 * @type {number}
 */
mobwrite.maxSyncInterval = 4000;


/**
 * Initial interval (in milliseconds) for connections.
 * This value is modified later as traffic rates are established.
 * @type {number}
 */
mobwrite.syncInterval = 2000;


/**
 * Optional prefix to automatically add to all IDs.
 * @type {string}
 */
mobwrite.idPrefix = '';


/**
 * Flag to nullify all shared elements and terminate.
 * @type {boolean}
 */
mobwrite.nullifyAll = false;


/**
 * Track whether something changed client-side in each sync.
 * @type {boolean}
 * @private
 */
mobwrite.clientChange_ = false;


/**
 * Track whether something changed server-side in each sync.
 * @type {boolean}
 * @private
 */
mobwrite.serverChange_ = false;


/**
 * Temporary object used while each sync is airborne.
 * @type {Object?}
 * @private
 */
mobwrite.syncAjaxObj_ = null;


/**
 * Return a random ID that's 6 characters long.
 * 79^6 = 243,087,455,521
 * @return {string} Random ID.
 */
mobwrite.uniqueId = function() {
  // All the legal characters for a URL 'fragment' (hash) as per RFC 3986.
  var soup = 'ABCDEFGHIJKLMNOPQUSTPVWXYZabcdefghijklmnopqrstuvwxyz' +
      '0123456789-._~!$&\'()*+,;=?/';
  var id = '';
  for (var i = 0; i < 6; i++) {
    id += soup.charAt(Math.random() * soup.length);
  }
  return id;
};


/**
 * Unique ID for this session.
 * @type {string}
 */
mobwrite.syncUsername = mobwrite.uniqueId();


/**
 * Hash of all shared objects.
 * @type {Object}
 */
mobwrite.shared = Object.create(null);


/**
 * Array of registered handlers for sharing types.
 * Modules add their share functions to this list.
 * @type {Array.<Function>}
 */
mobwrite.shareHandlers = [];


/**
 * Prototype of shared object.
 * @param {string=} id Unique file ID.
 * @constructor
 */
mobwrite.shareObj = function(id) {
  if (!id) return;  // Creating subclass prototype object.
  this.file = id;
  this.dmp = new diff_match_patch();
  this.dmp.Diff_Timeout = 0.5;
  // List of unacknowledged edits sent to the server.
  this.editStack = [];
  if (mobwrite.debug) {
    console.info('Creating shareObj: "' + id + '"');
  }
};


/**
 * Client's understanding of what the server's text looks like.
 * @type {string}
 */
mobwrite.shareObj.prototype.shadowText = '';


/**
 * The client's version for the shadow (n).
 * @type {number}
 */
mobwrite.shareObj.prototype.clientVersion = 0;


/**
 * The server's version for the shadow (m).
 * @type {number}
 */
mobwrite.shareObj.prototype.serverVersion = 0;


/**
 * Did the client understand the server's delta in the previous heartbeat?
 * Initialize false because the server and client are out of sync initially.
 * @type {boolean}
 */
mobwrite.shareObj.prototype.deltaOk = false;


/**
 * Synchronization mode.
 * True: Used for text, attempts to gently merge differences together.
 * False: Used for numbers, overwrites conflicts, last save wins.
 * @type {boolean}
 */
mobwrite.shareObj.prototype.mergeChanges = true;


/**
 * Fetch or compute a plaintext representation of the user's text.
 * @return {string} Plaintext content.
 */
mobwrite.shareObj.prototype.getClientText = function() {
  throw new Error('Defined by subclass');
};


/**
 * Set the user's text based on the provided plaintext.
 * @param {string} text New text.
 */
mobwrite.shareObj.prototype.setClientText = function(text) {
  throw new Error('Defined by subclass');
};


/**
 * Modify the user's plaintext by applying a series of patches against it.
 * @param {Array.<patch_obj>} patches Array of Patch objects.
 */
mobwrite.shareObj.prototype.patchClientText = function(patches) {
  var oldClientText = this.getClientText();
  var result = this.dmp.patch_apply(patches, oldClientText);
  // Set the new text only if there is a change to be made.
  if (oldClientText != result[0]) {
    // The following will probably destroy any cursor or selection.
    // Widgets with cursors should override and patch more delicately.
    this.setClientText(result[0]);
  }
};


/**
 * Notification of when a diff was sent to the server.
 * @param {Array.<Array.<*>>} diffs Array of diff tuples.
 */
mobwrite.shareObj.prototype.onSentDiff = function(diffs) {
  // Potential hook for subclass.
};


/**
 * Fire a synthetic 'change' event to a target element.
 * Notifies an element that its contents have been changed.
 * @param {Object} target Element to notify.
 */
mobwrite.shareObj.prototype.fireChange = function(target) {
  if ('createEvent' in document) {  // W3
    var e = document.createEvent('HTMLEvents');
    e.initEvent('change', false, false);
    target.dispatchEvent(e);
  } else if ('fireEvent' in target) { // IE
    target.fireEvent('onchange');
  }
};


/**
 * Return the command to nullify this field.  Also unshares this field.
 * @return {string} Command to be sent to the server.
 */
mobwrite.shareObj.prototype.nullify = function() {
  mobwrite.unshare(this.file);
  return 'N:' + mobwrite.idPrefix + this.file + '\n';
};


/**
 * Asks the shareObj to synchronize.  Computes client-made changes since
 * previous postback.  Return '' to skip this synchronization.
 * @return {string} Commands to be sent to the server.
 */
mobwrite.shareObj.prototype.syncText = function() {
  var clientText = this.getClientText();
  if (this.deltaOk) {
    // The last delta postback from the server to this shareObj was successful.
    // Send a compressed delta.
    var diffs = this.dmp.diff_main(this.shadowText, clientText, true);
    if (diffs.length > 2) {
      this.dmp.diff_cleanupSemantic(diffs);
      this.dmp.diff_cleanupEfficiency(diffs);
    }
    var changed = diffs.length != 1 || diffs[0][0] != DIFF_EQUAL;
    if (changed) {
      mobwrite.clientChange_ = true;
      this.shadowText = clientText;
    }
    // Don't bother appending a no-change diff onto the stack if the stack
    // already contains something.
    if (changed || !this.editStack.length) {
      var action = (this.mergeChanges ? 'd:' : 'D:') + this.clientVersion +
          ':' + this.dmp.diff_toDelta(diffs);
      this.editStack.push([this.clientVersion, action]);
      this.clientVersion++;
      this.onSentDiff(diffs);
    }
  } else {
    // The last delta postback from the server to this shareObj didn't match.
    // Send a full text dump to get back in sync.  This will result in any
    // changes since the last postback being wiped out. :(
    this.shadowText = clientText;
    this.clientVersion++;
    var action = 'r:' + this.clientVersion + ':' +
                 encodeURI(clientText).replace(/%20/g, ' ');
    // Append the action to the edit stack.
    this.editStack.push([this.clientVersion, action]);
    // Sending a raw dump will put us back in sync.
    // Set deltaOk to true in case this sync fails to connect, in which case
    // the following sync(s) should be a delta, not more raw dumps.
    this.deltaOk = true;
  }

  // Create the output starting with the file statement, followed by the edits.
  var data = 'F:' + this.serverVersion + ':' +
      mobwrite.idPrefix + this.file + '\n';
  for (var i = 0; i < this.editStack.length; i++) {
    data += this.editStack[i][1] + '\n';
  }
  return data;
};


/**
 * Collect all client-side changes and send them to the server.
 * @private
 */
mobwrite.syncRun1_ = function() {
  // Initialize clientChange_, to be checked at the end of syncRun2_.
  mobwrite.clientChange_ = false;
  var data = [];
  data[0] = 'u:' + mobwrite.syncUsername + '\n';
  var empty = true;
  // Ask every shared object for their deltas.
  for (var x in mobwrite.shared) {
    if (mobwrite.shared[x]) {
      if (mobwrite.nullifyAll) {
        data.push(mobwrite.shared[x].nullify());
      } else {
        data.push(mobwrite.shared[x].syncText());
      }
      empty = false;
    }
  }
  if (empty) {
    // No sync objects.
    if (mobwrite.debug) {
      console.info('MobWrite task stopped.');
    }
    return;
  }
  if (data.length == 1) {
    // No sync data.
    if (mobwrite.debug) {
      console.info('All objects silent; null sync.');
    }
    mobwrite.syncRun2_('\n\n');
    return;
  }

  if (mobwrite.debug) {
    console.info('TO server:\n' + data.join(''));
  }
  // Add terminating blank line.
  data.push('\n');
  data = data.join('');

  // Schedule a watchdog task to catch us if something horrible happens.
  mobwrite.syncKillPid_ =
      setTimeout(mobwrite.syncKill_, mobwrite.timeoutInterval);

  // Issue Ajax post of client-side changes and request server-side changes.
  data = 'q=' + encodeURIComponent(data);
  mobwrite.syncAjaxObj_ = mobwrite.syncLoadAjax_(mobwrite.syncGateway, data,
      mobwrite.syncCheckAjax_);
  // Execution will resume in either syncCheckAjax_(), or syncKill_()
};


/**
 * Parse all server-side changes and distribute them to the shared objects.
 * @param {string} text Raw content from server.
 * @private
 */
mobwrite.syncRun2_ = function(text) {
  // Initialize serverChange_, to be checked at the end of syncRun2_.
  mobwrite.serverChange_ = false;
  if (mobwrite.debug) {
    console.info('FROM server:\n' + text);
  }
  // There must be a newline followed by a blank line.
  if (text.length < 2 || text.substring(text.length - 2) != '\n\n') {
    text = '';
    if (mobwrite.debug) {
      console.info('Truncated data.  Abort.');
    }
  }
  var lines = text.split('\n');
  var file = null;
  var clientVersion = null;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line) {
      // Terminate on blank line.
      break;
    }
    // Divide each line into 'N:value' pairs.
    if (line.charAt(1) != ':') {
      if (mobwrite.debug) {
        console.error('Unparsable line: ' + line);
      }
      continue;
    }
    var name = line.charAt(0);
    var value = line.substring(2);

    // Parse out a version number for file, delta or raw.
    var version;
    if ('FfDdRr'.indexOf(name) != -1) {
      var div = value.indexOf(':');
      if (div < 1) {
        if (mobwrite.debug) {
          console.error('No version number: ' + line);
        }
        continue;
      }
      version = parseInt(value.substring(0, div), 10);
      if (isNaN(version)) {
        if (mobwrite.debug) {
          console.error('NaN version number: ' + line);
        }
        continue;
      }
      value = value.substring(div + 1);
    }
    if (name == 'F' || name == 'f') {
      // File indicates which shared object following delta/raw applies to.
      if (value.substring(0, mobwrite.idPrefix.length) == mobwrite.idPrefix) {
        // Trim off the ID prefix.
        value = value.substring(mobwrite.idPrefix.length);
      } else {
        // This file does not have our ID prefix.
        file = null;
        if (mobwrite.debug) {
          console.error('File does not have "' + mobwrite.idPrefix +
              '" prefix: ' + value);
        }
        continue;
      }
      if (mobwrite.shared[value]) {
        file = mobwrite.shared[value];
        file.deltaOk = true;
        clientVersion = version;
        // Remove any elements from the edit stack with low version numbers
        // which have been acked by the server.
        for (var j = 0; j < file.editStack.length; j++) {
          if (file.editStack[j][0] <= clientVersion) {
            file.editStack.splice(j, 1);
            j--;
          }
        }

      } else {
        // This file does not map to a currently shared object.
        file = null;
        if (mobwrite.debug) {
          console.error('Unknown file: ' + value);
        }
      }
    } else if (name == 'R' || name == 'r') {
      // The server reports it was unable to integrate the previous delta.
      if (file) {
        file.shadowText = decodeURI(value);
        file.clientVersion = clientVersion;
        file.serverVersion = version;
        file.editStack = [];
        if (name == 'R') {
          // Accept the server's raw text dump and wipe out any user's changes.
          file.setClientText(file.shadowText);
        }
        // Server-side activity.
        mobwrite.serverChange_ = true;
      }
    } else if (name == 'D' || name == 'd') {
      // The server offers a compressed delta of changes to be applied.
      if (file) {
        if (clientVersion != file.clientVersion) {
          // Can't apply a delta on a mismatched shadow version.
          file.deltaOk = false;
          if (mobwrite.debug) {
            console.error('Client version number mismatch.\n' +
                'Expected: ' + file.clientVersion + ' Got: ' + clientVersion);
          }
        } else if (version > file.serverVersion) {
          // Server has a version in the future?
          file.deltaOk = false;
          if (mobwrite.debug) {
            console.error('Server version in future.\n' +
                'Expected: ' + file.serverVersion + ' Got: ' + version);
          }
        } else if (version < file.serverVersion) {
          // We've already seen this diff.
          if (mobwrite.debug) {
            console.warn('Server version in past.\n' +
                'Expected: ' + file.serverVersion + ' Got: ' + version);
          }
        } else {
          // Expand the delta into a diff using the client shadow.
          var diffs;
          try {
            diffs = file.dmp.diff_fromDelta(file.shadowText, value);
            file.serverVersion++;
          } catch (ex) {
            // The delta the server supplied does not fit on our copy of
            // shadowText.
            diffs = null;
            // Set deltaOk to false so that on the next sync we send
            // a complete dump to get back in sync.
            file.deltaOk = false;
            // Do the next sync soon because the user will lose any changes.
            mobwrite.syncInterval = 0;
            if (mobwrite.debug) {
              console.error('Delta mismatch.\n' + encodeURI(file.shadowText));
            }
          }
          if (diffs && (diffs.length != 1 || diffs[0][0] != DIFF_EQUAL)) {
            // Compute and apply the patches.
            if (name == 'D') {
              // Overwrite text.
              file.shadowText = file.dmp.diff_text2(diffs);
              file.setClientText(file.shadowText);
            } else {
              // Merge text.
              var patches = file.dmp.patch_make(file.shadowText, diffs);
              // First shadowText.  Should be guaranteed to work.
              var serverResult = file.dmp.patch_apply(patches, file.shadowText);
              file.shadowText = serverResult[0];
              // Second the user's text.
              file.patchClientText(patches);
            }
            // Server-side activity.
            mobwrite.serverChange_ = true;
          }
        }
      }
    }
  }

  mobwrite.computeSyncInterval_();

  // Ensure that there is only one sync task.
  clearTimeout(mobwrite.syncRunPid_);
  // Schedule the next sync.
  mobwrite.syncRunPid_ =
      setTimeout(mobwrite.syncRun1_, mobwrite.syncInterval);
  // Terminate the watchdog task, everything's ok.
  clearTimeout(mobwrite.syncKillPid_);
  mobwrite.syncKillPid_ = null;
};


/**
 * Compute how long to wait until next synchronization.
 * @private
 */
mobwrite.computeSyncInterval_ = function() {
  var range = mobwrite.maxSyncInterval - mobwrite.minSyncInterval;
  if (mobwrite.clientChange_) {
    // Client-side activity.
    // Cut the sync interval by 40% of the min-max range.
    mobwrite.syncInterval -= range * 0.4;
  }
  if (mobwrite.serverChange_) {
    // Server-side activity.
    // Cut the sync interval by 20% of the min-max range.
    mobwrite.syncInterval -= range * 0.2;
  }
  if (!mobwrite.clientChange_ && !mobwrite.serverChange_) {
    // No activity.
    // Let the sync interval creep up by 10% of the min-max range.
    mobwrite.syncInterval += range * 0.1;
  }
  // Keep the sync interval constrained between min and max.
  mobwrite.syncInterval =
      Math.max(mobwrite.minSyncInterval, mobwrite.syncInterval);
  mobwrite.syncInterval =
      Math.min(mobwrite.maxSyncInterval, mobwrite.syncInterval);
};


/**
 * If the Ajax call doesn't complete after a timeout period, start over.
 * @private
 */
mobwrite.syncKill_ = function() {
  mobwrite.syncKillPid_ = null;
  if (mobwrite.syncAjaxObj_) {
    // Cleanup old Ajax connection.
    mobwrite.syncAjaxObj_.abort();
    mobwrite.syncAjaxObj_ = null;
  }
  if (mobwrite.debug) {
    console.warn('Connection timeout.');
  }
  clearTimeout(mobwrite.syncRunPid_);
  // Initiate a new sync right now.
  mobwrite.syncRunPid_ = setTimeout(mobwrite.syncRun1_, 1);
};


/**
 * Initiate an Ajax network connection.
 * @param {string} url Location to send request.
 * @param {string} post Data to be sent.
 * @param {Function} callback Function to be called when response arrives.
 * @return {!Object} New Ajax object.
 * @private
 */
mobwrite.syncLoadAjax_ = function(url, post, callback) {
  var req = new XMLHttpRequest();
  req.onload = callback;
  req.open('POST', url, true);
  req.withCredentials = true;
  req.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
  req.send(post);
  return req;
};


/**
 * Callback function for Ajax request.  Checks network response was ok,
 * then calls mobwrite.syncRun2_.
 * @private
 */
mobwrite.syncCheckAjax_ = function() {
  if (typeof mobwrite == 'undefined' || !mobwrite.syncAjaxObj_) {
    // This might be a callback after the page has unloaded,
    // or this might be a callback which we deemed to have timed out.
    return;
  }
  // Only if "OK"
  if (mobwrite.syncAjaxObj_.status === 200) {
    var text = mobwrite.syncAjaxObj_.responseText;
    mobwrite.syncAjaxObj_ = null;
    mobwrite.syncRun2_(text);
  } else if (mobwrite.syncAjaxObj_.status === 410) {
    // Required cookie not found.  Stop sharing.
    console.warn('410: Required cookie not found');
    for (var file in mobwrite.shared) {
      delete mobwrite.shared[file];
    }
  } else {
    if (mobwrite.debug) {
      console.warn('Connection error code: ' + mobwrite.syncAjaxObj_.status);
    }
    mobwrite.syncAjaxObj_ = null;
  }
};


/**
 * When unloading, run a sync one last time.
 * @private
 */
mobwrite.unload_ = function() {
  if (!mobwrite.syncKillPid_) {
    // Turn off debug mode since the console disappears on page unload before
    // this code does.
    mobwrite.debug = false;
    mobwrite.syncRun1_();
  }
  // By the time the callback runs mobwrite.syncRun2_, this page will probably
  // be gone.  But that's ok, we are just sending our last changes out, we
  // don't care what the server says.
};


// Attach unload event to
addEventListener('unload', mobwrite.unload_, false);


/**
 * Start sharing the specified object(s).
 * @param {*} var_args Object(s) or ID(s) of object(s) to share.
 */
mobwrite.share = function(var_args) {
  for (var i = 0; i < arguments.length; i++) {
    var el = arguments[i];
    var result = null;
    // Ask every registered handler if it knows what to do with this object.
    for (var j = 0; j < mobwrite.shareHandlers.length && !result; j++) {
      result = mobwrite.shareHandlers[j].call(mobwrite, el);
    }
    if (result && result.file) {
      if (!result.file.match(/^[-.~!$&\'()*+,;=?\/\w]*$/)) {
        if (mobwrite.debug) {
          console.error('Illegal id "' + result.file + '".');
        }
        continue;
      }
      if (result.file in mobwrite.shared) {
        // Already exists.
        // Don't replace, since we don't want to lose state.
        if (mobwrite.debug) {
          console.warn('Ignoring duplicate share on "' + el + '".');
        }
        continue;
      }
      mobwrite.shared[result.file] = result;

      if (mobwrite.syncRunPid_ === null) {
        // Startup the main task if it doesn't already exist.
        if (mobwrite.debug) {
          console.info('MobWrite task started.');
        }
      } else {
        // Bring sync forward in time.
        clearTimeout(mobwrite.syncRunPid_);
      }
      mobwrite.syncRunPid_ = setTimeout(mobwrite.syncRun1_, 10);
    } else {
      if (mobwrite.debug) {
        console.warn('Share: Unknown widget type: ' + el + '.');
      }
    }
  }
};


/**
 * Stop sharing the specified object(s).
 * Does not handle forms recursively.
 * @param {*} var_args Object(s) or ID(s) of object(s) to unshare.
 */
mobwrite.unshare = function(var_args) {
  for (var i = 0; i < arguments.length; i++) {
    var el = arguments[i];
    if (typeof el == 'string' && mobwrite.shared[el]) {
      delete mobwrite.shared[el];
      if (mobwrite.debug) {
        console.info('Unshared: ' + el);
      }
    } else {
      // Pretend to want to share this object, acquire a new shareObj, then use
      // its ID to locate and kill the existing shareObj that's already shared.
      var result = null;
      // Ask every registered handler if it knows what to do with this object.
      for (var j = 0; j < mobwrite.shareHandlers.length && !result; j++) {
        result = mobwrite.shareHandlers[j].call(mobwrite, el);
      }
      if (result && result.file) {
        if (mobwrite.shared[result.file]) {
          delete mobwrite.shared[result.file];
          if (mobwrite.debug) {
            console.info('Unshared: ' + el);
          }
        } else {
          if (mobwrite.debug) {
            console.warn('Ignoring ' + el + '. Not currently shared.');
          }
        }
      } else {
        if (mobwrite.debug) {
          console.warn('Unshare: Unknown widget type: ' + el + '.');
        }
      }
    }
  }
};
