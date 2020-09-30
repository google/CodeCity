#!/usr/bin/python2

# Copyright 2006 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""This file is MobWrite's server-side daemon.

Runs in the background listening to a port, accepting synchronization sessions
from clients.
"""

__author__ = "fraser@google.com (Neil Fraser)"

import datetime
import glob
import os
import re
import sys
import time
import thread
import urllib
from BaseHTTPServer import BaseHTTPRequestHandler
from BaseHTTPServer import HTTPServer

import mobwrite_core

# Demo usage should limit the maximum number of connected views.
# Set to 0 to disable limit.
MAX_VIEWS = 10000

# Dictionary of all text objects.
texts = {}

# Lock to prevent simultaneous changes to the texts dictionary.
lock_texts = thread.allocate_lock()


class TextObj(mobwrite_core.TextObj):
  # A persistent object which stores a text.

  # Object properties:
  # .lock - Access control for writing to the text on this object.
  # .views - Count of views currently connected to this text.
  # .lasttime - The last time that this text was modified.

  # Inherited properties:
  # .name - The unique name for this text, e.g 'proposal'.
  # .text - The text itself.

  def __init__(self, *args, **kwargs):
    # Setup this object
    mobwrite_core.TextObj.__init__(self, *args, **kwargs)
    self.views = 0
    self.lasttime = datetime.datetime.now()
    self.lock = thread.allocate_lock()

    # lock_texts must be acquired by the caller to prevent simultaneous
    # creations of the same text.
    assert lock_texts.locked(), "Can't create TextObj unless locked."
    global texts
    texts[self.name] = self

  def setText(self, newText):
    mobwrite_core.TextObj.setText(self, newText)
    self.lasttime = datetime.datetime.now()

  def cleanup(self):
    # General cleanup task.
    if self.views > 0:
      return
    terminate = False
    # Lock must be acquired to prevent simultaneous deletions.
    self.lock.acquire()
    try:
      if self.lasttime < datetime.datetime.now() - mobwrite_core.TIMEOUT_TEXT:
        mobwrite_core.LOG.info("Expired text: '%s'" % self)
        terminate = True

      if terminate:
        # Terminate in-memory copy.
        global texts
        lock_texts.acquire()
        try:
          try:
            del texts[self.name]
          except KeyError:
            mobwrite_core.LOG.error("Text object not in text list: '%s'" % self)
        finally:
          lock_texts.release()
    finally:
      self.lock.release()


def fetch_textobj(name, view):
  # Retrieve the named text object.  Create it if it doesn't exist.
  # Add the given view into the text object's list of connected views.
  # Don't let two simultaneous creations happen, or a deletion during a
  # retrieval.
  lock_texts.acquire()
  try:
    if texts.has_key(name):
      textobj = texts[name]
      mobwrite_core.LOG.debug("Accepted text: '%s'" % name)
    else:
      textobj = TextObj(name=name)
      mobwrite_core.LOG.debug("Creating text: '%s'" % name)
    textobj.views += 1
  finally:
    lock_texts.release()
  return textobj


# Dictionary of all view objects.
views = {}

# Lock to prevent simultaneous changes to the views dictionary.
lock_views = thread.allocate_lock()

class ViewObj(mobwrite_core.ViewObj):
  # A persistent object which contains one user's view of one text.

  # Object properties:
  # .lasttime - The last time that a web connection serviced this object.
  # .textobj - The shared text object being worked on.

  # Inherited properties:
  # .username - The name for the user, e.g 'fraser'
  # .filename - The name for the file, e.g 'proposal'
  # .shadow - The last version of the text sent to client.
  # .backup_shadow - The previous version of the text sent to client.
  # .shadow_client_version - The client's version for the shadow (n).
  # .shadow_server_version - The server's version for the shadow (m).
  # .backup_shadow_server_version - the server's version for the backup
  #     shadow (m).
  # .edit_stack - List of unacknowledged edits sent to the client.
  # .delta_ok - Did the previous delta match the text length.

  def __init__(self, *args, **kwargs):
    # Setup this object
    mobwrite_core.ViewObj.__init__(self, *args, **kwargs)
    self.lasttime = datetime.datetime.now()
    self.textobj = fetch_textobj(self.filename, self)

    # lock_views must be acquired by the caller to prevent simultaneous
    # creations of the same view.
    assert lock_views.locked(), "Can't create ViewObj unless locked."
    global views
    views[(self.username, self.filename)] = self

  def cleanup(self):
    # General cleanup task.
    # Delete myself if I've been idle too long.
    # Don't delete during a retrieval.
    lock_views.acquire()
    try:
      if self.lasttime < datetime.datetime.now() - mobwrite_core.TIMEOUT_VIEW:
        mobwrite_core.LOG.info("Idle out: '%s'" % self)
        global views
        try:
          del views[(self.username, self.filename)]
        except KeyError:
          mobwrite_core.LOG.error("View object not in view list: '%s'" % self)
        self.textobj.views -= 1
    finally:
      lock_views.release()

  def nullify(self):
    self.lasttime = datetime.datetime.min
    self.cleanup()


def fetch_viewobj(username, filename):
  # Retrieve the named view object.  Create it if it doesn't exist.
  # Don't let two simultaneous creations happen, or a deletion during a
  # retrieval.
  lock_views.acquire()
  try:
    key = (username, filename)
    if views.has_key(key):
      viewobj = views[key]
      viewobj.lasttime = datetime.datetime.now()
      mobwrite_core.LOG.debug("Accepting view: '%s'" % viewobj)
    else:
      if MAX_VIEWS != 0 and len(views) > MAX_VIEWS:
        viewobj = None
        mobwrite_core.LOG.critical("Overflow: Can't create new view.")
      else:
        viewobj = ViewObj(username=username, filename=filename)
        mobwrite_core.LOG.debug("Creating view: '%s'" % viewobj)
  finally:
    lock_views.release()
  return viewobj


class DaemonMobWrite(BaseHTTPRequestHandler, mobwrite_core.MobWrite):

  def do_POST(self):
    connection_origin = mobwrite_core.CFG.get("CONNECTION_ORIGIN", "")
    if connection_origin and self.client_address[0] != connection_origin:
      raise IOError("Connection refused from %s (only %s allowed)." %
          (self.client_address[0], connection_origin))
    mobwrite_core.LOG.info("Connection accepted from " + self.client_address[0])

    required_cookie = mobwrite_core.CFG.get("REQUIRED_COOKIE", "")
    if required_cookie and (('Cookie' not in self.headers) or
        (not re.search(r'(^|;)\s*%s=\w' % required_cookie, self.headers['Cookie']))):
      self.send_headers(410)
      self.wfile.write("Required cookie not found.\n")
      return

    # Read the POST data.
    content_length = int(self.headers['Content-Length'])
    data = self.rfile.read(content_length)

    div = data.find("q=")
    if div == -1:
      self.send_headers(400)
      self.wfile.write("'q=' parameter not found in data:\n")
      self.wfile.write(data)
      return

    data = data[div + 2:]
    data = urllib.unquote(data)
    self.send_headers(200)
    self.wfile.write(self.handleRequest(data))
    self.wfile.write("\n")  # Terminating blank line.

    # Goodbye
    mobwrite_core.LOG.debug("Disconnecting.")


  def send_headers(self, code):
    origin = self.headers['Origin']
    self.send_response(code)
    self.send_header('Content-type', 'text/plain')
    self.send_header('Access-Control-Allow-Origin', origin)
    self.send_header('Access-Control-Allow-Credentials', 'true')
    self.end_headers()


  def handleRequest(self, text):
    actions = self.parseRequest(text)
    return self.doActions(actions)


  def doActions(self, actions):
    output = []
    viewobj = None
    last_username = None
    last_filename = None

    for action_index in xrange(len(actions)):
      # Use an indexed loop in order to peek ahead one step to detect
      # username/filename boundaries.
      action = actions[action_index]
      username = action["username"]
      filename = action["filename"]

      # Fetch the requested view object.
      if not viewobj:
        viewobj = fetch_viewobj(username, filename)
        if viewobj is None:
          # Too many views connected at once.
          # Send back nothing.  Pretend the return packet was lost.
          return ""
        viewobj.delta_ok = True
        textobj = viewobj.textobj

      if action["mode"] == "null":
        # Nullify the text.
        mobwrite_core.LOG.debug("Nullifying: '%s'" % viewobj)
        textobj.lock.acquire()
        try:
          textobj.setText(None)
        finally:
          textobj.lock.release()
        viewobj.nullify();
        viewobj = None
        continue

      if (action["server_version"] != viewobj.shadow_server_version and
          action["server_version"] == viewobj.backup_shadow_server_version):
        # Client did not receive the last response.  Roll back the shadow.
        mobwrite_core.LOG.warning("Rollback from shadow %d to backup shadow %d" %
            (viewobj.shadow_server_version, viewobj.backup_shadow_server_version))
        viewobj.shadow = viewobj.backup_shadow
        viewobj.shadow_server_version = viewobj.backup_shadow_server_version
        viewobj.edit_stack = []

      # Remove any elements from the edit stack with low version numbers which
      # have been acked by the client.
      x = 0
      while x < len(viewobj.edit_stack):
        if viewobj.edit_stack[x][0] <= action["server_version"]:
          del viewobj.edit_stack[x]
        else:
          x += 1

      if action["mode"] == "raw":
        # It's a raw text dump.
        data = urllib.unquote(action["data"]).decode("utf-8")
        mobwrite_core.LOG.info("Got %db raw text: '%s'" % (len(data), viewobj))
        viewobj.delta_ok = True
        # First, update the client's shadow.
        viewobj.shadow = data
        viewobj.shadow_client_version = action["client_version"]
        viewobj.shadow_server_version = action["server_version"]
        viewobj.backup_shadow = viewobj.shadow
        viewobj.backup_shadow_server_version = viewobj.shadow_server_version
        viewobj.edit_stack = []
        if action["force"] or textobj.text is None:
          # Clobber the server's text.
          textobj.lock.acquire()
          try:
            if textobj.text != data:
              textobj.setText(data)
              mobwrite_core.LOG.debug("Overwrote content: '%s'" % viewobj)
          finally:
            textobj.lock.release()

      elif action["mode"] == "delta":
        # It's a delta.
        mobwrite_core.LOG.info("Got '%s' delta: '%s'" % (action["data"], viewobj))
        if action["server_version"] != viewobj.shadow_server_version:
          # Can't apply a delta on a mismatched shadow version.
          viewobj.delta_ok = False
          mobwrite_core.LOG.warning("Shadow version mismatch: %d != %d" %
              (action["server_version"], viewobj.shadow_server_version))
        elif action["client_version"] > viewobj.shadow_client_version:
          # Client has a version in the future?
          viewobj.delta_ok = False
          mobwrite_core.LOG.warning("Future delta: %d > %d" %
              (action["client_version"], viewobj.shadow_client_version))
        elif action["client_version"] < viewobj.shadow_client_version:
          # We've already seen this diff.
          pass
          mobwrite_core.LOG.warning("Repeated delta: %d < %d" %
              (action["client_version"], viewobj.shadow_client_version))
        else:
          # Expand the delta into a diff using the client shadow.
          try:
            diffs = mobwrite_core.DMP.diff_fromDelta(viewobj.shadow, action["data"])
          except ValueError:
            diffs = None
            viewobj.delta_ok = False
            mobwrite_core.LOG.warning("Delta failure, expected %d length: '%s'" %
                (len(viewobj.shadow), viewobj))
          viewobj.shadow_client_version += 1
          if diffs != None:
            # Textobj lock required for read/patch/write cycle.
            textobj.lock.acquire()
            try:
              self.applyPatches(viewobj, diffs, action)
            finally:
              textobj.lock.release()

      # Generate output if this is the last action or the username/filename
      # will change in the next iteration.
      if ((action_index + 1 == len(actions)) or
          actions[action_index + 1]["username"] != username or
          actions[action_index + 1]["filename"] != filename):
        print_username = None
        print_filename = None
        if action["echo_username"] and last_username != username:
          # Print the username if the previous action was for a different user.
          print_username = username
        if last_filename != filename or last_username != username:
          # Print the filename if the previous action was for a different user
          # or file.
          print_filename = filename
        output.append(self.generateDiffs(viewobj, print_username,
                                         print_filename, action["force"]))
        last_username = username
        last_filename = filename
        # Dereference the view object so that a new one can be created.
        viewobj = None

    return "".join(output)


  def generateDiffs(self, viewobj, print_username, print_filename, force):
    output = []
    if print_username:
      output.append("u:%s\n" %  print_username)
    if print_filename:
      output.append("F:%d:%s\n" % (viewobj.shadow_client_version, print_filename))

    textobj = viewobj.textobj
    mastertext = textobj.text

    if viewobj.delta_ok:
      if mastertext is None:
        mastertext = ""
      # Create the diff between the view's text and the master text.
      diffs = mobwrite_core.DMP.diff_main(viewobj.shadow, mastertext)
      mobwrite_core.DMP.diff_cleanupEfficiency(diffs)
      text = mobwrite_core.DMP.diff_toDelta(diffs)
      if force:
        # Client sending 'D' means number, no error.
        # Client sending 'R' means number, client error.
        # Both cases involve numbers, so send back an overwrite delta.
        viewobj.edit_stack.append((viewobj.shadow_server_version,
            "D:%d:%s\n" % (viewobj.shadow_server_version, text)))
      else:
        # Client sending 'd' means text, no error.
        # Client sending 'r' means text, client error.
        # Both cases involve text, so send back a merge delta.
        viewobj.edit_stack.append((viewobj.shadow_server_version,
            "d:%d:%s\n" % (viewobj.shadow_server_version, text)))
      viewobj.shadow_server_version += 1
      mobwrite_core.LOG.info("Sent '%s' delta: '%s'" % (text, viewobj))
    else:
      # Error; server could not parse client's delta.
      # Send a raw dump of the text.
      viewobj.shadow_client_version += 1
      if mastertext is None:
        mastertext = ""
        viewobj.edit_stack.append((viewobj.shadow_server_version,
            "r:%d:\n" % viewobj.shadow_server_version))
        mobwrite_core.LOG.info("Sent empty raw text: '%s'" % viewobj)
      else:
        # Force overwrite of client.
        text = mastertext
        text = text.encode("utf-8")
        text = urllib.quote(text, "!~*'();/?:@&=+$,# ")
        viewobj.edit_stack.append((viewobj.shadow_server_version,
            "R:%d:%s\n" % (viewobj.shadow_server_version, text)))
        mobwrite_core.LOG.info("Sent %db raw text: '%s'" %
            (len(text), viewobj))

    viewobj.shadow = mastertext

    for edit in viewobj.edit_stack:
      output.append(edit[1])

    return "".join(output)

def cleanup_thread():
  # Every minute cleanup.
  while True:
    mobwrite_core.LOG.info("Running cleanup task.")
    for v in views.values():
      v.cleanup()
    for v in texts.values():
      v.cleanup()

    timeout = datetime.datetime.now() - mobwrite_core.TIMEOUT_TEXT

    time.sleep(60)


def main():
  mobwrite_core.CFG.initConfig("./mobwrite.cfg")
  # Start up a thread that does timeouts and cleanup.
  thread.start_new_thread(cleanup_thread, ())

  port = int(mobwrite_core.CFG.get("LOCAL_PORT", 3017))
  mobwrite_core.LOG.info("Listening on port %d..." % port)
  s = HTTPServer(("", port), DaemonMobWrite)
  try:
    s.serve_forever()
  except KeyboardInterrupt:
    mobwrite_core.LOG.info("Shutting down.")
    s.socket.close()


if __name__ == "__main__":
  mobwrite_core.logging.basicConfig()
  main()
  mobwrite_core.logging.shutdown()
