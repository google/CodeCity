/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Code City's client.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

var CCC = {};

/**
 * Smallest interval in milliseconds between pings.
 * @constant
 */
CCC.MIN_PING_INTERVAL = 1000;

/**
 * Largest interval in milliseconds between pings.
 * @constant
 */
CCC.MAX_PING_INTERVAL = 4000;

/**
 * Maximum number of commands saved in history.
 * @constant
 */
CCC.MAX_HISTORY_SIZE = 1000;

/**
 * Location to send pings to.
 * @constant
 */
CCC.PING_URL = 'ping';

// Properties below this point are not configurable.

/**
 * All the commands the user has sent.
 */
CCC.commandHistory = [];

/**
 * When browsing the command history, save the current command here.
 */
CCC.commandTemp = '';

/**
 * Where in the command history are we browsing?
 */
CCC.commandHistoryPointer = -1;

/**
 * When was the last time we saw the user?
 * @type {number}
 */
CCC.lastActiveTime = Date.now();

/**
 * Number of lines we think the user has not seen.
 */
CCC.unreadLines = 0;

/**
 * The index number of the most recent command added to the command buffer.
 */
CCC.commandNum = 0;

/**
 * Buffer of commands being sent, awaiting acks from server.
 */
CCC.commandBuffer = [];

/**
 * Bit to switch off local echo when typing passwords.
 */
CCC.localEcho = true;

/**
 * The index number of the most recent memo received from the server.
 */
CCC.memoNum = 0;

/**
 * Number of calls to countdown required before launching.
 */
CCC.countdownValue = 3;

/**
 * XMLHttpRequest currently in flight, or null.
 * @type {XMLHttpRequest}
 */
CCC.xhrObject = null;

/**
 * Current length of time between pings.
 */
CCC.pingInterval = CCC.MIN_PING_INTERVAL;

/**
 * Process ID of next ping to the server.
 */
CCC.nextPingPid = -1;

/**
 * Flag for only acknowledging new memos after a new memo has arrived.
 * Saves bandwidth.
 */
CCC.ackMemoNextPing = true;

/**
 * Buffer to accumulate incoming messages when paused.
 */
CCC.pauseBuffer = null;

/**
 * Number of consecutive ping errors that have occurred.
 */
CCC.xhrErrorCounter = 0;

/**
 * Sequence of possible connection states.
 * @enum {number}
 */
CCC.ConnectionStates = {
  NEVER_CONNECTED: 0,
  CONNECTED: 1,
  DISCONNECTED: 2
};

/**
 * Is the client currently connected to the server?
 * @type {CCC.ConnectionStates}
 */
CCC.connectionState = CCC.ConnectionStates.NEVER_CONNECTED;

/**
 * Enum for message types to the log/world frames.
 * Should be identical to CCC.Common.MessageTypes
 * @enum {string}
 */
CCC.MessageTypes = {
  // Messages that may be paused:
  COMMAND: 'command',  // User-generated command echoed.
  MEMO: 'memo',  // Block of text from Code City.
  CONNECT_MSG: 'connect msg',  // User-visible connection message.
  DISCONNECT_MSG: 'disconnect msg',  // User-visible disconnection message.
  // Messages that may be sent while paused:
  CONNECTION: 'connection',  // Signal change of connection state.
  CLEAR: 'clear',  // Signal to clear history.
  BLUR: 'blur'  // Signal to close pop-up menus.
};

/**
 * Unique queue ID.  Identifies this client to the connectServer across
 * polling connections.  Set by the server at startup.
 * @private
 */
CCC.queueId_ = SESSION_ID;

/**
 * After every iframe has reported ready, call the initialization.
 */
CCC.countdown = function() {
  CCC.countdownValue--;
  if (!CCC.countdownValue) {
    CCC.init();
  }
};

/**
 * Initialization code called on startup.
 */
CCC.init = function() {
  CCC.worldFrame = document.getElementById('worldFrame');
  CCC.logFrame = document.getElementById('logFrame');
  CCC.displayCell = document.getElementById('displayCell');
  CCC.commandTextarea = document.getElementById('commandTextarea');

  // When the user closes the tab/window, tell connect server to logout.
  window.addEventListener('unload', function() {
    CCC.abortPing();
    clearTimeout(CCC.nextPingPid);
    var sendingJson = {
      'q': CCC.queueId_,
      'logout': true
    };
    navigator.sendBeacon(CCC.PING_URL, JSON.stringify(sendingJson));
  }, false);

  // When focus returns to this frame from an iframe, go to the command area.
  // This happens whenever a command link is clicked in an iframe.
  window.addEventListener('focus', function() {
    CCC.commandTextarea.focus();
  }, false);
  window.addEventListener('resize', CCC.resize, false);
  // Firefox needs a 0ms delay before first resize, Chrome does not care.
  setTimeout(CCC.resize, 0);

  CCC.commandTextarea.addEventListener('keydown', CCC.keydown, false);
  CCC.commandTextarea.addEventListener('click', CCC.userActive, false);
  CCC.commandTextarea.value = '';

  // Restore command history from sessionStorage.
  var sessionHistory = sessionStorage.getItem('commandHistory');
  if (sessionHistory) {
    CCC.commandHistory = JSON.parse(sessionHistory);
  }

  var clearButton = document.getElementById('clearButton');
  clearButton.addEventListener('click', CCC.clear, false);
  var pauseButton = document.getElementById('pauseButton');
  pauseButton.addEventListener('click', CCC.pause, false);
  var worldButton = document.getElementById('worldButton');
  worldButton.addEventListener('click', CCC.tab.bind(null, 'world'), false);
  var logButton = document.getElementById('logButton');
  logButton.addEventListener('click', CCC.tab.bind(null, 'log'), false);
  document.body.addEventListener('click', function() {
    CCC.postToAllFrames({'mode': 'blur'});
  }, true);
  CCC.tab();
  CCC.schedulePing(0);
  // Firefox sometimes caches the disabled value on reload.
  CCC.commandTextarea.disabled = false;
};

/**
 * Switch between world and log views.
 * @param {string=} mode Either 'world' or 'log', or undefined.
 */
CCC.tab = function(mode) {
  if (!mode) {
    // Check for a cookie preference.
    var m = document.cookie.match(/(?:^|;\s*)TAB=(\w+)(?:;|$)/);
    mode = m ? m[1] : 'world';
  }
  CCC.userActive();
  var worldButton = document.getElementById('worldButton');
  var logButton = document.getElementById('logButton');
  if (mode === 'world') {
    CCC.worldFrame.style.zIndex = 1;
    CCC.logFrame.style.zIndex = -1;
    CCC.commandTextarea.style.fontFamily = '"Patrick Hand", "Comic Sans MS"';
    worldButton.classList.add('jfk-checked');
    logButton.classList.remove('jfk-checked');
  } else {
    CCC.logFrame.style.zIndex = 1;
    CCC.worldFrame.style.zIndex = -1;
    CCC.commandTextarea.style.fontFamily = '"Roboto Mono", monospace';
    worldButton.classList.remove('jfk-checked');
    logButton.classList.add('jfk-checked');
  }
  // Set a session cookie to preserve this setting.
  document.cookie = 'TAB=' + mode;
  CCC.commandTextarea.focus();
};

/**
 * Clear all history.
 */
CCC.clear = function() {
  CCC.userActive();
  CCC.commandHistory.length = 0;
  CCC.commandTemp = '';
  CCC.commandHistoryPointer = -1;
  sessionStorage.removeItem('commandHistory');
  if (CCC.pauseBuffer) {
    var datum;
    while ((datum = CCC.pauseBuffer[0]) &&
           datum[0] !== CCC.MessageTypes.DISCONNECT_MSG) {
      CCC.pauseBuffer.shift();
    }
    // Clear the date/time on the 'Reconnect?' line (if it exists).
    if (datum) {
      datum[1] = '...';
    }
  }
  CCC.postToAllFrames({'mode': 'clear'});
  CCC.commandTextarea.focus();
};

/**
 * Toggle pausing of incoming messages.
 */
CCC.pause = function() {
  CCC.userActive();
  var paused = CCC.pauseBuffer === null;
  var pauseButton = document.getElementById('pauseButton');
  var pauseIcon = document.getElementById('pauseIcon');
  var playIcon = document.getElementById('playIcon');
  if (paused) {
    document.body.classList.add('paused');
    pauseButton.classList.add('jfk-button-action');
    pauseIcon.style.display = 'none';
    playIcon.style.display = '';
    // Initialize the pause buffer.
    CCC.pauseBuffer = [];
  } else {
    document.body.classList.remove('paused');
    pauseButton.classList.remove('jfk-button-action');
    pauseIcon.style.display = '';
    playIcon.style.display = 'none';
    // Fire off all accumulated messages.
    var buffer = CCC.pauseBuffer;
    CCC.pauseBuffer = null;
    for (var args of buffer) {
      CCC.distributeMessage.apply(null, args);
    }
  }
  CCC.commandTextarea.focus();
};

/**
 * Reposition the iframes over the placeholder displayCell.
 * Called when the window changes size.
 */
CCC.resize = function() {
  // Compute the absolute coordinates and dimensions of displayCell.
  var element = CCC.displayCell;
  var x = 0;
  var y = 0;
  do {
    x += element.offsetLeft;
    y += element.offsetTop;
    element = element.offsetParent;
  } while (element);
  // Position both iframes over displayCell.
  CCC.worldFrame.style.left = x + 'px';
  CCC.worldFrame.style.top = y + 'px';
  CCC.worldFrame.style.width = CCC.displayCell.offsetWidth + 'px';
  CCC.worldFrame.style.height = CCC.displayCell.offsetHeight + 'px';
  CCC.logFrame.style.left = x + 'px';
  CCC.logFrame.style.top = y + 'px';
  CCC.logFrame.style.width = CCC.displayCell.offsetWidth + 'px';
  CCC.logFrame.style.height = CCC.displayCell.offsetHeight + 'px';
};

/**
 * Receive messages from our child frames.
 * @param {!Event} e Incoming message event.
 */
CCC.receiveMessage = function(e) {
  var origin = e.origin || e.originalEvent.origin;
  if (origin !== location.origin) {
    console.error('Message received by client frame from unknown origin: ' +
                  origin);
    return;
  }
  if (!e.data) {
    // Shouldn't happen, but harmless.
  } else if (e.data === 'init') {
    // A frame is notifying us that it has fully loaded.
    CCC.countdown();
  } else if (e.data['commands'] && e.data['commands'].length) {
    // User has clicked a command link or command menu.
    for (var command of e.data['commands']) {
      CCC.sendCommand(command, true);
    }
  } else {
    console.log('Unknown message received by client frame: ' + e.data);
  }
};

/**
 * Distribute a line of text to all frames.  If paused, hold this message back.
 * @param {!CCC.MessageTypes} mode Message type.
 * @param {string} text Text to or from Code City.
 */
CCC.distributeMessage = function(mode, text) {
  if (CCC.pauseBuffer) {
    CCC.pauseBuffer.push(arguments);
    return;
  }
  CCC.postToAllFrames({'mode': mode, 'text': text});
};

/**
 * Distribute an encoded message to all sub-frames.
 * @param {!Object} json Encoded message.
 */
CCC.postToAllFrames = function(json) {
  CCC.worldFrame.contentWindow.postMessage(json, location.origin);
  CCC.logFrame.contentWindow.postMessage(json, location.origin);
};

/**
 * Add one command to the outbound queue.
 * @param {string} commands Text of user's command.  May be more than one line.
 * @param {boolean} echo True if command to be saved in history.
 */
CCC.sendCommand = function(commands, echo) {
  CCC.userActive();
  commands = commands.split('\n');
  // A blank line at the end of a multi-line command is usually accidental.
  if (commands.length > 1 && !commands[commands.length - 1]) {
    commands.pop();
  }
  for (var command of commands) {
    // Add command to list of commands to send to server.
    CCC.commandBuffer.push(command + '\n');
    CCC.commandNum++;
    // Add command to history.
    if (echo) {
      if (!CCC.commandHistory.length ||
          CCC.commandHistory[CCC.commandHistory.length - 1] !== command) {
        CCC.commandHistory.push(command);
      }
    }
    while (CCC.commandHistory.length > CCC.MAX_HISTORY_SIZE) {
      CCC.commandHistory.shift();
    }
    // Echo command onscreen.
    if (echo) {
      CCC.distributeMessage(CCC.MessageTypes.COMMAND, command);
    }
  }
  CCC.commandTemp = '';
  CCC.commandHistoryPointer = -1;
  sessionStorage.setItem('commandHistory', JSON.stringify(CCC.commandHistory));
  // User is sending command, reset the ping to be frequent.
  CCC.pingInterval = CCC.MIN_PING_INTERVAL;
  CCC.abortPing();
  CCC.doPing();
};

/**
 * Interrupt any in-flight ping.
 */
CCC.abortPing = function() {
  if (CCC.xhrObject) {
    CCC.xhrObject.abort();
    CCC.xhrObject = null;
  }
};

/**
 * Initiate an XHR network connection.
 */
CCC.doPing = function() {
  if (CCC.xhrObject) {
    // Another ping is currently in progress.
    return;
  }
  // Next ping will be scheduled when this ping completes,
  // but schedule a contingency ping in case of some thrown error.
  CCC.schedulePing(CCC.MAX_PING_INTERVAL + 1);

  var sendingJson = {
    'q': CCC.queueId_
  };
  if (CCC.ackMemoNextPing) {
    sendingJson['ackMemoNum'] = CCC.memoNum;
  }
  if (CCC.commandBuffer.length) {
    sendingJson['cmdNum'] = CCC.commandNum;
    sendingJson['cmds'] = CCC.commandBuffer;
  }

  // XMLHttpRequest with timeout works in IE8 or better.
  var req = new XMLHttpRequest();
  req.onload = CCC.xhrLoaded;
  req.ontimeout = CCC.xhrError;
  req.onerror = CCC.xhrError;
  req.open('POST', CCC.PING_URL, true);
  req.timeout = CCC.MAX_PING_INTERVAL;  // Time in milliseconds.
  req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  req.send(JSON.stringify(sendingJson));
  CCC.xhrObject = req;
  // Let the ping interval creep up.
  CCC.pingInterval = Math.min(CCC.MAX_PING_INTERVAL, CCC.pingInterval * 1.1);
};

/**
 * Error handler for XHR request.
 * @this {!XMLHttpRequest}
 */
CCC.xhrError = function() {
  CCC.xhrErrorCounter++;
  console.warn('Connection error: ' + CCC.xhrErrorCounter);
  CCC.xhrObject = null;
  if (CCC.xhrErrorCounter >= 8) {
    // Too many errors.  Drop the connection.
    CCC.terminate();
    return;
  } else {
    CCC.schedulePing(CCC.pingInterval);
  }
};

/**
 * Callback function for XHR request.
 * Check network response was ok, then call CCC.parse.
 * @this {!XMLHttpRequest}
 */
CCC.xhrLoaded = function() {
  CCC.xhrObject = null;
  // Only if "OK".
  if (this.status === 200) {
    try {
      var json = JSON.parse(this.responseText);
    } catch (e) {
      console.warn('Invalid JSON: ' + this.responseText);
      CCC.xhrError();
      return;
    }
    CCC.xhrErrorCounter = 0;
    CCC.parse(json);
  } else if (this.status === 410) {
    console.warn('Session closed.');
    CCC.terminate();
    return;
  } else if (this.status) {
    console.warn('Connection error code: ' + this.status);
    CCC.xhrError();
    return;
  }
  CCC.schedulePing(CCC.pingInterval);
};

/**
 * Received an error from the server, indicating that our connection is closed.
 */
CCC.terminate = function() {
  CCC.connectionState = CCC.ConnectionStates.DISCONNECTED;
  clearTimeout(CCC.nextPingPid);
  // Send immediate signal to enter readonly-mode for all frames.
  CCC.postToAllFrames({'mode': CCC.MessageTypes.CONNECTION, 'state': false});
  // Send user-visible message (which might be delayed due to pause).
  CCC.distributeMessage(CCC.MessageTypes.DISCONNECT_MSG,
                        CCC.currentDateString());
};

/**
 * Parse the response from the server.
 * @param {!Object} receivedJson Server data.
 */
CCC.parse = function(receivedJson) {
  if (CCC.connectionState === CCC.ConnectionStates.DISCONNECTED) {
    throw new Error('JSON received after disconnection: ' + receivedJson);
  } else if (CCC.connectionState === CCC.ConnectionStates.NEVER_CONNECTED) {
    CCC.postToAllFrames({'mode': CCC.MessageTypes.CONNECTION, 'state': true});
    CCC.distributeMessage(CCC.MessageTypes.CONNECT_MSG,
                          CCC.currentDateString());
    CCC.connectionState = CCC.ConnectionStates.CONNECTED;
  }
  var ackCmdNum = receivedJson['ackCmdNum'];
  var memoNum = receivedJson['memoNum'];
  var memos = receivedJson['memos'];

  if (typeof ackCmdNum === 'number') {
    if (ackCmdNum > CCC.commandNum) {
      console.error('Server acks ' + ackCmdNum +
                    ', but CCC.commandNum is only ' + CCC.commandNum);
      CCC.terminate();
    }
    // Server acknowledges receipt of commands.
    // Remove them from the output list.
    CCC.commandBuffer.splice(0,
        CCC.commandBuffer.length + ackCmdNum - CCC.commandNum);
  }

  if (typeof memoNum === 'number') {
    // Server sent messages.  Increase client's index for acknowledgment.
    var currentIndex = memoNum - memos.length + 1;
    for (var memo of memos) {
      if (currentIndex > CCC.memoNum) {
        CCC.memoNum = currentIndex;
        CCC.distributeMessage(CCC.MessageTypes.MEMO, memo);
        // Reduce ping interval.
        CCC.pingInterval =
            Math.max(CCC.MIN_PING_INTERVAL, CCC.pingInterval * 0.8);
      }
      currentIndex++;
    }
    CCC.setUnreadLines(CCC.unreadLines + memos.length);
    CCC.ackMemoNextPing = true;
  } else {
    CCC.ackMemoNextPing = false;
  }
};

/**
 * Schedule the next ping.
 * @param {number} ms Milliseconds.
 */
CCC.schedulePing = function(ms) {
  clearTimeout(CCC.nextPingPid);
  CCC.nextPingPid = setTimeout(CCC.doPing, ms);
};

/**
 * Monitor the user's keystrokes in the command text area.
 * @param {!Event} e Keydown event.
 */
CCC.keydown = function(e) {
  CCC.userActive();
  if (!e.shiftKey && e.key === 'Enter') {
    // Enter
    if (CCC.connectionState === CCC.ConnectionStates.CONNECTED) {
      CCC.sendCommand(CCC.commandTextarea.value, CCC.localEcho);
      // Clear the textarea.
      CCC.commandTextarea.value = '';
      CCC.commandHistoryPointer = -1;
      CCC.commandTemp = '';
    } else {
      // Pulse the command text area to indicate disconnection.
      CCC.commandTextarea.style.transition = '';
      CCC.commandTextarea.style.backgroundColor = '#f88';
      // Wait 0.1 seconds for the browser to process the above style changes.
      setTimeout(function() {
        CCC.commandTextarea.style.transition = 'background-color 1s';
        CCC.commandTextarea.style.backgroundColor = '';
      }, 100);
    }
    e.preventDefault();  // Don't add an enter after the clear.
  } else if ((!e.shiftKey && e.key === 'ArrowUp') ||
             (e.ctrlKey && e.key === 'p')) {
    // Up or Ctrl-P
    if (!CCC.commandHistory.length) {
      return;
    }
    if (CCC.commandHistoryPointer === -1) {
      CCC.commandTemp = CCC.commandTextarea.value;
      CCC.commandHistoryPointer = CCC.commandHistory.length - 1;
      CCC.commandTextarea.value = CCC.commandHistory[CCC.commandHistoryPointer];
    } else if (CCC.commandHistoryPointer > 0) {
      CCC.commandHistoryPointer--;
      CCC.commandTextarea.value = CCC.commandHistory[CCC.commandHistoryPointer];
    }
    e.preventDefault();  // Don't move the cursor to start after change.
  } else if ((!e.shiftKey && e.key === 'ArrowDown') ||
             (e.ctrlKey && e.key === 'n')) {
    // Down or Ctrl-N
    if (!CCC.commandHistory.length) {
      return;
    }
    if (CCC.commandHistoryPointer === CCC.commandHistory.length - 1) {
      CCC.commandHistoryPointer = -1;
      CCC.commandTextarea.value = CCC.commandTemp;
      CCC.commandTemp = '';
    } else if (CCC.commandHistoryPointer >= 0) {
      CCC.commandHistoryPointer++;
      CCC.commandTextarea.value = CCC.commandHistory[CCC.commandHistoryPointer];
    }
  } else if (e.key === 'Tab') {
    // Tab
    e.preventDefault();  // Don't change the focus.
    if (!CCC.commandHistory.length) {
      return;
    }
    var chp = CCC.commandHistoryPointer;
    if (chp === -1) {  // Save the current value.
      CCC.commandTemp = CCC.commandTextarea.value;
    }
    var reverse = e.shiftKey;
    for (var i = 0; i <= CCC.commandHistory.length; i++) {
      // Loop through the entire history, and the current value.
      chp += reverse ? 1 : -1;
      if (chp < -1) {  // Wrap up.
        chp = CCC.commandHistory.length - 1;
      } else if (chp >= CCC.commandHistory.length) {  // Wrap down.
        chp = -1;
      }
      if (chp === -1) {
        // The current value is always a match.
        CCC.commandHistoryPointer = -1;
        CCC.commandTextarea.value = CCC.commandTemp;
        CCC.commandTemp = '';
        break;
      } else if (CCC.commandHistory[chp].toLowerCase()
                 .startsWith(CCC.commandTemp.toLowerCase())) {
        CCC.commandHistoryPointer = chp;
        CCC.commandTextarea.value = CCC.commandHistory[chp];
        break;
      }
    }
  } else if (e.key.length === 1) {
    CCC.commandHistoryPointer = -1;
    CCC.commandTemp = '';
  }
  // Delete the placeholder text as soon as the user types anything.
  CCC.commandTextarea.placeholder = '';
};

/**
 * The user is active.
 * Reset the last active time, and clear the notification of unread lines.
 */
CCC.userActive = function() {
  CCC.lastActiveTime = Date.now();
  CCC.setUnreadLines(0);
};

/**
 * Change the number of unread lines, as notified in the title.
 * @param {number} n Number of unread lines.
 */
CCC.setUnreadLines = function(n) {
  CCC.unreadLines = n;
  var title = document.title;
  // Strip off old number.
  title = title.replace(/ \(\d+\)$/, '');
  // Add new number if user hasn't been seen in 10 seconds.
  if (n && CCC.lastActiveTime + 10000 < Date.now()) {
    title += ' (' + n + ')';
  }
  document.title = title;
};

/**
 * Return a local date/time in 'yyyy-mm-dd hh:mm:ss' format.
 * @return {string} Current date/time.
 */
CCC.currentDateString = function() {
  var now = new Date();
  var dy = now.getFullYear();
  var dm = ('0' + (now.getMonth() + 1)).slice(-2);
  var dd = ('0' + now.getDate()).slice(-2);
  var th = ('0' + now.getHours()).slice(-2);
  var tm = ('0' + now.getMinutes()).slice(-2);
  var ts = ('0' + now.getSeconds()).slice(-2);
  return dy + '-' + dm + '-' + dd + ' ' + th + ':' + tm + ':' + ts;
};

window.addEventListener('message', CCC.receiveMessage, false);
window.addEventListener('load', CCC.countdown, false);
