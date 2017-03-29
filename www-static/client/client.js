/**
 * @license
 * Code City Client
 *
 * Copyright 2017 Google Inc.
 * https://codecity.world/
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
 * @fileoverview Code City's client.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

var CCC = {};

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
CCC.lastactivetime = Date.now();

/**
 * The last command's index number.
 */
CCC.commandindex = 0;

/**
 * Number of lines unread.
 * @type {number}
 * @private
 */
CCC.unreadlines_ = 0;

/**
 * Bit to switch off local echo when typing passwords.
 */
CCC.localecho = true;

/**
 * Maximum number of commands saved in history.
 */
CCC.maxHistorySize = 1000;

/**
 * Number of calls to countdown required before launching.
 * @private
 */
CCC.countdown_ = 2;

/**
 * After every iframe has reported ready, call the initialization.
 */
CCC.countdown = function() {
  CCC.countdown_--;
  if (CCC.countdown_ == 0) {
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
  CCC.commandInput = document.getElementById('commandInput');

  window.addEventListener('resize', CCC.resize, false);
  CCC.resize();

  CCC.commandInput.addEventListener('keydown', CCC.keydown, false);
  CCC.commandInput.value = '';
  CCC.commandInput.focus();

  var worldButton = document.getElementById('worldButton');
  worldButton.addEventListener('click', CCC.tab.bind(null, 'world'), false);
  var logButton = document.getElementById('logButton');
  logButton.addEventListener('click', CCC.tab.bind(null, 'log'), false);
  CCC.tab('log');
};

/**
 * Switch between world and log views.
 * @param {string} mode Either 'world' or 'log'.
 */
CCC.tab = function(mode) {
  if (mode == 'world') {
    CCC.worldFrame.style.zIndex = 1;
    CCC.logFrame.style.zIndex = -1;
  } else {
    CCC.logFrame.style.zIndex = 1;
    CCC.worldFrame.style.zIndex = -1;
  }
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
  if (origin != location.origin) {
    console.error('Message received by client frame from unknown origin: ' +
                  origin);
    return;
  }
  if (e.data == 'initLog') {
    CCC.countdown();
  } else {
    console.log('Unknown message received by client frame: ' + e.data);
  }
};

/**
 * Distribute a line of text to all frames.
 * @param {string} line Text from Code City.
 */
CCC.renderLine = function(line) {
  CCC.logFrame.contentWindow.postMessage({mode: 'message', text: line},
                                         location.origin);
};

/**
 * Distribute a command to all frames.
 * @param {string} line Text from user.
 */
CCC.localEcho = function(line) {
  CCC.logFrame.contentWindow.postMessage({mode: 'command', text: line},
                                         location.origin);
};

/**
 * Add one command to the outbound queue.
 * @param {string} commands Text of user's command.  May be more than one line.
 * @param {boolean} echo True if command to be saved in history.
 */
CCC.sendCommand = function(commands, echo) {
  CCC.lastactivetime = Date.now();
  CCC.setUnreadLines(0);
  commands = commands.split('\n');
  // A blank line at the end of a multi-line command is usually accidental.
  if (commands.length > 1 && !commands[commands.length-1]) {
    commands.pop();
  }
  for (var i = 0; i < commands.length; i++) {
    if (echo) {
      if (!CCC.commandHistory.length ||
          CCC.commandHistory[CCC.commandHistory.length - 1] != commands[i]) {
        CCC.commandHistory.push(commands[i]);
      }
    }
    while (CCC.commandHistory.length > CCC.maxHistorySize) {
      CCC.commandHistory.shift();
    }
    if (echo) {
      CCC.localEcho(commands[i]);
    }
  }
  CCC.commandTemp = '';
  CCC.commandHistoryPointer = -1;
};

/**
 * Monitor the user's keystrokes in the command text area.
 * @param {!Event} e Keydown event.
 */
CCC.keydown = function(e) {
  CCC.lastactivetime = Date.now();
  CCC.setUnreadLines(0);
  if (e.key == 'Enter') {
    // Enter
    CCC.sendCommand(CCC.commandInput.value, CCC.localecho);
    // Clear the textarea.
    CCC.commandInput.value = '';
    CCC.commandHistoryPointer = -1;
    CCC.commandTemp = '';
    e.preventDefault();  // Don't add an enter after the clear.
  } else if ((!e.shiftKey && e.key == 'ArrowUp') ||
             (e.ctrlKey && e.key == 'p')) {
    // Up or Ctrl-P
    if (!CCC.commandHistory.length) {
      return;
    }
    if (CCC.commandHistoryPointer == -1) {
      CCC.commandTemp = CCC.commandInput.value;
      CCC.commandHistoryPointer = CCC.commandHistory.length - 1;
      CCC.commandInput.value = CCC.commandHistory[CCC.commandHistoryPointer];
    } else if (CCC.commandHistoryPointer > 0) {
      CCC.commandHistoryPointer--;
      CCC.commandInput.value = CCC.commandHistory[CCC.commandHistoryPointer];
    }
    e.preventDefault();  // Don't move the cursor to start after change.
  } else if ((!e.shiftKey && e.key == 'ArrowDown') ||
             (e.ctrlKey && e.key == 'n')) {
    // Down or Ctrl-N
    if (!CCC.commandHistory.length) {
      return;
    }
    if (CCC.commandHistoryPointer == CCC.commandHistory.length - 1) {
      CCC.commandHistoryPointer = -1;
      CCC.commandInput.value = CCC.commandTemp;
      CCC.commandTemp = '';
    } else if (CCC.commandHistoryPointer >= 0) {
      CCC.commandHistoryPointer++;
      CCC.commandInput.value = CCC.commandHistory[CCC.commandHistoryPointer];
    }
  } else if (e.key == 'Tab') {
    // Tab
    e.preventDefault();  // Don't change the focus.
    if (!CCC.commandHistory.length) {
      return;
    }
    var chp = CCC.commandHistoryPointer;
    if (chp == -1) {  // Save the current value
      CCC.commandTemp = CCC.commandInput.value;
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
      if (chp == -1) {
        // The current value is always a match.
        CCC.commandHistoryPointer = -1;
        CCC.commandInput.value = CCC.commandTemp;
        CCC.commandTemp = '';
        break;
      } else if (CCC.commandHistory[chp].toLowerCase()
                 .indexOf(CCC.commandTemp.toLowerCase()) == 0) {
        CCC.commandHistoryPointer = chp;
        CCC.commandInput.value = CCC.commandHistory[chp];
        break;
      }
    }
  } else if (e.key.length == 1) {
    CCC.commandHistoryPointer = -1;
    CCC.commandTemp = '';
  }
};

/**
 * Change the number of unread lines, as notified in the title.
 * @param {number} n Number of unread lines.
 */
CCC.setUnreadLines = function(n) {
  CCC.unreadlines_ = n;
  var title = document.title;
  // Strip off old number.
  title = title.replace(/ \(\d+\)$/, '');
  // Add new number.
  if (n) {
    title += ' (' + n + ')';
  }
  document.title = title;
};

window.addEventListener('message', CCC.receiveMessage, false);
window.addEventListener('load', CCC.countdown, false);
